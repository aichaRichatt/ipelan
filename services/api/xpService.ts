import { moodleFetch } from './moodleClient';

export interface UserProfile {
  xp: number;
  streak: number;
  lastActivityDate: string;
}

export async function getUserXP(token: string, userId: number): Promise<UserProfile> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_user_get_users_by_field',
      moodlewsrestformat: 'json',
      field: 'id',
      'values[0]': userId,
    });

    if (result?.exception || !result?.users?.[0]) {
      console.warn('[xpService] get_users_by_field error:', result?.message);
      return { xp: 0, streak: 0, lastActivityDate: '' };
    }

    const user = result.users[0];
    const profileFields = user.profile ?? {};

    return {
      xp: parseInt(profileFields.ipelan_xp || '0', 10),
      streak: parseInt(profileFields.ipelan_streak || '0', 10),
      lastActivityDate: profileFields.ipelan_last_activity || '',
    };
  } catch (err: any) {
    console.warn('[xpService] getUserXP exception:', err.message);
    return { xp: 0, streak: 0, lastActivityDate: '' };
  }
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
      'users[0][customfields][0][type]': 'ipelan_xp',
      'users[0][customfields][0][value]': String(newXp),
    });

    if (result?.exception) {
      console.warn('[xpService] update XP error:', result.message);
      return false;
    }

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
      'users[0][customfields][0][type]': 'ipelan_streak',
      'users[0][customfields][0][value]': String(newStreak),
      'users[0][customfields][1][type]': 'ipelan_last_activity',
      'users[0][customfields][1][value]': today,
    });

    if (result?.exception) {
      console.warn('[xpService] update streak error:', result.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[xpService] updateUserStreak exception:', err.message);
    return false;
  }
}

export async function awardXPForActivity(
  token: string,
  userId: number,
  activityType: 'quiz' | 'listening' | 'dictation' | 'association',
  score: number,
  maxScore: number
): Promise<number> {
  const baseXP: Record<string, number> = {
    quiz: 20,
    listening: 15,
    dictation: 15,
    association: 10,
  };

  const multiplier = maxScore > 0 ? score / maxScore : 0;
  const xpAwarded = Math.round(baseXP[activityType] * multiplier);

  if (xpAwarded > 0) {
    await updateUserXP(token, userId, xpAwarded);
    await updateUserStreak(token, userId);
  }

  return xpAwarded;
}