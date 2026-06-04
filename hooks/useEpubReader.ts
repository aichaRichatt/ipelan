// hooks/useEpubReader.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchManifest,
  getMainHtmlUrl,
  getFileUrl,
  getSectionPageUrl,
  buildBookId,
  checkServerHealth,
  EpubManifest,
  EpubReadingSection,
  EPUB_SERVER_URL,
} from '../services/epub/epubServerService';

const IS_DEV = process.env.NODE_ENV === 'development';

export type EpubLoadingState = 'idle' | 'checking_server' | 'fetching' | 'processing' | 'ready' | 'error';

export interface UseEpubReaderReturn {
  loadingState: EpubLoadingState;
  isLoading: boolean;
  error: string | null;
  manifest: EpubManifest | null;
  title: string;
  epubType: string;
  language: string | null;
  totalSections: number;
  currentSectionIndex: number;
  currentSection: EpubReadingSection | null;
  sectionsWithAudio: EpubReadingSection[];
  goToSection: (index: number) => void;
  nextSection: () => void;
  previousSection: () => void;
  hasNextSection: boolean;
  hasPreviousSection: boolean;
  mainHtmlUrl: string | null;
  /** URL de la page HTML d'une seule section — pour le lazy loading section par section */
  currentSectionPageUrl: string | null;
  currentAudioUrl: string | null;
  getAudioUrl: (audioFilePath: string) => string;
  refetch: () => void;
  serverUrl: string;
}

export function useEpubReader(
  cmid: number | string | null,
  epubUrl?: string | null
): UseEpubReaderReturn {
  const [loadingState, setLoadingState] = useState<EpubLoadingState>('idle');
  const [error, setError]               = useState<string | null>(null);
  const [manifest, setManifest]         = useState<EpubManifest | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  // Incrémenter pour forcer un re-fetch manuel (refetch())
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const bookId = cmid != null ? buildBookId(cmid) : null;

  useEffect(() => {
    if (!bookId) return;

    // ── Pattern anti-StrictMode : flag cancelled local à cette invocation d'effet ──
    // StrictMode monte → démonte → remonte. Le cleanup du premier mount
    // met cancelled=true → son fetch async ignore ses résultats.
    // Le second mount crée un nouveau cancelled=false et part normalement.
    let cancelled = false;

    const run = async () => {
      if (IS_DEV) console.log('[useEpubReader] Loading bookId:', bookId);

      setLoadingState('checking_server');
      setError(null);
      setManifest(null);
      setCurrentSectionIndex(0);

      const serverOk = await checkServerHealth();
      if (cancelled) return;

      if (!serverOk) {
        setLoadingState('error');
        setError(
          `Serveur EPUB inaccessible (${EPUB_SERVER_URL || 'URL non configurée'}).\n` +
          'Vérifiez que le serveur EpubPlugin est démarré et que vous êtes sur le même réseau Wi-Fi.'
        );
        return;
      }

      setLoadingState('fetching');

      try {
        const m = await fetchManifest(bookId, {
          timeoutMs     : 10 * 60 * 1000,
          pollIntervalMs: 2000,
          epubUrl       : epubUrl ?? undefined,
          onProcessing  : () => {
            if (!cancelled) setLoadingState('processing');
          },
        });

        if (cancelled) return;

        setManifest(m);
        setLoadingState('ready');

        if (IS_DEV) {
          console.log('[useEpubReader] Ready:', m.metadata.title);
          console.log('[useEpubReader] Sections:', m.readingSections.length);
          console.log('[useEpubReader] AudioType:', m.audioType);
        }
      } catch (err: any) {
        if (cancelled) return;
        if (IS_DEV) console.error('[useEpubReader] Error:', err.message);
        setLoadingState('error');
        setError(err.message || "Erreur lors du chargement du livre");
      }
    };

    run();

    return () => {
      cancelled = true; // annule les setState du fetch en cours lors du cleanup
    };
  }, [bookId, epubUrl, fetchTrigger]);

  // ── Navigation ──
  const allSections    = manifest?.readingSections || [];
  const currentSection = allSections[currentSectionIndex] || null;
  const sectionsWithAudio = allSections.filter(s => s.audioFiles.length > 0);

  const goToSection = useCallback((index: number) => {
    if (!manifest) return;
    setCurrentSectionIndex(Math.max(0, Math.min(index, manifest.readingSections.length - 1)));
  }, [manifest]);

  const nextSection = useCallback(() => {
    if (!manifest) return;
    setCurrentSectionIndex(prev => Math.min(prev + 1, manifest.readingSections.length - 1));
  }, [manifest]);

  const previousSection = useCallback(() => {
    setCurrentSectionIndex(prev => Math.max(prev - 1, 0));
  }, []);

  // ── URLs ──
  const mainHtmlUrl = manifest && bookId ? getMainHtmlUrl(bookId, manifest) : null;

  // URL de la page HTML d'une seule section (lazy loading section par section)
  const currentSectionPageUrl = (bookId && manifest)
    ? getSectionPageUrl(bookId, currentSectionIndex)
    : null;

  const currentAudioUrl = (currentSection && bookId && currentSection.audioFiles.length > 0)
    ? getFileUrl(bookId, currentSection.audioFiles[0])
    : null;

  const getAudioUrl = useCallback((audioFilePath: string): string => {
    if (!bookId) return '';
    return getFileUrl(bookId, audioFilePath);
  }, [bookId]);

  return {
    loadingState,
    isLoading: loadingState === 'checking_server' || loadingState === 'fetching' || loadingState === 'processing',
    error,
    manifest,
    title        : manifest?.metadata.title || 'Livre',
    epubType     : manifest?.epubType       || 'unknown',
    language     : manifest?.language       || null,
    totalSections: allSections.length,
    currentSectionIndex,
    currentSection,
    sectionsWithAudio,
    goToSection,
    nextSection,
    previousSection,
    hasNextSection    : manifest ? currentSectionIndex < manifest.readingSections.length - 1 : false,
    hasPreviousSection: currentSectionIndex > 0,
    mainHtmlUrl,
    currentSectionPageUrl,
    currentAudioUrl,
    getAudioUrl,
    refetch  : () => setFetchTrigger(n => n + 1), // incrémente → re-run du useEffect
    serverUrl: EPUB_SERVER_URL,
  };
}

export default useEpubReader;
