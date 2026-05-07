/**
 * Moodle Quiz Service — wrapper natif autour des Web Services mod_quiz_*.
 *
 * Flux de référence (à respecter strictement pour éviter
 * `submissionoutofsequence`) :
 *
 *   1. startAttempt(quizId)         → attemptId
 *   2. getAttemptData(attemptId, 0) → questions + sequencecheck
 *   3. saveAnswer(...)              → enregistre une réponse
 *   4. getAttemptData(...)          → recharge pour récupérer le NOUVEAU
 *                                     sequencecheck (sinon out-of-sequence)
 *   5. finishAttempt(attemptId)     → ferme la tentative
 *
 * Toutes les requêtes utilisent `preflightdata[0][name]=confirmdatasaved`
 * + `value=1` pour passer les confirmations Moodle.
 */

import { moodleFetch } from './moodleClient';

const IS_DEV = process.env.NODE_ENV === 'development';

// ─── Types publics ───────────────────────────────────────────────────────────

export type QuestionType =
  | 'multichoice'
  | 'truefalse'
  | 'shortanswer'
  | 'numerical'
  | 'matching'
  | 'unknown';

export interface QuizOption {
  /** valeur exacte attendue par Moodle (input value) */
  value: string;
  /** libellé affiché (HTML strippé) */
  label: string;
  /** nom complet de l'input (ex. q296:1_answer) — partagé entre options d'une même question */
  inputName: string;
}

export interface ParsedQuestion {
  /** numéro de slot Moodle (1, 2, 3 …) */
  slot: number;
  /** type Moodle */
  type: QuestionType;
  /** énoncé (HTML strippé) */
  text: string;
  /** options pour multichoice / truefalse — vide pour shortanswer/numerical */
  options: QuizOption[];
  /** nom de l'input principal (ex. q296:1_answer). Pour shortanswer, c'est aussi l'input texte */
  answerInputName: string;
  /** valeur courante du sequencecheck — DOIT être rechargée après chaque save */
  sequencecheck: number;
  /** nom COMPLET du champ sequencecheck tel qu'attendu par Moodle (ex. q296:1_:sequencecheck) */
  sequencecheckName: string;
  /** HTML brut (debug) */
  rawHtml: string;
  /** points max (mod_quiz.maxmark) */
  maxmark?: number;
}

export interface QuizAttempt {
  id: number;
  state: 'inprogress' | 'finished' | 'overdue' | 'abandoned';
  currentpage?: number;
  sumgrades?: number | null;
}

// ─── Helpers HTML ────────────────────────────────────────────────────────────

function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à')
    .replace(/&ccedil;/g, 'ç').replace(/&ecirc;/g, 'ê').replace(/&icirc;/g, 'î')
    .replace(/&ocirc;/g, 'ô').replace(/&ucirc;/g, 'û').replace(/&Eacute;/g, 'É');
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Détecte le type de question à partir du `class="que <qtype>"` du conteneur.
 */
function detectQuestionType(html: string): QuestionType {
  const m = html.match(/class="que\s+([a-z]+)/i);
  const raw = (m?.[1] || '').toLowerCase();
  if (raw === 'multichoice') return 'multichoice';
  if (raw === 'truefalse') return 'truefalse';
  if (raw === 'shortanswer') return 'shortanswer';
  if (raw === 'numerical') return 'numerical';
  if (raw === 'match' || raw === 'matching') return 'matching';
  return 'unknown';
}

/**
 * Récupère le contenu de la première occurrence d'un attribut `qtext`
 * y compris quand il contient des `<pre><code>` ou des balises imbriquées.
 *
 * Stratégie : matcher l'ouverture `<div ... class="...qtext..."...>` puis
 * compter les ouvertures/fermetures de `<div>` jusqu'à la fermeture
 * équilibrée — plus robuste qu'un simple `[^<]*?</div>`.
 */
function extractQtext(html: string): string {
  const openRe = /<div[^>]+class="[^"]*\bqtext\b[^"]*"[^>]*>/i;
  const m = openRe.exec(html);
  if (!m) return '';

  let depth = 1;
  let i = m.index + m[0].length;
  const start = i;
  const len = html.length;
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = i;

  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRe.exec(html)) !== null) {
    const isClosing = /^<\//.test(tagMatch[0]);
    if (isClosing) {
      depth--;
      if (depth === 0) {
        return html.slice(start, tagMatch.index);
      }
    } else {
      depth++;
    }
    if (tagMatch.index >= len) break;
  }
  // fallback : pas de fermeture trouvée
  return html.slice(start);
}

/**
 * Extrait les options de réponse d'un bloc question Moodle 4.x.
 *
 * Format réel :
 *   <div class="answer">
 *     <div class="r0">
 *       <input type="radio" name="q296:1_answer" value="0" id="q296:1_answer0"
 *              aria-labelledby="q296:1_answer0_label" />
 *       <div class="d-flex w-auto" id="q296:1_answer0_label" data-region="answer-label">
 *         <span class="answernumber">a. </span>
 *         <div class="flex-fill ml-1"><p>Aboro Moodle!</p></div>
 *       </div>
 *     </div>
 *     <div class="r1">…</div>
 *   </div>
 *
 * On découpe par `<div class="rN">` puis on extrait l'input + le texte
 * du `<p>` (ou à défaut, le contenu du div `flex-fill`).
 *
 * L'option `value="-1"` (« Effacer mon choix ») est ignorée.
 */
function extractMultichoiceOptions(html: string): QuizOption[] {
  const options: QuizOption[] = [];

  // Découper par <div class="r0"> ou <div class="r1">
  const blocks = html.split(/<div\s+class="r[01]"[^>]*>/i);
  blocks.shift(); // contenu avant la première option

  for (const block of blocks) {
    // Extraire l'input radio/checkbox du bloc
    const inputMatch = block.match(
      /<input[^>]+type="(?:radio|checkbox)"[^>]+name="([^"]+)"[^>]+value="([^"]+)"[^>]*>/i
    );
    if (!inputMatch) continue;

    const inputName = inputMatch[1];
    const value = inputMatch[2];

    // Skip "clearchoice" (pseudo-option de Moodle pour effacer la sélection)
    if (value === '-1') continue;

    // Extraire le texte de la réponse
    let label = '';

    // 1. Priorité : contenu d'un <p> (cas le plus courant)
    const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch) {
      label = stripHtml(pMatch[1]);
    }

    // 2. Sinon : div "flex-fill" qui contient le texte sans <p>
    if (!label) {
      const flexMatch = block.match(
        /<div[^>]+class="[^"]*flex-fill[^"]*"[^>]*>([\s\S]*?)<\/div>/i
      );
      if (flexMatch) {
        label = stripHtml(flexMatch[1]);
      }
    }

    // 3. Dernier recours : tout le bloc strippé moins la lettre
    //    (« a. », « b. ») via le span answernumber
    if (!label) {
      const cleaned = block
        .replace(/<input[^>]*>/gi, '')
        .replace(/<span[^>]*class="[^"]*answernumber[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
      label = stripHtml(cleaned);
    }

    // Garde-fou : si toujours rien, ignorer pour ne pas afficher une option vide
    if (!label) continue;

    options.push({ inputName, value, label });
  }

  return options;
}

/**
 * Parse une question Moodle depuis son HTML.
 *
 * - multichoice / truefalse : extrait toutes les options via `extractMultichoiceOptions`
 * - shortanswer / numerical : extrait l'input texte (name + valeur courante éventuelle)
 * - sequencecheck : extrait `<input type="hidden" name="qX:Y_:sequencecheck" value="N">`
 *
 * Le format du sequencecheck dans Moodle 4.4 est `q<usageId>:<slot>_:sequencecheck`
 * (ex. `q296:1_:sequencecheck`).
 */
function parseQuestionHtml(
  slot: number,
  fallbackSequencecheck: number,
  html: string,
  maxmark?: number
): ParsedQuestion {
  const type = detectQuestionType(html);

  // Énoncé (gère <pre><code> imbriqué et div multi-niveaux)
  const qtextRaw = extractQtext(html);
  const text = qtextRaw ? stripHtml(qtextRaw) : '';

  // sequencecheck — capturer le NOM COMPLET (ex. "q296:1_:sequencecheck") ET la valeur
  const scMatch = html.match(
    /name="(q\d+:\d*_?:?sequencecheck)"\s+value="(\d+)"/i
  );
  const sequencecheckName = scMatch ? scMatch[1] : `q0:${slot}_:sequencecheck`;
  const sequencecheck = scMatch ? parseInt(scMatch[2], 10) : fallbackSequencecheck;

  let options: QuizOption[] = [];
  let answerInputName = '';

  if (type === 'multichoice' || type === 'truefalse') {
    options = extractMultichoiceOptions(html);
    answerInputName = options[0]?.inputName || '';

    // Fallback si extractMultichoiceOptions retourne 0 (HTML non standard)
    if (answerInputName === '') {
      const m = html.match(
        /<input[^>]+type="(?:radio|checkbox)"[^>]+name="(q\d+:\d+_answer)"/i
      );
      if (m) answerInputName = m[1];
    }
  } else if (type === 'shortanswer' || type === 'numerical') {
    const m = html.match(
      /<input[^>]+type="text"[^>]+name="(q\d+:\d+_answer)"[^>]*>/i
    );
    answerInputName = m?.[1] || '';
  }

  return {
    slot,
    type,
    text,
    options,
    answerInputName,
    sequencecheck,
    sequencecheckName,
    rawHtml: html,
    maxmark,
  };
}

// ─── Service public ──────────────────────────────────────────────────────────

/**
 * Liste les tentatives existantes pour un quiz.
 */
export async function getUserAttempts(
  authToken: string,
  quizInstanceId: number
): Promise<QuizAttempt[]> {
  const result = await moodleFetch('/webservice/rest/server.php', {
    wstoken: authToken,
    wsfunction: 'mod_quiz_get_user_attempts',
    moodlewsrestformat: 'json',
    quizid: quizInstanceId,
    status: 'all',
  });
  if (result?.exception) {
    if (IS_DEV) console.warn('[quizService] get_attempts:', result.message);
    return [];
  }
  // Debug: voir la structure brute de la reponse
  if (IS_DEV) {
    console.log('[quizService] getUserAttempts raw result:', JSON.stringify(result, null, 2).slice(0, 500));
  }
  return result?.attempts || [];
}

/**
 * Démarre une nouvelle tentative ou réutilise une tentative en cours.
 *
 * Stratégie :
 *  1. List attempts → tentative `inprogress` ? → on la reprend (sumgrades
 *     peut être null pour une tentative fraîchement créée, c'est normal).
 *  2. Sinon → `mod_quiz_start_attempt` (sans forcenew pour éviter les doublons).
 */
export async function getOrCreateAttempt(
  authToken: string,
  quizInstanceId: number
): Promise<number | null> {
  try {
    const attempts = await getUserAttempts(authToken, quizInstanceId);

    // Debug: voir toutes les tentatives retournées
    if (IS_DEV) {
      console.log('[quizService] getUserAttempts returned:', attempts.length, 'attempts');
      attempts.forEach((a, i) => {
        console.log(`  [${i}] id=${a.id}, state=${a.state}`);
      });
    }

    // Reprendre toute tentative en cours (inprogress, overdue, abandoned)
    const activeStates = ['inprogress', 'overdue', 'abandoned'];
    const existingAttempt = attempts.find(a => activeStates.includes(a.state));
    if (existingAttempt?.id) {
      if (IS_DEV) console.log('[quizService] Resuming attempt:', existingAttempt.id, 'state:', existingAttempt.state);
      return existingAttempt.id;
    }

    if (IS_DEV) console.log('[quizService] No inProgress attempt found, creating new one');

      let startResult;
    try {
      startResult = await moodleFetch('/webservice/rest/server.php', {
        wstoken: authToken,
        wsfunction: 'mod_quiz_start_attempt',
        moodlewsrestformat: 'json',
        quizid: quizInstanceId,
        'preflightdata[0][name]': 'confirmdatasaved',
        'preflightdata[0][value]': '1',
      });
    } catch (err: any) {
       if (err?.message?.includes('Tentative encore en cours') || err?.message?.includes('attempt')) {
        if (IS_DEV) console.log('[quizService] Attempt in progress blocking, forcing new attempt with forcenew=1');
        try {
          startResult = await moodleFetch('/webservice/rest/server.php', {
            wstoken: authToken,
            wsfunction: 'mod_quiz_start_attempt',
            moodlewsrestformat: 'json',
            quizid: quizInstanceId,
            forcenew: '1',
            'preflightdata[0][name]': 'confirmdatasaved',
            'preflightdata[0][value]': '1',
          });
        } catch (forceErr: any) {
          if (IS_DEV) console.warn('[quizService] force new attempt failed:', forceErr?.message);
          throw new Error('Impossible de démarrer le quiz. Vérifiez que vous êtes inscrit au cours.');
        }
      } else {
        throw err;
      }
    }

     if (startResult?.exception && startResult?.message?.includes('Tentative encore en cours')) {
      if (IS_DEV) console.log('[quizService] Attempt in progress blocking, forcing new attempt with forcenew=1');
      startResult = await moodleFetch('/webservice/rest/server.php', {
        wstoken: authToken,
        wsfunction: 'mod_quiz_start_attempt',
        moodlewsrestformat: 'json',
        quizid: quizInstanceId,
        forcenew: '1',
        'preflightdata[0][name]': 'confirmdatasaved',
        'preflightdata[0][value]': '1',
      });
    }

    if (startResult?.exception) {
      if (IS_DEV) console.warn('[quizService] start_attempt:', startResult.message);
      return null;
    }

    if (IS_DEV) console.log('[quizService] New attempt created:', startResult?.attempt?.id);
    return startResult?.attempt?.id ?? null;
  } catch (err: any) {
    if (IS_DEV) console.warn('[quizService] getOrCreateAttempt:', err?.message);
    return null;
  }
}

/**
 * Charge une page de la tentative et parse les questions.
 * À appeler après chaque save pour récupérer le nouveau sequencecheck.
 */
export async function getAttemptPage(
  authToken: string,
  attemptId: number,
  page: number = 0
): Promise<{ questions: ParsedQuestion[]; nextPage: number; totalPages: number }> {
  const data = await moodleFetch('/webservice/rest/server.php', {
    wstoken: authToken,
    wsfunction: 'mod_quiz_get_attempt_data',
    moodlewsrestformat: 'json',
    attemptid: attemptId,
    page,
    'preflightdata[0][name]': 'confirmdatasaved',
    'preflightdata[0][value]': '1',
  });

  if (data?.exception) {
    if (IS_DEV) console.warn('[quizService] get_attempt_data:', data.message);
    return { questions: [], nextPage: -1, totalPages: 0 };
  }

  const rawQuestions = Array.isArray(data?.questions) ? data.questions : [];
  const questions: ParsedQuestion[] = rawQuestions.map((q: any) =>
    parseQuestionHtml(q.slot, q.sequencecheck ?? 1, q.html || '', q.maxmark)
  );

  // Calculer totalPages approximatif : si nextpage >= 0, il y a au moins nextpage+1 pages
  // sinon c'est la derniere page
  const currentPageCount = Array.isArray(data?.questions) ? data.questions.length : 0;
  const nextPg = data?.nextpage ?? -1;
  const totalPages = nextPg >= 0 ? Math.max(nextPg + 1, currentPageCount) : currentPageCount;

  return {
    questions,
    nextPage: nextPg,
    totalPages,
  };
}

/**
 * Charge TOUTES les pages d'une tentative (utile pour les quiz à pages multiples).
 * Garde-fou à 100 pages.
 */
export async function fetchAllQuizQuestions(
  authToken: string,
  attemptId: number
): Promise<ParsedQuestion[]> {
  const all: ParsedQuestion[] = [];
  let page = 0;

  while (page >= 0 && page < 100) {
    const { questions, nextPage } = await getAttemptPage(authToken, attemptId, page);
    if (questions.length === 0) break;
    all.push(...questions);
    page = nextPage;
    if (nextPage === -1) break;
  }

  return all;
}

/**
 * Sauvegarde des réponses sans terminer la tentative.
 *
 * IMPORTANT : utilise `mod_quiz_process_attempt` avec `finishattempt=0`.
 * Ne PAS utiliser `mod_quiz_save_attempt` qui est un endpoint d'autosave
 * (brouillon) — Moodle ne grade PAS à partir de l'autosave quand on
 * termine la tentative, d'où un score toujours à 0.
 *
 * @param answers        Map { inputName → valeur }
 * @param sequencechecks Map { sequencecheckName → valeur }
 */
export async function saveQuizAnswers(
  authToken: string,
  attemptId: number,
  answers: Record<string, string>,
  sequencechecks: Record<string, string>
): Promise<boolean> {
  const params: Record<string, any> = {
    wstoken: authToken,
    wsfunction: 'mod_quiz_process_attempt',
    moodlewsrestformat: 'json',
    attemptid: attemptId,
    finishattempt: '0',
    timeup: '0',
    'preflightdata[0][name]': 'confirmdatasaved',
    'preflightdata[0][value]': '1',
  };

  let idx = 0;
  for (const [name, value] of Object.entries(answers)) {
    params[`data[${idx}][name]`] = name;
    params[`data[${idx}][value]`] = value;
    idx++;
  }
  for (const [scName, scValue] of Object.entries(sequencechecks)) {
    params[`data[${idx}][name]`] = scName;
    params[`data[${idx}][value]`] = scValue;
    idx++;
  }

  if (IS_DEV) {
    const preview: Record<string, string> = {};
    for (let i = 0; i < idx; i++) {
      preview[params[`data[${i}][name]`]] = params[`data[${i}][value]`];
    }
    console.log('[quizService] saveQuizAnswers data:', JSON.stringify(preview));
  }

  const result = await moodleFetch('/webservice/rest/server.php', params);
  if (result?.exception) {
    if (IS_DEV) console.warn('[quizService] saveQuizAnswers failed:', result.errorcode, result.message);
    return false;
  }
  if (IS_DEV) console.log('[quizService] saveQuizAnswers ✅ attemptId:', attemptId);
  return true;
}

/**
 * Termine la tentative.
 *
 * N'envoie AUCUNE donnée (ni réponses, ni sequencechecks) dans data[].
 * Les réponses ont déjà été soumises question par question via saveQuizAnswers
 * (process_attempt finishattempt=0). Moodle grade à partir de ces réponses
 * stockées — envoyer des sequencechecks périmés ici provoquerait
 * `submissionoutofsequence` car le compteur interne de Moodle a été incrémenté
 * après chaque saveQuizAnswers.
 */
export async function finishQuizAttempt(
  authToken: string,
  attemptId: number
): Promise<boolean> {
  const params: Record<string, any> = {
    wstoken: authToken,
    wsfunction: 'mod_quiz_process_attempt',
    moodlewsrestformat: 'json',
    attemptid: attemptId,
    finishattempt: '1',
    timeup: '0',
    'preflightdata[0][name]': 'confirmdatasaved',
    'preflightdata[0][value]': '1',
  };

  if (IS_DEV) console.log('[quizService] finishAttempt → attemptId:', attemptId, '(no data entries)');

  const result = await moodleFetch('/webservice/rest/server.php', params);
  if (result?.exception) {
    if (IS_DEV) console.warn('[quizService] finish failed:', result.errorcode, result.message);
    return false;
  }
  if (IS_DEV) console.log('[quizService] Attempt finished:', attemptId);
  return true;
}

/**
 * Sauvegarde une SEULE réponse puis recharge la page pour synchroniser le
 * sequencecheck. Recommandé : `submitAnswer` après chaque clic de l'utilisateur.
 *
 * Renvoie les questions rafraîchies (avec nouveaux sequencechecks) ou null
 * en cas d'échec.
 */
export async function submitSingleAnswer(
  authToken: string,
  attemptId: number,
  page: number,
  inputName: string,
  value: string,
  slot: number,
  sequencecheck: number
): Promise<{ questions: ParsedQuestion[]; nextPage: number } | null> {
  const ok = await saveQuizAnswers(
    authToken,
    attemptId,
    { [inputName]: value },
    { [String(slot)]: String(sequencecheck) }
  );
  if (!ok) return null;

  // Recharger la page pour récupérer le nouveau sequencecheck
  const { questions, nextPage } = await getAttemptPage(authToken, attemptId, page);
  return { questions, nextPage };
}

/**
 * Récupère la review (corrections + bonnes réponses + score final).
 */
export async function getAttemptReview(
  authToken: string,
  attemptId: number
): Promise<any | null> {
  const result = await moodleFetch('/webservice/rest/server.php', {
    wstoken: authToken,
    wsfunction: 'mod_quiz_get_attempt_review',
    moodlewsrestformat: 'json',
    attemptid: attemptId,
  });
  if (result?.exception) {
    if (IS_DEV) console.warn('[quizService] review failed:', result.message);
    return null;
  }
  if (IS_DEV) {
    console.log('[quizService] review grade:', result?.grade,
      '| sumgrades:', result?.attempt?.sumgrades,
      '| questions:', result?.questions?.length);
  }
  return result;
}

/**
 * Extrait le score final d'une review Moodle.
 *
 * Structure réelle de mod_quiz_get_attempt_review :
 *   attempt.sumgrades → score brut (ex. 2.0 sur 3 questions)
 *   grade             → STRING POURCENTAGE (ex. "66.67"), PAS la note max
 *   questions         → tableau des questions (pour compter le total)
 *
 * IMPORTANT : review.grade est un pourcentage, pas une note absolue.
 * Utiliser review.grade comme dénominateur donne un résultat complètement faux.
 */
export function extractFinalScore(review: any): {
  sumgrades: number;
  maxgrade: number;
  percentage: number;
} {
  const attempt = review?.attempt || {};
  const sumgrades = Number(attempt.sumgrades ?? 0);

  // review.grade est un pourcentage string comme "66.67" — pas la note max
  const gradePercent = review?.grade != null ? Number(review.grade) : NaN;
  const questionsCount = Array.isArray(review?.questions) ? review.questions.length : 0;

  let percentage = 0;
  // Utiliser le nombre de questions comme maxgrade si disponible
  let maxgrade = questionsCount || 1;

  if (!isNaN(gradePercent) && gradePercent >= 0) {
    // Si grade > sumgrades et proche, c'est la note max (100%)
    // Ex: sumgrades=10, grade=10 → 100%, mais sumgrades=1, grade=1 sur 3 questions → 33%
    // ✅ CORRECTION: grade doit etre >= questionsCount pour etre la note max possible
    if (gradePercent >= sumgrades && gradePercent > 0 && sumgrades > 0 &&
      Math.abs(gradePercent - sumgrades) < 0.01 &&
      (questionsCount === 0 || gradePercent >= questionsCount)) {
      // grade est la note max (toutes les reponses correctes) → 100%
      maxgrade = Math.max(gradePercent, sumgrades, questionsCount || 1);
      percentage = 100;
    } else if (gradePercent <= 100 && Math.abs(gradePercent - sumgrades) >= 0.01) {
      // grade est un vrai pourcentage (ex: 66.67)
      percentage = Math.round(gradePercent);
      if (sumgrades > 0 && gradePercent > 0 && questionsCount === 0) {
        maxgrade = Math.round(sumgrades / (gradePercent / 100));
      }
    } else {
      // grade est une note brute supérieure à 100 ou égale à sumgrades avec sumgrades=0
      percentage = maxgrade > 0 ? Math.round((sumgrades / maxgrade) * 100) : 0;
    }
  } else if (maxgrade > 0 && sumgrades > 0) {
    percentage = Math.round((sumgrades / maxgrade) * 100);
  }

  return { sumgrades, maxgrade, percentage };
}

/**
 * @deprecated — utiliser `submitSingleAnswer` qui recharge le sequencecheck.
 * Conservé pour compatibilité ascendante.
 */
export async function processSingleAnswer(
  authToken: string,
  attemptId: number,
  slot: number,
  answerValue: string,
  sequencecheck: number
): Promise<boolean> {
  const params: Record<string, any> = {
    wstoken: authToken,
    wsfunction: 'mod_quiz_process_attempt',
    moodlewsrestformat: 'json',
    attemptid: attemptId,
    finishattempt: '0',
    'data[0][name]': `q${slot}:_sequencecheck`,
    'data[0][value]': String(sequencecheck),
    'data[1][name]': `q${slot}:_answer`,
    'data[1][value]': answerValue,
    'preflightdata[0][name]': 'confirmdatasaved',
    'preflightdata[0][value]': '1',
  };
  const result = await moodleFetch('/webservice/rest/server.php', params);
  if (result?.exception) {
    if (IS_DEV) console.warn('[quizService] processSingleAnswer:', result.message);
    return false;
  }
  return true;
}
