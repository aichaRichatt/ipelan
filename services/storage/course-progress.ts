import { getDBConnection } from './db-service';

export interface CourseProgressData {
  courseId: number;
  completedActivities: number;
  totalActivities: number;
  totalXP: number;
  bestScore: number;
  lastActivityAt: string;
  syncedAt?: string;
}

export interface CourseProgressStats {
  progressPercent: number;
  completedActivities: number;
  totalActivities: number;
  totalXP: number;
  avgScore: number;
}

export const saveCourseProgress = async (
  courseId: number,
  completedActivities: number,
  totalActivities: number,
  totalXP: number,
  bestScore: number = 0,
  userId: number = 0
): Promise<void> => {
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const db = await getDBConnection();
      const now = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO course_progress (user_id, course_id, completed_activities, total_activities, total_xp, best_score, last_activity_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, course_id) DO UPDATE SET
           completed_activities = MAX(excluded.completed_activities, completed_activities),
           total_activities = CASE WHEN excluded.total_activities > 0 THEN excluded.total_activities ELSE total_activities END,
           total_xp = MAX(excluded.total_xp, total_xp),
           best_score = MAX(excluded.best_score, best_score),
           last_activity_at = excluded.last_activity_at,
           synced_at = excluded.synced_at`,
        [
          userId,
          courseId,
          completedActivities,
          totalActivities,
          totalXP,
          bestScore,
          now,
          null,
        ]
      );

      console.log('[CourseProgress] Saved:', { courseId, completedActivities, totalActivities, totalXP });
      return;
    } catch (error: any) {
      lastError = error;
      const isLockError = error?.message?.includes('database is locked') || error?.code === 'database is locked';
      console.warn('[CourseProgress] Save attempt', attempt, 'failed:', isLockError ? 'database locked' : error.message);

      if (isLockError && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 100 * attempt));
      } else if (!isLockError) {
        break;
      }
    }
  }

  console.error('[CourseProgress] Failed to save after', maxRetries, 'attempts:', lastError);
};

export const getCourseProgress = async (
  courseId: number,
  userId?: number
): Promise<CourseProgressData | null> => {
  try {
    const db = await getDBConnection();
    const result = await db.getFirstAsync<{
      course_id: number;
      completed_activities: number;
      total_activities: number;
      total_xp: number;
      best_score: number;
      last_activity_at: string;
      synced_at: string;
    }>(
      userId != null
        ? 'SELECT * FROM course_progress WHERE course_id = ? AND user_id = ?'
        : 'SELECT * FROM course_progress WHERE course_id = ?',
      userId != null ? [courseId, userId] : [courseId]
    );

    if (!result) return null;

    return {
      courseId: result.course_id,
      completedActivities: result.completed_activities,
      totalActivities: result.total_activities,
      totalXP: result.total_xp,
      bestScore: result.best_score,
      lastActivityAt: result.last_activity_at,
      syncedAt: result.synced_at,
    };
  } catch (error) {
    console.error('Failed to get course progress:', error);
    return null;
  }
};

// Get progress percentage for completion check
export const getCourseProgressForCompletion = async (
  courseId: number,
  userId?: number
): Promise<{ progress: number; completed: number; total: number } | null> => {
  try {
    const db = await getDBConnection();
    const result = await db.getFirstAsync<{
      completed_activities: number;
      total_activities: number;
    }>(
      userId != null
        ? 'SELECT completed_activities, total_activities FROM course_progress WHERE course_id = ? AND user_id = ?'
        : 'SELECT completed_activities, total_activities FROM course_progress WHERE course_id = ?',
      userId != null ? [courseId, userId] : [courseId]
    );

    if (!result) return null;

    const completed = result.completed_activities || 0;
    const total = result.total_activities || 0;
    //  Progression capée à 100% maximum
    const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

    return { progress, completed, total };
  } catch (error) {
    console.error('[getCourseProgressForCompletion] Failed:', error);
    return null;
  }
};

export const getAllCourseProgress = async (userId?: number): Promise<CourseProgressData[]> => {
  try {
    const db = await getDBConnection();
    const results = await db.getAllAsync<{
      course_id: number;
      completed_activities: number;
      total_activities: number;
      total_xp: number;
      best_score: number;
      last_activity_at: string;
      synced_at: string;
    }>(
      userId != null
        ? 'SELECT * FROM course_progress WHERE user_id = ? ORDER BY last_activity_at DESC'
        : 'SELECT * FROM course_progress ORDER BY last_activity_at DESC',
      userId != null ? [userId] : []
    );

    return results.map((r) => ({
      courseId: r.course_id,
      completedActivities: r.completed_activities,
      totalActivities: r.total_activities,
      totalXP: r.total_xp,
      bestScore: r.best_score,
      lastActivityAt: r.last_activity_at,
      syncedAt: r.synced_at,
    }));
  } catch (error) {
    console.error('Failed to get all course progress:', error);
    return [];
  }
};

export const updateCourseProgressFromActivities = async (
  courseId: number,
  totalActivities: number,
  userId?: number
): Promise<CourseProgressStats> => {
  try {
    const db = await getDBConnection();
    const result = await db.getFirstAsync<{
      completed: number;
      total_xp: number;
      best_score: number;
    }>(
      userId != null
        ? `SELECT
            SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed,
            SUM(xp_earned) as total_xp,
            MAX(best_score) as best_score
           FROM activity_progress WHERE course_id = ? AND user_id = ?`
        : `SELECT
            SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed,
            SUM(xp_earned) as total_xp,
            MAX(best_score) as best_score
           FROM activity_progress WHERE course_id = ?`,
      userId != null ? [courseId, userId] : [courseId]
    );

    const completed = result?.completed || 0;
    const totalXP = result?.total_xp || 0;
    const bestScore = result?.best_score || 0;
    const progressPercent = totalActivities > 0 ? Math.min(100, Math.round((completed / totalActivities) * 100)) : 0;

    await saveCourseProgress(courseId, completed, totalActivities, totalXP, bestScore, userId ?? 0);

    return {
      progressPercent,
      completedActivities: completed,
      totalActivities,
      totalXP,
      avgScore: bestScore,
    };
  } catch (error) {
    console.error('Failed to update course progress from activities:', error);
    return {
      progressPercent: 0,
      completedActivities: 0,
      totalActivities: 0,
      totalXP: 0,
      avgScore: 0,
    };
  }
};

export const markActivityCompleted = async (
  moduleId: number,
  courseId: number
): Promise<void> => {
  try {
    const db = await getDBConnection();
    await db.runAsync(
      `UPDATE activity_progress SET is_completed = 1, synced_at = NULL WHERE module_id = ? AND course_id = ?`,
      [moduleId, courseId]
    );
  } catch (error) {
    console.error('Failed to mark activity completed:', error);
  }
};

// ── Filtrage strict des activités complétables ──────────────────────────

export interface CompletableModule {
  cmid: number;
  instanceId: number;
  modname: string;
  name: string;
  completion: number; // 0=aucun, 1=manuel, 2=automatique
}

const NON_ACTIVITY_TYPES = ['label', 'section'];

export function getCompletableModules(sections: any[]): CompletableModule[] {
  const completable: CompletableModule[] = [];

  for (const section of sections ?? []) {
    for (const mod of section.modules ?? []) {
      // Règle 1 : completion > 0 = suivi d'achèvement activé dans Moodle
      if (!mod.completion || mod.completion === 0) continue;

      // Règle 2 : Ignorer les modules non-activités (labels, sections)
      if (NON_ACTIVITY_TYPES.includes(mod.modname)) continue;

      // Règle 3 : Ignorer les modules cachés
      if (mod.visible === 0) continue;

      // Règle 4 : instanceId valide obligatoire
      if (!mod.instance || mod.instance === 0) continue;

      completable.push({
        cmid: mod.id,
        instanceId: mod.instance,
        modname: mod.modname,
        name: mod.name,
        completion: mod.completion,
      });
    }
  }

  return completable;
}

// ── Calcul fiable de la progression d'un cours ──────────────────────────

export async function calculateCourseProgress(
  courseId: number,
  sections: any[],
  moodleCompletionStatuses?: { cmid: number; completionstate: number }[],
  userId?: number
): Promise<{
  completed: number;
  total: number;
  percentage: number;
}> {
  const completable = getCompletableModules(sections);
  const total = completable.length;

  if (total === 0) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  // Source 1 : Statut Moodle (plus fiable)
  const moodleMap = new Map<number, boolean>();
  if (moodleCompletionStatuses) {
    for (const stat of moodleCompletionStatuses) {
      moodleMap.set(stat.cmid, stat.completionstate >= 1);
    }
  }

  // Source 2 : Données locales SQLite (pour hors-ligne)
  const localMap = new Map<number, boolean>();
  try {
    const db = await getDBConnection();
    const rows = await db.getAllAsync<{ module_id: number; is_completed: number }>(
      userId != null
        ? `SELECT module_id, is_completed FROM activity_progress WHERE course_id = ? AND user_id = ? AND is_completed = 1`
        : `SELECT module_id, is_completed FROM activity_progress WHERE course_id = ? AND is_completed = 1`,
      userId != null ? [courseId, userId] : [courseId]
    );
    rows.forEach(r => localMap.set(r.module_id, true));
  } catch {
    console.warn('[calculateCourseProgress] Failed to read local progress');
  }

  // Fusionner : Priorité Moodle > Local
  let completedCount = 0;
  for (const mod of completable) {
    const isCompleted =
      moodleMap.get(mod.cmid) ??
      localMap.get(mod.cmid) ??
      false;

    if (isCompleted) {
      completedCount++;
    }
  }

  const percentage = Math.round((completedCount / total) * 100);

  console.log('[calculateCourseProgress]', { courseId, total, completed: completedCount, percentage });

  return { completed: completedCount, total, percentage };
}