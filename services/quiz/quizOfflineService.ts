import { getDBConnection } from '../storage/db-service';
import { moodleCall } from '../api/moodleClient';
import { getUserAttempts } from '../api/quizService';

const IS_DEV = process.env.NODE_ENV === 'development';

// Au-delà de ce nombre d'échecs, on arrête de réessayer automatiquement la
// sync d'un attempt — évite le retry silencieux infini d'une tentative qui
// ne pourra plus jamais être synchronisée (ex: déjà clôturée côté Moodle).
const MAX_SYNC_RETRIES = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  slot        : number;
  type        : string;   // 'multichoice' | 'truefalse' | 'shortanswer' | 'match' | ...
  html        : string;   // HTML de la question avec CSS inliné
  sequencecheck: number;
  answers?    : { id: number; text: string; fraction?: number }[];
}

export interface QuizCacheEntry {
  cmid         : number;
  quizId       : number;
  courseId     : number;
  attemptId    : number | null;
  quizName     : string;
  timeLimit    : number;
  questions    : QuizQuestion[];
  attemptState : 'notstarted' | 'prestarted' | 'offline_completed' | 'synced';
  cachedAt     : number;
  expiresAt    : number | null;
}

export interface OfflineAnswer {
  slot  : number;
  name  : string;  // format Moodle: "q{attemptId}:{page}_{slot}_answer"
  value : string;
}

export interface OfflineQuizAttempt {
  id         : number;
  userId     : number;
  cmid       : number;
  quizId     : number;
  attemptId  : number;
  answers    : OfflineAnswer[];
  score      : number;
  maxScore   : number;
  startedAt  : number;
  /** null = autosave en cours (quiz pas encore terminé) */
  finishedAt : number | null;
  synced     : boolean;
  syncError  : string | null;
  retries    : number;
}

// ─── Download (online) ────────────────────────────────────────────────────────

/**
 * Pré-télécharge un quiz pour utilisation offline.
 * Démarre une tentative côté Moodle, récupère toutes les pages de questions,
 * persiste en SQLite. À appeler depuis le détail de cours (bouton "Télécharger").
 */
export async function downloadQuizForOffline(
  cmid    : number,
  quizId  : number,
  courseId: number,
  token   : string
): Promise<void> {
  // 1. Réutiliser une tentative en cours si elle existe — Moodle refuse
  // mod_quiz_start_attempt avec l'exception "Tentative encore en cours"
  // sinon (ex: tentative démarrée précédemment en ligne et jamais finalisée).
  // Même logique que quizService.ts getOrCreateAttempt.
  const existingAttempts = await getUserAttempts(token, quizId);
  const resumable = existingAttempts.find(a => a.state === 'inprogress' || a.state === 'overdue');

  let attemptId : number;
  let quizName  = '';
  let timeLimit = 0;

  if (resumable) {
    attemptId = resumable.id;
    if (IS_DEV) console.log(`[QuizOffline] Reprise tentative ${attemptId} pour cmid ${cmid}`);
  } else {
    // ⚠️ preflightdata[confirmdatasaved] obligatoire — sans lui Moodle renvoie
    // l'exception "Veuillez vérifier et confirmer que vous n'avez pas de
    // données non enregistrées"
    const startData = await moodleCall('mod_quiz_start_attempt', {
      quizid: quizId,
      'preflightdata[0][name]': 'confirmdatasaved',
      'preflightdata[0][value]': '1',
    }, token) as any;
    if (startData.exception) throw new Error(startData.message || 'Impossible de démarrer la tentative');

    const attempt = startData.attempt;
    attemptId = attempt.id as number;
    quizName  = attempt.quiz ?? '';
    timeLimit = attempt.timecheckstate ?? 0;
  }

  // 2. Récupérer toutes les pages (-1 = current page ; on itère jusqu'à la fin)
  const allQuestions: QuizQuestion[] = [];
  let page = 0;

  while (true) {
    const pageData = await moodleCall('mod_quiz_get_attempt_data', {
      attemptid: attemptId,
      page,
      'preflightdata[0][name]': 'confirmdatasaved',
      'preflightdata[0][value]': '1',
    }, token) as any;

    if (pageData.exception) break;

    const pageQuestions: QuizQuestion[] = (pageData.questions ?? []).map((q: any) => ({
      slot         : q.slot,
      type         : q.type,
      html         : q.html || '',
      sequencecheck: q.sequencecheck ?? 1,
      answers      : q.answers ?? [],
    }));

    allQuestions.push(...pageQuestions);

    // Dernière page atteinte
    if (!pageData.nextpage || pageData.nextpage === -1) break;
    page = pageData.nextpage;
  }

  if (IS_DEV) console.log(`[QuizOffline] ${allQuestions.length} questions téléchargées pour cmid ${cmid}`);

  // 3. Persister en SQLite
  const db = await getDBConnection();
  await db.runAsync(
    `INSERT OR REPLACE INTO quiz_cache
       (cmid, quiz_id, course_id, attempt_id, quiz_name, time_limit, questions_json, attempt_state, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'prestarted', ?)`,
    [cmid, quizId, courseId, attemptId, quizName, timeLimit, JSON.stringify(allQuestions), Date.now()]
  );
}

// ─── Queue locale (offline-first) ─────────────────────────────────────────────
//
// Le pré-téléchargement d'un quiz exige mod_quiz_start_attempt, qui consomme
// une vraie tentative côté Moodle. On ne veut pas perdre cette intention si
// l'appel réseau échoue (coupure pendant l'ouverture du cours) : on enregistre
// d'abord l'intention en local (aucun appel réseau), puis on "push" l'appel
// réel séparément — avec retry automatique au prochain retour réseau via
// queueProcessor.ts, plutôt qu'un échec silencieux à usage unique.

/**
 * Marque un quiz comme "à télécharger pour offline" en local — aucun appel réseau.
 * Idempotent : n'écrase pas un cache déjà téléchargé (prestarted/offline_completed/synced).
 */
export async function queuePendingQuizDownload(
  cmid    : number,
  quizId  : number,
  courseId: number
): Promise<void> {
  const db = await getDBConnection();
  await db.runAsync(
    `INSERT INTO quiz_cache (cmid, quiz_id, course_id, attempt_state, cached_at)
     VALUES (?, ?, ?, 'pending', ?)
     ON CONFLICT(cmid) DO NOTHING`,
    [cmid, quizId, courseId, Date.now()]
  );
}

/**
 * Exécute (pousse vers Moodle) tous les pré-téléchargements de quiz encore en
 * attente. Appelé depuis queueProcessor.ts au démarrage, au retour au premier
 * plan et à la reconnexion réseau — un échec réseau ponctuel sera réessayé
 * automatiquement au prochain déclencheur, la ligne restant en 'pending'.
 */
export async function processPendingQuizDownloads(token: string): Promise<void> {
  try {
    const db   = await getDBConnection();
    const rows = await db.getAllAsync<{ cmid: number; quiz_id: number; course_id: number }>(
      "SELECT cmid, quiz_id, course_id FROM quiz_cache WHERE attempt_state = 'pending'"
    );

    for (const row of rows) {
      try {
        await downloadQuizForOffline(row.cmid, row.quiz_id, row.course_id, token);
        if (IS_DEV) console.log(`[QuizOffline] Pending download résolu pour cmid ${row.cmid}`);
      } catch (e: any) {
        if (IS_DEV) console.warn(`[QuizOffline] Pending download échoué pour cmid ${row.cmid}:`, e.message);
      }
    }
  } catch (e) {
    if (IS_DEV) console.warn('[QuizOffline] processPendingQuizDownloads error:', e);
  }
}

// ─── Read (offline) ───────────────────────────────────────────────────────────

export async function getQuizOffline(cmid: number): Promise<QuizCacheEntry | null> {
  try {
    const db  = await getDBConnection();
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM quiz_cache WHERE cmid = ?',
      [cmid]
    );
    if (!row) return null;

    return {
      cmid        : row.cmid,
      quizId      : row.quiz_id,
      courseId    : row.course_id,
      attemptId   : row.attempt_id,
      quizName    : row.quiz_name || '',
      timeLimit   : row.time_limit || 0,
      questions   : JSON.parse(row.questions_json || '[]'),
      attemptState: row.attempt_state,
      cachedAt    : row.cached_at,
      expiresAt   : row.expires_at,
    };
  } catch {
    return null;
  }
}

export async function isQuizDownloaded(cmid: number): Promise<boolean> {
  try {
    const db  = await getDBConnection();
    const row = await db.getFirstAsync<{ attempt_state: string }>(
      "SELECT attempt_state FROM quiz_cache WHERE cmid = ? AND attempt_state NOT IN ('notstarted', 'pending')",
      [cmid]
    );
    return !!row;
  } catch {
    return false;
  }
}

// ─── Save offline attempt ─────────────────────────────────────────────────────

/**
 * Enregistre les réponses d'un quiz complété offline.
 * Score = calcul local approximatif (sera recalculé par Moodle à la sync).
 */
export async function saveOfflineQuizAttempt(
  userId   : number,
  cmid     : number,
  quizId   : number,
  attemptId: number,
  answers  : OfflineAnswer[],
  score    : number,
  maxScore : number,
  startedAt: number
): Promise<void> {
  const db = await getDBConnection();

  await db.runAsync(
    `INSERT OR REPLACE INTO offline_quiz_attempts
       (user_id, cmid, quiz_id, attempt_id, answers_json, score, max_score, started_at, finished_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [userId, cmid, quizId, attemptId, JSON.stringify(answers), score, maxScore, startedAt, Date.now()]
  );

  // Marquer le cache comme "complété offline"
  await db.runAsync(
    "UPDATE quiz_cache SET attempt_state = 'offline_completed' WHERE cmid = ?",
    [cmid]
  );

  if (IS_DEV) console.log(`[QuizOffline] Attempt ${attemptId} sauvegardé offline pour cmid ${cmid}`);
}

/**
 * Autosave des réponses en cours, AVANT la fin du quiz (finished_at = NULL).
 * Appelé après chaque réponse sélectionnée — contrairement à saveOfflineQuizAttempt
 * (appelé une seule fois à la fin), ceci garantit qu'un crash/fermeture de l'app
 * en plein quiz offline ne perd pas les réponses déjà données.
 * Ne touche PAS quiz_cache.attempt_state (le quiz n'est pas terminé).
 */
export async function saveOfflineQuizProgress(
  userId   : number,
  cmid     : number,
  quizId   : number,
  attemptId: number,
  answers  : OfflineAnswer[],
  startedAt: number
): Promise<void> {
  const db = await getDBConnection();
  await db.runAsync(
    `INSERT OR REPLACE INTO offline_quiz_attempts
       (user_id, cmid, quiz_id, attempt_id, answers_json, score, max_score, started_at, finished_at, synced, retries)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, NULL, 0, 0)`,
    [userId, cmid, quizId, attemptId, JSON.stringify(answers), startedAt]
  );
}

/**
 * Récupère la progression offline non synchronisée pour un cmid donné
 * (autosave en cours OU attempt déjà terminé en attente de sync).
 * Utilisé au montage de l'écran quiz pour reprendre où l'utilisateur s'était
 * arrêté plutôt que de repartir de zéro après un crash.
 */
export async function getOfflineQuizProgress(
  userId: number,
  cmid  : number
): Promise<OfflineQuizAttempt | null> {
  try {
    const db  = await getDBConnection();
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM offline_quiz_attempts WHERE user_id = ? AND cmid = ? AND synced = 0 ORDER BY id DESC LIMIT 1',
      [userId, cmid]
    );
    return row ? rowToAttempt(row) : null;
  } catch {
    return null;
  }
}

// ─── Sync (back online) ───────────────────────────────────────────────────────

/**
 * Tentatives terminées offline, pas encore synchronisées, qui n'ont pas
 * dépassé MAX_SYNC_RETRIES. Les autosaves en cours (finished_at IS NULL,
 * voir saveOfflineQuizProgress) ne sont jamais poussées vers Moodle ici —
 * seul un quiz réellement terminé (saveOfflineQuizAttempt) doit être synchronisé.
 */
export async function getPendingQuizAttempts(userId: number): Promise<OfflineQuizAttempt[]> {
  try {
    const db   = await getDBConnection();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM offline_quiz_attempts
       WHERE user_id = ? AND synced = 0 AND finished_at IS NOT NULL AND retries < ?
       ORDER BY finished_at ASC`,
      [userId, MAX_SYNC_RETRIES]
    );
    return rows.map(rowToAttempt);
  } catch {
    return [];
  }
}

/**
 * Soumet une tentative offline vers Moodle.
 * Séquence : save_attempt (réponses) → finish_attempt → récupère grade.
 */
export async function syncQuizAttempt(
  attempt: OfflineQuizAttempt,
  token  : string
): Promise<{ grade: number; maxGrade: number }> {
  // 1. Envoyer les réponses
  const saveParams: Record<string, any> = { attemptid: attempt.attemptId };
  attempt.answers.forEach((a, i) => {
    saveParams[`data[${i}][name]`]  = a.name;
    saveParams[`data[${i}][value]`] = a.value;
  });

  const saveData = await moodleCall('mod_quiz_save_attempt', saveParams, token) as any;
  if (saveData.exception) throw new Error(saveData.message || 'save_attempt échoué');

  // 2. Finaliser la tentative
  const finishData = await moodleCall('mod_quiz_finish_attempt', {
    attemptid     : attempt.attemptId,
    onattemptfound: 'getlatest',
    finishattempt : 1,
  }, token) as any;
  if (finishData.exception) throw new Error(finishData.message || 'finish_attempt échoué');

  const grade    = finishData.grade    ?? attempt.score;
  const maxGrade = finishData.maxgrade ?? attempt.maxScore;

  // 3. Marquer comme synchronisé
  const db = await getDBConnection();
  await db.runAsync(
    'UPDATE offline_quiz_attempts SET synced = 1, sync_error = NULL WHERE id = ?',
    [attempt.id]
  );
  await db.runAsync(
    "UPDATE quiz_cache SET attempt_state = 'synced' WHERE cmid = ?",
    [attempt.cmid]
  );

  if (IS_DEV) console.log(`[QuizOffline] Attempt ${attempt.attemptId} synchronisé — grade: ${grade}/${maxGrade}`);
  return { grade, maxGrade };
}

export async function markAttemptSyncError(attemptId: number, error: string): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.runAsync(
      'UPDATE offline_quiz_attempts SET sync_error = ?, retries = retries + 1 WHERE id = ?',
      [error, attemptId]
    );
  } catch {}
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function clearQuizCache(cmid: number): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.runAsync('DELETE FROM quiz_cache WHERE cmid = ?', [cmid]);
    if (IS_DEV) console.log(`[QuizOffline] Cache supprimé pour cmid ${cmid}`);
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToAttempt(row: any): OfflineQuizAttempt {
  return {
    id        : row.id,
    userId    : row.user_id,
    cmid      : row.cmid,
    quizId    : row.quiz_id,
    attemptId : row.attempt_id,
    answers   : JSON.parse(row.answers_json || '[]'),
    score     : row.score,
    maxScore  : row.max_score,
    startedAt : row.started_at,
    finishedAt: row.finished_at ?? null,
    synced    : row.synced === 1,
    syncError : row.sync_error ?? null,
    retries   : row.retries ?? 0,
  };
}

/**
 * Construit le nom du champ réponse au format Moodle.
 * Exemple : "q12345:0_1_answer" pour attemptId=12345, page=0, slot=1
 */
export function buildAnswerFieldName(
  attemptId: number,
  page     : number,
  slot     : number,
  suffix   : string = 'answer'
): string {
  return `q${attemptId}:${page}_${slot}_${suffix}`;
}
