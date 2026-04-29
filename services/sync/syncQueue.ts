/**
 * Sync Queue Service
 * Gère la synchronisation automatique avec retry en background
 * Sans interruption utilisateur
 */

import { getGlobalGamificationStats, syncUserGamificationToMoodle, triggerGamificationSync } from '../gamification/gamificationService';
import { getDBConnection } from '../storage/db-service';

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
        if (IS_DEV) console.log('[SyncQueue] Offline, waiting...');
        break;
      }

      const success = await this.executeJob(job);

      if (success) {
        this.jobs.shift(); // Supprimer job réussi
        if (IS_DEV) console.log(`[SyncQueue] Job completed: ${job.type}`);
      } else {
        job.attempts++;
        if (job.attempts >= job.maxAttempts) {
          // Job échoué définitivement - le garder pour retry manuel plus tard
          if (IS_DEV) console.warn(`[SyncQueue] Job failed after ${job.maxAttempts} attempts: ${job.type}`);
          this.jobs.shift();
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
      const { courseId, completedActivities, totalActivities, totalXP } = job.data;

      const localStats = await getGlobalGamificationStats(job.userId);
      await syncUserGamificationToMoodle(job.userId, {
        totalXp: localStats.totalXp,
        coins: localStats.coins,
        lives: localStats.lives,
        streak: localStats.streak,
        allBadgeIds: localStats.allBadgeIds
      }, job.token);

      // 3. Marquer la progression du cours comme sync dans SQLite
      const db = await getDBConnection();
      await db.runAsync(
        'UPDATE course_progress SET synced_at = ? WHERE course_id = ?',
        [new Date().toISOString(), courseId]
      );

      if (IS_DEV) {
        console.log(`[SyncQueue] Course ${courseId} synced:`, {
          xp: localStats.totalXp,
          coins: localStats.coins,
          latestBadge: localStats.latestBadge,
        });
      }

      return true;
    } catch (err) {
      if (IS_DEV) console.error('[SyncQueue] Course progress sync error:', err);
      return false;
    }
  }


  private async checkOnline(): Promise<boolean> {
    try {
      const response = await fetch(process.env.EXPO_PUBLIC_API_URL || 'https://moodle.richatt.com', {
        method: 'HEAD',
        timeout: 3000,
      } as any);
      return response.ok;
    } catch {
      return false;
    }
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
}

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error';

export const syncQueue = new SyncQueue();

