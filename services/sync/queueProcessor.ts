import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { isMoodleOnline, moodleCall } from '../api/moodleClient';
import { markActivitySynced } from '../storage/activity-progress';
import { getToken }                 from '../storage/tokenStorage';
import {
  getPendingItems,
  removeFromQueue,
  incrementRetry,
  getPendingCount,
} from '../storage/sync-queue';
import {
  getPendingQuizAttempts,
  syncQuizAttempt,
  markAttemptSyncError,
} from '../quiz/quizOfflineService';
import { getDBConnection } from '../storage/db-service';

const IS_DEV = process.env.NODE_ENV === 'development';

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_RETRIES     = 3;
const BACKOFF_BASE_MS = 2000; // 2s, 4s, 8s

// ─── Vérifier la connectivité (délégué) ──────────────────────────────────────

const isOnline = isMoodleOnline;

// ─── Traiter un item avec backoff ─────────────────────────────────────────────

async function processItem(
  item: { id: number; type: string; wsfunction: string; payload: string; retries: number },
  token: string
): Promise<boolean> {
  if (item.retries > 0) {
    const delay = BACKOFF_BASE_MS * Math.pow(2, item.retries - 1);
    await new Promise(r => setTimeout(r, delay));
  }

  try {
    const raw = JSON.parse(item.payload);
    // Extraire les métadonnées internes avant d'envoyer à Moodle
    const courseId = raw._courseId ? parseInt(raw._courseId as string, 10) : 0;
    const { _courseId, ...params } = raw;
    await moodleCall(item.wsfunction, params, token);
    await removeFromQueue(item.id);
    if (IS_DEV) console.log('[QueueProcessor] ✅ Traité:', item.wsfunction);

    // Après une complétion confirmée par Moodle, marquer l'activité comme synchronisée
    if (item.type === 'completion' && params.cmid && courseId > 0) {
      await markActivitySynced(parseInt(params.cmid as string, 10), courseId).catch(() => {});
    }

    return true;
  } catch (e: any) {
    const errMsg = e.message ?? 'Erreur inconnue';
    await incrementRetry(item.id, errMsg);
    if (IS_DEV) console.warn('[QueueProcessor] ❌ Échec retry', item.retries + 1, ':', errMsg);
    return false;
  }
}

// ─── Traiter toute la queue ───────────────────────────────────────────────────

export async function processQueue(): Promise<{
  processed: number;
  failed:    number;
  remaining: number;
}> {
  const token = await getToken();
  if (!token) {
    if (IS_DEV) console.warn('[QueueProcessor] Pas de token — queue ignorée');
    return { processed: 0, failed: 0, remaining: 0 };
  }

  const online = await isOnline();
  if (!online) {
    if (IS_DEV) console.info('[QueueProcessor] Hors ligne — queue reportée');
    const remaining = await getPendingCount();
    return { processed: 0, failed: 0, remaining };
  }

  const items     = await getPendingItems(MAX_RETRIES);
  let processed   = 0;
  let failed      = 0;

  if (items.length === 0) return { processed: 0, failed: 0, remaining: 0 };

  if (IS_DEV) console.log('[QueueProcessor] Traitement de', items.length, 'items...');

  for (const item of items) {
    const ok = await processItem(item, token);
    if (ok) processed++;
    else    failed++;
  }

  // Sync tentatives quiz offline
  await syncPendingQuizAttempts(token);

  const remaining = await getPendingCount();
  if (IS_DEV) console.log('[QueueProcessor] Résultat:', { processed, failed, remaining });

  return { processed, failed, remaining };
}

async function syncPendingQuizAttempts(token: string): Promise<void> {
  try {
    // Récupérer tous les user_id distincts qui ont des tentatives en attente
    const db    = await getDBConnection();
    const users = await db.getAllAsync<{ user_id: number }>(
      'SELECT DISTINCT user_id FROM offline_quiz_attempts WHERE synced = 0'
    );

    for (const { user_id } of users) {
      const attempts = await getPendingQuizAttempts(user_id);
      for (const attempt of attempts) {
        try {
          await syncQuizAttempt(attempt, token);
          if (IS_DEV) console.log('[QueueProcessor] Quiz attempt synced:', attempt.attemptId);
        } catch (e: any) {
          await markAttemptSyncError(attempt.id, e.message ?? 'sync error');
          if (IS_DEV) console.warn('[QueueProcessor] Quiz attempt sync failed:', e.message);
        }
      }
    }
  } catch (e) {
    if (IS_DEV) console.warn('[QueueProcessor] syncPendingQuizAttempts error:', e);
  }
}

// ─── Listeners ───────────────────────────────────────────────────────────────

let appStateSubscription: any = null;
let netInfoUnsubscribe: (() => void) | null = null;
let wasOffline = false; // détecte la transition offline → online

export function registerQueueProcessor(): void {
  // Traiter au démarrage
  processQueue().catch(e => { if (IS_DEV) console.warn('[QueueProcessor] startup sync failed:', e); });

  // Traiter chaque fois que l'app revient au premier plan
  if (appStateSubscription) {
    appStateSubscription.remove();
  }
  appStateSubscription = AppState.addEventListener(
    'change',
    (state: AppStateStatus) => {
      if (state === 'active') {
        processQueue().catch(e => { if (IS_DEV) console.warn('[QueueProcessor] foreground sync failed:', e); });
      }
    }
  );

  // Traiter automatiquement au retour du réseau (offline → online)
  if (netInfoUnsubscribe) {
    netInfoUnsubscribe();
  }
  netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const isConnected = state.isConnected ?? false;
    if (isConnected && wasOffline) {
      if (IS_DEV) console.log('[QueueProcessor] Réseau retrouvé — sync automatique');
      processQueue().catch(e => { if (IS_DEV) console.warn('[QueueProcessor] auto-sync failed:', e); });
    }
    wasOffline = !isConnected;
  });

  if (IS_DEV) console.log('[QueueProcessor] Enregistré (AppState + NetInfo)');
}

export function unregisterQueueProcessor(): void {
  appStateSubscription?.remove();
  appStateSubscription = null;
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = null;
  wasOffline = false;
}
