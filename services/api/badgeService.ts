import { moodleFetch } from "./moodleClient";

const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_TOKEN;

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
