import { getDBConnection } from '../storage/db-service';
import { moodleFetch } from './moodleClient';

export async function initStreakTable(): Promise<void> {
  const db = await getDBConnection();
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

/**
 * Met à jour le streak utilisateur après une activité.
 *
 * Source de vérité : table `user_streaks` (gérée par services/storage/streak.ts).
 * Cette fonction délègue à `updateStreakAfterActivity` puis met à jour le miroir
 * dans `users.streak` pour les lectures rapides côté UI.
 */
export async function updateStreak(userId: number): Promise<number> {
  try {
    const { updateStreakAfterActivity } = await import('../storage/streak');
    const updated = await updateStreakAfterActivity(userId);

    const db = await getDBConnection();
    await db.runAsync(
      `UPDATE users SET streak = ?, last_activity = ? WHERE id = ?`,
      [updated.currentStreak, updated.lastActivityDate, userId]
    );

    return updated.currentStreak;
  } catch (err) {
    console.warn('[userProgressService] updateStreak error:', err);
    return 1;
  }
}

export async function setXP(userId: number, xp: number): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.runAsync(
      `UPDATE users SET ipelan_xp = ? WHERE id = ?`,
      [Math.max(0, xp), userId]
    );
  } catch (err) {
    console.warn('[userProgressService] setXP error:', err);
  }
}

export async function setStreak(userId: number, streak: number, best?: number): Promise<void> {
  try {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const db = await getDBConnection();
    await db.runAsync(
      `UPDATE users SET streak = ?, last_activity = ? WHERE id = ?`,
      [Math.max(1, streak), localDate, userId]
    );
  } catch (err) {
    console.warn('[userProgressService] setStreak error:', err);
  }
}

export async function setCoins(userId: number, coins: number): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.runAsync(
      `UPDATE users SET coins = ? WHERE id = ?`,
      [Math.max(0, coins), userId]
    );
  } catch (err) {
    console.warn('[userProgressService] setCoins error:', err);
  }
}

export async function setLives(userId: number, lives: number): Promise<void> {
  try {
    const db = await getDBConnection();
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
    const db = await getDBConnection();
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
    const db = await getDBConnection();
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
    const db = await getDBConnection();
    const row = await db.getFirstAsync(
      `SELECT
         u.ipelan_xp as xp,
         u.coins,
         COALESCE(s.current_streak, u.streak, 0) as streak_current,
         COALESCE(s.best_streak, u.streak, 0) as streak_best
       FROM users u
       LEFT JOIN user_streaks s ON s.user_id = u.id
       WHERE u.id = ?`,
      [userId]
    ) as {
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
    await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_completion_update_activity_completion_status_manually',
      moodlewsrestformat: 'json',
      cmid: moduleId,
      completed: passed ? 1 : 0,
    });

    console.log('[Grade] Completion marked for module:', moduleId, 'passed:', passed);
    return true;
  } catch (err: any) {
    const errCode = err?.errorcode || '';
    const errMsg = err?.message || String(err);

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
    const db = await getDBConnection();
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
    const db = await getDBConnection();
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
    const db = await getDBConnection();
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
    const db = await getDBConnection();
    await db.runAsync('DELETE FROM pending_sync WHERE id = ?', [id]);
  } catch (err: any) {
    console.warn('[pending_sync] Failed to delete:', err.message);
  }
}
