// hooks/useEpubReader.ts
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../services/redux/store';
import {
  buildBookId,
  EpubManifest,
  EpubReadingSection,
} from '../services/epub/epubServerService';
import {
  fetchManifestMoodle,
  fetchSectionHtmlMoodle,
  buildAudioDownloadUrl,
  cacheManifest,
  getManifestOffline,
  invalidateStaleSections,
} from '../services/epub/epubDownloadService';
import {
  getSectionOffline,
  cacheSectionOffline,
} from '../services/epub/epubOfflineService';

const IS_DEV = process.env.NODE_ENV === 'development';

export type EpubLoadingState = 'idle' | 'checking_server' | 'fetching' | 'processing' | 'ready' | 'error';

export interface UseEpubReaderReturn {
  loadingState      : EpubLoadingState;
  isLoading         : boolean;
  error             : string | null;
  manifest          : EpubManifest | null;
  title             : string;
  epubType          : string;
  language          : string | null;
  totalSections     : number;
  currentSectionIndex: number;
  currentSection    : EpubReadingSection | null;
  sectionsWithAudio : EpubReadingSection[];
  goToSection       : (index: number) => void;
  nextSection       : () => void;
  previousSection   : () => void;
  hasNextSection    : boolean;
  hasPreviousSection: boolean;
  /** HTML complet de la section courante (CSS inliné) — source={{ html }} pour WebView */
  currentSectionHtml: string | null;
  isSectionLoading  : boolean;
  fileBaseUrl       : string;
  currentAudioUrl   : string | null;
  getAudioUrl       : (audioFilePath: string) => string;
  token             : string;
  refetch           : () => void;
  // Rétrocompat — null en mode Moodle WS
  serverUrl         : string;
  mainHtmlUrl       : string | null;
  currentSectionPageUrl: string | null;
}

export function useEpubReader(
  cmid   : number | string | null,
  _epubUrl?: string | null   // ignoré en mode Moodle WS
): UseEpubReaderReturn {
  const token = useSelector((s: RootState) => s.auth.token) || '';

  const [loadingState, setLoadingState]     = useState<EpubLoadingState>('idle');
  const [error, setError]                   = useState<string | null>(null);
  const [manifest, setManifest]             = useState<EpubManifest | null>(null);
  const [fileBaseUrl, setFileBaseUrl]       = useState('');
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentSectionHtml, setCurrentSectionHtml]   = useState<string | null>(null);
  const [isSectionLoading, setIsSectionLoading]       = useState(false);
  const [fetchTrigger, setFetchTrigger]     = useState(0);

  const cmidNum = cmid != null ? Number(cmid) : null;
  const bookId  = cmidNum != null ? buildBookId(cmidNum) : null;

  // ── Charger le manifest depuis Moodle WS ──────────────────────────────────
  useEffect(() => {
    if (!cmidNum || !token || !bookId) return;
    let cancelled = false;
    const abortCtrl = new AbortController();

    const run = async () => {
      if (IS_DEV) console.log('[useEpubReader] Loading cmid:', cmidNum);
      setLoadingState('fetching');
      setError(null);
      setManifest(null);
      setCurrentSectionIndex(0);
      setCurrentSectionHtml(null);

      try {
        const { manifest: m, fileBaseUrl: fbu } = await fetchManifestMoodle(cmidNum, token, {
          signal: abortCtrl.signal,
          onProcessing: () => { if (!cancelled) setLoadingState('processing'); },
        });
        if (cancelled) return;

        setManifest(m);
        setFileBaseUrl(fbu);
        setLoadingState('ready');
        cacheManifest(bookId, m, fbu).catch(() => {});
        if (m.generatedAt) {
          invalidateStaleSections(bookId, m.generatedAt).catch(() => {});
        }

        if (IS_DEV) console.log('[useEpubReader] Ready:', m.metadata?.title, '|', m.readingSections?.length, 'sections');
      } catch (err: any) {
        // Ignorer les erreurs d'un effet annulé
        if (cancelled || abortCtrl.signal.aborted) return;

        // Fallback manifest offline
        try {
          const offline = await getManifestOffline(bookId);
          if (offline && !cancelled) {
            setManifest(offline.manifest);
            setFileBaseUrl(offline.fileBaseUrl);
            setLoadingState('ready');
            if (IS_DEV) console.log('[useEpubReader] Offline manifest loaded');
            return;
          }
        } catch {}

        if (!cancelled) {
          setLoadingState('error');
          setError(err.message || 'Erreur chargement livre');
        }
      }
    };

    run();
    return () => {
      cancelled = true;
      abortCtrl.abort();
    };
  }, [cmidNum, token, fetchTrigger]);

  // ── Charger le HTML de la section courante ────────────────────────────────
  useEffect(() => {
    if (!cmidNum || !token || !manifest || !bookId) return;
    let cancelled = false;

    (async () => {
      setIsSectionLoading(true);
      setCurrentSectionHtml(null);

      // 1. Cache offline d'abord
      const cached = await getSectionOffline(bookId, currentSectionIndex);
      if (!cancelled && cached?.htmlPage) {
        setCurrentSectionHtml(cached.htmlPage);
        setIsSectionLoading(false);
        return;
      }

      // 2. Moodle WS
      try {
        const { html, sectionId, audioFiles } = await fetchSectionHtmlMoodle(
          cmidNum, currentSectionIndex, token, true
        );
        if (!cancelled && html) {
          setCurrentSectionHtml(html);
          const section = manifest.readingSections[currentSectionIndex];
          cacheSectionOffline(
            bookId, currentSectionIndex, sectionId,
            audioFiles, section?.text || '', html
          ).catch(() => {});
        }
      } catch (e) {
        if (IS_DEV) console.warn('[useEpubReader] Section fetch failed:', e);
      }

      if (!cancelled) setIsSectionLoading(false);
    })();

    return () => { cancelled = true; };
  }, [cmidNum, token, manifest, currentSectionIndex]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const allSections       = manifest?.readingSections || [];
  const currentSection    = allSections[currentSectionIndex] || null;
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

  // ── URLs audio ────────────────────────────────────────────────────────────
  const getAudioUrl = useCallback((audioFilePath: string): string => {
    if (!bookId || !fileBaseUrl || !token) return '';
    return buildAudioDownloadUrl(fileBaseUrl, bookId, audioFilePath, token);
  }, [bookId, fileBaseUrl, token]);

  const currentAudioUrl = (currentSection?.audioFiles?.length ?? 0) > 0
    ? getAudioUrl(currentSection!.audioFiles[0])
    : null;

  return {
    loadingState,
    isLoading: loadingState === 'fetching' || loadingState === 'processing',
    error,
    manifest,
    title        : manifest?.metadata?.title || 'Livre',
    epubType     : manifest?.epubType        || 'unknown',
    language     : manifest?.language        || null,
    totalSections: allSections.length,
    currentSectionIndex,
    currentSection,
    sectionsWithAudio,
    goToSection,
    nextSection,
    previousSection,
    hasNextSection    : manifest ? currentSectionIndex < manifest.readingSections.length - 1 : false,
    hasPreviousSection: currentSectionIndex > 0,
    currentSectionHtml,
    isSectionLoading,
    fileBaseUrl,
    currentAudioUrl,
    getAudioUrl,
    token,
    refetch  : () => setFetchTrigger(n => n + 1),
    serverUrl: '',        // rétrocompat
    mainHtmlUrl       : null,   // rétrocompat
    currentSectionPageUrl: null, // rétrocompat
  };
}

export default useEpubReader;
