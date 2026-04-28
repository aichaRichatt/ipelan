import AsyncStorage from "@react-native-async-storage/async-storage";
import { moodleFetch } from "./moodleClient";

const ADMIN_TOKEN = process.env.MOODLE_ADMIN_TOKEN;
const BADGES_STORAGE_KEY = "@ipelan_user_badges";
const BADGES_TIMESTAMP_KEY = "@ipelan_badges_timestamp";

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

    if (result?.exception && ADMIN_TOKEN) {
      const adminParams = {
        wstoken: ADMIN_TOKEN,
        wsfunction: "core_badges_get_user_badges",
        userid: userId,
        moodlewsrestformat: "json"
      };
      const adminResult = await moodleFetch("/webservice/rest/server.php", adminParams, "POST");
      if (adminResult?.badges && Array.isArray(adminResult.badges)) {
        return adminResult.badges;
      }
      return [];
    }

    if (result?.badges && Array.isArray(result.badges)) {
      return result.badges;
    }

    return [];
  } catch (error) {
    console.warn("[badgeService] getUserBadges failed:", error);
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
    const localBadges = await getUserBadgesLocal();

    const freshBadges = await getUserBadges(token, userId);
    if (freshBadges.length > 0) {
      await saveUserBadgesLocal(freshBadges);
      return { badges: freshBadges, fromCache: false };
    }

    return { badges: localBadges, fromCache: true };
  } catch (error) {
    console.warn("[badgeService] getAndSyncUserBadges failed:", error);
    const localBadges = await getUserBadgesLocal();
    return { badges: localBadges, fromCache: true };
  }
}
