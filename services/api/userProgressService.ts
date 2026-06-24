import { getDBConnection } from '../storage/db-service';

const IS_DEV = process.env.NODE_ENV === 'development';

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
    if (IS_DEV) console.warn('[userProgressService] updateStreak error:', err);
    return 1;
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
    if (IS_DEV) console.warn('[userProgressService] setLives error:', err);
  }
}

export async function setUserGamificationStats(
  userId: number,
  xp: number,
  coins: number,
  lives: number,
  streak: number,
): Promise<void> {
  const db = await getDBConnection();
  const d = new Date();
  const today = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  await db.runAsync(
    `UPDATE users SET ipelan_xp = ?, coins = ?, lives = ?, streak = ?, last_activity = ? WHERE id = ?`,
    [Math.max(0, xp), Math.max(0, coins), Math.max(0, Math.min(6, lives)), Math.max(0, streak), today, userId]
  );
}

export async function addXP(userId: number, xpToAdd: number): Promise<number> {
  if (xpToAdd <= 0) {
    const db = await getDBConnection();
    const row = await db.getFirstAsync<{ xp: number }>('SELECT ipelan_xp as xp FROM users WHERE id = ?', [userId]);
    return row?.xp ?? 0;
  }
  try {
    const db = await getDBConnection();
    // Atomic increment — avoids read-modify-write race condition
    await db.runAsync(
      `UPDATE users SET ipelan_xp = ipelan_xp + ? WHERE id = ?`,
      [xpToAdd, userId]
    );
    const row = await db.getFirstAsync<{ xp: number }>('SELECT ipelan_xp as xp FROM users WHERE id = ?', [userId]);
    return row?.xp ?? xpToAdd;
  } catch (err) {
    if (IS_DEV) console.warn('[userProgressService] addXP error:', err);
    return xpToAdd;
  }
}

export async function addCoins(userId: number, coinsToAdd: number): Promise<number> {
  if (coinsToAdd <= 0) {
    const db = await getDBConnection();
    const row = await db.getFirstAsync<{ coins: number }>('SELECT coins FROM users WHERE id = ?', [userId]);
    return row?.coins ?? 0;
  }
  try {
    const db = await getDBConnection();
    // Atomic increment — avoids read-modify-write race condition
    await db.runAsync(
      `UPDATE users SET coins = MIN(1000, coins + ?) WHERE id = ?`,
      [coinsToAdd, userId]
    );
    const row = await db.getFirstAsync<{ coins: number }>('SELECT coins FROM users WHERE id = ?', [userId]);
    return row?.coins ?? coinsToAdd;
  } catch (err) {
    if (IS_DEV) console.warn('[userProgressService] addCoins error:', err);
    return coinsToAdd;
  }
}

/**
 * Vérifie le streak au premier plan et met à jour le miroir dans users.
 * Délègue à streak.checkStreakOnForeground puis synchronise users.streak.
 */
export async function checkStreakOnForeground(userId: number): Promise<number> {
  try {
    const { checkStreakOnForeground: checkStreak } = await import('../storage/streak');
    const newStreak = await checkStreak(userId);

    const db = await getDBConnection();
    await db.runAsync(
      `UPDATE users SET streak = ? WHERE id = ?`,
      [newStreak, userId]
    );

    return newStreak;
  } catch (err) {
    if (IS_DEV) console.warn('[userProgressService] checkStreakOnForeground error:', err);
    return 0;
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
    if (IS_DEV) console.warn('[userProgressService] getUserProgress error:', err);
    return null;
  }
}

// syncUserProgressToMoodle and syncCoinsToMoodle are removed, use syncQueue.syncGamification instead.

// saveActivityResult is deprecated, use saveActivityScore in services/storage/activity-progress.ts instead.
