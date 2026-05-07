import { moodleFetch } from './moodleClient';
import { convertFileUrlForAuth } from '../utils/moodleIdResolver';

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  fullname: string;
  xp: number;
  streak: number;
  avatarUrl: string;
}

export async function getLeaderboard(
  courseId: number,
  token: string
): Promise<LeaderboardEntry[]> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_enrol_get_enrolled_users',
      moodlewsrestformat: 'json',
      courseid: courseId,
      'options[0][name]': 'userfields',
      'options[0][value]': 'id,firstname,lastname,fullname,profileimageurl,profileimageurlsmall,customfields',
    });

    const users = result || [];
    const entries: LeaderboardEntry[] = [];

    for (const user of users) {
      const customfields = user.customfields || [];

      const xpField = customfields.find((f: any) => f.shortname === 'ipelan_xp');
      const streakField = customfields.find((f: any) => f.shortname === 'ipelan_streak');

      const xp = parseInt(xpField?.value ?? '0', 10);
      const streak = parseInt(streakField?.value ?? '0', 10);
      const rawAvatar = user.profileimageurl || user.profileimageurlsmall || '';

      entries.push({
        rank: 0,
        userId: user.id,
        fullname: user.fullname || `${user.firstname || ''} ${user.lastname || ''}`.trim(),
        xp,
        streak,
        avatarUrl: rawAvatar ? convertFileUrlForAuth(rawAvatar, token) : '',
      });
    }

    const sorted = entries.sort((a, b) => b.xp - a.xp);
    
    return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
  } catch (err: any) {
    console.warn('[leaderboardService] Exception:', err.message);
    return [];
  }
}

export async function getCourseLeaderboard(
  courseId: number,
  token: string
): Promise<LeaderboardEntry[]> {
  return getLeaderboard(courseId, token);
}

/**
 * Classement global IPELAN.
 *
 * Stratégie pour éviter de charger TOUS les utilisateurs Moodle :
 *  1. Restreindre la requête aux utilisateurs ayant un ipelan_xp > 0 via
 *     `core_user_get_users` + critère `auth=manual` (par défaut) puis
 *     filtre côté serveur sur les customfields n'est pas supporté ; on
 *     limite donc le résultat (`limit:100`) et on trie côté client.
 *  2. Si l'API ne supporte pas `criteria` vide, on essaye de paginer.
 *
 * @param token  WS token Moodle
 * @param limit  Nombre maximum d'utilisateurs à charger (défaut 100)
 */
export async function getGlobalLeaderboard(
  token: string,
  limit: number = 100
): Promise<LeaderboardEntry[]> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_user_get_users',
      moodlewsrestformat: 'json',
      // Restreindre aux utilisateurs confirmés actifs
      // (Moodle exige au moins un critère)
      'criteria[0][key]': 'deleted',
      'criteria[0][value]': '0',
      limitfrom: 0,
      limitnum: limit,
    });

    const users = result?.users || [];
    const entries: LeaderboardEntry[] = [];

    for (const user of users) {
      const customfields = user.customfields || [];

      const xpField = customfields.find((f: any) => f.shortname === 'ipelan_xp');
      const streakField = customfields.find((f: any) => f.shortname === 'ipelan_streak');

      const xp = parseInt(xpField?.value ?? '0', 10);
      const streak = parseInt(streakField?.value ?? '0', 10);
      const rawAvatar = user.profileimageurl || user.profileimageurlsmall || '';

      if (xp > 0) {
        entries.push({
          rank: 0,
          userId: user.id,
          fullname:
            user.fullname ||
            `${user.firstname || ''} ${user.lastname || ''}`.trim(),
          xp,
          streak,
          avatarUrl: rawAvatar ? convertFileUrlForAuth(rawAvatar, token) : '',
        });
      }
    }

    // Tri stable XP desc, puis streak desc en cas d'égalité
    const sorted = entries.sort((a, b) => (b.xp - a.xp) || (b.streak - a.streak));

    return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
  } catch (err: any) {
    console.warn('[leaderboardService] getGlobalLeaderboard exception:', err.message);
    return [];
  }
}