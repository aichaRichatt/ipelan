 

import { getDBConnection } from './db-service';
import { BadgeDefinition, BADGE_DEFINITIONS } from '@/constants/badges';

const IS_DEV = process.env.NODE_ENV === 'development';

export interface UserBadge {
  id: string;
  userId: number;
  badgeId: string;
  earnedAt: string;
  syncedAt: string | null;
}

 
/**
 * Filet de sécurité : la table user_badges est aussi créée par
 * services/storage/db-service.ts → createTables(). Cette fonction est
 * idempotente (CREATE IF NOT EXISTS) et reste utile dans les flux où
 * createTables n'a pas encore tourné (ex. accès direct hors login).
 */
export async function initBadgeTable(): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        badge_id TEXT NOT NULL,
        earned_at TEXT NOT NULL,
        synced_at TEXT,
        UNIQUE(user_id, badge_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
    `);

    if (IS_DEV) {
      console.log('[badgeStorage] Badge table verified');
    }
  } catch (err) {
    console.error('[badgeStorage] Failed to init badge table:', err);
    throw err;
  }
}

 
export async function saveBadge(userId: number, badgeId: string): Promise<void> {
  try {
    const db = await getDBConnection();
    const id = `${userId}_${badgeId}`;
    const earnedAt = new Date().toISOString();
    
    await db.runAsync(
      `INSERT OR REPLACE INTO user_badges (id, user_id, badge_id, earned_at, synced_at)
       VALUES (?, ?, ?, ?, NULL)`,
      [id, userId, badgeId, earnedAt]
    );
    
    if (IS_DEV) {
      console.log(`[badgeStorage] Badge saved: ${badgeId} for user ${userId}`);
    }
  } catch (err) {
    console.error('[badgeStorage] Failed to save badge:', err);
    throw err;
  }
}
 
export async function getUserBadges(userId: number): Promise<UserBadge[]> {
  try {
    const db = await getDBConnection();
    const rows = await db.getAllAsync<{
      id: string;
      user_id: number;
      badge_id: string;
      earned_at: string;
      synced_at: string | null;
    }>(
      'SELECT * FROM user_badges WHERE user_id = ? ORDER BY earned_at DESC',
      [userId]
    );
    return (rows || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      badgeId: r.badge_id,
      earnedAt: r.earned_at,
      syncedAt: r.synced_at,
    }));
  } catch (err) {
    console.error('[badgeStorage] Failed to get user badges:', err);
    return [];
  }
}

 
export async function hasBadge(userId: number, badgeId: string): Promise<boolean> {
  try {
    const db = await getDBConnection();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM user_badges WHERE user_id = ? AND badge_id = ?',
      [userId, badgeId]
    );
    return (row?.count || 0) > 0;
  } catch (err) {
    console.error('[badgeStorage] Failed to check badge:', err);
    return false;
  }
}

 
export async function markBadgesAsSynced(userId: number, badgeIds: string[]): Promise<void> {
  try {
    const db = await getDBConnection();
    const syncedAt = new Date().toISOString();
    
    for (const badgeId of badgeIds) {
      await db.runAsync(
        'UPDATE user_badges SET synced_at = ? WHERE user_id = ? AND badge_id = ?',
        [syncedAt, userId, badgeId]
      );
    }
    
    if (IS_DEV) {
      console.log(`[badgeStorage] Badges marked as synced: ${badgeIds.join(', ')}`);
    }
  } catch (err) {
    console.error('[badgeStorage] Failed to mark badges as synced:', err);
  }
}

 
export async function getUnsyncedBadges(userId: number): Promise<UserBadge[]> {
  try {
    const db = await getDBConnection();
    const rows = await db.getAllAsync<{
      id: string;
      user_id: number;
      badge_id: string;
      earned_at: string;
      synced_at: string | null;
    }>(
      'SELECT * FROM user_badges WHERE user_id = ? AND synced_at IS NULL',
      [userId]
    );
    return (rows || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      badgeId: r.badge_id,
      earnedAt: r.earned_at,
      syncedAt: r.synced_at,
    }));
  } catch (err) {
    console.error('[badgeStorage] Failed to get unsynced badges:', err);
    return [];
  }
}

/**
 * Compte le nombre total de badges
 */
export async function countUserBadges(userId: number): Promise<number> {
  try {
    const db = await getDBConnection();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM user_badges WHERE user_id = ?',
      [userId]
    );
    return row?.count || 0;
  } catch (err) {
    console.error('[badgeStorage] Failed to count badges:', err);
    return 0;
  }
}

/**
 * Supprime tous les badges d'un utilisateur (pour debug/testing)
 */
export async function clearUserBadges(userId: number): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.runAsync('DELETE FROM user_badges WHERE user_id = ?', [userId]);
    
    if (IS_DEV) {
      console.log(`[badgeStorage] All badges cleared for user ${userId}`);
    }
  } catch (err) {
    console.error('[badgeStorage] Failed to clear badges:', err);
  }
}

/**
 * Enrichit les badges avec leurs définitions complètes
 */
export function enrichBadgesWithDefinitions(userBadges: UserBadge[]): Array<BadgeDefinition & { earnedAt: string; synced: boolean }> {
  return userBadges.map(ub => {
    const definition = BADGE_DEFINITIONS.find(b => b.id === ub.badgeId);
    return {
      ...(definition || { id: ub.badgeId, name: ub.badgeId, description: '', icon: '🏅', condition: () => false }),
      earnedAt: ub.earnedAt,
      synced: !!ub.syncedAt,
    };
  });
}

/**
 * Calcule les nouveaux badges gagnés
 */
export function calculateNewBadges(
  progressData: {
    completedLessons: number;
    currentStreak: number;
    totalXP: number;
    quizPassed: number;
    perfectScores: number;
    daysActive: number;
  },
  existingBadgeIds: string[]
): BadgeDefinition[] {
  const newlyEarned: BadgeDefinition[] = [];
  
  for (const badge of BADGE_DEFINITIONS) {
    // Skip si déjà gagné
    if (existingBadgeIds.includes(badge.id)) continue;
    
    // Vérifier condition
    if (badge.condition(progressData)) {
      newlyEarned.push(badge);
    }
  }
  
  return newlyEarned;
}
