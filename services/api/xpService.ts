import { moodleFetch } from './moodleClient';

const IS_DEV = process.env.NODE_ENV === 'development';

export interface UserGamificationProfile {
  xp: number;
  coins: number;
  lives: number;
  streak: number;
  badges: string[];
  badgeCount: number;
  lastBadgeId?: string | null;
  lastActivityDate: string;
  lastLivesUpdate?: string | null; // ✅ Timestamp dernière régénération de vies
  lastSync?: string | null;        // ✅ Timestamp dernière sync Moodle (détection conflit multi-device)
  courseProgress?: Record<string, { c: number; t: number }> | null; // ✅ Progression des cours pour sync multi-device
}

function parseCustomFields(user: any): Record<string, string> {
  const fields: Record<string, string> = {};
  const customfields = user.customfields || user.profile || [];
  if (Array.isArray(customfields)) {
    for (const field of customfields) {
      const name = field.shortname || field.name || field.type;
      if (name) {
        fields[name] = String(field.value ?? '');
      }
    }
  } else if (typeof customfields === 'object') {
    for (const key of Object.keys(customfields)) {
      fields[key] = String(customfields[key] ?? '');
    }
  }
  return fields;
}

/**
 * Vérifie que l'ID utilisateur Moodle correspond à l'ID attendu
 * Cette sécurité empêche la synchronisation des données d'un autre utilisateur
 */
function verifyUserIdentity(moodleUserId: number, expectedUserId: number): boolean {
  if (moodleUserId !== expectedUserId) {
    console.error(`[xpService] USER ID MISMATCH! Expected: ${expectedUserId}, Got: ${moodleUserId}`);
    return false;
  }
  return true;
}

export async function getUserGamificationFromMoodle(
  token: string,
  userId: number
): Promise<UserGamificationProfile> {
  try {
    if (IS_DEV) {
      console.log('[xpService] Fetching gamification for userId:', userId);
    }

    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_user_get_users_by_field',
      moodlewsrestformat: 'json',
      field: 'id',
      'values[0]': userId,
    });

    if (IS_DEV) {
      console.log('[xpService] Moodle response:', JSON.stringify(result).substring(0, 500));
    }

    if (result?.exception) {
      const errorMsg = result?.message || result?.error || 'Unknown Moodle error';
      console.warn('[xpService] Moodle exception:', errorMsg);
      return { xp: 0, coins: 0, lives: 6, streak: 0, badges: [], badgeCount: 0, lastBadgeId: null, lastActivityDate: '' };
    }

    // Moodle retourne soit un array direct, soit {users: [...]}
    const users = Array.isArray(result) ? result : result?.users;
    if (!users?.[0]) {
      console.warn('[xpService] No users returned from Moodle. Result keys:', Object.keys(result || {}));
      return { xp: 0, coins: 0, lives: 6, streak: 0, badges: [], badgeCount: 0, lastBadgeId: null, lastActivityDate: '' };
    }

    const user = users[0];

    // 🔒 VÉRIFICATION DE SÉCURITÉ : S'assurer que l'ID retourné correspond à l'ID demandé
    const returnedUserId = parseInt(user.id, 10);
    if (!verifyUserIdentity(returnedUserId, userId)) {
      console.error('[xpService] Security alert: User ID mismatch detected. Aborting sync.');
      // Retourner des valeurs par défaut pour éviter la corruption des données
      return { xp: 0, coins: 0, lives: 6, streak: 0, badges: [], badgeCount: 0, lastBadgeId: null, lastActivityDate: '' };
    }

    const fields = parseCustomFields(user);

    const badgesRaw = fields.ipelan_badges || '';
    const badgeIds = badgesRaw
      .split(',')
      .map((id: string) => id.trim())
      .filter((id: string) => id.length > 0);

    let courseProgress: Record<string, { c: number; t: number }> | null = null;
    try {
      const raw = fields.ipelan_course_progress || '';
      if (raw) courseProgress = JSON.parse(raw);
    } catch { 
      console.log("[xpService] Erreur ")
    }

    return {
      xp: parseInt(fields.ipelan_xp || '0', 10),
      coins: parseInt(fields.ipelan_coins || '0', 10),
      lives: parseInt(fields.ipelan_lives || '6', 10),
      streak: parseInt(fields.ipelan_streak || '0', 10),
      badges: badgeIds,
      badgeCount: parseInt(fields.ipelan_badges_count || '0', 10) || badgeIds.length,
      lastBadgeId: fields.ipelan_last_badge || (badgeIds.length > 0 ? badgeIds[0] : null),
      lastActivityDate: fields.ipelan_last_activity || '',
      lastLivesUpdate: fields.ipelan_last_lives_update || null, // ✅ Timestamp depuis serveur
      lastSync: fields.ipelan_last_sync || null,               // ✅ Timestamp dernière sync
      courseProgress,                                           // ✅ Progression des cours pour Device B
    };
  } catch (err: any) {
    console.warn('[xpService] getUserGamificationFromMoodle exception:', err.message);
    return { xp: 0, coins: 0, lives: 6, streak: 0, badges: [], badgeCount: 0, lastBadgeId: null, lastActivityDate: '' };
  }
}

// Legacy export kept for compatibility - delegates to the new unified fetch
export interface UserProfile {
  xp: number;
  streak: number;
  lastActivityDate: string;
  coins: number;
  lives: number;
  badges: string;
  badgeCount: number;
}

export async function getUserXP(token: string, userId: number): Promise<UserProfile> {
  const profile = await getUserGamificationFromMoodle(token, userId);
  return {
    xp: profile.xp,
    streak: profile.streak,
    lastActivityDate: profile.lastActivityDate,
    coins: profile.coins,
    lives: profile.lives,
    badges: profile.badges.join(','),
    badgeCount: profile.badgeCount,
  };
}

export async function updateUserXP(
  token: string,
  userId: number,
  xpToAdd: number
): Promise<boolean> {
  try {
    const current = await getUserXP(token, userId);
    const newXp = current.xp + xpToAdd;

    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_user_update_users',
      moodlewsrestformat: 'json',
      'users[0][id]': userId,
      'users[0][customfields][0][type]': 'ipelan_xp', // Points d'expérience
      'users[0][customfields][0][value]': String(newXp),
    });

    return true;
  } catch (err: any) {
    console.warn('[xpService] updateUserXP exception:', err.message);
    return false;
  }
}

export async function updateUserStreak(
  token: string,
  userId: number
): Promise<boolean> {
  try {
    const current = await getUserXP(token, userId);
    const today = new Date().toISOString().split('T')[0];
    const lastDate = current.lastActivityDate;

    let newStreak = current.streak;

    if (lastDate === today) {
      return true;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastDate === yesterdayStr) {
      newStreak += 1;
    } else if (lastDate !== today) {
      newStreak = 1;
    }

    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_user_update_users',
      moodlewsrestformat: 'json',
      'users[0][id]': userId,
      'users[0][customfields][0][type]': 'ipelan_streak', // Séquence de jours consécutifs
      'users[0][customfields][0][value]': String(newStreak),
      'users[0][customfields][1][type]': 'ipelan_last_activity', // Date de dernière activité
      'users[0][customfields][1][value]': today,
    });

    return true;
  } catch (err: any) {
    console.warn('[xpService] updateUserStreak exception:', err.message);
    return false;
  }
}

/**
 * @deprecated Ne plus utiliser cette fonction.
 *
 * Le flux de récompense d'XP passe désormais par :
 *   1. saveActivityScore (services/storage/activity-progress.ts) → SQLite local
 *   2. triggerGamificationSync (services/gamification/gamificationService.ts)
 *      → push de tous les customfields Moodle (xp/coins/lives/streak/badges)
 *
 * Appeler awardXPForActivity en plus dupliquerait l'XP côté Moodle puisque
 * triggerGamificationSync écrit déjà la valeur courante de `ipelan_xp`.
 *
 * Conservée uniquement pour compatibilité ascendante. Sera retirée dans
 * une version future.
 */
/** @deprecated Use triggerGamificationSync instead. Calling this would duplicate XP in Moodle. */
export async function awardXPForActivity(
  token: string,
  userId: number,
  activityType: 'quiz' | 'listening' | 'dictation' | 'association',
  score: number,
  maxScore: number
): Promise<number> {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[xpService] awardXPForActivity est déprécié - utilisez triggerGamificationSync');
  }
  return 0;
}