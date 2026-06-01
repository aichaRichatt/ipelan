import { ActivityProgress, ActivityType } from '../../types/activity';
import { addXP, updateStreak } from '../api/userProgressService';
import { syncQueue } from '../sync/syncQueue';
import { getDBConnection } from './db-service';
const IS_DEV = process.env.NODE_ENV === 'development'
export interface ActivityScoreData {
  moduleId: number;
  courseId: number;
  type: ActivityType;
  bestScore: number;
  totalScore: number;
  attemptsCount: number;
  isCompleted: boolean;
  lastAttempt: string;
  xpEarned: number;
  syncedAt?: string;
}

export const saveActivityProgress = async (
  progress: ActivityProgress
): Promise<void> => {
  try {
    const db = await getDBConnection();
    await db.runAsync(
      `INSERT INTO activity_progress (module_id, course_id, type, best_score, total_score, attempts_count, is_completed, last_attempt, xp_earned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(module_id, course_id) DO UPDATE SET
         best_score = MAX(excluded.best_score, best_score),
         total_score = excluded.total_score,
         attempts_count = attempts_count + 1,
         is_completed = excluded.is_completed,
         last_attempt = excluded.last_attempt,
         xp_earned = MAX(excluded.xp_earned, xp_earned)`,
      [
        progress.moduleId,
        progress.courseId,
        progress.type,
        progress.bestScore,
        progress.totalScore,
        1,
        progress.isCompleted ? 1 : 0,
        progress.lastAttempt,
        progress.xpEarned,
      ]
    );
  } catch (error) {
    console.error('Failed to save activity progress:', error);
    throw error;
  }
};

export const saveActivityScore = async (
  moduleId: number,
  courseId: number,
  type: ActivityType,
  score: number,
  total: number,
  xpEarned: number = 0,
  userId?: number,
  coinsEarned: number = 0,
  token?: string
): Promise<void> => {
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const db = await getDBConnection();
      const isCompleted = score >= total * 0.6;
      if (IS_DEV) {
        console.log(`[saveActivityScore] moduleId=${moduleId}, courseId=${courseId}, score=${score}/${total}, isCompleted=${isCompleted}`);
      }
      const now = new Date().toISOString();

      // Read existing record to compute XP delta correctly:
      // - First save → award full xpEarned
      // - Retry with better score → award only the improvement delta
      // - Retry with same/lower score → award nothing (prevents double-accumulation)
      const existing = userId != null
        ? await db.getFirstAsync<{ xp_earned: number }>(
            'SELECT xp_earned FROM activity_progress WHERE user_id = ? AND module_id = ? AND course_id = ?',
            [userId, moduleId, courseId]
          )
        : null;
      const isFirstSave = !existing;
      const xpDelta = isFirstSave
        ? xpEarned
        : Math.max(0, xpEarned - (existing?.xp_earned ?? 0));

      await db.runAsync(
        `INSERT INTO activity_progress (user_id, module_id, course_id, type, best_score, total_score, attempts_count, is_completed, last_attempt, xp_earned, coins_earned, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, module_id, course_id) DO UPDATE SET
           best_score = CASE
             WHEN excluded.best_score > best_score THEN excluded.best_score
             ELSE best_score
           END,
           total_score = excluded.total_score,
           attempts_count = attempts_count + 1,
           is_completed = CASE
             WHEN excluded.best_score >= best_score AND excluded.is_completed = 1 THEN 1
             ELSE is_completed
           END,
           last_attempt = excluded.last_attempt,
           xp_earned = CASE
             WHEN excluded.xp_earned > xp_earned THEN excluded.xp_earned
             ELSE xp_earned
           END,
           coins_earned = CASE
             WHEN excluded.coins_earned > coins_earned THEN excluded.coins_earned
             ELSE coins_earned
           END,
           synced_at = NULL`,
        [
          userId || null,
          moduleId,
          courseId,
          type,
          score,
          total,
          1,
          isCompleted ? 1 : 0,
          now,
          xpEarned,
          coinsEarned,
          null,
        ]
      );

      // Award XP delta: full amount on first save, only the improvement on retries
      // updateStreak only when user actually earned XP (not on score=0 saves)
      if (userId && xpDelta > 0) {
        await addXP(userId, xpDelta);
        await updateStreak(userId);
        if (token) {
          syncQueue.syncGamification(userId, token);
        }
      }

      if (IS_DEV) console.log('[ActivityProgress] Saved score:', { moduleId, score, total, bestScore: score, xpEarned });
      return;
    } catch (error: any) {
      lastError = error;
      const isLockError = error?.message?.includes('database is locked') || error?.code === 'database is locked';
      console.warn('[ActivityProgress] Save attempt', attempt, 'failed:', isLockError ? 'database locked' : error.message);

      if (isLockError && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 100 * attempt));
      } else if (!isLockError) {
        break;
      }
    }
  }

  console.error('[ActivityProgress] Failed to save after', maxRetries, 'attempts:', lastError);
};

export const getBestScore = async (
  moduleId: number,
  courseId: number,
  userId?: number
): Promise<ActivityScoreData | null> => {
  try {
    const db = await getDBConnection();
    const result = await db.getFirstAsync<{
      module_id: number;
      course_id: number;
      type: string;
      best_score: number;
      total_score: number;
      attempts_count: number;
      is_completed: number;
      last_attempt: string;
      xp_earned: number;
      synced_at: string;
    }>(
      userId != null
        ? 'SELECT * FROM activity_progress WHERE module_id = ? AND course_id = ? AND user_id = ?'
        : 'SELECT * FROM activity_progress WHERE module_id = ? AND course_id = ?',
      userId != null ? [moduleId, courseId, userId] : [moduleId, courseId]
    );

    if (!result) return null;

    return {
      moduleId: result.module_id,
      courseId: result.course_id,
      type: result.type as ActivityType,
      bestScore: result.best_score,
      totalScore: result.total_score,
      attemptsCount: result.attempts_count,
      isCompleted: result.is_completed === 1,
      lastAttempt: result.last_attempt,
      xpEarned: result.xp_earned,
      syncedAt: result.synced_at,
    };
  } catch (error) {
    console.error('Failed to get best score:', error);
    return null;
  }
};

export const getAllScoresForCourse = async (
  courseId: number,
  userId?: number
): Promise<Map<number, ActivityScoreData>> => {
  try {
    const db = await getDBConnection();
    const results = await db.getAllAsync<{
      module_id: number;
      course_id: number;
      type: string;
      best_score: number;
      total_score: number;
      attempts_count: number;
      is_completed: number;
      last_attempt: string;
      xp_earned: number;
    }>(
      userId != null
        ? 'SELECT * FROM activity_progress WHERE course_id = ? AND user_id = ?'
        : 'SELECT * FROM activity_progress WHERE course_id = ?',
      userId != null ? [courseId, userId] : [courseId]
    );

    const scoreMap = new Map<number, ActivityScoreData>();
    for (const r of results) {
      scoreMap.set(r.module_id, {
        moduleId: r.module_id,
        courseId: r.course_id,
        type: r.type as ActivityType,
        bestScore: r.best_score,
        totalScore: r.total_score,
        attemptsCount: r.attempts_count,
        isCompleted: r.is_completed === 1,
        lastAttempt: r.last_attempt,
        xpEarned: r.xp_earned,
      });
    }
    return scoreMap;
  } catch (error) {
    console.error('Failed to get all scores for course:', error);
    return new Map();
  }
};


export const markActivitySynced = async (
  moduleId: number,
  courseId: number,
  userId?: number
): Promise<void> => {
  try {
    const db = await getDBConnection();
    const now = new Date().toISOString();

    await db.runAsync(
      userId != null
        ? `UPDATE activity_progress 
           SET synced_at = ?
           WHERE module_id = ? AND course_id = ? AND user_id = ?`
        : `UPDATE activity_progress 
           SET synced_at = ?
           WHERE module_id = ? AND course_id = ?`,
      userId != null ? [now, moduleId, courseId, userId] : [now, moduleId, courseId]
    );

    console.log('[ActivityProgress]   Marked as synced:', { moduleId, courseId });
  } catch (error) {
    console.error('[ActivityProgress] Failed to mark as synced:', error);
    // Don't throw - this is non-critical
  }
};

/**
 * Check if an activity was already synced
 * Returns true if synced_at is set
 */
export const isActivitySynced = async (
  moduleId: number,
  courseId: number,
  userId?: number
): Promise<boolean> => {
  try {
    const db = await getDBConnection();
    const result = await db.getFirstAsync<{ synced_at: string | null }>(
      userId != null
        ? `SELECT synced_at FROM activity_progress 
           WHERE module_id = ? AND course_id = ? AND user_id = ?`
        : `SELECT synced_at FROM activity_progress 
           WHERE module_id = ? AND course_id = ?`,
      userId != null ? [moduleId, courseId, userId] : [moduleId, courseId]
    );

    return !!result?.synced_at;
  } catch (error) {
    console.error('[ActivityProgress] Failed to check sync status:', error);
    return false;
  }
};

export const getActivityProgress = async (
  moduleId: number,
  courseId: number,
  userId?: number
): Promise<ActivityProgress | null> => {
  try {
    const db = await getDBConnection();
    const result = await db.getFirstAsync<{
      module_id: number;
      course_id: number;
      type: string;
      best_score: number;
      total_score: number;
      attempts_count: number;
      is_completed: number;
      last_attempt: string;
      xp_earned: number;
    }>(
      userId != null
        ? 'SELECT * FROM activity_progress WHERE module_id = ? AND course_id = ? AND user_id = ?'
        : 'SELECT * FROM activity_progress WHERE module_id = ? AND course_id = ?',
      userId != null ? [moduleId, courseId, userId] : [moduleId, courseId]
    );

    if (!result) return null;

    return {
      moduleId: result.module_id,
      courseId: result.course_id,
      type: result.type as ActivityType,
      bestScore: result.best_score,
      totalScore: result.total_score,
      attempts: result.attempts_count,
      isCompleted: result.is_completed === 1,
      lastAttempt: result.last_attempt,
      xpEarned: result.xp_earned,
    };
  } catch (error) {
    console.error('Failed to get activity progress:', error);
    return null;
  }
};

export const getAllProgressForCourse = async (
  courseId: number,
  userId?: number
): Promise<ActivityProgress[]> => {
  try {
    const db = await getDBConnection();
    const results = await db.getAllAsync<{
      module_id: number;
      course_id: number;
      type: string;
      best_score: number;
      total_score: number;
      attempts_count: number;
      is_completed: number;
      last_attempt: string;
      xp_earned: number;
    }>(
      userId != null
        ? 'SELECT * FROM activity_progress WHERE course_id = ? AND user_id = ?'
        : 'SELECT * FROM activity_progress WHERE course_id = ?',
      userId != null ? [courseId, userId] : [courseId]
    );

    return results.map((r) => ({
      moduleId: r.module_id,
      courseId: r.course_id,
      type: r.type as ActivityType,
      bestScore: r.best_score,
      totalScore: r.total_score,
      attempts: r.attempts_count,
      isCompleted: r.is_completed === 1,
      lastAttempt: r.last_attempt,
      xpEarned: r.xp_earned,
    }));
  } catch (error) {
    console.error('Failed to get all progress for course:', error);
    return [];
  }
};

export const incrementActivityAttempts = async (
  moduleId: number,
  courseId: number,
  userId?: number
): Promise<number> => {
  try {
    const db = await getDBConnection();
    await db.runAsync(
      userId != null
        ? 'UPDATE activity_progress SET attempts_count = MAX(attempts_count, 1) + 1 WHERE module_id = ? AND course_id = ? AND user_id = ?'
        : 'UPDATE activity_progress SET attempts_count = MAX(attempts_count, 1) + 1 WHERE module_id = ? AND course_id = ?',
      userId != null ? [moduleId, courseId, userId] : [moduleId, courseId]
    );
    const current = await db.getFirstAsync<{ attempts_count: number }>(
      userId != null
        ? 'SELECT attempts_count FROM activity_progress WHERE module_id = ? AND course_id = ? AND user_id = ?'
        : 'SELECT attempts_count FROM activity_progress WHERE module_id = ? AND course_id = ?',
      userId != null ? [moduleId, courseId, userId] : [moduleId, courseId]
    );
    return current?.attempts_count || 1;
  } catch (error) {
    console.error('Failed to increment attempts:', error);
    return 1;
  }
};

export const getCourseActivityStats = async (
  courseId: number
): Promise<{
  total: number;
  completed: number;
  totalXp: number;
}> => {
  try {
    const db = await getDBConnection();
    const result = await db.getFirstAsync<{
      total: number;
      completed: number;
      totalXp: number;
    }>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed,
        SUM(xp_earned) as totalXp
       FROM activity_progress WHERE course_id = ?`,
      [courseId]
    );
    return result || { total: 0, completed: 0, totalXp: 0 };
  } catch (error) {
    console.error('Failed to get course activity stats:', error);
    return { total: 0, completed: 0, totalXp: 0 };
  }
};

export interface QuizStats {
  quizPassed: number;
  perfectScores: number;
}

/**
 * Compte les quiz réussis et les scores parfaits pour un utilisateur.
 * quizPassed  = type='quiz' AND is_completed=1
 * perfectScores = best_score >= total_score AND total_score > 0
 */
export const getQuizStats = async (userId: number | null | undefined): Promise<QuizStats> => {
  try {
    const db = await getDBConnection();
    const userFilter = userId != null ? 'AND user_id = ?' : '';
    const params = userId != null ? [userId, userId] : [];
    const result = await db.getFirstAsync<{ quizPassed: number; perfectScores: number }>(
      `SELECT
         SUM(CASE WHEN type = 'quiz' AND is_completed = 1 ${userFilter} THEN 1 ELSE 0 END) AS quizPassed,
         SUM(CASE WHEN best_score >= total_score AND total_score > 0 ${userFilter} THEN 1 ELSE 0 END) AS perfectScores
       FROM activity_progress`,
      params
    );
    return {
      quizPassed: result?.quizPassed ?? 0,
      perfectScores: result?.perfectScores ?? 0,
    };
  } catch (error) {
    console.error('[ActivityProgress] Failed to get quiz stats:', error);
    return { quizPassed: 0, perfectScores: 0 };
  }
};