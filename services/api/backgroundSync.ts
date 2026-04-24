import { getAuthToken } from '../contentLoader';
import { getUserProgress, syncUserProgressToMoodle, syncCoinsToMoodle } from './userProgressService';

const TASK_NAME = 'IPELAN_BG_SYNC';

export async function registerBackgroundSync(): Promise<boolean> {
  try {
    const BackgroundFetch = require('expo-background-fetch').default;
    const status = await BackgroundFetch.getStatusAsync();
    
    if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
      await BackgroundFetch.registerTaskAsync(TASK_NAME, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('[BackgroundSync] Registered successfully');
      return true;
    }
    
    console.log('[BackgroundSync] Not available, status:', status);
    return false;
  } catch (err) {
    console.warn('[BackgroundSync] Registration failed:', err);
    return false;
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    const BackgroundFetch = require('expo-background-fetch').default;
    await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
    console.log('[BackgroundSync] Unregistered');
  } catch (err) {
    console.warn('[BackgroundSync] Unregister failed:', err);
  }
}

export async function performBackgroundSync(
  userId: number,
  token: string
): Promise<boolean> {
  try {
    const moodleToken = getAuthToken(token);
    if (!moodleToken) {
      console.log('[BackgroundSync] No token, skipping');
      return false;
    }

    const progress = await getUserProgress(userId);
    if (!progress) {
      console.log('[BackgroundSync] No progress found');
      return false;
    }

    const xpSynced = await syncUserProgressToMoodle(
      userId,
      progress.xp,
      progress.streak_current,
      moodleToken
    );

    if (progress.coins > 0) {
      await syncCoinsToMoodle(userId, progress.coins, moodleToken);
    }

    console.log('[BackgroundSync] Sync complete:', {
      xp: progress.xp,
      streak: progress.streak_current,
      success: xpSynced
    });

    return xpSynced;
  } catch (err) {
    console.warn('[BackgroundSync] Sync failed:', err);
    return false;
  }
}

export function initBackgroundSyncOnAppStart(userId: number, token: string): void {
  registerBackgroundSync().then((registered) => {
    if (registered) {
      performBackgroundSync(userId, token);
    }
  });
}