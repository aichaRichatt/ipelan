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

    if (!result?.users?.[0]) {
      console.warn('[xpService] No users returned from Moodle. Result keys:', Object.keys(result || {}));
      return { xp: 0, coins: 0, lives: 6, streak: 0, badges: [], badgeCount: 0, lastBadgeId: null, lastActivityDate: '' };
    }

    const user = result.users[0];
    const fields = parseCustomFields(user);

    const badgesRaw = fields.ipelan_badges || '';
    const badgeIds = badgesRaw
      .split(',')
      .map((id: string) => id.trim())
      .filter((id: string) => id.length > 0);

    return {
      xp: parseInt(fields.ipelan_xp || '0', 10),
      coins: parseInt(fields.ipelan_coins || '0', 10),
      lives: parseInt(fields.ipelan_lives || '6', 10),
      streak: parseInt(fields.ipelan_streak || '0', 10),
      badges: badgeIds,
      badgeCount: parseInt(fields.ipelan_badges_count || '0', 10) || badgeIds.length,
      lastBadgeId: fields.ipelan_last_badge || (badgeIds.length > 0 ? badgeIds[0] : null),
      lastActivityDate: fields.ipelan_last_activity || '',
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