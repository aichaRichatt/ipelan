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
import { startLifeBackgroundFetch } from '@/services/background/lifeRegeneration';
import { getGlobalGamificationStats } from '@/services/gamification/gamificationService';
import { updateUser } from '@/services/redux/slices/authSlice';
import { RootState } from '@/services/redux/store';
import { countUserBadges, initBadgeTable } from '@/services/storage/badge-storage';
import { getAllCourseProgress } from '@/services/storage/course-progress';
import { syncQueue } from '@/services/sync/syncQueue';
import { verifyUserIdentityBeforeSync } from '@/services/utils/userIdentity';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAppState } from './useAppState';

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

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

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

    // ✅ Vérifier et régénérer les vies automatiquement (même si app était fermée)
    const { recalculateLivesOnForeground } = await import('@/services/background/lifeRegeneration');
    const lifeResult = await recalculateLivesOnForeground(userId);
    if (lifeResult.livesRegenerated > 0 && IS_DEV) {
      console.log('[useUserStats] Auto-regenerated', lifeResult.livesRegenerated, 'lives on foreground');
    }

    // ✅ Démarrer le background fetch pour régénération future
    await startLifeBackgroundFetch();
    if (!isMountedRef.current) return;
    setError(null);

    try {
      const localProgress = await getUserProgress(userId);
      const courseProgress = await getAllCourseProgress(userId);
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
        streak: localProgress?.streak_current ?? globalStats.streak,
        streakBest: localProgress?.streak_best ?? globalStats.streak,
        badges: badgeCount,
        coursesInProgress: inProgressCourses,
        coursesCompleted: completedCourses,
        lastActivity: null,
        nextHeartTime: globalStats.nextHeartTime,
      };

      if (IS_DEV) {
        console.log('[useUserStats] Local stats loaded:', localStats);
      }

      const isOnline = await checkOnline() && token !== null;

      if (isOnline && token) {
        try {
          // 🔒 VÉRIFICATION DE SÉCURITÉ : Vérifier l'identité avant toute synchronisation
          const identityCheck = await verifyUserIdentityBeforeSync(token);

          if (!identityCheck.isValid) {
            console.error('[useUserStats] Identity verification failed:', identityCheck.error);
            setStats(localStats);
            dispatch(updateUser({
              xp: localStats.xp,
              coins: localStats.coins,
              lives: localStats.lives,
              streak: localStats.streak,
            }));
            setIsLoading(false);
            return;
          }

          if (IS_DEV) {
            console.log('[useUserStats] Identity verified, proceeding with sync');
          }

          // Lire le timestamp de la dernière sync locale (pour détection de conflits)
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          const localLastSyncStr = await AsyncStorage.getItem('@ipelan_last_sync');
          const localLastSync = localLastSyncStr ? new Date(localLastSyncStr).getTime() : 0;

          // Fetch unified gamification profile from Moodle
          const moodleProfile = await getUserGamificationFromMoodle(token, userId);

          if (IS_DEV) {
            console.log('[useUserStats] Moodle gamification:', moodleProfile);
          }

          // ✅ Seed course_progress depuis Moodle pour Device B (new install)
          if (moodleProfile.courseProgress && Object.keys(moodleProfile.courseProgress).length > 0) {
            const { saveCourseProgress, getCourseProgress } = await import('@/services/storage/course-progress');
            for (const [courseIdStr, data] of Object.entries(moodleProfile.courseProgress)) {
              const courseId = parseInt(courseIdStr, 10);
              if (courseId > 0 && data.t > 0) {
                const localProg = await getCourseProgress(courseId, userId);
                // Seed si: pas de données locales, ou données locales incomplètes, ou plus d'activités complétées côté serveur
                if (!localProg || localProg.totalActivities === 0 || data.c > localProg.completedActivities) {
                  await saveCourseProgress(courseId, data.c, data.t, 0, localProg?.bestScore ?? 0, userId);
                }
              }
            }
            if (IS_DEV) console.log('[useUserStats] Course progress seeded from Moodle:', moodleProfile.courseProgress);
          }

          // ✅ Détection de conflit multi-device via ipelan_last_sync
          const serverLastSync = moodleProfile.lastSync ? new Date(moodleProfile.lastSync).getTime() : 0;
          const serverIsNewer = serverLastSync > localLastSync + 5000; // tolérance 5s
          if (IS_DEV && serverIsNewer) {
            console.warn('[useUserStats] ⚠️ Conflit détecté: le serveur a été sync plus récemment (autre appareil). Server:', moodleProfile.lastSync, '/ Local:', localLastSyncStr);
          }

          // ✅ Recalculer les vies avec le timestamp serveur (ipelan_last_lives_update)
          // Garantit la cohérence multi-device : si l'utilisateur a été actif sur un autre appareil,
          // son timestamp de régénération de vies est plus récent → correction locale
          if (moodleProfile.lastLivesUpdate) {
            const { recalculateLivesOnForeground } = await import('@/services/background/lifeRegeneration');
            const liveResultServer = await recalculateLivesOnForeground(userId, moodleProfile.lastLivesUpdate);
            localStats = {
              ...localStats,
              lives: liveResultServer.currentLives,
              nextHeartTime: liveResultServer.nextHeartTime,
            };
            if (IS_DEV) console.log('[useUserStats] Lives recalculated with server timestamp:', liveResultServer.currentLives, 'nextHeart:', liveResultServer.nextHeartTime);
          }

          // Stratégie de merge :
          // XP/coins/streak : toujours MAX (peuvent seulement augmenter)
          // Lives : si serveur plus récent → serveur fait foi (user a peut-être dépensé des vies)
          //         sinon → local fait foi (regen locale appliquée)
          // Badges : toujours union (jamais perdre un badge)
          const mergedXP = Math.max(localStats.xp, moodleProfile.xp);
          const mergedCoins = Math.max(localStats.coins, moodleProfile.coins);
          const mergedLives = serverIsNewer
            ? Math.max(localStats.lives, moodleProfile.lives) // autre device → prendre le max quand même pour la regen
            : localStats.lives; // local fait foi si plus récent
          const mergedStreak = Math.max(localStats.streak, moodleProfile.streak);
          const mergedStreakBest = Math.max(localStats.streakBest, moodleProfile.streak);
          const mergedBadges = Math.max(localStats.badges, moodleProfile.badgeCount);

          // ✅ Recompute course counts AFTER seeding so Device B sees correct values
          const seededCourseProgress = await getAllCourseProgress(userId);
          const finalCoursesCompleted = seededCourseProgress.filter(c => {
            const p = c.totalActivities > 0 ? Math.round((c.completedActivities / c.totalActivities) * 100) : 0;
            return p === 100;
          }).length;
          const finalCoursesInProgress = seededCourseProgress.filter(c => {
            const p = c.totalActivities > 0 ? Math.round((c.completedActivities / c.totalActivities) * 100) : 0;
            return p > 0 && p < 100;
          }).length;

          const mergedStats: UserStats = {
            xp: mergedXP,
            coins: mergedCoins,
            lives: mergedLives,
            streak: mergedStreak,
            streakBest: mergedStreakBest,
            badges: mergedBadges,
            coursesInProgress: finalCoursesInProgress,
            coursesCompleted: finalCoursesCompleted,
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

          // ✅ Sauvegarder le timestamp de sync locale pour la prochaine détection de conflit
          await AsyncStorage.setItem('@ipelan_last_sync', new Date().toISOString());

          // Trigger background sync to ensure Moodle is up to date with merged state
          if (token) {
            syncQueue.syncGamification(userId, token);
          }

          // ✅ Background non-blocking: rebuild activity_progress from Moodle completion statuses
          // Runs silently after UI is updated — INSERT OR IGNORE never overwrites local scores
          ;(async () => {
            try {
              const { fetchAndPopulateActivityProgressFromMoodle } = await import('@/services/sync/progressSync');
              await fetchAndPopulateActivityProgressFromMoodle(userId, token);
            } catch {}
          })();
        } catch (syncErr) {
          console.warn('[useUserStats] Moodle sync failed, using local:', syncErr);
          setStats(localStats);
          dispatch(updateUser({
            xp: localStats.xp,
            coins: localStats.coins,
            lives: localStats.lives,
            streak: localStats.streak,
          }));
        }
      } else {
        // Offline mode - use local data only
        setStats(localStats);
        dispatch(updateUser({
          xp: localStats.xp,
          coins: localStats.coins,
          lives: localStats.lives,
          streak: localStats.streak,
        }));
        if (IS_DEV) {
          console.log('[useUserStats] Offline mode - using local data');
        }
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('[useUserStats] Error loading stats:', err);
      setError(err.message || 'Failed to load stats');
    } finally {
      if (isMountedRef.current) setIsLoading(false);
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

      syncQueue.syncGamification(userId, token);
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

  // ✅ Détecter quand l'app revient au premier plan et recalculer les vies
  const handleForeground = useCallback(() => {
    if (userId) {
      if (IS_DEV) console.log('[useUserStats] App came to foreground, recalculating lives...');
      loadStats();
    }
  }, [userId, loadStats]);
  useAppState(handleForeground);

  // ✅ Auto-refresh des vies quand nextHeartTime arrive (même si l'app reste ouverte)
  useEffect(() => {
    if (!userId || !stats.nextHeartTime) return;

    const msUntilNextHeart = new Date(stats.nextHeartTime).getTime() - Date.now();

    if (msUntilNextHeart <= 0) {
      // Le timer est déjà passé — recalculer immédiatement
      loadStats();
      return;
    }

    if (IS_DEV) console.log('[useUserStats] Next heart in', Math.round(msUntilNextHeart / 60000), 'min');

    const timer = setTimeout(() => {
      if (IS_DEV) console.log('[useUserStats] Heart timer fired — reloading lives...');
      loadStats();
    }, msUntilNextHeart + 1000); // +1s buffer pour éviter les edge cases

    return () => clearTimeout(timer);
  }, [stats.nextHeartTime, userId, loadStats]);

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


