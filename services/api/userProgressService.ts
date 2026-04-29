import { getDBConnection } from '../storage/db-service';
import { moodleFetch } from './moodleClient';

let dbInstance: any = null;

async function getDB() {
  if (!dbInstance) {
    dbInstance = await getDBConnection();
  }
  return dbInstance;
}

export async function initStreakTable(): Promise<void> {
  const db = await getDB();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_sync (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_type TEXT NOT NULL,
      module_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      retries INTEGER DEFAULT 0,
      last_attempt TEXT,
      status TEXT DEFAULT 'pending'
    );
  `);
}

export async function updateStreak(userId: number): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  try {
    const db = await getDB();
    const row = await db.getFirstAsync('SELECT streak as streak_current, streak as streak_best, last_activity FROM users WHERE id = ?', [userId]) as {
      streak_current: number;
      streak_best: number;
      last_activity: string;
    } | null;

    let current = row?.streak_current ?? 1;
    let best = row?.streak_best ?? current;

    if (row && row.last_activity) {
      // Comparaison basée sur les jours calendaires
      const lastDate = new Date(row.last_activity);
      const todayDate = new Date(today);
      
       lastDate.setHours(0, 0, 0, 0);
      todayDate.setHours(0, 0, 0, 0);
      
      const diffTime = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        current = (row.streak_current || 0) + 1;
      } else if (diffDays === 0) {
        current = row.streak_current || 1;
      } else if (diffDays > 1) {
        current = 1; // Série brisée
      }

      best = Math.max(best, current);
    }

    const db2 = await getDB();
    await db2.runAsync(
      `UPDATE users SET streak = ?, last_activity = ? WHERE id = ?`,
      [current, today, userId]
    );

    return current;
  } catch (err) {
    console.warn('[userProgressService] updateStreak error:', err);
    return 1;
  }
}

// Set XP to a specific value (for sync from Moodle - replaces local value)
export async function setXP(userId: number, xp: number): Promise<void> {
  try {
    const db = await getDB();
    await db.runAsync(
      `UPDATE users SET ipelan_xp = ? WHERE id = ?`,
      [Math.max(0, xp), userId]
    );
  } catch (err) {
    console.warn('[userProgressService] setXP error:', err);
  }
}

// Set streak to a specific value (for sync from Moodle - replaces local value)
export async function setStreak(userId: number, streak: number, best?: number): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const db = await getDB();
    await db.runAsync(
      `UPDATE users SET streak = ?, last_activity = ? WHERE id = ?`,
      [Math.max(1, streak), today, userId]
    );
  } catch (err) {
    console.warn('[userProgressService] setStreak error:', err);
  }
}

// Set coins to a specific value (for sync from Moodle)
export async function setCoins(userId: number, coins: number): Promise<void> {
  try {
    const db = await getDB();
    await db.runAsync(
      `UPDATE users SET coins = ? WHERE id = ?`,
      [Math.max(0, coins), userId]
    );
  } catch (err) {
    console.warn('[userProgressService] setCoins error:', err);
  }
}

// Set lives to a specific value (for sync from Moodle)
export async function setLives(userId: number, lives: number): Promise<void> {
  try {
    const db = await getDB();
    await db.runAsync(
      `UPDATE users SET lives = ? WHERE id = ?`,
      [Math.max(0, Math.min(6, lives)), userId]
    );
  } catch (err) {
    console.warn('[userProgressService] setLives error:', err);
  }
}

export async function addXP(userId: number, xpToAdd: number): Promise<number> {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync('SELECT ipelan_xp as xp FROM users WHERE id = ?', [userId]) as { xp: number } | null;

    const currentXP = (row?.xp ?? 0) + xpToAdd;

    await db.runAsync(
      `UPDATE users SET ipelan_xp = ? WHERE id = ?`,
      [currentXP, userId]
    );

    return currentXP;
  } catch (err) {
    console.warn('[userProgressService] addXP error:', err);
    return xpToAdd;
  }
}

export async function addCoins(userId: number, coinsToAdd: number): Promise<number> {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync('SELECT coins FROM users WHERE id = ?', [userId]) as { coins: number } | null;

    const currentCoins = (row?.coins ?? 0) + coinsToAdd;

    await db.runAsync(
      `UPDATE users SET coins = ? WHERE id = ?`,
      [currentCoins, userId]
    );

    return currentCoins;
  } catch (err) {
    console.warn('[userProgressService] addCoins error:', err);
    return coinsToAdd;
  }
}

export async function getUserProgress(userId: number): Promise<{
  xp: number;
  coins: number;
  streak_current: number;
  streak_best: number;
} | null> {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync('SELECT ipelan_xp as xp, coins, streak as streak_current, streak as streak_best FROM users WHERE id = ?', [userId]) as {
      xp: number;
      coins: number;
      streak_current: number;
      streak_best: number;
    } | null;

    return row ?? null;
  } catch (err) {
    console.warn('[userProgressService] getUserProgress error:', err);
    return null;
  }
}

// syncUserProgressToMoodle and syncCoinsToMoodle are removed, use syncQueue.syncGamification instead.

// saveActivityResult is deprecated, use saveActivityScore in services/storage/activity-progress.ts instead.

export async function submitGradeToMoodle(params: {
  userId: number;
  courseId: number;
  moduleId: number;
  score: number;
  total: number;
  token: string;
}): Promise<boolean> {
  const { moduleId, score, total, token } = params;
  const percentage = Math.round((score / Math.max(total, 1)) * 100);
  const passed = percentage >= 50;

  if (!token || token.length < 10) {
    console.warn('[Grade] Missing token, cannot submit completion to Moodle');
    return false;
  }

  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_completion_update_activity_completion_status_manually',
      moodlewsrestformat: 'json',
      cmid: moduleId,
      completionstate: passed ? 1 : 0,
      completionnotify: 0,
    });

    if (result?.exception) {
      const errCode = result.errorcode || '';
      const errMsg = result.message || '';

      if (errCode === 'invalidparameter' || errMsg.includes('Valeur incorrecte')) {
        console.warn('[Grade] Completion not enabled on cmid:', moduleId);
        return false;
      }

      if (errCode === 'invalidtoken' || errMsg.includes('invalid token')) {
        console.error('[Grade] Invalid token for cmid:', moduleId);
        return false;
      }

      console.warn('[Grade] Completion update failed:', errCode || errMsg);
      return false;
    }

    console.log('[Grade] Completion marked for module:', moduleId, 'passed:', passed);
    return true;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.warn('[Grade] Completion update exception:', errorMsg);
    return false;
  }
}

export interface PendingSyncRecord {
  id: number;
  activity_type: string;
  module_id: number;
  course_id: number;
  payload: string;
  created_at: string;
  retries: number;
  last_attempt: string | null;
  status: string;
}

export async function addPendingSync(
  activityType: string,
  moduleId: number,
  courseId: number,
  payload: Record<string, any>
): Promise<boolean> {
  try {
    const db = await getDB();
    await db.runAsync(
      `INSERT INTO pending_sync (activity_type, module_id, course_id, payload, status) VALUES (?, ?, ?, ?, ?)`,
      [activityType, moduleId, courseId, JSON.stringify(payload), 'pending']
    );
    return true;
  } catch (err: any) {
    console.warn('[pending_sync] Failed to add:', err.message);
    return false;
  }
}

export async function getPendingSync(): Promise<PendingSyncRecord[]> {
  try {
    const db = await getDB();
    return await db.getAllAsync('SELECT * FROM pending_sync WHERE status = ? ORDER BY created_at ASC', ['pending']) as PendingSyncRecord[];
  } catch (err: any) {
    console.warn('[pending_sync] Failed to get:', err.message);
    return [];
  }
}

export async function updatePendingSync(
  id: number,
  status: string,
  incrementRetries: boolean = false
): Promise<void> {
  try {
    const db = await getDB();
    if (incrementRetries) {
      await db.runAsync(
        'UPDATE pending_sync SET status = ?, retries = retries + 1, last_attempt = ? WHERE id = ?',
        [status, new Date().toISOString(), id]
      );
    } else {
      await db.runAsync(
        'UPDATE pending_sync SET status = ?, last_attempt = ? WHERE id = ?',
        [status, new Date().toISOString(), id]
      );
    }
  } catch (err: any) {
    console.warn('[pending_sync] Failed to update:', err.message);
  }
}

export async function deletePendingSync(id: number): Promise<void> {
  try {
    const db = await getDB();
    await db.runAsync('DELETE FROM pending_sync WHERE id = ?', [id]);
  } catch (err: any) {
    console.warn('[pending_sync] Failed to delete:', err.message);
  }
}
