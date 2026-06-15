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

export const MAX_LIVES = 6;
export const MAX_COINS = 1000; // Limite maximale de pièces
export const REGEN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 h

// SQLite datetime('now') → '2025-05-20 10:00:00' (no T, no Z).
// Hermes may parse that as local time — force UTC interpretation.
function normalizeSQLiteTimestamp(ts: string): string {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(ts)) {
    return ts.replace(' ', 'T') + 'Z';
  }
  return ts;
}

/**
 * Vérifie et régénère les vies (1 toutes les 6h, max 6).
 *
 * Garantie : après une absence prolongée, l'utilisateur retrouve
 * progressivement toutes ses vies (1 par tranche de 6h écoulées),
 * dans la limite de MAX_LIVES.
 *
 * Le reliquat de temps (ex. 18h écoulées → +1 vie + 6h en banque) est
 * conservé pour le prochain cycle via `last_lives_update`.
 *
 *  VERSION MULTI-DEVICE : Prend en compte le timestamp serveur si plus récent
 */
export const checkAndRegenerateLives = async (
  userId: number,
  serverLastLivesUpdate?: string | null
): Promise<{ newLives: number; regenerated: boolean; livesAdded: number }> => {
  const db = await getDBConnection();
  const user = await db.getFirstAsync<{ lives: number; last_lives_update: string | null }>(
    `SELECT lives, last_lives_update FROM users WHERE id = ?`,
    [userId]
  );

  if (!user) return { newLives: 0, regenerated: false, livesAdded: 0 };
  if (user.lives >= MAX_LIVES) return { newLives: MAX_LIVES, regenerated: false, livesAdded: 0 };

  const now = Date.now();

  //   DETERMINER LE TIMESTAMP LE PLUS RÉCENT (local vs serveur)
  const localTimestamp = user.last_lives_update;
  const serverTimestamp = serverLastLivesUpdate;

  let mostRecentTimestamp = localTimestamp;
  if (serverTimestamp && localTimestamp) {
    const serverTime = new Date(serverTimestamp).getTime();
    const localTime = new Date(localTimestamp).getTime();
    mostRecentTimestamp = serverTime > localTime ? serverTimestamp : localTimestamp;
  } else if (serverTimestamp) {
    mostRecentTimestamp = serverTimestamp;
  }

  // Pas de timestamp → l'utilisateur n'a jamais perdu de vie via le timer.
  // On restaure immédiatement le maximum (absence inconnue = absence longue).
  if (!mostRecentTimestamp) {
    await db.runAsync(
      `UPDATE users SET lives = ?, last_lives_update = ? WHERE id = ?`,
      [MAX_LIVES, new Date(now).toISOString(), userId]
    );
    return { newLives: MAX_LIVES, regenerated: true, livesAdded: MAX_LIVES - user.lives };
  }

  const lastUpdate = new Date(normalizeSQLiteTimestamp(mostRecentTimestamp)).getTime();
  const diffMs = now - lastUpdate;

  if (diffMs <= 0) {
    return { newLives: user.lives, regenerated: false, livesAdded: 0 };
  }

  const livesToAdd = Math.floor(diffMs / REGEN_INTERVAL_MS);

  if (livesToAdd > 0) {
    const newLives = Math.min(MAX_LIVES, user.lives + livesToAdd);
    // Reliquat conservé pour le prochain cycle
    const remainingMs = diffMs % REGEN_INTERVAL_MS;
    // Si on a atteint le max, on remet le timer à 0 pour être propre
    const newUpdateDate = newLives >= MAX_LIVES
      ? new Date(now).toISOString()
      : new Date(now - remainingMs).toISOString();

    await db.runAsync(
      `UPDATE users SET lives = ?, last_lives_update = ? WHERE id = ?`,
      [newLives, newUpdateDate, userId]
    );

    return { newLives, regenerated: true, livesAdded: livesToAdd };
  }

  return { newLives: user.lives, regenerated: false, livesAdded: 0 };
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

  //  Régénérer les vies si nécessaire (1/6h)
  await checkAndRegenerateLives(userId);

  // Stats globales d'activités — filtrées par user_id
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
    WHERE user_id = ?
  `, [userId]);

  const userInfo = await db.getFirstAsync<{ coins: number; lives: number; streak: number; ipelan_xp: number; last_lives_update: string }>(
    `SELECT coins, lives, streak, ipelan_xp, last_lives_update FROM users WHERE id = ?`,
    [userId]
  );

  // c Source de vérité pour XP: activity_progress (calculé dynamiquement)
  // ipelan_xp n'est utilisé que pour la synchro Moodle
  const calculatedXP = activityStats?.total_xp || 0;
  const moodleXP = userInfo?.ipelan_xp || 0;

  const stats = {
    completedLessons: activityStats?.completed_activities || 0,
    currentStreak: userInfo?.streak || 0,
    //  Utiliser le max des deux pour ne pas perdre de données, mais privilégier le calculé
    totalXP: Math.max(calculatedXP, moodleXP),
    quizPassed: 0,
    perfectScores: activityStats?.perfect_scores || 0,
    daysActive: userInfo?.streak || 0,
  };

  // Fetch all earned badge IDs before evaluating the latest badge
  const { getUserBadges } = await import('../storage/badge-storage');
  const userBadges = await getUserBadges(userId);
  const allBadgeIds = userBadges.map(b => b.badgeId);

  const latestBadge = evaluateLatestBadge(stats);

  // Calcul du temps restant pour le prochain cœur
  let nextHeartTime = null;
  if ((userInfo?.lives ?? 6) < 6 && userInfo?.last_lives_update) {
    const lastUpdate = new Date(userInfo.last_lives_update).getTime();
    nextHeartTime = new Date(lastUpdate + 6 * 60 * 60 * 1000).toISOString();
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
  stats: { totalXp: number; coins: number; lives: number; streak: number; allBadgeIds?: string[]; latestBadge?: string | null; lastLivesUpdate?: string | null; lastSync?: string | null; courseProgress?: Record<string, { c: number; t: number }> | null },
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
        params["users[0][customfields][6][type]"] = "ipelan_last_badge"; // Dernier badge obtenu
        params["users[0][customfields][6][value]"] = stats.latestBadge;
      }

      //  Synchroniser le timestamp de dernière régénération de vies (multi-device)
      if (stats.lastLivesUpdate) {
        params["users[0][customfields][7][type]"] = "ipelan_last_lives_update";
        params["users[0][customfields][7][value]"] = stats.lastLivesUpdate;
      }

      // ✅ Toujours écrire ipelan_last_sync — permet la détection de conflits multi-device
      params["users[0][customfields][8][type]"] = "ipelan_last_sync";
      params["users[0][customfields][8][value]"] = stats.lastSync || new Date().toISOString();

      // ✅ Progression des cours — permet à Device B de voir la progression immédiatement
      if (stats.courseProgress && Object.keys(stats.courseProgress).length > 0) {
        params["users[0][customfields][9][type]"] = "ipelan_course_progress";
        params["users[0][customfields][9][value]"] = JSON.stringify(stats.courseProgress);
      }

      await moodleFetch("/webservice/rest/server.php", params, "POST");
      if (IS_DEV) console.log("[Gamification] Sync successful to Moodle");
      return { success: true, permissionError: false };
    } catch (error: any) {
      const errorMsg = (error?.message || '').toLowerCase();
      const isPermError =
        errorMsg.includes('permission') ||
        errorMsg.includes('droits') ||
        errorMsg.includes('requis') ||
        error?.errorcode === 'nopermissions' ||
        error?.errorcode === 'accessdenied';

      if (isPermError) {
        if (IS_DEV) console.warn("[Gamification] Permission denied (expected for user token):", error?.message);
      } else {
        if (IS_DEV) console.warn("[Gamification] Request failed:", error?.message || error);
      }
      return { success: false, permissionError: isPermError };
    }
  };

  // 1. Try with user token first
  if (userToken) {
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

export const LIFE_COST = 20;

/**
 * Met à jour les vies et les pièces après une activité.
 *
 * Règles :
 *  - score >= 60% → coins gagnés = floor((percentage/100) * 10), max 10
 *  - score < 60% ET skipLifeDeduction = false → 1 vie perdue (plancher à 0)
 *  - skipLifeDeduction = true → pour les activités qui gèrent elles-mêmes leurs vies (association)
 *  - Si on passe de MAX_LIVES à MAX_LIVES-1 → on (re)démarre le timer 6h
 */
export const processActivityResults = async (
  userId: number,
  score: number,
  totalScore: number,
  options?: { skipLifeDeduction?: boolean }
): Promise<{ coinsEarned: number; livesLost: number }> => {
  const db = await getDBConnection();
  let coinsEarned = 0;
  let livesLost = 0;

  const percentage = totalScore > 0 ? (score / totalScore) * 100 : 0;

  if (percentage >= 60) {
    coinsEarned = Math.floor((percentage / 100) * 10);
  } else if (!options?.skipLifeDeduction) {
    // Déduire une vie uniquement si l'activité ne gère pas ses propres vies
    livesLost = 1;
  }

  if (coinsEarned > 0 || livesLost > 0) {
    const nowISO = new Date().toISOString();
    await db.runAsync(
      `UPDATE users SET
        coins = MIN(${MAX_COINS}, coins + ?),
        lives = MAX(0, MIN(${MAX_LIVES}, lives - ?)),
        last_lives_update = CASE
          WHEN ? > 0 THEN ?
          ELSE last_lives_update
        END
       WHERE id = ?`,
      [coinsEarned, livesLost, livesLost, nowISO, userId]
    );
  }

  return { coinsEarned, livesLost };
};

/**
 * Achat d'une vie avec des pièces.
 * Coût : LIFE_COST pièces.
 */
export const buyLife = async (userId: number): Promise<{ success: boolean; message: string; newLives: number; newCoins: number }> => {
  const db = await getDBConnection();

  const user = await db.getFirstAsync<{ coins: number; lives: number }>(
    `SELECT coins, lives FROM users WHERE id = ?`,
    [userId]
  );

  if (!user) return { success: false, message: "Utilisateur introuvable", newLives: 0, newCoins: 0 };
  if (user.lives >= MAX_LIVES) return { success: false, message: "Vous avez déjà le maximum de vies", newLives: user.lives, newCoins: user.coins };
  if (user.coins < LIFE_COST) return { success: false, message: `Pas assez de pièces (${LIFE_COST} requises)`, newLives: user.lives, newCoins: user.coins };

  const newCoins = user.coins - LIFE_COST;
  const newLives = user.lives + 1;

  await db.runAsync(
    `UPDATE users SET coins = ?, lives = ? WHERE id = ?`,
    [newCoins, newLives, userId]
  );

  return { success: true, message: "Vie achetée avec succès", newLives, newCoins };
};


export const triggerGamificationSync = async (userId: number, userToken?: string): Promise<boolean> => {
  try {
    const stats = await getGlobalGamificationStats(userId);

    // ✅ Récupérer le timestamp de dernière régénération de vies depuis SQLite
    const db = await getDBConnection();
    const userRow = await db.getFirstAsync<{ last_lives_update: string }>(
      'SELECT last_lives_update FROM users WHERE id = ?',
      [userId]
    );
    const lastLivesUpdate = userRow?.last_lives_update || null;

    // ✅ Récupérer la progression des cours pour la synchronisation multi-device
    const { getAllCourseProgress } = await import('../storage/course-progress');
    const allProgress = await getAllCourseProgress(userId);
    const courseProgressMap: Record<string, { c: number; t: number }> = {};
    for (const cp of allProgress) {
      if (cp.totalActivities > 0) {
        courseProgressMap[String(cp.courseId)] = { c: cp.completedActivities, t: cp.totalActivities };
      }
    }

    const success = await syncUserGamificationToMoodle(userId, {
      totalXp: stats.totalXp,
      coins: stats.coins,
      lives: stats.lives,
      streak: stats.streak,
      allBadgeIds: stats.allBadgeIds,
      latestBadge: stats.latestBadge,
      lastLivesUpdate,                    // ✅ Synchroniser pour multi-device
      lastSync: new Date().toISOString(), // ✅ Horodatage de cette sync
      courseProgress: Object.keys(courseProgressMap).length > 0 ? courseProgressMap : null,
    }, userToken);

    // Marquer les badges comme synchronisés en cas de succès
    if (success && stats.allBadgeIds.length > 0) {
      try {
        const { markBadgesAsSynced } = await import('../storage/badge-storage');
        await markBadgesAsSynced(userId, stats.allBadgeIds);
      } catch (e: any) {
        if (IS_DEV) console.warn('[Gamification] markBadgesAsSynced failed:', e?.message);
      }
    }

    return success;
  } catch (error) {
    if (IS_DEV) console.error("[Gamification] Trigger sync failed:", error);
    return false;
  }
};
