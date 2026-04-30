 
import { AppState, AppStateStatus } from 'react-native';
import { isMoodleOnline, moodleCall } from '../api/moodleClient';
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
  item: { id: number; wsfunction: string; payload: string; retries: number },
  token: string
): Promise<boolean> {
  // Backoff exponentiel : 2s, 4s, 8s
  if (item.retries > 0) {
    const delay = BACKOFF_BASE_MS * Math.pow(2, item.retries - 1);
    await new Promise(r => setTimeout(r, delay));
  }

  try {
    const params = JSON.parse(item.payload);
    const result = await moodleCall(item.wsfunction, params, token);
    
    if (result?.exception) {
       throw new Error(result.message || 'Moodle exception');
    }

    await removeFromQueue(item.id);
    console.log('[QueueProcessor] ✅ Traité:', item.wsfunction);
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

// ─── Enregistrer le listener AppState ────────────────────────────────────────

let appStateSubscription: any = null;

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

  console.log('[QueueProcessor] Enregistré');
}

export function unregisterQueueProcessor(): void {
  appStateSubscription?.remove();
  appStateSubscription = null;
}
