// services/sync/progressSync.ts
// Fixes appliqués :
// ✅ Fix 1 : NON_GRADED_MODULES étendu (page, url, label, folder)
// ✅ Fix 2 : Suppression du hack activityId = cmid
// ✅ Fix 3 : Queue offline pour les syncs ratés
// ✅ Fix 4 : resolveIds utilisé partout correctement

import { moodleFetch } from '../api/moodleClient';
import { markActivitySynced } from '../storage/activity-progress';
import { updateStreakAfterActivity } from '../storage/streak';
import { addToSyncQueue } from '../storage/sync-queue';
import { getToken } from '../storage/tokenStorage';
import { resolveIds } from '../utils/moodleIdResolver';

const IS_DEV = process.env.NODE_ENV === 'development';

// ✅ Fix 1 : Liste complète des modules sans note
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

async function isOnline(): Promise<boolean> {
  try {
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_MOODLE_URL || "https://moodle.richatt.com"}/login/index.php`,
      { method: 'HEAD', signal: AbortSignal.timeout(3000) }
    );
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

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

  // Vérifier que l'instanceId est valide
  if (!instanceId || instanceId <= 0) {
    if (IS_DEV) console.warn('[ProgressSync] Instance ID invalide:', { instanceId, modname, courseId, cmid });
    return;
  }

  // Normaliser le score entre 0 et 100
  const normalizedGrade = maxScore > 0
    ? Math.round((score / maxScore) * 100)
    : score > 0 ? 100 : 0;

  if (IS_DEV) console.log(`[ProgressSync] Envoi note: modname=${modname}, instanceId=${instanceId}, normalizedGrade=${normalizedGrade}`);

  const gradeParams: any = {
    wstoken: token,
    wsfunction: 'core_grades_update_grades',
    source: 'ipelan_app',
    component: `mod_${modname}`,
    courseid: courseId,
    'grades[0][activityid]': String(instanceId),
    'grades[0][rawgrade]': String(normalizedGrade),
    moodlewsrestformat: 'json',
  };

  if (userId) {
    gradeParams['grades[0][userid]'] = userId;
  }

  try {
    const result = await moodleFetch('/webservice/rest/server.php', gradeParams, 'POST');
    if (result?.exception) {
      if (IS_DEV) console.warn('[ProgressSync] Moodle error response:', JSON.stringify(result));
      throw new Error(result.message || result.exception || 'Grade update exception');
    }
    if (IS_DEV) console.log(`[ProgressSync] ✅ Note envoyée ${modname} instance=${instanceId} score=${normalizedGrade}`);
  } catch (e: any) {
    if (IS_DEV) console.warn('[ProgressSync] Note échouée:', e.message);

    // ✅ Fix 3 : Mettre en queue si offline ou erreur temporaire
    const isOffline = !await isOnline();
    const isTempError = e.message?.includes('incorrect') || e.message?.includes('invalide') || e.message?.includes('parameter');
    if (isOffline || !isTempError) {
      await addToSyncQueue('grade', 'core_grades_update_grades', gradeParams);
    } else if (IS_DEV) {
      console.warn('[ProgressSync] Paramètre invalide - pas de retry automatique');
    }
  }
}

// ─── Complétion manuelle pour modules sans note ───────────────────────────────

async function markManualCompletion(
  token: string,
  cmid: number
): Promise<void> {
  const params = {
    wstoken: token,
    wsfunction: 'core_completion_update_activity_completion_status_manually',
    cmid: String(cmid),
    completed: '1',
    moodlewsrestformat: 'json',
  };

  try {
    const result = await moodleFetch('/webservice/rest/server.php', params, 'POST');
    if (result?.exception) {
      // Ignorer si déjà complété ou non activé
      if (result.errorcode === 'invalidparameter' || result.errorcode === 'completionnotenabled') {
        if (IS_DEV) console.info(`[ProgressSync] Complétion auto sur cmid=${cmid} — OK`);
        return;
      }
      throw new Error(result.message || 'Completion exception');
    }
    if (IS_DEV) console.log(`[ProgressSync] ✅ Complétion manuelle cmid=${cmid}`);
  } catch (e: any) {
    if (IS_DEV) console.warn('[ProgressSync] Complétion manuelle échouée:', e.message);

    // ✅ Fix 3 : Mettre en queue si offline
    if (!await isOnline()) {
      await addToSyncQueue(
        'completion',
        'core_completion_update_activity_completion_status_manually',
        params
      );
    }
  }
}

// ─── Fonction principale exportée ─────────────────────────────────────────────

export async function syncActivityCompletion(
  token: string,
  courseId: number,
  cmid: number,
  score: number,
  maxScore: number,
  userId?: number
): Promise<void> {
  // Résoudre le modname depuis le cache
  const resolved = await resolveIds(courseId, cmid, token);
  if (!resolved) {
    if (IS_DEV) console.warn('[ProgressSync] Module introuvable:', { courseId, cmid });
    return;
  }

  const { modname } = resolved;

  if (IS_DEV) console.log(`[ProgressSync] Sync ${modname} cmid=${cmid} score=${score}/${maxScore}`);

  if (GRADED_MODULES.has(modname)) {
    await updateActivityGrade(token, courseId, cmid, score, maxScore, userId);
  } else if (NON_GRADED_MODULES.has(modname)) {
    await markManualCompletion(token, cmid);
  } else {
    if (IS_DEV) console.warn(`[ProgressSync] Module type inconnu: "${modname}" cmid=${cmid}`);
    await markManualCompletion(token, cmid);
  }

  // ── Mettre à jour le streak ───────────────────────────────────────────────
  if (userId) {
    try {
      await updateStreakAfterActivity(userId);
    } catch (e: any) {
      if (IS_DEV) console.warn('[ProgressSync] Streak update échoué:', e.message);
    }
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

    await syncActivityCompletion(
      token,
      params.courseId,
      params.cmid,
      params.score,
      params.maxScore,
      params.userId
    );

    await markActivitySynced(params.cmid, params.courseId);
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
  // Cette fonction est un placeholder pour la compatibilité
  // La logique de sync est gérée par les autres fonctions
  if (IS_DEV) console.log('[ProgressSync] syncCourseProgress called:', { courseId, totalActivities, userId });
  return { success: true };
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