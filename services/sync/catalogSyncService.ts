import AsyncStorage from '@react-native-async-storage/async-storage';
import { moodleCall } from '../api/moodleClient';
import { getCourseContents } from '../api/courseService';
import { getDBConnection, saveCourseContentCache } from '../storage/db-service';
import { cacheManifest, getManifestOffline } from '../epub/epubDownloadService';
import type { EpubManifest } from '../epub/epubServerService';
import { isEpubFile } from '../contentLoader';

const IS_DEV = process.env.NODE_ENV === 'development';

const CATALOG_SYNC_KEY = '@ipelan_catalog_last_sync';
const SYNC_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;

// Empêche deux exécutions parallèles si l'utilisateur revient rapidement sur l'onglet
let _syncInProgress = false;

/**
 * Sync en arrière-plan du catalogue complet :
 * - Contenu de chaque cours → SQLite course_content_cache (offline détail cours)
 * - Manifests EPUB déjà extraits → AsyncStorage (offline sommaire EPUB)
 *
 * Ne télécharge PAS les sections HTML ni les audios.
 * Cadencé à max 1 exécution toutes les 12h, non concurrent.
 */
export async function runCatalogSync(
  courses: any[],
  token: string,
  prefetchedContents?: Map<number, any[]>
): Promise<void> {
  if (_syncInProgress) {
    if (IS_DEV) console.log('[CatalogSync] Already running — skipped');
    return;
  }

  try {
    const raw = await AsyncStorage.getItem(CATALOG_SYNC_KEY).catch(() => null);
    if (raw) {
      const { syncedAt } = JSON.parse(raw);
      if (Date.now() - syncedAt < SYNC_MIN_INTERVAL_MS) {
        if (IS_DEV) console.log('[CatalogSync] Skipped — last sync <12h ago');
        return;
      }
    }

    _syncInProgress = true;
    if (IS_DEV) console.log('[CatalogSync] Starting for', courses.length, 'courses');
    const db = await getDBConnection();

    for (const course of courses) {
      try {
        // Réutilise les contenus déjà fetchés par l'appelant si disponibles,
        // sinon fetch autonome (appel depuis un autre point d'entrée).
        const rawContents = prefetchedContents?.get(course.id)
          ?? await getCourseContents(token, course.id);
        if (rawContents.length > 0) {
          await saveCourseContentCache(db, course.id, rawContents).catch(() => {});
          if (IS_DEV) console.log(`[CatalogSync] Course ${course.id}: ${rawContents.length} sections cached`);
        }

        for (const section of rawContents) {
          for (const mod of (section.modules || [])) {
            for (const file of (mod.contents || [])) {
              if (!isEpubFile(file.filename || '')) continue;

              const cmid   = mod.id as number;
              const bookId = `cmid-${cmid}`;

              // Ne refetch pas si le manifest est déjà en cache
              const existing = await getManifestOffline(bookId);
              if (existing) continue;

              // Vérification rapide du statut PHP (appel léger, pas de polling)
              let status: any = null;
              try {
                status = await moodleCall('local_ipelan_epub_get_status', { cmid }, token);
              } catch { continue; }
              if (status?.status !== 'ready') {
                if (IS_DEV) console.log(`[CatalogSync] ${bookId} not ready (${status?.status}) — skip`);
                continue;
              }

              // L'EPUB est déjà extrait → get_manifest doit répondre immédiatement.
              // On appelle moodleCall directement avec un timeout court (15s) au lieu
              // de passer par fetchManifestMoodle qui impose 5 min de timeout HTTP par
              // requête, rendant notre timeoutMs: 30_000 inopérant.
              try {
                const data = await moodleCall(
                  'local_ipelan_epub_get_manifest',
                  { cmid },
                  token,
                  15_000
                ) as any;
                if (!data || data.exception || data.status !== 'ready' || !data.manifest) continue;
                const manifest: EpubManifest = JSON.parse(data.manifest);
                await cacheManifest(bookId, manifest, data.file_base_url || '');
                if (IS_DEV) console.log(`[CatalogSync] Manifest cached: ${bookId} (${manifest.readingSections?.length ?? 0} sections)`);
              } catch (e) {
                if (IS_DEV) console.warn(`[CatalogSync] Manifest fetch failed for ${bookId}:`, e);
              }
            }
          }
        }
      } catch (e) {
        if (IS_DEV) console.warn(`[CatalogSync] Course ${course.id} failed:`, e);
      }
    }

    await AsyncStorage.setItem(CATALOG_SYNC_KEY, JSON.stringify({ syncedAt: Date.now() }))
      .catch(() => {});
    if (IS_DEV) console.log('[CatalogSync] Done');
  } catch (e) {
    if (IS_DEV) console.warn('[CatalogSync] Sync failed:', e);
  } finally {
    _syncInProgress = false;
  }
}
