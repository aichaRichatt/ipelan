import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityType } from '../types/activity';
import { markActivitySynced, saveActivityScore } from '../services/storage/activity-progress';
import { getCourseProgress, updateCourseProgressFromActivities } from '../services/storage/course-progress';
import { getPendingCount } from '../services/storage/sync-queue';
import { syncAfterActivity } from '../services/sync/progressSync';
import { processQueue } from '../services/sync/queueProcessor';

export interface ProgressSaveData {
  moduleId: number;
  courseId: number;
  activityType: ActivityType;
  score: number;
  total: number;
  xpEarned: number;
  userId?: number;
  coinsEarned?: number;
  totalActivities?: number;
}

export type SyncStatus = 'idle' | 'saving' | 'syncing' | 'queued' | 'success' | 'error';

export interface ProgressSyncState {
  status: SyncStatus;
  message: string | null;
  pendingCount: number;
}

const IS_DEV = process.env.NODE_ENV === 'development';

export function useProgressSync(token: string | null) {
  const [state, setState] = useState<ProgressSyncState>({
    status: 'idle',
    message: null,
    pendingCount: 0,
  });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const safeSetState = useCallback((update: Partial<ProgressSyncState>) => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, ...update }));
    }
  }, []);

  /**
   * Sauvegarde immédiate en local (sans réseau requis).
   */
  const saveProgressLocally = useCallback(async (data: ProgressSaveData): Promise<void> => {
    safeSetState({ status: 'saving', message: 'Sauvegarde en cours...' });
    try {
      await saveActivityScore(
        data.moduleId,
        data.courseId,
        data.activityType,
        data.score,
        data.total,
        data.xpEarned,
        data.userId,
        data.coinsEarned ?? 0,
        token ?? undefined
      );

      if (data.totalActivities !== undefined) {
        await updateCourseProgressFromActivities(data.courseId, data.totalActivities, data.userId);
      }

      if (IS_DEV) console.log('[useProgressSync] ✅ Sauvegardé localement:', data.moduleId);
    } catch (e: any) {
      if (IS_DEV) console.error('[useProgressSync] saveProgressLocally error:', e.message);
      throw e;
    }
  }, [token, safeSetState]);

  /**
   * Envoie la progression vers Moodle.
   * Si offline, met en queue et retourne 'queued'.
   * Si online, envoie immédiatement et retourne 'success'.
   */
  const syncActivityToMoodle = useCallback(async (params: {
    moduleId: number;
    courseId: number;
    score: number;
    maxScore: number;
    userId?: number;
    instanceId?: number;
  }): Promise<'success' | 'queued' | 'error'> => {
    if (!token) {
      safeSetState({ status: 'queued', message: 'Mode hors-ligne (sync au prochain démarrage)' });
      return 'queued';
    }

    safeSetState({ status: 'syncing', message: 'Synchronisation avec Moodle...' });
    try {
      await syncAfterActivity({
        courseId: params.courseId,
        cmid: params.moduleId,
        score: params.score,
        maxScore: params.maxScore,
        userId: params.userId,
        tokenParam: token,
      });

      // Vérifier si toujours en attente (sync a été mise en queue)
      const pending = await getPendingCount();
      if (pending > 0) {
        safeSetState({ status: 'queued', message: '📶 Sync mise en queue (hors-ligne)', pendingCount: pending });
        return 'queued';
      }

      safeSetState({ status: 'success', message: '✅ Synchronisé avec Moodle', pendingCount: 0 });
      return 'success';
    } catch (e: any) {
      safeSetState({ status: 'error', message: `⚠️ Sync échouée: ${e.message || 'Erreur'}` });
      if (IS_DEV) console.error('[useProgressSync] syncActivityToMoodle error:', e.message);
      return 'error';
    }
  }, [token, safeSetState]);

  /**
   * Traite tous les items en attente dans la queue (quand connexion retrouvée).
   */
  const syncPendingProgress = useCallback(async (): Promise<{ processed: number; failed: number; remaining: number }> => {
    try {
      const result = await processQueue();
      const pending = await getPendingCount();
      safeSetState({ pendingCount: pending });
      if (IS_DEV) console.log('[useProgressSync] syncPendingProgress:', result);
      return result;
    } catch (e: any) {
      if (IS_DEV) console.error('[useProgressSync] syncPendingProgress error:', e.message);
      return { processed: 0, failed: 0, remaining: 0 };
    }
  }, [safeSetState]);

  /**
   * Lecture hors-ligne de la progression d'un cours.
   */
  const getLocalProgress = useCallback(async (userId: number, courseId: number) => {
    return getCourseProgress(courseId, userId);
  }, []);

  /**
   * Marque une activité comme synchronisée avec Moodle.
   */
  const markAsSynced = useCallback(async (moduleId: number, courseId: number): Promise<void> => {
    await markActivitySynced(moduleId, courseId);
  }, []);

  /**
   * Réessaye les synchronisations échouées (max 3 tentatives via queueProcessor).
   */
  const retryFailed = useCallback(async (): Promise<{ processed: number; failed: number; remaining: number }> => {
    return syncPendingProgress();
  }, [syncPendingProgress]);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    safeSetState({ pendingCount: count });
  }, [safeSetState]);

  return {
    state,
    saveProgressLocally,
    syncActivityToMoodle,
    syncPendingProgress,
    getLocalProgress,
    markAsSynced,
    retryFailed,
    refreshPendingCount,
  };
}
