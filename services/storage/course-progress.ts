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
  bestScore: number = 0
): Promise<void> => {
  const maxRetries = 3;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const db = await getDBConnection();
      const now = new Date().toISOString();
      
      await db.runAsync(
        `INSERT INTO course_progress (course_id, completed_activities, total_activities, total_xp, best_score, last_activity_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(course_id) DO UPDATE SET
           completed_activities = MAX(excluded.completed_activities, completed_activities),
           total_activities = MAX(excluded.total_activities, total_activities),
           total_xp = MAX(excluded.total_xp, total_xp),
           best_score = MAX(excluded.best_score, best_score),
           last_activity_at = excluded.last_activity_at,
           synced_at = excluded.synced_at`,
        [
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
  courseId: number
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
      'SELECT * FROM course_progress WHERE course_id = ?',
      [courseId]
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

export const getAllCourseProgress = async (): Promise<CourseProgressData[]> => {
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
    }>('SELECT * FROM course_progress ORDER BY last_activity_at DESC');

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
  totalActivities: number
): Promise<CourseProgressStats> => {
  try {
    const db = await getDBConnection();
    const result = await db.getFirstAsync<{
      completed: number;
      total_xp: number;
      best_score: number;
    }>(
      `SELECT 
        SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed,
        SUM(xp_earned) as total_xp,
        MAX(best_score) as best_score
       FROM activity_progress WHERE course_id = ?`,
      [courseId]
    );

    const completed = result?.completed || 0;
    const totalXP = result?.total_xp || 0;
    const bestScore = result?.best_score || 0;
    const progressPercent = totalActivities > 0 ? Math.round((completed / totalActivities) * 100) : 0;

    await saveCourseProgress(courseId, completed, totalActivities, totalXP, bestScore);

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