// TODO: Migrate to expo-background-task when ready:
//   bun add expo-background-task
//   Then replace BackgroundFetch imports with BackgroundTask equivalents.
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { checkAndRegenerateLives } from '../gamification/gamificationService';
import { getDBConnection } from '../storage/db-service';

const BACKGROUND_LIFE_TASK = 'background-life-regeneration';
const IS_DEV = process.env.NODE_ENV === 'development';

const MAX_LIVES = 6;
const REGEN_HOURS = 2;
const REGEN_MS = REGEN_HOURS * 60 * 60 * 1000;

/**
 * Enregistrer la tâche de fond pour régénérer les vies
 */
export function registerLifeBackgroundTask() {
  TaskManager.defineTask(BACKGROUND_LIFE_TASK, async () => {
    try {
      if (IS_DEV) console.log('[Background] Checking life regeneration...');

      const db = await getDBConnection();
      const users = await db.getAllAsync<{ id: number; lives: number; last_lives_update: string }>(
        'SELECT id, lives, last_lives_update FROM users WHERE lives < ? ORDER BY id LIMIT 1',
        [MAX_LIVES]
      );

      if (users.length === 0) {
        if (IS_DEV) console.log('[Background] No users need life regeneration');
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      const user = users[0];
      const now = Date.now();
      const lastUpdate = new Date(user.last_lives_update || now).getTime();
      const elapsedMs = now - lastUpdate;
      const livesToRegen = Math.floor(elapsedMs / REGEN_MS);

      if (livesToRegen > 0) {
        const result = await checkAndRegenerateLives(user.id);

        if (IS_DEV) console.log('[Background] Regenerated', result.regenerated ? 'yes' : 'no', 'lives for user', user.id, 'new count:', result.newLives);

        if (result.regenerated) {
          if (IS_DEV) console.log('[Background] Would schedule notification for', result.newLives, 'lives');
        }

        return BackgroundFetch.BackgroundFetchResult.NewData;
      }

      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
      console.error('[Background] Life regeneration error:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

// Module-level promise to coalesce concurrent registration calls from multiple tabs
let _lifeTaskRegistrationPromise: Promise<boolean> | null = null;

async function _registerLifeTask(): Promise<boolean> {
  try {
    registerLifeBackgroundTask();

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LIFE_TASK);
    if (isRegistered) {
      if (IS_DEV) console.log('[Background] Life task already registered');
      return true;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_LIFE_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    if (IS_DEV) console.log('[Background] Life regeneration task registered (15min interval)');
    return true;
  } catch (error) {
    if (IS_DEV) console.warn('[Background] Failed to register life task:', error);
    return false;
  }
}

/**
 * Démarrer le background fetch pour les vies.
 * Les appels concurrents (ex: 3 tabs montées simultanément) partagent la même Promise.
 */
export async function startLifeBackgroundFetch(): Promise<boolean> {
  if (_lifeTaskRegistrationPromise) return _lifeTaskRegistrationPromise;
  _lifeTaskRegistrationPromise = _registerLifeTask();
  const result = await _lifeTaskRegistrationPromise;
  // Reset on failure so the next cold-start can retry
  if (!result) _lifeTaskRegistrationPromise = null;
  return result;
}

/**
 * Arrêter le background fetch
 */
export async function stopLifeBackgroundFetch(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_LIFE_TASK);
    if (IS_DEV) console.log('[Background] Life task unregistered');
  } catch (error) {
    console.error('[Background] Failed to unregister:', error);
  }
}

/**
 * Calculer immédiatement les vies regénérées (à appeler au foreground)
 */
export async function recalculateLivesOnForeground(
  userId: number,
  serverLastLivesUpdate?: string | null
): Promise<{
  currentLives: number;
  livesRegenerated: number;
  nextHeartTime: string | null;
}> {
  const result = await checkAndRegenerateLives(userId, serverLastLivesUpdate);

  const db = await getDBConnection();
  const user = await db.getFirstAsync<{ lives: number; last_lives_update: string }>(
    'SELECT lives, last_lives_update FROM users WHERE id = ?',
    [userId]
  );

  let nextHeartTime: string | null = null;
  if (user && user.lives < MAX_LIVES) {
    const lastUpdate = new Date(user.last_lives_update).getTime();
    nextHeartTime = new Date(lastUpdate + REGEN_MS).toISOString();
  }

  return {
    currentLives: result.newLives,
    livesRegenerated: result.livesAdded,
    nextHeartTime,
  };
}
