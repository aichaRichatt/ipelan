import { moodleFetch } from './moodleClient';

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

    if (result?.exception) {
      console.warn('[leaderboardService] get_enrolled_users error:', result.message);
      return [];
    }

    const users = result || [];
    const entries: LeaderboardEntry[] = [];

    for (const user of users) {
      const customfields = user.customfields || [];
      
      const xpField = customfields.find((f: any) => f.shortname === 'ipelan_xp');
      const streakField = customfields.find((f: any) => f.shortname === 'ipelan_streak');

      const xp = parseInt(xpField?.value ?? '0', 10);
      const streak = parseInt(streakField?.value ?? '0', 10);

      entries.push({
        rank: 0,
        userId: user.id,
        fullname: user.fullname || `${user.firstname || ''} ${user.lastname || ''}`.trim(),
        xp,
        streak,
        avatarUrl: user.profileimageurl || user.profileimageurlsmall || '',
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

export async function getGlobalLeaderboard(
  token: string
): Promise<LeaderboardEntry[]> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_user_get_users',
      moodlewsrestformat: 'json',
      criteria: [],
      limit: 100,
    });

    if (result?.exception) {
      console.warn('[leaderboardService] get_users error:', result.message);
      return [];
    }

    const users = result?.users || [];
    const entries: LeaderboardEntry[] = [];

    for (const user of users) {
      const customfields = user.customfields || [];
      
      const xpField = customfields.find((f: any) => f.shortname === 'ipelan_xp');
      const streakField = customfields.find((f: any) => f.shortname === 'ipelan_streak');

      const xp = parseInt(xpField?.value ?? '0', 10);
      const streak = parseInt(streakField?.value ?? '0', 10);

      if (xp > 0) {
        entries.push({
          rank: 0,
          userId: user.id,
          fullname: `${user.firstname || ''} ${user.lastname || ''}`.trim(),
          xp,
          streak,
          avatarUrl: user.profileimageurl || user.profileimageurlsmall || '',
        });
      }
    }

    const sorted = entries.sort((a, b) => b.xp - a.xp);
    
    return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
  } catch (err: any) {
    console.warn('[leaderboardService] getGlobalLeaderboard exception:', err.message);
    return [];
  }
}