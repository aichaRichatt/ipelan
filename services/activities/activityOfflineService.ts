import * as FileSystem from 'expo-file-system/legacy';
import { getDBConnection } from '../storage/db-service';
import type { DictationExercise } from '../api/dictationService';
import type { ListeningExercise } from '../api/listeningService';
import type { WordPair } from '../api/associationService';
import type { WordOrderSentence } from '../api/wordOrderService';

const IS_DEV = process.env.NODE_ENV === 'development';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ActivityType = 'dictation' | 'listening' | 'association' | 'word_order';

// Volontairement permissif : la sérialisation JSON accepte tout objet/tableau.
// Les types concrets sont appliqués au moment de la lecture via le générique T.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ActivityData = Record<string, any> | any[];

export interface CachedActivity<T = ActivityData> {
  cmid            : number;
  activityType    : ActivityType;
  courseId        : number;
  data            : T;
  rawAudioUrl     : string | null;   // fileurl sans token — reconstruit avec token courant
  localAudioPath  : string | null;   // chemin filesystem local si téléchargé
  audioDownloaded : boolean;
  cachedAt        : number;
}

// ─── Helpers audio ──────────────────────────────────────────────────────────────

/** Reconstruit l'URL authentifiée depuis le rawAudioUrl et le token courant */
export function buildAuthAudioUrl(rawAudioUrl: string, token: string): string {
  const base = rawAudioUrl.includes('/webservice/pluginfile.php/')
    ? rawAudioUrl
    : rawAudioUrl.replace('/pluginfile.php/', '/webservice/pluginfile.php/');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}token=${encodeURIComponent(token)}`;
}

/** Chemin local pour l'audio d'une activité */
function audioLocalPath(cmid: number, rawAudioUrl: string): string {
  const ext = rawAudioUrl.split('.').pop()?.split('?')[0] || 'mp3';
  return `${FileSystem.documentDirectory}activities/${cmid}/audio.${ext}`;
}

// ─── Cache (écriture) ───────────────────────────────────────────────────────────

/**
 * Met en cache les données d'une activité.
 * Pour dictée et écoute : passer rawAudioUrl (fileurl sans token).
 * Pour association et jeu de mots : rawAudioUrl = null.
 */
export async function cacheActivity(
  cmid        : number,
  activityType: ActivityType,
  courseId    : number,
  data        : ActivityData,
  rawAudioUrl : string | null = null
): Promise<void> {
  const db  = await getDBConnection();
  const now = Date.now();
  const json = JSON.stringify(data);
  // INSERT OR IGNORE creates the row only if it doesn't exist yet.
  // This preserves local_audio_path + audio_downloaded set by downloadActivityAudio.
  await db.runAsync(
    `INSERT OR IGNORE INTO activity_cache
       (cmid, activity_type, course_id, data_json, raw_audio_url, local_audio_path, audio_downloaded, cached_at)
     VALUES (?, ?, ?, ?, ?, NULL, 0, ?)`,
    [cmid, activityType, courseId, json, rawAudioUrl, now]
  );
  // Always update data fields — does NOT touch local_audio_path / audio_downloaded.
  await db.runAsync(
    `UPDATE activity_cache
     SET activity_type = ?, course_id = ?, data_json = ?, raw_audio_url = ?, cached_at = ?
     WHERE cmid = ?`,
    [activityType, courseId, json, rawAudioUrl, now, cmid]
  );
  if (IS_DEV) console.log(`[ActivityOffline] Données cachées pour cmid ${cmid} (${activityType})`);
}

// ─── Téléchargement audio ────────────────────────────────────────────────────────

/**
 * Télécharge le fichier audio d'une activité vers le filesystem local.
 * Retourne le chemin local ou null si échec.
 */
export async function downloadActivityAudio(
  cmid       : number,
  rawAudioUrl: string,
  token      : string
): Promise<string | null> {
  const localPath = audioLocalPath(cmid, rawAudioUrl);

  try {
    // Déjà téléchargé ?
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) {
      if (IS_DEV) console.log(`[ActivityOffline] Audio déjà présent: ${localPath}`);
      return localPath;
    }

    // Créer le répertoire
    const dir = localPath.substring(0, localPath.lastIndexOf('/'));
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    // Télécharger
    const url    = buildAuthAudioUrl(rawAudioUrl, token);
    const result = await FileSystem.downloadAsync(url, localPath);

    if (result.status !== 200) {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
      if (IS_DEV) console.warn(`[ActivityOffline] Audio download HTTP ${result.status}`);
      return null;
    }

    // Mettre à jour SQLite avec le chemin local
    const db = await getDBConnection();
    await db.runAsync(
      'UPDATE activity_cache SET local_audio_path = ?, audio_downloaded = 1 WHERE cmid = ?',
      [localPath, cmid]
    );

    if (IS_DEV) console.log(`[ActivityOffline] Audio téléchargé: ${localPath}`);
    return localPath;
  } catch (e) {
    if (IS_DEV) console.warn(`[ActivityOffline] Erreur download audio cmid ${cmid}:`, e);
    return null;
  }
}

/**
 * Télécharge données + audio en une seule opération.
 * C'est la fonction à appeler depuis le bouton "Télécharger" dans l'UI.
 */
export async function downloadActivityForOffline(
  cmid        : number,
  activityType: ActivityType,
  courseId    : number,
  data        : ActivityData,
  rawAudioUrl : string | null,
  token       : string
): Promise<void> {
  // 1. Cacher les données texte
  await cacheActivity(cmid, activityType, courseId, data, rawAudioUrl);

  // 2. Télécharger l'audio si nécessaire
  if (rawAudioUrl) {
    await downloadActivityAudio(cmid, rawAudioUrl, token);
  }
}

// ─── Lecture (offline) ──────────────────────────────────────────────────────────

export async function getActivityOffline<T = ActivityData>(
  cmid: number
): Promise<CachedActivity<T> | null> {
  try {
    const db  = await getDBConnection();
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM activity_cache WHERE cmid = ?',
      [cmid]
    );
    if (!row) return null;

    return {
      cmid           : row.cmid,
      activityType   : row.activity_type as ActivityType,
      courseId       : row.course_id,
      data           : JSON.parse(row.data_json || '{}') as T,
      rawAudioUrl    : row.raw_audio_url ?? null,
      localAudioPath : row.local_audio_path ?? null,
      audioDownloaded: row.audio_downloaded === 1,
      cachedAt       : row.cached_at,
    };
  } catch {
    return null;
  }
}

export async function isActivityCached(cmid: number): Promise<boolean> {
  try {
    const db  = await getDBConnection();
    const row = await db.getFirstAsync<{ cmid: number }>(
      'SELECT cmid FROM activity_cache WHERE cmid = ?',
      [cmid]
    );
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Retourne l'URL audio à utiliser pour la lecture :
 * - chemin local si l'audio est téléchargé
 * - URL Moodle re-authentifiée sinon
 */
export function resolveAudioUrl(
  cached: CachedActivity,
  currentToken: string
): string | null {
  if (cached.localAudioPath && cached.audioDownloaded) {
    return cached.localAudioPath;
  }
  if (cached.rawAudioUrl) {
    return buildAuthAudioUrl(cached.rawAudioUrl, currentToken);
  }
  return null;
}

// ─── Nettoyage ────────────────────────────────────────────────────────────────

export async function clearActivityCache(cmid: number): Promise<void> {
  try {
    const db    = await getDBConnection();
    const row   = await db.getFirstAsync<{ local_audio_path: string | null }>(
      'SELECT local_audio_path FROM activity_cache WHERE cmid = ?',
      [cmid]
    );

    // Supprimer le fichier audio local
    if (row?.local_audio_path) {
      const dir = `${FileSystem.documentDirectory}activities/${cmid}`;
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        await FileSystem.deleteAsync(dir, { idempotent: true });
      }
    }

    await db.runAsync('DELETE FROM activity_cache WHERE cmid = ?', [cmid]);
    if (IS_DEV) console.log(`[ActivityOffline] Cache supprimé pour cmid ${cmid}`);
  } catch (e) {
    if (IS_DEV) console.warn('[ActivityOffline] clearActivityCache error:', e);
  }
}

export async function clearAllActivityCaches(): Promise<void> {
  try {
    const db   = await getDBConnection();
    const rows = await db.getAllAsync<{ cmid: number }>(
      'SELECT cmid FROM activity_cache'
    );
    for (const { cmid } of rows) {
      await clearActivityCache(cmid);
    }
  } catch {}
}
