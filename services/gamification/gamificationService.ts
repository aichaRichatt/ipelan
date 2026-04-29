import { BadgeProgressData, getEarnedBadges } from '../../constants/badges';
import { moodleFetch } from '../api/moodleClient';
import { getDBConnection } from '../storage/db-service';

const IS_DEV = process.env.NODE_ENV === 'development';
const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_ADMIN_TOKEN;


export const evaluateLatestBadge = (stats: BadgeProgressData): string | null => {
  const earnedBadges = getEarnedBadges(stats);
  if (earnedBadges.length === 0) return null;
  return earnedBadges[earnedBadges.length - 1].id;
};

/**
 * Vérifie et régénère les vies (1 toutes les 12h, max 6)
 */
export const checkAndRegenerateLives = async (userId: number): Promise<{ newLives: number; regenerated: boolean }> => {
  const db = await getDBConnection();
  const user = await db.getFirstAsync<{ lives: number; last_lives_update: string }>(
    `SELECT lives, last_lives_update FROM users WHERE id = ?`,
    [userId]
  );

  if (!user) return { newLives: 0, regenerated: false };
  if (user.lives >= 6) return { newLives: 6, regenerated: false };

  const lastUpdate = new Date(user.last_lives_update || new Date()).getTime();
  const now = new Date().getTime();
  const diffMs = now - lastUpdate;
  
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  const livesToAdd = Math.floor(diffMs / TWELVE_HOURS_MS);

  if (livesToAdd > 0) {
    const newLives = Math.min(6, user.lives + livesToAdd);
    // On garde le reliquat de temps pour le prochain cycle
    const remainingMs = diffMs % TWELVE_HOURS_MS;
    const newUpdateDate = new Date(now - remainingMs).toISOString();

    await db.runAsync(
      `UPDATE users SET lives = ?, last_lives_update = ? WHERE id = ?`,
      [newLives, newUpdateDate, userId]
    );
    
    return { newLives, regenerated: true };
  }

  return { newLives: user.lives, regenerated: false };
};

/**
 * Calcul complet des statistiques globales de l'utilisateur
 */
export const getGlobalGamificationStats = async (userId: number): Promise<{
  totalXp: number;
  totalCompletedActivities: number;
  perfectScores: number;
  coins: number;
  lives: number;
  streak: number;
  latestBadge: string | null;
  allBadgeIds: string[];
  nextHeartTime: string | null;
}> => {
  const db = await getDBConnection();
  
  // ✅ Régénérer les vies si nécessaire (1/12h)
  await checkAndRegenerateLives(userId);

  // Stats globales d'activités
  const activityStats = await db.getFirstAsync<{
    total_xp: number;
    completed_activities: number;
    perfect_scores: number;
  }>(`
    SELECT 
      SUM(xp_earned) as total_xp,
      SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_activities,
      SUM(CASE WHEN best_score = total_score AND total_score > 0 THEN 1 ELSE 0 END) as perfect_scores
    FROM activity_progress
  `);

  const userInfo = await db.getFirstAsync<{ coins: number; lives: number; streak: number; ipelan_xp: number; last_lives_update: string }>(
    `SELECT coins, lives, streak, ipelan_xp, last_lives_update FROM users WHERE id = ?`,
    [userId]
  );

  const stats = {
    completedLessons: activityStats?.completed_activities || 0,
    currentStreak: userInfo?.streak || 0,
    totalXP: Math.max(userInfo?.ipelan_xp || 0, activityStats?.total_xp || 0),
    quizPassed: 0,
    perfectScores: activityStats?.perfect_scores || 0,
    daysActive: userInfo?.streak || 0,
  };

  const latestBadge = evaluateLatestBadge(stats);

  // Fetch all earned badge IDs
  const { getUserBadges } = await import('../storage/badge-storage');
  const userBadges = await getUserBadges(userId);
  const allBadgeIds = userBadges.map(b => b.badgeId);

  // Calcul du temps restant pour le prochain cœur
  let nextHeartTime = null;
  if ((userInfo?.lives ?? 6) < 6 && userInfo?.last_lives_update) {
    const lastUpdate = new Date(userInfo.last_lives_update).getTime();
    nextHeartTime = new Date(lastUpdate + 12 * 60 * 60 * 1000).toISOString();
  }

  return {
    totalXp: stats.totalXP,
    totalCompletedActivities: stats.completedLessons,
    perfectScores: stats.perfectScores,
    coins: userInfo?.coins || 0,
    lives: userInfo?.lives ?? 6,
    streak: userInfo?.streak || 0,
    latestBadge: latestBadge || (allBadgeIds.length > 0 ? allBadgeIds[0] : null),
    allBadgeIds,
    nextHeartTime
  };
};


export const syncUserGamificationToMoodle = async (
  userId: number,
  stats: { totalXp: number; coins: number; lives: number; streak: number; allBadgeIds?: string[]; latestBadge?: string | null },
  userToken?: string
): Promise<boolean> => {
  const trySync = async (token: string): Promise<{ success: boolean; permissionError: boolean }> => {
    try {
      const params: any = {
        wstoken: token,
        wsfunction: "core_user_update_users",
        moodlewsrestformat: "json",
        "users[0][id]": userId,
        "users[0][customfields][0][type]": "ipelan_xp",
        "users[0][customfields][0][value]": String(stats.totalXp),
        "users[0][customfields][1][type]": "ipelan_coins",
        "users[0][customfields][1][value]": String(stats.coins),
        "users[0][customfields][2][type]": "ipelan_lives",
        "users[0][customfields][2][value]": String(stats.lives),
        "users[0][customfields][3][type]": "ipelan_streak",
        "users[0][customfields][3][value]": String(stats.streak),
      };

      if (stats.allBadgeIds && stats.allBadgeIds.length > 0) {
        params["users[0][customfields][4][type]"] = "ipelan_badges";
        params["users[0][customfields][4][value]"] = stats.allBadgeIds.join(',');
        params["users[0][customfields][5][type]"] = "ipelan_badges_count";
        params["users[0][customfields][5][value]"] = String(stats.allBadgeIds.length);
      }

      if (stats.latestBadge) {
        params["users[0][customfields][6][type]"] = "ipelan_last_badge";
        params["users[0][customfields][6][value]"] = stats.latestBadge;
      }

      const result = await moodleFetch("/webservice/rest/server.php", params, "POST");

      if (result && result.exception) {
        const errorMsg = result.message || result.exception || 'Unknown error';
        const isPermError = errorMsg.toLowerCase().includes('permission') ||
          errorMsg.toLowerCase().includes('droits') ||
          errorMsg.toLowerCase().includes('requis');

        if (isPermError) {
          // Permission errors are expected for non-admin users - log as warning
          if (IS_DEV) console.warn("[Gamification] Permission denied (expected for user token):", errorMsg);
        } else {
          console.error("[Gamification] Moodle error:", errorMsg);
        }
        return { success: false, permissionError: isPermError };
      }
      if (IS_DEV) console.log("[Gamification] Sync successful to Moodle");
      return { success: true, permissionError: false };
    } catch (error: any) {
      if (IS_DEV) console.warn("[Gamification] Request failed:", error?.message || error);
      return { success: false, permissionError: false };
    }
  };

  // 1. Try with user token first
  if (userToken) {
    if (IS_DEV) console.log(`[Gamification] Trying with USER token: ${userToken.substring(0, 10)}...`);
    const res = await trySync(userToken);
    if (res.success) {
      if (IS_DEV) console.log("[Gamification] User token sync SUCCESS");
      return true;
    }

    if (res.permissionError) {
      if (IS_DEV) console.warn("[Gamification] User token lacks permission (expected for non-admin users)");
    } else {
      if (IS_DEV) console.warn("[Gamification] User token sync failed:", res);
    }

    // If permission error, try fallback to ADMIN_TOKEN
    if (res.permissionError && ADMIN_TOKEN && ADMIN_TOKEN !== userToken) {
      if (IS_DEV) console.log("[Gamification] Trying with ADMIN_TOKEN...");
      const adminRes = await trySync(ADMIN_TOKEN);
      if (adminRes.success) {
        if (IS_DEV) console.log("[Gamification] ADMIN_TOKEN sync SUCCESS");
      } else if (IS_DEV) {
        console.warn("[Gamification] ADMIN_TOKEN also failed, sync will retry later");
      }
      return adminRes.success;
    }
    return false;
  }

  // 2. Try with ADMIN_TOKEN if no user token
  if (ADMIN_TOKEN) {
    const res = await trySync(ADMIN_TOKEN);
    return res.success;
  }

  if (IS_DEV) console.warn('[Gamification] Sync ignored: No token available');
  return false;
};

/**
 * Met à jour les vies et les pièces après une activité
 */
export const processActivityResults = async (
  userId: number,
  score: number,
  totalScore: number
): Promise<{ coinsEarned: number; livesLost: number }> => {
  const db = await getDBConnection();
  let coinsEarned = 0;
  let livesLost = 0;

  const percentage = totalScore > 0 ? (score / totalScore) * 100 : 0;

  if (percentage >= 50) {
    // Succès: Gain proportionnel (max 10)
    coinsEarned = Math.floor((percentage / 100) * 10);
  } else {
    // Échec: Perte d'une vie
    livesLost = 1;
  }

  if (coinsEarned > 0 || livesLost > 0) {
    await db.runAsync(
      `UPDATE users SET 
        coins = coins + ?, 
        lives = MAX(0, lives - ?),
        last_lives_update = CASE WHEN lives = 6 AND ? > 0 THEN datetime('now') ELSE last_lives_update END
       WHERE id = ?`,
      [coinsEarned, livesLost, livesLost, userId]
    );
  }

  return { coinsEarned, livesLost };
};

/**
 * Achat d'une vie
 */
export const buyLife = async (userId: number): Promise<{ success: boolean; message: string; newLives: number; newCoins: number }> => {
  const db = await getDBConnection();
  const cost = 20;

  const user = await db.getFirstAsync<{ coins: number; lives: number }>(
    `SELECT coins, lives FROM users WHERE id = ?`,
    [userId]
  );

  if (!user) return { success: false, message: "Utilisateur introuvable", newLives: 0, newCoins: 0 };
  if (user.lives >= 6) return { success: false, message: "Vous avez déjà le maximum de vies", newLives: user.lives, newCoins: user.coins };
  if (user.coins < cost) return { success: false, message: "Pas assez de pièces", newLives: user.lives, newCoins: user.coins };

  const newCoins = user.coins - cost;
  const newLives = user.lives + 1;

  await db.runAsync(`UPDATE users SET coins = ?, lives = ? WHERE id = ?`, [newCoins, newLives, userId]);

  return { success: true, message: "Vie achetée avec succès", newLives, newCoins };
};

/**
 * Point d'entrée principal pour synchroniser après toute modification
 */
export const triggerGamificationSync = async (userId: number, userToken?: string): Promise<boolean> => {
  try {
    const stats = await getGlobalGamificationStats(userId);
    return await syncUserGamificationToMoodle(userId, {
      totalXp: stats.totalXp,
      coins: stats.coins,
      lives: stats.lives,
      streak: stats.streak,
      allBadgeIds: stats.allBadgeIds,
      latestBadge: stats.latestBadge
    }, userToken);
  } catch (error) {
    console.error("[Gamification] Trigger sync failed:", error);
    return false;
  }
};
