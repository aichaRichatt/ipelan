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
    console.log('[QueueProcessor] ✅ Traité:', item.wsfunction);

    // Après une complétion confirmée par Moodle, marquer l'activité comme synchronisée
    if (item.type === 'completion' && params.cmid && courseId > 0) {
      await markActivitySynced(parseInt(params.cmid as string, 10), courseId).catch(() => {});
    }

    return true;
  } catch (e: any) {
    const errMsg = e.message ?? 'Erreur inconnue';
    await incrementRetry(item.id, errMsg);
    console.warn('[QueueProcessor] ❌ Échec retry', item.retries + 1, ':', errMsg);
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
    console.warn('[QueueProcessor] Pas de token — queue ignorée');
    return { processed: 0, failed: 0, remaining: 0 };
  }

  const online = await isOnline();
  if (!online) {
    console.info('[QueueProcessor] Hors ligne — queue reportée');
    const remaining = await getPendingCount();
    return { processed: 0, failed: 0, remaining };
  }

  const items     = await getPendingItems(MAX_RETRIES);
  let processed   = 0;
  let failed      = 0;

  if (items.length === 0) return { processed: 0, failed: 0, remaining: 0 };

  console.log('[QueueProcessor] Traitement de', items.length, 'items...');

  for (const item of items) {
    const ok = await processItem(item, token);
    if (ok) processed++;
    else    failed++;
  }

  const remaining = await getPendingCount();
  console.log('[QueueProcessor] Résultat:', { processed, failed, remaining });

  return { processed, failed, remaining };
}

// ─── Listeners ───────────────────────────────────────────────────────────────

let appStateSubscription: any = null;
let netInfoUnsubscribe: (() => void) | null = null;
let wasOffline = false; // détecte la transition offline → online

export function registerQueueProcessor(): void {
  // Traiter au démarrage
  processQueue().catch(console.warn);

  // Traiter chaque fois que l'app revient au premier plan
  if (appStateSubscription) {
    appStateSubscription.remove();
  }
  appStateSubscription = AppState.addEventListener(
    'change',
    (state: AppStateStatus) => {
      if (state === 'active') {
        processQueue().catch(console.warn);
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
      console.log('[QueueProcessor] Réseau retrouvé — sync automatique');
      processQueue().catch(console.warn);
    }
    wasOffline = !isConnected;
  });

  console.log('[QueueProcessor] Enregistré (AppState + NetInfo)');
}

export function unregisterQueueProcessor(): void {
  appStateSubscription?.remove();
  appStateSubscription = null;
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = null;
  wasOffline = false;
}
