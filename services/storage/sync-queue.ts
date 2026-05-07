
import { getDBConnection } from './db-service';

export interface SyncQueueItem {
  id: number;
  type: 'grade' | 'completion' | 'xp' | 'streak' | 'course_progress';
  wsfunction: string;
  payload: string; // JSON stringifié
  userId?: number;
  createdAt: string;
  retries: number;
  lastError?: string;
}

// ─── Ajouter un item à la queue ───────────────────────────────────────────────

export async function addToSyncQueue(
  type: SyncQueueItem['type'],
  wsfunction: string,
  payload: Record<string, unknown>,
  userId?: number
): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.runAsync(
      `INSERT INTO sync_queue (type, wsfunction, payload, user_id)
       VALUES (?, ?, ?, ?)`,
      [type, wsfunction, JSON.stringify(payload), userId ?? null]
    );
    console.log('[SyncQueue] Ajouté:', type, wsfunction);
  } catch (error) {
    console.error('[SyncQueue] Erreur ajout:', error);
  }
}

// ─── Lire les items en attente ────────────────────────────────────────────────

export async function getPendingItems(maxRetries = 3): Promise<SyncQueueItem[]> {
  try {
    const db = await getDBConnection();
    const rows = await db.getAllAsync<any>(
      `SELECT id, type, wsfunction, payload, user_id as userId, created_at as createdAt, retries, last_error as lastError
       FROM sync_queue
       WHERE retries < ?
       ORDER BY created_at ASC`,
      [maxRetries]
    );
    return rows;
  } catch (error) {
    console.error('[SyncQueue] Erreur lecture:', error);
    return [];
  }
}

// ─── Marquer comme traité ─────────────────────────────────────────────────────

export async function removeFromQueue(id: number): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  } catch (error) {
    console.error('[SyncQueue] Erreur suppression:', error);
  }
}

// ─── Incrémenter les retries ──────────────────────────────────────────────────

export async function incrementRetry(id: number, error: string): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.runAsync(
      `UPDATE sync_queue SET retries = retries + 1, last_error = ? WHERE id = ?`,
      [error, id]
    );
  } catch (error) {
    console.error('[SyncQueue] Erreur retry increment:', error);
  }
}

// ─── Compter les items en attente ─────────────────────────────────────────────

export async function getPendingCount(): Promise<number> {
  try {
    const db = await getDBConnection();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM sync_queue WHERE retries < 3'
    );
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

// ─── Gamification queue (persistance des jobs in-memory) ─────────────────────

export async function persistGamificationJob(
  userId: number,
  jobType: string,
  jobData: Record<string, unknown> = {}
): Promise<void> {
  try {
    const db = await getDBConnection();
    // INSERT OR REPLACE respecte la contrainte UNIQUE(user_id, job_type)
    // et écrase le job précédent du même type (même comportement que SyncQueue.addJob)
    await db.runAsync(
      `INSERT OR REPLACE INTO gamification_queue (user_id, job_type, job_data, attempts)
       VALUES (?, ?, ?, 0)`,
      [userId, jobType, JSON.stringify(jobData)]
    );
  } catch (error) {
    console.warn('[GamificationQueue] Erreur persist:', error);
  }
}

export async function removePersistedGamificationJob(
  userId: number,
  jobType: string
): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.runAsync(
      'DELETE FROM gamification_queue WHERE user_id = ? AND job_type = ?',
      [userId, jobType]
    );
  } catch (error) {
    console.warn('[GamificationQueue] Erreur remove:', error);
  }
}

export async function getPendingGamificationJobs(): Promise<
  Array<{ id: number; user_id: number; job_type: string; job_data: string; attempts: number }>
> {
  try {
    const db = await getDBConnection();
    return await db.getAllAsync<{ id: number; user_id: number; job_type: string; job_data: string; attempts: number }>(
      'SELECT id, user_id, job_type, job_data, attempts FROM gamification_queue ORDER BY created_at ASC'
    );
  } catch {
    return [];
  }
}
