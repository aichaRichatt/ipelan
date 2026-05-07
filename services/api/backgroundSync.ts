import { getToken, getUserData } from '../storage/tokenStorage';
import { syncQueue } from '../sync/syncQueue';
import { isMoodleOnline } from './moodleClient';
import { deletePendingSync, getPendingSync, getUserProgress, submitGradeToMoodle, updatePendingSync } from './userProgressService';

const TASK_NAME = 'IPELAN_BG_SYNC';

function loadTaskManager(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-task-manager');
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

const TaskManager = loadTaskManager();

function defineBackgroundFetchTask(): void {
  if (!TaskManager || typeof TaskManager.defineTask !== 'function') {
    return;
  }

  let isDefined = false;
  if (typeof TaskManager.isTaskDefined === 'function') {
    try {
      isDefined = TaskManager.isTaskDefined(TASK_NAME);
    } catch {
      isDefined = false;
    }
  }

  if (isDefined) {
    return;
  }

  TaskManager.defineTask(TASK_NAME, async ({ error }: { error?: any }) => {
    if (error) {
      console.warn('[BackgroundSync] Task error:', error);
      return;
    }

    try {
      const token = await getToken();
      const userData = await getUserData();
      if (!token || !userData?.id) {
        console.log('[BackgroundSync] No user token or user data available in task');
        return;
      }

      await performBackgroundSync(userData.id, token);
    } catch (taskErr) {
      console.warn('[BackgroundSync] Task execution failed:', taskErr);
    }
  });
}


function loadBackgroundFetch(): any | null {
  try {
    // Pas de require() littéral pour ne pas bloquer le bundler
    const moduleName = 'expo-background-fetch';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(moduleName);
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

export async function registerBackgroundSync(): Promise<boolean> {
  const BackgroundFetch = loadBackgroundFetch();
  if (!BackgroundFetch) {
    console.info('[BackgroundSync] expo-background-fetch non installé — sync arrière-plan désactivée');
    return false;
  }
  try {
    defineBackgroundFetchTask();
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
  const BackgroundFetch = loadBackgroundFetch();
  if (!BackgroundFetch) return;
  try {
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
  const IS_DEV = process.env.NODE_ENV === 'development';

  try {
    const moodleToken = token;
    if (!moodleToken) {
      console.log('[BackgroundSync] No token, skipping');
      return false;
    }

    // Check if Moodle is online
    const isOnline = await isMoodleOnline();
    if (!isOnline) {
      if (IS_DEV) console.log('[BackgroundSync] Moodle offline, deferring sync');
      return false;
    }

    let syncSuccess = true;

    // 1. Sync gamification data (XP, streak, coins, badges) via syncQueue
    try {
      syncQueue.syncGamification(userId, moodleToken);
      if (IS_DEV) console.log('[BackgroundSync] Gamification sync queued');
    } catch (err) {
      console.warn('[BackgroundSync] Gamification sync failed:', err);
      syncSuccess = false;
    }

    // 2. Process pending activity sync records
    try {
      const pendingRecords = await getPendingSync();
      if (pendingRecords.length > 0) {
        if (IS_DEV) console.log(`[BackgroundSync] Processing ${pendingRecords.length} pending sync records`);

        for (const record of pendingRecords) {
          try {
            const payload = JSON.parse(record.payload);

            // Submit grade/completion to Moodle
            const gradeSuccess = await submitGradeToMoodle({
              userId,
              courseId: record.course_id,
              moduleId: record.module_id,
              score: payload.score || 0,
              total: payload.total || 100,
              token: moodleToken,
            });

            if (gradeSuccess) {
              await deletePendingSync(record.id);
              if (IS_DEV) console.log(`[BackgroundSync] Synced and removed pending record ${record.id}`);
            } else {
              await updatePendingSync(record.id, 'failed', true);
              if (IS_DEV) console.warn(`[BackgroundSync] Failed to sync record ${record.id}, will retry`);
            }
          } catch (recordErr) {
            console.warn(`[BackgroundSync] Error processing record ${record.id}:`, recordErr);
            await updatePendingSync(record.id, 'error', true);
          }
        }
      }
    } catch (err) {
      console.warn('[BackgroundSync] Pending sync processing failed:', err);
      syncSuccess = false;
    }

    // 3. Get local progress for logging/debugging
    const progress = await getUserProgress(userId);
    if (progress && IS_DEV) {
      console.log('[BackgroundSync] Local progress:', {
        xp: progress.xp,
        coins: progress.coins,
        streak: progress.streak_current,
      });
    }

    return syncSuccess;
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

