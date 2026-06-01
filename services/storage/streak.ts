
import { useCallback, useEffect, useState } from 'react';
import { getDBConnection } from './db-service';

export interface StreakData {
  userId: number;
  currentStreak: number;
  bestStreak: number;
  lastActivityDate: string | null;
  totalDaysActive: number;
}

// ─── Lire le streak ───────────────────────────────────────────────────────────

export async function getStreak(userId: number): Promise<StreakData> {
  const db = await getDBConnection();
  const row = await db.getFirstAsync<{
    current_streak: number;
    best_streak: number;
    last_activity_date: string | null;
    total_days_active: number;
  }>(
    'SELECT current_streak, best_streak, last_activity_date, total_days_active FROM user_streaks WHERE user_id = ?',
    [userId]
  );

  return {
    userId,
    currentStreak: row?.current_streak ?? 0,
    bestStreak: row?.best_streak ?? 0,
    lastActivityDate: row?.last_activity_date ?? null,
    totalDaysActive: row?.total_days_active ?? 0,
  };
}


// Retourne la date courante en UTC sous forme "YYYY-MM-DD"
function todayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Normalise un dateString (ISO timestamp ou date seule) en "YYYY-MM-DD" UTC
function dateOnlyUTC(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 10); // fallback si parse échoue
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function updateStreakAfterActivity(userId: number): Promise<StreakData> {
  const db = await getDBConnection();
  const today = todayUTC();
  const existing = await getStreak(userId);

  let newStreak = 1;
  let totalDays = existing.totalDaysActive;

  if (existing.lastActivityDate) {
    // Normaliser en date UTC pure pour éviter le décalage timezone
    const lastDateOnly = dateOnlyUTC(existing.lastActivityDate);
    const last = new Date(lastDateOnly); // UTC midnight
    const now = new Date(today);         // UTC midnight
    const diffMs = now.getTime() - last.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Même jour → streak inchangé
      newStreak = existing.currentStreak;
    } else if (diffDays === 1) {
      // Jour consécutif → streak +1
      newStreak = existing.currentStreak + 1;
      totalDays += 1;
    } else {
      // Pause > 1 jour → streak reset
      newStreak = 1;
      totalDays += 1;
    }
  } else {
    // Premier jour d'activité
    totalDays = 1;
  }

  const bestStreak = Math.max(newStreak, existing.bestStreak);

  await db.runAsync(
    `INSERT INTO user_streaks
       (user_id, current_streak, best_streak, last_activity_date, total_days_active, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       current_streak     = excluded.current_streak,
       best_streak        = excluded.best_streak,
       last_activity_date = excluded.last_activity_date,
       total_days_active  = excluded.total_days_active,
       updated_at         = datetime('now')`,
    [userId, newStreak, bestStreak, today, totalDays]
  );

  return {
    userId,
    currentStreak: newStreak,
    bestStreak,
    lastActivityDate: today,
    totalDaysActive: totalDays,
  };
}

/**
 * Vérifie le streak au premier plan (quand l'utilisateur ouvre l'app).
 * Si plus d'un jour s'est écoulé depuis la dernière activité, reset à 0.
 * Préserve best_streak et last_activity_date.
 */
export async function checkStreakOnForeground(userId: number): Promise<number> {
  const db = await getDBConnection();
  const today = todayUTC();
  const existing = await getStreak(userId);

  if (!existing.lastActivityDate) {
    if (existing.currentStreak !== 0) {
      await db.runAsync(
        `UPDATE user_streaks SET current_streak = 0, updated_at = datetime('now') WHERE user_id = ?`,
        [userId]
      );
    }
    return 0;
  }

  const lastDateOnly = dateOnlyUTC(existing.lastActivityDate);
  const last = new Date(lastDateOnly);
  const now = new Date(today);
  const diffMs = now.getTime() - last.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Actif aujourd'hui (0) ou hier (1) → streak valide
  if (diffDays <= 1) return existing.currentStreak;

  // Déjà à 0 → rien à faire
  if (existing.currentStreak === 0) return 0;

  // Rupture : au moins un jour complet sans activité
  await db.runAsync(
    `UPDATE user_streaks SET current_streak = 0, updated_at = datetime('now') WHERE user_id = ?`,
    [userId]
  );

  return 0;
}

// ─── Hook React ───────────────────────────────────────────────────────────────

export function useStreak(userId: number | null) {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getStreak(userId);
      setStreak(data);
    } catch (e) {
      console.error('[useStreak] Failed to load streak:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const recordActivity = useCallback(async () => {
    if (!userId) return;
    try {
      const updated = await updateStreakAfterActivity(userId);
      setStreak(updated);
      return updated;
    } catch (e) {
      console.error('[useStreak] Failed to record activity:', e);
    }
  }, [userId]);

  return { streak, loading, recordActivity, reload: load };
}
