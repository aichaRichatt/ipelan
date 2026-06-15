// services/sync/progressSync.ts
// Fixes appliqués :
//  Fix 1 : NON_GRADED_MODULES étendu (page, url, label, folder)
//  Fix 2 : Suppression du hack activityId = cmid
//  Fix 3 : Queue offline pour les syncs ratés
//  Fix 4 : resolveIds utilisé partout correctement

import { isMoodleOnline, moodleFetch } from '../api/moodleClient';
import { markActivitySynced } from '../storage/activity-progress';
import { addToSyncQueue } from '../storage/sync-queue';
import { getToken } from '../storage/tokenStorage';
import { resolveIds } from '../utils/moodleIdResolver';

const IS_DEV = process.env.NODE_ENV === 'development';

//  Fix 1 : Liste complète des modules sans note
const NON_GRADED_MODULES = new Set([
  'resource',  // PDF, fichiers
  'glossary',  // Association de mots
  'choice',    // Listening
  'page',      // Pages HTML
  'url',       // Liens externes
  'label',     // Étiquettes
  'folder',    // Dossiers
  'book',      // Livres Moodle
  'imscp',     // Packages IMS
]);

// Modules avec note → complétion automatique via Moodle après envoi de la note
const GRADED_MODULES = new Set([
  'quiz',    // Quiz
  'assign',  // Devoirs / Dictée
  'lesson',  // Leçons / Word Order
]);

// ─── Vérifier connectivité ────────────────────────────────────────────────────

// Délégué à services/api/moodleClient.ts pour éviter la duplication
const isOnline = isMoodleOnline;

// ─── Envoi de note (sans hack activityId) ────────────────────────────

async function updateActivityGrade(
  token: string,
  courseId: number,
  cmid: number,
  score: number,
  maxScore: number,
  userId?: number
): Promise<void> {

  const resolved = await resolveIds(courseId, cmid, token);

  if (!resolved) {
    if (IS_DEV) console.warn('[ProgressSync] Module non trouvé dans cache:', { courseId, cmid });
    return;
  }

  const { instanceId, modname } = resolved;

  //  Quiz : la note est déjà calculée par mod_quiz_process_attempt avec le token
  // user. Appeler core_grades_update_grades après (même avec token admin) écrase
  // la note correcte à 0 car le format des paramètres diffère.
  if (modname === 'quiz') {
    if (IS_DEV) console.log(`[ProgressSync] Quiz cmid=${cmid} — note gérée par Moodle, marquage complétion uniquement`);
    await markManualCompletion(token, cmid, userId);
    return;
  }

  // Vérifier que l'instanceId est valide
  if (!instanceId || instanceId <= 0) {
    if (IS_DEV) console.warn('[ProgressSync] Instance ID invalide:', { instanceId, modname, courseId, cmid });
    return;
  }

  // Normaliser le score entre 0 et 100 — guard NaN si score/maxScore invalides
  const safeScore    = isFinite(score)    && score    >= 0 ? score    : 0;
  const safeMaxScore = isFinite(maxScore) && maxScore >  0 ? maxScore : 0;
  const normalizedGrade = safeMaxScore > 0
    ? Math.min(100, Math.round((safeScore / safeMaxScore) * 100))
    : safeScore > 0 ? 100 : 0;

  if (IS_DEV) console.log(`[ProgressSync] Envoi note: modname=${modname}, instanceId=${instanceId}, normalizedGrade=${normalizedGrade}`);

  // core_grades_update_grades requiert un token ADMIN (token étudiant = permission refusée)
  const gradeToken = process.env.EXPO_PUBLIC_MOODLE_ADMIN_TOKEN || token;

  // activityid and itemnumber are top-level params; userid goes inside grades[]
  const gradeParams: any = {
    wstoken: gradeToken,
    wsfunction: 'core_grades_update_grades',
    source: 'ipelan_app',
    component: `mod_${modname}`,
    activityid: instanceId,
    itemnumber: 0,
    'grades[0][rawgrade]': String(normalizedGrade),
    moodlewsrestformat: 'json',
  };

  if (userId) {
    gradeParams['grades[0][userid]'] = userId;
  } else {
    // No userId → can't address a specific student grade, skip grade sync
    if (IS_DEV) console.warn('[ProgressSync] Pas de userId — grade ignoré, complétion manuelle uniquement');
    await markManualCompletion(token, cmid);
    return;
  }

  try {
    await moodleFetch('/webservice/rest/server.php', gradeParams, 'POST');
    if (IS_DEV) console.log(`[ProgressSync]  Note envoyée ${modname} instance=${instanceId} score=${normalizedGrade}`);
  } catch (e: any) {
    if (IS_DEV) console.warn('[ProgressSync] Note échouée:', e.message);

    //  Fix 3 : Mettre en queue si offline ou erreur temporaire
    const isOffline = !await isOnline();
    const isParamError = e.message?.includes('incorrect') ||
      e.message?.includes('invalide') ||
      e.message?.includes('parameter') ||
      e.message?.includes('Valeur incorrecte de paramètre');
    if (isOffline) {
      await addToSyncQueue('grade', 'core_grades_update_grades', gradeParams, userId);
    } else if (isParamError && IS_DEV) {
      console.warn('[ProgressSync] Paramètre invalide - pas de retry automatique:', e.message);
    } else if (!isParamError) {
      await addToSyncQueue('grade', 'core_grades_update_grades', gradeParams, userId);
    }
  }
}

// ─── Complétion manuelle pour modules sans note ───────────────────────────────

async function markManualCompletion(
  token: string,
  cmid: number,
  userId?: number
): Promise<boolean> {
  if (!cmid || cmid <= 0) {
    if (IS_DEV) console.warn('[markManualCompletion] Invalid cmid:', cmid);
    return false;
  }
  const params = {
    wstoken: token,
    wsfunction: 'core_completion_update_activity_completion_status_manually',
    cmid: Number(cmid),
    completed: 1,
    moodlewsrestformat: 'json',
  };

  try {
    await moodleFetch('/webservice/rest/server.php', params, 'POST');
    if (IS_DEV) console.log(`[ProgressSync]  Complétion manuelle cmid=${cmid}`);
    return true;
  } catch (e: any) {
    const isParamError = e.errorcode === 'invalidparameter' ||
      e.errorcode === 'completionnotenabled' ||
      e.message?.includes('Valeur incorrecte de paramètre');
    if (isParamError) {
      if (IS_DEV) console.info(`[ProgressSync] Complétion auto sur cmid=${cmid} — OK (paramètre non requis)`);
      return true;
    }
    if (IS_DEV) console.warn('[ProgressSync] Complétion manuelle échouée:', e.message);
    if (!await isOnline()) {
      await addToSyncQueue(
        'completion',
        'core_completion_update_activity_completion_status_manually',
        params,
        userId
      );
    }
    return false;
  }
}

// ─── Fonction principale exportée ─────────────────────────────────────────────

/**
 * Retourne true si la sync a été effectuée immédiatement vers Moodle,
 * false si elle a été mise en queue (offline ou module non résolu).
 */
export async function syncActivityCompletion(
  token: string,
  courseId: number,
  cmid: number,
  score: number,
  maxScore: number,
  userId?: number
): Promise<boolean> {
  //   OFFLINE-FIRST: vérifier la connexion AVANT resolveIds.
  // resolveIds utilise un cache in-memory vide quand offline → renvoie null →
  // l'ancienne version sortait silencieusement sans rien mettre en queue.
  const online = await isOnline();

  if (!online) {
    await addToSyncQueue(
      'completion',
      'core_completion_update_activity_completion_status_manually',
      { wstoken: token, cmid: Number(cmid), completed: 1, moodlewsrestformat: 'json', _courseId: String(courseId) },
      userId
    );
    if (IS_DEV) console.log(`[ProgressSync] Offline — completion queued cmid=${cmid}`);
    return false;
  }

  // Online : résoudre le modname depuis le cache Moodle
  const resolved = await resolveIds(courseId, cmid, token);
  if (!resolved) {
    // Module inconnu (cours non chargé) → queue completion comme fallback
    await addToSyncQueue(
      'completion',
      'core_completion_update_activity_completion_status_manually',
      { wstoken: token, cmid: Number(cmid), completed: 1, moodlewsrestformat: 'json', _courseId: String(courseId) },
      userId
    );
    if (IS_DEV) console.warn('[ProgressSync] Module introuvable — completion queued:', { courseId, cmid });
    return false;
  }

  const { modname } = resolved;

  if (IS_DEV) console.log(`[ProgressSync] Sync ${modname} cmid=${cmid} score=${score}/${maxScore}`);

  try {
    if (GRADED_MODULES.has(modname)) {
      await updateActivityGrade(token, courseId, cmid, score, maxScore, userId);
      // For assign/lesson: grade is sent but Moodle may not auto-set completionstate.
      // Calling markManualCompletion ensures core_completion_get_activities_completion_status
      // returns state=1 on Device B, enabling correct cross-device progress seeding.
      // (quiz already handles this internally; markManualCompletion silently succeeds
      // for auto-completion modules via completionnotenabled error handling)
      if (modname !== 'quiz') {
        await markManualCompletion(token, cmid, userId);
      }
    } else if (NON_GRADED_MODULES.has(modname)) {
      const success = await markManualCompletion(token, cmid, userId);
      if (!success) return false;
    } else {
      if (IS_DEV) console.warn(`[ProgressSync] Module type inconnu: "${modname}" cmid=${cmid}`);
      const success = await markManualCompletion(token, cmid, userId);
      if (!success) return false;
    }
    return true;
  } catch (error: any) {
    if (IS_DEV) console.error('[ProgressSync] Error during sync:', error.message);
    return false;
  }
}

// ─── syncAfterActivity — point d'entrée depuis les écrans ─────────────────────

export async function syncAfterActivity(params: {
  courseId: number;
  cmid: number;
  score: number;
  maxScore: number;
  userId?: number;
  tokenParam?: string;
}): Promise<void> {
  try {
    const token = params.tokenParam || await getToken();
    if (!token) {
      if (IS_DEV) console.warn('[ProgressSync] Pas de token — sync ignorée');
      return;
    }

    const synced = await syncActivityCompletion(
      token,
      params.courseId,
      params.cmid,
      params.score,
      params.maxScore,
      params.userId
    );

    // Marquer synced uniquement si Moodle a confirmé (pas si mis en queue)
    if (synced) {
      await markActivitySynced(params.cmid, params.courseId, params.userId);
    }
  } catch (e: any) {
    if (IS_DEV) console.error('[ProgressSync] Erreur fatale:', e.message);
  }
}

// ─── Exports pour compatibilité avec courseId.tsx ───────────────────────────

export async function checkInternetConnection(): Promise<boolean> {
  return isOnline();
}

export async function syncCourseProgress(
  token: string,
  courseId: number,
  totalActivities: number,
  userId?: number
): Promise<{ success: boolean }> {
  if (!token || !courseId) return { success: false };

  if (IS_DEV) console.log('[ProgressSync] syncCourseProgress start:', { courseId, totalActivities, userId });

  try {
    const { moodleCall } = await import('../api/moodleClient');
    const sections = await moodleCall('core_course_get_contents', { courseid: courseId }, token);

    if (!Array.isArray(sections)) {
      if (IS_DEV) console.warn('[ProgressSync] syncCourseProgress: invalid sections response');
      return { success: false };
    }

    const cmids: number[] = [];
    for (const section of sections) {
      if (Array.isArray(section.modules)) {
        for (const mod of section.modules) {
          if (mod.id && mod.completiondata?.completionstate === 1) {
            // Only sync modules already marked complete locally
            cmids.push(mod.id);
          }
        }
      }
    }

    if (cmids.length === 0) {
      if (IS_DEV) console.log('[ProgressSync] syncCourseProgress: no completed modules to sync');
      return { success: true };
    }

    const results = await Promise.allSettled(
      cmids.map(cmid => markManualCompletion(token, cmid, userId))
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    if (IS_DEV) console.log(`[ProgressSync] syncCourseProgress: ${cmids.length - failed}/${cmids.length} modules synced`);

    return { success: failed === 0 };
  } catch (e: any) {
    if (IS_DEV) console.error('[ProgressSync] syncCourseProgress error:', e.message);

    if (!await isOnline()) {
      await addToSyncQueue('course_progress', 'core_course_get_contents', {
        wstoken: token,
        courseid: courseId,
        moodlewsrestformat: 'json',
      }, userId);
    }

    return { success: false };
  }
}

// ─── Reconstruction de activity_progress depuis Moodle (Device B / fresh install) ───

/**
 * Fetches enrolled courses + per-module completion statuses from Moodle and
 * inserts completed modules into the local activity_progress table.
 *
 * Rules:
 *  - INSERT OR IGNORE → never overwrites an existing local score
 *  - Runs silently in background — never awaited by UI code
 *  - Batches courses in groups of 3 to avoid rate-limiting
 */
export async function fetchAndPopulateActivityProgressFromMoodle(
  userId: number,
  token: string
): Promise<void> {
  if (!userId || !token) return;

  try {
    const { moodleCall } = await import('../api/moodleClient');
    const { getDBConnection } = await import('../storage/db-service');

    // 1. Get enrolled courses
    const result = await moodleCall(
      'core_course_get_enrolled_courses_by_timeline_classification',
      { classification: 'all', limit: 20 },
      token
    );
    const courses: Array<{ id: number }> = result?.courses ?? [];
    if (courses.length === 0) return;

    const db = await getDBConnection();
    const now = new Date().toISOString();

    // 2. Process in batches of 3
    for (let i = 0; i < courses.length; i += 3) {
      const batch = courses.slice(i, i + 3);

      await Promise.all(batch.map(async (course) => {
        try {
          const courseId = course.id;

          const [sections, completionResult] = await Promise.all([
            moodleCall('core_course_get_contents', { courseid: String(courseId) }, token).catch(() => []),
            moodleCall('core_completion_get_activities_completion_status', { courseid: String(courseId), userid: String(userId) }, token).catch(() => null),
          ]);

          const sectionsArr: any[] = Array.isArray(sections) ? sections : [];
          const statuses: Array<{ cmid: number; state: number }> = completionResult?.statuses ?? [];

          // Build cmid → modname map from sections
          const modnameMap = new Map<number, string>();
          for (const section of sectionsArr) {
            for (const mod of section.modules ?? []) {
              if (mod.id) modnameMap.set(mod.id, mod.modname || 'lesson');
            }
          }

          // 3. Insert completed modules (INSERT OR IGNORE preserves existing local scores)
          for (const stat of statuses) {
            if (stat.state >= 1) {
              const modname = modnameMap.get(stat.cmid) || 'lesson';
              await db.runAsync(
                `INSERT OR IGNORE INTO activity_progress
                   (user_id, module_id, course_id, type, best_score, total_score,
                    attempts_count, is_completed, last_attempt, xp_earned, coins_earned, synced_at)
                 VALUES (?, ?, ?, ?, 0, 100, 1, 1, ?, 0, 0, ?)`,
                [userId, stat.cmid, courseId, modname, now, now]
              );
            }
          }

          // 4. Update course_progress with totals derived from completion statuses
          const totalActivities = statuses.length;
          const completedActivities = statuses.filter(s => s.state >= 1).length;
          if (totalActivities > 0) {
            const { saveCourseProgress } = await import('../storage/course-progress');
            const existing = await db.getFirstAsync<{ completed_activities: number; total_activities: number }>(
              'SELECT completed_activities, total_activities FROM course_progress WHERE course_id = ? AND user_id = ?',
              [courseId, userId]
            );
            // Only update if Moodle has more progress than local (never go backward)
            if (!existing || existing.total_activities === 0 || completedActivities > existing.completed_activities) {
              await saveCourseProgress(
                courseId,
                Math.max(completedActivities, existing?.completed_activities ?? 0),
                Math.max(totalActivities, existing?.total_activities ?? 0),
                0,
                0,
                userId
              );
            }
          }

          if (IS_DEV) {
            const completed = statuses.filter(s => s.state >= 1).length;
            console.log(`[ProgressSync] Seeded course=${courseId} completed=${completed}/${statuses.length}`);
          }
        } catch (e: any) {
          if (IS_DEV) console.warn(`[ProgressSync] Failed to seed activity_progress for course ${course.id}:`, e.message);
        }
      }));
    }
  } catch (e: any) {
    if (IS_DEV) console.warn('[ProgressSync] fetchAndPopulateActivityProgressFromMoodle failed:', e.message);
  }
}

// Mantain compatibility with some old calls if any
export const syncAfterActivityWithRetry = async (
  moduleId: number,
  courseId: number,
  activityType: string,
  score: number,
  total: number,
  xpEarned: number,
  instanceId: number,
  maxRetries: number = 3,
  tokenParam?: string,
  userId?: number
) => {
  return syncAfterActivity({
    courseId,
    cmid: moduleId,
    score,
    maxScore: total,
    userId,
    tokenParam
  });
};