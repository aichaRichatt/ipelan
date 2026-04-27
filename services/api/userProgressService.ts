import { moodleFetch } from './moodleClient';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('ipelan.db');

export async function initStreakTable(): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS streaks (
      user_id      INTEGER PRIMARY KEY,
      last_date    TEXT,
      current      INTEGER DEFAULT 0,
      best         INTEGER DEFAULT 0
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      xp INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 0,
      streak_current INTEGER DEFAULT 0,
      streak_best INTEGER DEFAULT 0,
      last_activity TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function updateStreak(userId: number): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  try {
    const row = await db.getFirstAsync<{
      user_id: number;
      last_date: string;
      streak_current: number;
      streak_best: number;
    }>('SELECT * FROM user_progress WHERE user_id = ?', [userId]);

    let current = 1;
    let best = row?.streak_best ?? 1;

    if (row) {
      const last = new Date(row.last_date);
      const diffDays = Math.floor((Date.now() - last.getTime()) / 86_400_000);

      if (diffDays === 1) {
        current = row.streak_current + 1;
      } else if (diffDays === 0) {
        current = row.streak_current;
      }

      best = Math.max(best, current);
    }

    await db.runAsync(
      `INSERT INTO user_progress (user_id, streak_current, streak_best, last_activity, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         streak_current = excluded.streak_current,
         streak_best = excluded.streak_best,
         last_activity = excluded.last_activity,
         updated_at = datetime('now')`,
      [userId, current, best, today]
    );

    return current;
  } catch (err) {
    console.warn('[userProgressService] updateStreak error:', err);
    return 1;
  }
}

export async function addXP(userId: number, xpToAdd: number): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ xp: number }>(
      'SELECT xp FROM user_progress WHERE user_id = ?',
      [userId]
    );

    const currentXP = (row?.xp ?? 0) + xpToAdd;

    await db.runAsync(
      `INSERT INTO user_progress (user_id, xp, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         xp = excluded.xp,
         updated_at = datetime('now')`,
      [userId, currentXP]
    );

    return currentXP;
  } catch (err) {
    console.warn('[userProgressService] addXP error:', err);
    return xpToAdd;
  }
}

export async function addCoins(userId: number, coinsToAdd: number): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ coins: number }>(
      'SELECT coins FROM user_progress WHERE user_id = ?',
      [userId]
    );

    const currentCoins = (row?.coins ?? 0) + coinsToAdd;

    await db.runAsync(
      `INSERT INTO user_progress (user_id, coins, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         coins = excluded.coins,
         updated_at = datetime('now')`,
      [userId, currentCoins]
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
    const row = await db.getFirstAsync<{
      xp: number;
      coins: number;
      streak_current: number;
      streak_best: number;
    }>(
      'SELECT xp, coins, streak_current, streak_best FROM user_progress WHERE user_id = ?',
      [userId]
    );

    return row ?? null;
  } catch (err) {
    console.warn('[userProgressService] getUserProgress error:', err);
    return null;
  }
}

export async function syncUserProgressToMoodle(
  userId: number,
  xp: number,
  streak: number,
  token: string
): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_user_update_users',
      moodlewsrestformat: 'json',
      'users[0][id]': userId,
      'users[0][customfields][0][type]': 'ipelan_xp',
      'users[0][customfields][0][value]': String(xp),
      'users[0][customfields][1][type]': 'ipelan_streak',
      'users[0][customfields][1][value]': String(streak),
      'users[0][customfields][2][type]': 'ipelan_last_activity',
      'users[0][customfields][2][value]': today,
    });

    if (result?.exception) {
      console.warn('[userProgressService] sync XP error:', result.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[userProgressService] syncUserProgressToMoodle exception:', err.message);
    return false;
  }
}

export async function syncCoinsToMoodle(
  userId: number,
  coins: number,
  token: string
): Promise<boolean> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_user_update_users',
      moodlewsrestformat: 'json',
      'users[0][id]': userId,
      'users[0][customfields][0][type]': 'ipelan_coins',
      'users[0][customfields][0][value]': String(coins),
    });

    if (result?.exception) {
      console.warn('[userProgressService] sync coins error:', result.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[userProgressService] syncCoinsToMoodle exception:', err.message);
    return false;
  }
}

export async function saveActivityResult(params: {
  userId: number;
  moduleId: number;
  courseId: number;
  type: string;
  score: number;
  total: number;
  xpEarned: number;
  coinsEarned: number;
  token: string;
}): Promise<void> {
  const { userId, xpEarned, coinsEarned, token, moduleId, courseId, type, score, total } = params;

  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO activity_results
       (user_id, module_id, course_id, type, score, total, xp_earned, coins_earned, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [userId, moduleId, courseId, type, score, total, xpEarned, coinsEarned]
    );

    const currentStreak = await updateStreak(userId);
    const totalXP = await addXP(userId, xpEarned);
    const totalCoins = await addCoins(userId, coinsEarned);

    console.log('[userProgressService] Activity saved:', {
      xp: totalXP,
      coins: totalCoins,
      streak: currentStreak,
    });

    await syncUserProgressToMoodle(userId, totalXP, currentStreak, token);

    if (coinsEarned > 0) {
      await syncCoinsToMoodle(userId, totalCoins, token);
    }

    await submitGradeToMoodle({
      userId,
      courseId,
      moduleId,
      score,
      total,
      token,
    });
  } catch (err) {
    console.warn('[userProgressService] saveActivityResult error:', err);
  }
}

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
      // Module sans completion manuelle activee : on ignore silencieusement.
      if (errCode === 'invalidparameter' || errMsg.includes('Valeur incorrecte')) {
        console.log('[Grade] Completion manual not enabled for this module, skipping');
        return true;
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
