/**
 * Sync Queue Service
 * Gère la synchronisation automatique avec retry en background
 * Sans interruption utilisateur
 */

import { isMoodleOnline } from '../api/moodleClient';
import { triggerGamificationSync } from '../gamification/gamificationService';
import {
  persistGamificationJob,
  removePersistedGamificationJob,
  getPendingGamificationJobs,
} from '../storage/sync-queue';

const IS_DEV = process.env.NODE_ENV === 'development';

interface SyncJob {
  id: string;
  type: 'xp' | 'streak' | 'coins' | 'course_progress' | 'badges' | 'last_badge' | 'gamification';
  userId: number;
  token: string;
  data: any;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
}

class SyncQueue {
  private jobs: SyncJob[] = [];
  private isProcessing: boolean = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  getStatus(): SyncStatus {
    const pending = this.jobs.filter(j => j.attempts < j.maxAttempts).length;
    const failed = this.jobs.filter(j => j.attempts >= j.maxAttempts).length;

    if (this.isProcessing && pending > 0) return 'syncing';
    if (pending > 0) return 'pending';
    if (failed > 0) return 'error';
    return 'synced';
  }

  subscribe(callback: (status: SyncStatus) => void) {
    this.listeners.add(callback);
    callback(this.getStatus());
    return () => this.listeners.delete(callback);
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach(cb => cb(status));
  }

  addJob(type: SyncJob['type'], userId: number, token: string, data: any) {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Éviter les doublons - remplacer job existant du même type
    this.jobs = this.jobs.filter(j => !(j.type === type && j.userId === userId));

    this.jobs.push({
      id,
      type,
      userId,
      token,
      data,
      attempts: 0,
      maxAttempts: 5,
      createdAt: Date.now(),
    });

    // Persister dans SQLite (sans token — il sera rechargé depuis SecureStore au restart)
    persistGamificationJob(userId, type, data || {}).catch(() => {});

    if (IS_DEV) {
      console.log(`[SyncQueue] Job added: ${type}`, data);
    }

    this.notify();
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.notify();

    while (this.jobs.length > 0) {
      const job = this.jobs[0];

      // Vérifier connexion
      const isOnline = await this.checkOnline();
      if (!isOnline) {
        // ✅ Logger seulement si on vient de passer offline (premier job)
        if (IS_DEV && this.jobs[0]?.attempts === 0) {
          console.log('[SyncQueue] Offline, waiting... (jobs pending:', this.jobs.length, ')');
        }
        break;
      }

      const success = await this.executeJob(job);

      if (success) {
        this.jobs.shift(); // Supprimer job réussi
        removePersistedGamificationJob(job.userId, job.type).catch(() => {});
        if (IS_DEV) console.log(`[SyncQueue] Job completed: ${job.type}`);
      } else {
        job.attempts++;
        if (job.attempts >= job.maxAttempts) {
          // Job échoué définitivement
          if (IS_DEV) console.warn(`[SyncQueue] Job failed after ${job.maxAttempts} attempts: ${job.type}`);
          this.jobs.shift();
          removePersistedGamificationJob(job.userId, job.type).catch(() => {});
        } else {
          // Attendre avant retry (backoff exponentiel)
          const delay = Math.min(1000 * Math.pow(2, job.attempts), 30000);
          if (IS_DEV) console.log(`[SyncQueue] Retry ${job.attempts} for ${job.type} in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }
      }

      this.notify();
    }

    this.isProcessing = false;
    this.notify();

    // Si des jobs restent, réessayer dans 30 secondes
    if (this.jobs.length > 0) {
      setTimeout(() => this.processQueue(), 30000);
    }
  }

  private async executeJob(job: SyncJob): Promise<boolean> {
    try {
      switch (job.type) {
        case 'xp':
        case 'streak':
        case 'coins':
        case 'badges':
        case 'last_badge':
        case 'gamification':
          return await triggerGamificationSync(job.userId, job.token);

        case 'course_progress':
          return await this._doSyncCourseProgress(job);

        default:
          return false;
      }
    } catch (err) {
      if (IS_DEV) console.error(`[SyncQueue] Job error:`, err);
      return false;
    }
  }

  private async _doSyncCourseProgress(job: SyncJob): Promise<boolean> {
    try {
      // Delegate to triggerGamificationSync which handles all fields including
      // ipelan_course_progress, ipelan_last_sync, lives, etc. correctly.
      return await triggerGamificationSync(job.userId, job.token);
    } catch (err) {
      if (IS_DEV) console.error('[SyncQueue] Course progress sync error:', err);
      return false;
    }
  }


  private async checkOnline(): Promise<boolean> {
    return isMoodleOnline();
  }

  // API publique pour les composants
  syncXP(userId: number, xp: number, streak: number, token: string) {
    this.addJob('xp', userId, token, { xp, streak });
  }

  syncCoins(userId: number, coins: number, token: string) {
    this.addJob('coins', userId, token, { coins });
  }

  syncCourseProgress(userId: number, courseId: number, progress: any, token: string) {
    this.addJob('course_progress', userId, token, {
      courseId,
      completedActivities: progress.completedActivities,
      totalActivities: progress.totalActivities,
      totalXP: progress.totalXP
    });
  }

  syncBadges(userId: number, badgeIds: string[], token: string) {
    this.addJob('badges', userId, token, { badgeIds });
  }

  syncLastBadge(userId: number, lastBadgeId: string, token: string) {
    this.addJob('last_badge', userId, token, { lastBadgeId });
  }

  syncGamification(userId: number, token: string) {
    this.addJob('gamification', userId, token, {});
  }

  clearJobs(userId?: number) {
    if (userId !== undefined) {
      const removed = this.jobs.filter(j => j.userId === userId);
      this.jobs = this.jobs.filter(j => j.userId !== userId);
      // Supprimer aussi de SQLite
      removed.forEach(j => removePersistedGamificationJob(j.userId, j.type).catch(() => {}));
    } else {
      this.jobs = [];
      // clearJobs sans userId = déconnexion → pas besoin de purger toute la table
    }
    this.notify();
  }

  /**
   * Appelé au démarrage de l'app (après restauration auth) pour récupérer
   * les jobs gamification qui n'ont pas été traités avant le dernier kill/crash.
   * Le token est passé en paramètre — ne jamais le lire depuis SQLite.
   */
  async restorePersistedJobs(token: string): Promise<void> {
    try {
      const pending = await getPendingGamificationJobs();
      if (pending.length === 0) return;

      let restored = 0;
      for (const row of pending) {
        // Ne pas re-ajouter si un job du même type est déjà en mémoire
        const exists = this.jobs.some(j => j.type === row.job_type && j.userId === row.user_id);
        if (exists) continue;

        const id = `${row.job_type}_restored_${row.id}`;
        this.jobs.push({
          id,
          type: row.job_type as SyncJob['type'],
          userId: row.user_id,
          token,
          data: (() => { try { return JSON.parse(row.job_data); } catch { return {}; } })(),
          attempts: 0, // repartir de 0 avec le nouveau token
          maxAttempts: 5,
          createdAt: Date.now(),
        });
        restored++;
      }

      if (restored > 0) {
        if (IS_DEV) console.log(`[SyncQueue] ${restored} job(s) restauré(s) depuis SQLite`);
        this.notify();
        this.processQueue();
      }
    } catch (err) {
      if (IS_DEV) console.warn('[SyncQueue] Impossible de restaurer les jobs persistés:', err);
    }
  }
}

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error';

export const syncQueue = new SyncQueue();

