import { isMoodleOnline } from '@/services/api/moodleClient';
import {
  getUserProgress,
  initStreakTable,
  setCoins,
  setLives,
  setStreak,
  setXP,
} from '@/services/api/userProgressService';
import { getUserGamificationFromMoodle } from '@/services/api/xpService';
import { getGlobalGamificationStats } from '@/services/gamification/gamificationService';
import { updateUser } from '@/services/redux/slices/authSlice';
import { RootState } from '@/services/redux/store';
import { countUserBadges, getUserBadges, initBadgeTable } from '@/services/storage/badge-storage';
import { getAllCourseProgress } from '@/services/storage/course-progress';
import { syncQueue } from '@/services/sync/syncQueue';
import { verifyUserIdentityBeforeSync } from '@/services/utils/userIdentity';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

const IS_DEV = process.env.NODE_ENV === 'development';

export interface UserStats {
  xp: number;
  coins: number;
  streak: number;
  streakBest: number;
  badges: number;
  lives: number;
  coursesInProgress: number;
  coursesCompleted: number;
  lastActivity: string | null;
  nextHeartTime: string | null;
}

interface UseUserStatsReturn {
  stats: UserStats;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  syncToMoodle: () => Promise<boolean>;
  // Fonctions utilitaires pour modifier les stats
  addXP: (amount: number) => Promise<void>;
  updateStreak: () => Promise<void>;
  addBadge: (badgeId: string) => Promise<void>;
  addCoins: (amount: number) => Promise<void>;
}

export function useUserStats(): UseUserStatsReturn {
  const { user, token } = useSelector((state: RootState) => state.auth);
  const userId = user?.id;
  const dispatch = useDispatch();

  const [stats, setStats] = useState<UserStats>({
    xp: 0,
    coins: 0,
    streak: 0,
    streakBest: 0,
    badges: 0,
    lives: 6,
    coursesInProgress: 0,
    coursesCompleted: 0,
    lastActivity: null,
    nextHeartTime: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initStreakTable().catch(console.warn);
    initBadgeTable().catch(console.warn);
  }, []);

  const checkOnline = useCallback((): Promise<boolean> => {
    return isMoodleOnline();
  }, []);

  const loadStats = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const localProgress = await getUserProgress(userId);
      const courseProgress = await getAllCourseProgress();
      const localBadges = await getUserBadges(userId);
      const badgeCount = await countUserBadges(userId);

      const completedCourses = courseProgress.filter(c => {
        const progress = c.totalActivities > 0 ? Math.round((c.completedActivities / c.totalActivities) * 100) : 0;
        return progress === 100;
      }).length;
      const inProgressCourses = courseProgress.filter(c => {
        const progress = c.totalActivities > 0 ? Math.round((c.completedActivities / c.totalActivities) * 100) : 0;
        return progress > 0 && progress < 100;
      }).length;

      const globalStats = await getGlobalGamificationStats(userId);

      let localStats: UserStats = {
        xp: globalStats.totalXp,
        coins: globalStats.coins,
        lives: globalStats.lives,
        streak: globalStats.streak,
        streakBest: globalStats.streak,
        badges: badgeCount,
        coursesInProgress: inProgressCourses,
        coursesCompleted: completedCourses,
        lastActivity: null,
        nextHeartTime: globalStats.nextHeartTime,
      };

      if (IS_DEV) {
        console.log('[useUserStats] Local stats loaded:', localStats);
      }

      // Check network status
      const isOnline = await checkOnline() && token !== null;

      if (isOnline && token) {
        try {
          // 🔒 VÉRIFICATION DE SÉCURITÉ : Vérifier l'identité avant toute synchronisation
          const identityCheck = await verifyUserIdentityBeforeSync(token);

          if (!identityCheck.isValid) {
            console.error('[useUserStats] Identity verification failed:', identityCheck.error);
            // Ne pas synchroniser - utiliser uniquement les données locales
            setStats(localStats);
            setIsLoading(false);
            return;
          }

          if (IS_DEV) {
            console.log('[useUserStats] Identity verified, proceeding with sync');
          }

          // Fetch unified gamification profile from Moodle
          const moodleProfile = await getUserGamificationFromMoodle(token, userId);

          if (IS_DEV) {
            console.log('[useUserStats] Moodle gamification:', moodleProfile);
          }


          const mergedXP = Math.max(localStats.xp, moodleProfile.xp);
          const mergedCoins = Math.max(localStats.coins, moodleProfile.coins);
          const mergedLives = Math.max(localStats.lives, moodleProfile.lives);
          const mergedStreak = Math.max(localStats.streak, moodleProfile.streak);
          const mergedStreakBest = Math.max(localStats.streakBest, moodleProfile.streak, moodleProfile.streak);
          const mergedBadges = Math.max(localStats.badges, moodleProfile.badgeCount);

          // If Moodle has higher values, write them back to local SQLite
          const needsUpdate =
            mergedXP > localStats.xp ||
            mergedCoins > localStats.coins ||
            mergedLives > localStats.lives ||
            mergedStreak > localStats.streak ||
            mergedBadges > localStats.badges;

          if (needsUpdate) {
            if (IS_DEV) {
              console.log('[useUserStats] Moodle has higher values, updating local DB');
            }
            if (mergedXP > localStats.xp) await setXP(userId, mergedXP);
            if (mergedCoins > localStats.coins) await setCoins(userId, mergedCoins);
            if (mergedLives > localStats.lives) await setLives(userId, mergedLives);
            if (mergedStreak > localStats.streak) await setStreak(userId, mergedStreak);
          }

          const mergedStats: UserStats = {
            xp: mergedXP,
            coins: mergedCoins,
            lives: mergedLives,
            streak: mergedStreak,
            streakBest: mergedStreakBest,
            badges: mergedBadges,
            coursesInProgress: localStats.coursesInProgress,
            coursesCompleted: localStats.coursesCompleted,
            lastActivity: moodleProfile.lastActivityDate || new Date().toISOString(),
            nextHeartTime: localStats.nextHeartTime,
          };

          setStats(mergedStats);

          await Promise.all([
            setXP(userId, mergedStats.xp),
            setCoins(userId, mergedStats.coins),
            setLives(userId, mergedStats.lives),
            setStreak(userId, mergedStats.streak),
          ]);

          // Sauvegarder aussi les badges fusionnés
          const { saveBadge } = await import('@/services/storage/badge-storage');
          if (moodleProfile.badges && Array.isArray(moodleProfile.badges)) {
            for (const badgeId of moodleProfile.badges) {
              await saveBadge(userId, badgeId);
            }
          }

          // Mettre à jour Redux pour l'UI immédiate
          dispatch(updateUser({
            xp: mergedStats.xp,
            coins: mergedStats.coins,
            lives: mergedStats.lives,
            streak: mergedStats.streak,
          }));

          // Trigger background sync to ensure Moodle is up to date with merged state
          if (token) {
            syncQueue.syncGamification(userId, token);
          }
        } catch (syncErr) {
          console.warn('[useUserStats] Moodle sync failed, using local:', syncErr);
          setStats(localStats);
        }
      } else {
        // Offline mode - use local data only
        setStats(localStats);
        if (IS_DEV) {
          console.log('[useUserStats] Offline mode - using local data');
        }
      }
    } catch (err: any) {
      console.error('[useUserStats] Error loading stats:', err);
      setError(err.message || 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, [userId, token, checkOnline, dispatch]);

  // Manuel sync to Moodle
  const syncToMoodle = useCallback(async (): Promise<boolean> => {
    if (!userId || !token) return false;

    setIsSyncing(true);
    try {
      const isOnline = await checkOnline();
      if (!isOnline) {
        console.log('[useUserStats] Cannot sync - offline');
        return false;
      }

      // 🔒 VÉRIFICATION DE SÉCURITÉ : Vérifier l'identité avant la synchronisation
      const identityCheck = await verifyUserIdentityBeforeSync(token);
      if (!identityCheck.isValid) {
        console.error('[useUserStats] Sync aborted - identity verification failed:', identityCheck.error);
        return false;
      }

      if (IS_DEV) {
        console.log('[useUserStats] Identity verified, proceeding with manual sync');
      }

      await syncQueue.syncGamification(userId, token);
      return true;
    } catch (err) {
      console.warn('[useUserStats] Sync to Moodle failed:', err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [userId, token, checkOnline]);

  const addXPUtil = useCallback(async (amount: number) => {
    if (!userId) return;
    try {
      const { addXP: addXPService } = await import('@/services/api/userProgressService');
      const newXP = await addXPService(userId, amount);
      setStats(prev => ({ ...prev, xp: newXP }));
      if (token) syncQueue.syncGamification(userId, token);
    } catch (err) {
      console.error('[useUserStats] Failed to add XP:', err);
    }
  }, [userId, token]);

  const updateStreakUtil = useCallback(async () => {
    if (!userId) return;
    try {
      const { updateStreak: updateStreakService } = await import('@/services/api/userProgressService');
      const newStreak = await updateStreakService(userId);
      setStats(prev => ({
        ...prev,
        streak: newStreak,
        streakBest: Math.max(prev.streakBest, newStreak)
      }));
      if (token) syncQueue.syncGamification(userId, token);
    } catch (err) {
      console.error('[useUserStats] Failed to update streak:', err);
    }
  }, [userId, token]);

  const addBadge = useCallback(async (badgeId: string) => {
    if (!userId) return;
    try {
      const { hasBadge, saveBadge, countUserBadges } = await import('@/services/storage/badge-storage');
      const alreadyHas = await hasBadge(userId, badgeId);
      if (alreadyHas) return;

      await saveBadge(userId, badgeId);
      const newCount = await countUserBadges(userId);
      setStats(prev => ({ ...prev, badges: newCount }));
      if (token) syncQueue.syncGamification(userId, token);
    } catch (err) {
      console.error('[useUserStats] Failed to add badge:', err);
    }
  }, [userId, token]);

  const addCoinsUtil = useCallback(async (amount: number) => {
    if (!userId) return;
    try {
      const { addCoins: addCoinsService } = await import('@/services/api/userProgressService');
      await addCoinsService(userId, amount);
      setStats(prev => ({ ...prev, coins: prev.coins + amount }));
      if (token) syncQueue.syncGamification(userId, token);
    } catch (err) {
      console.error('[useUserStats] Failed to add coins:', err);
    }
  }, [userId, token]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    isLoading,
    isSyncing,
    addXP: addXPUtil,
    updateStreak: updateStreakUtil,
    addBadge,
    addCoins: addCoinsUtil,
    error,
    refetch: loadStats,
    syncToMoodle,
  };
}


