import AsyncStorage from "@react-native-async-storage/async-storage";
import { moodleFetch } from "./moodleClient";

const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_ADMIN_TOKEN;
const BADGES_STORAGE_KEY = "@ipelan_user_badges";
const BADGES_TIMESTAMP_KEY = "@ipelan_badges_timestamp";
const IS_DEV = process.env.NODE_ENV === 'development';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; 

export interface MoodleBadge {
  id: number;
  name: string;
  description: string;
  badgeurl: string;
  issuername: string;
  dateissued: number;
  dateexpire: number | null;
  uniquehash: string;
}

export async function getUserBadges(token: string, userId: number): Promise<MoodleBadge[]> {
  const params = {
    wstoken: token,
    wsfunction: "core_badges_get_user_badges",
    userid: userId,
    moodlewsrestformat: "json"
  };

  try {
    const result = await moodleFetch("/webservice/rest/server.php", params, "POST");
    if (result?.badges && Array.isArray(result.badges)) {
      return result.badges;
    }
    return [];
  } catch (error) {
    // User token may lack badge permission — retry with admin token
    if (ADMIN_TOKEN) {
      try {
        const adminResult = await moodleFetch("/webservice/rest/server.php", {
          wstoken: ADMIN_TOKEN,
          wsfunction: "core_badges_get_user_badges",
          userid: userId,
          moodlewsrestformat: "json"
        }, "POST");
        return adminResult?.badges && Array.isArray(adminResult.badges) ? adminResult.badges : [];
      } catch (adminErr) {
        if (IS_DEV) console.warn("[badgeService] Admin fallback also failed:", adminErr);
      }
    }
    if (IS_DEV) console.warn("[badgeService] getUserBadges failed:", error);
    return [];
  }
}

export async function saveUserBadgesLocal(badges: MoodleBadge[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BADGES_STORAGE_KEY, JSON.stringify(badges));
    await AsyncStorage.setItem(BADGES_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.warn("[badgeService] saveUserBadgesLocal failed:", error);
  }
}

export async function getUserBadgesLocal(): Promise<MoodleBadge[]> {
  try {
    const badgesJson = await AsyncStorage.getItem(BADGES_STORAGE_KEY);
    if (badgesJson) {
      return JSON.parse(badgesJson);
    }
    return [];
  } catch (error) {
    console.warn("[badgeService] getUserBadgesLocal failed:", error);
    return [];
  }
}

export async function getAndSyncUserBadges(
  token: string,
  userId: number
): Promise<{ badges: MoodleBadge[]; fromCache: boolean }> {
  try {
    // Return cached data if still fresh (< 24h)
    const timestampRaw = await AsyncStorage.getItem(BADGES_TIMESTAMP_KEY);
    if (timestampRaw) {
      const age = Date.now() - parseInt(timestampRaw, 10);
      if (age < CACHE_TTL_MS) {
        const cached = await getUserBadgesLocal();
        if (cached.length > 0) return { badges: cached, fromCache: true };
      }
    }

    const freshBadges = await getUserBadges(token, userId);
    if (freshBadges.length > 0) {
      await saveUserBadgesLocal(freshBadges);
      return { badges: freshBadges, fromCache: false };
    }

    const localBadges = await getUserBadgesLocal();
    return { badges: localBadges, fromCache: true };
  } catch (error) {
    if (IS_DEV) console.warn("[badgeService] getAndSyncUserBadges failed:", error);
    const localBadges = await getUserBadgesLocal();
    return { badges: localBadges, fromCache: true };
  }
}


export async function syncBadgesToMoodle(
  token: string,
  userId: number,
  badgeIds: string[]
): Promise<boolean> {
  try {
    // Le champ ipelan_badges stocke UNIQUEMENT le dernier badge obtenu
    // pour indiquer la progression actuelle de l'utilisateur
    const lastBadge = badgeIds.length > 0 ? badgeIds[badgeIds.length - 1] : '';
    const today = new Date().toISOString().split('T')[0];

    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_user_update_users',
      moodlewsrestformat: 'json',
      'users[0][id]': userId,
      'users[0][customfields][0][type]': 'ipelan_badges',
      'users[0][customfields][0][value]': lastBadge, // Dernier badge uniquement !
      'users[0][customfields][1][type]': 'ipelan_badges_count',
      'users[0][customfields][1][value]': String(badgeIds.length), // Nombre total de badges
      'users[0][customfields][2][type]': 'ipelan_last_activity', // Date de dernière activité
      'users[0][customfields][2][value]': today,
    });

    if (IS_DEV) console.log(`[badgeService] Synced to Moodle: lastBadge=${lastBadge}, count=${badgeIds.length}`);


    return true;
  } catch (error) {
    console.warn('[badgeService] syncBadgesToMoodle failed:', error);
    return false;
  }
}

/**
 * Récupère les badges IPELAN depuis Moodle (via champs personnalisés)
 */
export async function getBadgesFromMoodle(
  token: string,
  userId: number
): Promise<{ badgeIds: string[]; count: number }> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_user_get_users',
      moodlewsrestformat: 'json',
      'criteria[0][key]': 'id',
      'criteria[0][value]': userId,
    });

    const user = result?.users?.[0];
    if (!user || !user.customfields) {
      return { badgeIds: [], count: 0 };
    }

    const badgesField = user.customfields.find(
      (f: any) => f.shortname === 'ipelan_badges'
    );
    const countField = user.customfields.find(
      (f: any) => f.shortname === 'ipelan_badges_count'
    );

    const badgeIds = badgesField?.value
      ? badgesField.value.split(',').filter((id: string) => id.trim())
      : [];
    const count = countField?.value
      ? parseInt(countField.value, 10)
      : badgeIds.length;

    return { badgeIds, count };
  } catch (error) {
    console.warn('[badgeService] getBadgesFromMoodle failed:', error);
    return { badgeIds: [], count: 0 };
  }
}

/**
 * Sync bidirectionnelle des badges
 * Merge les badges locaux et Moodle (union des deux)
 */
export async function syncBadgesBidirectional(
  token: string,
  userId: number,
  localBadgeIds: string[]
): Promise<{ badgeIds: string[]; synced: boolean }> {
  try {
    // 1. Récupérer badges depuis Moodle
    const moodleBadges = await getBadgesFromMoodle(token, userId);

    // 2. Fusionner (union) - pas de perte de badges
    const mergedBadgeIds = Array.from(new Set([
      ...localBadgeIds,
      ...moodleBadges.badgeIds
    ]));

    // 3. Si local a plus de badges, push vers Moodle
    if (localBadgeIds.length > moodleBadges.badgeIds.length) {
      const synced = await syncBadgesToMoodle(token, userId, mergedBadgeIds);
      return { badgeIds: mergedBadgeIds, synced };
    }

    // 4. Si Moodle a plus, retourner les badges Moodle
    return { badgeIds: mergedBadgeIds, synced: true };
  } catch (error) {
    console.warn('[badgeService] syncBadgesBidirectional failed:', error);
    return { badgeIds: localBadgeIds, synced: false };
  }
}
