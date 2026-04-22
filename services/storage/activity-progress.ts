import { getDBConnection } from './db-service';
import { ActivityProgress, ActivityType } from '../../types/activity';

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
        progress.score,
        progress.total,
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
  xpEarned: number = 0
): Promise<void> => {
  const maxRetries = 3;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const db = await getDBConnection();
      const isCompleted = score >= total * 0.5;
      const now = new Date().toISOString();
      
      await db.runAsync(
        `INSERT INTO activity_progress (module_id, course_id, type, best_score, total_score, attempts_count, is_completed, last_attempt, xp_earned, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(module_id, course_id) DO UPDATE SET
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
           synced_at = NULL`,
        [
          moduleId,
          courseId,
          type,
          score,
          total,
          1,
          isCompleted ? 1 : 0,
          now,
          xpEarned,
          null,
        ]
      );
      
      console.log('[ActivityProgress] Saved score:', { moduleId, score, total, bestScore: score, xpEarned });
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
  courseId: number
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
      'SELECT * FROM activity_progress WHERE module_id = ? AND course_id = ?',
      [moduleId, courseId]
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
  courseId: number
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
      synced_at: string;
    }>('SELECT * FROM activity_progress WHERE course_id = ?', [courseId]);

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
        syncedAt: r.synced_at,
      });
    }
    return scoreMap;
  } catch (error) {
    console.error('Failed to get all scores for course:', error);
    return new Map();
  }
};

export const getActivityProgress = async (
  moduleId: number,
  courseId: number
): Promise<ActivityProgress | null> => {
  try {
    const db = await getDBConnection();
    const result = await db.getFirstAsync<{
      module_id: number;
      course_id: number;
      type: string;
      score: number;
      total: number;
      attempts: number;
      is_completed: number;
      last_attempt: string;
      xp_earned: number;
    }>(
      'SELECT * FROM activity_progress WHERE module_id = ? AND course_id = ?',
      [moduleId, courseId]
    );

    if (!result) return null;

    return {
      moduleId: result.module_id,
      courseId: result.course_id,
      type: result.type as ActivityType,
      score: result.score,
      total: result.total,
      attempts: result.attempts,
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
  courseId: number
): Promise<ActivityProgress[]> => {
  try {
    const db = await getDBConnection();
    const results = await db.getAllAsync<{
      module_id: number;
      course_id: number;
      type: string;
      score: number;
      total: number;
      attempts: number;
      is_completed: number;
      last_attempt: string;
      xp_earned: number;
    }>('SELECT * FROM activity_progress WHERE course_id = ?', [courseId]);

    return results.map((r) => ({
      moduleId: r.module_id,
      courseId: r.course_id,
      type: r.type as ActivityType,
      score: r.score,
      total: r.total,
      attempts: r.attempts,
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
  courseId: number
): Promise<number> => {
  try {
    const db = await getDBConnection();
    const result = await db.runAsync(
      'UPDATE activity_progress SET attempts = attempts + 1 WHERE module_id = ? AND course_id = ?',
      [moduleId, courseId]
    );
    const current = await db.getFirstAsync<{ attempts: number }>(
      'SELECT attempts FROM activity_progress WHERE module_id = ? AND course_id = ?',
      [moduleId, courseId]
    );
    return current?.attempts || 1;
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