import { useState, useEffect, useCallback } from 'react';
import { EpubChapter, downloadEpubBuffer } from '../services/contentLoader';
import { ParsedEpub, parseEpub, processEpubHtml, extractAudioFromEpub, extractImagesFromEpub } from '../services/epubParser';

const IS_DEV = process.env.NODE_ENV === "development";

export interface EpubAudio {
  href: string;
  dataUrl: string;
  title: string;
}

export interface EpubImage {
  href: string;
  dataUrl: string;
}

export interface UseEpubReaderReturn {
  isLoading: boolean;
  error: string | null;
  title: string;
  author?: string;
  chapters: EpubChapter[];
  currentChapter: number;
  currentHtml: string;
  audioFiles: EpubAudio[];
  images: EpubImage[];
  progress: number;
  totalChapters: number;
  goToChapter: (index: number) => void;
  nextChapter: () => void;
  previousChapter: () => void;
  hasNextChapter: boolean;
  hasPreviousChapter: boolean;
  refetch: () => Promise<void>;
}

export function useEpubReader(
  epubUrl: string | null,
  token: string
): UseEpubReaderReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedEpub | null>(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [currentHtml, setCurrentHtml] = useState('');
  const [audioFiles, setAudioFiles] = useState<EpubAudio[]>([]);
  const [images, setImages] = useState<EpubImage[]>([]);

  const loadEpub = useCallback(async () => {
    if (!epubUrl) {
      setError("URL EPUB manquante");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (IS_DEV) console.log('[useEpubReader] Downloading EPUB from:', epubUrl);

      const buffer = await downloadEpubBuffer(token, epubUrl);
      
      if (!buffer) {
        setError("Impossible de télécharger le fichier EPUB");
        setIsLoading(false);
        return;
      }

      if (IS_DEV) console.log('[useEpubReader] Parsing EPUB...');
      
      const parsedEpub = parseEpub(buffer);
      
      if (!parsedEpub) {
        setError("Impossible de lire le fichier EPUB");
        setIsLoading(false);
        return;
      }

      if (IS_DEV) {
        console.log('[useEpubReader] EPUB parsed successfully');
        console.log('[useEpubReader] Title:', parsedEpub.manifest.title);
        console.log('[useEpubReader] Chapters:', parsedEpub.manifest.chapters.length);
      }

      setParsed(parsedEpub);
      
      const audios = extractAudioFromEpub(parsedEpub);
      setAudioFiles(audios);
      if (IS_DEV) console.log('[useEpubReader] Audio files:', audios.length);
      
      const imgs = extractImagesFromEpub(parsedEpub);
      setImages(imgs);
      if (IS_DEV) console.log('[useEpubReader] Images:', imgs.length);
      
      setCurrentChapter(0);
      
      if (parsedEpub.manifest.chapters.length > 0) {
        const firstChapter = parsedEpub.manifest.chapters[0];
        const html = parsedEpub.contentMap.get(firstChapter.href);
        
        if (html) {
          const processed = processEpubHtml(html, parsedEpub.mediaMap, firstChapter.href);
          setCurrentHtml(processed);
        } else {
          setCurrentHtml('<p>Contenu du chapitre non disponible</p>');
        }
      }
      
      setIsLoading(false);
    } catch (err: any) {
      if (IS_DEV) console.error('[useEpubReader] Error:', err);
      setError(err.message || "Erreur lors du chargement de l'EPUB");
      setIsLoading(false);
    }
  }, [epubUrl, token]);

  useEffect(() => {
    loadEpub();
  }, [loadEpub]);

  const goToChapter = useCallback((index: number) => {
    if (!parsed || index < 0 || index >= parsed.manifest.chapters.length) {
      return;
    }

    setCurrentChapter(index);
    
    const chapter = parsed.manifest.chapters[index];
    const html = parsed.contentMap.get(chapter.href);
    
    if (html) {
      const processed = processEpubHtml(html, parsed.mediaMap, chapter.href);
      setCurrentHtml(processed);
    } else {
      setCurrentHtml('<p>Contenu non disponible pour ce chapitre</p>');
    }
  }, [parsed]);

  const nextChapter = useCallback(() => {
    if (!parsed) return;
    
    if (currentChapter < parsed.manifest.chapters.length - 1) {
      goToChapter(currentChapter + 1);
    }
  }, [parsed, currentChapter, goToChapter]);

  const previousChapter = useCallback(() => {
    if (currentChapter > 0) {
      goToChapter(currentChapter - 1);
    }
  }, [currentChapter, goToChapter]);

  const chapters = parsed?.manifest.chapters || [];
  const title = parsed?.manifest.title || 'EPUB';
  const author = parsed?.manifest.author;
  const totalChapters = chapters.length;
  const progress = totalChapters > 0 ? ((currentChapter + 1) / totalChapters) * 100 : 0;
  const hasNextChapter = parsed ? currentChapter < parsed.manifest.chapters.length - 1 : false;
  const hasPreviousChapter = currentChapter > 0;

  return {
    isLoading,
    error,
    title,
    author,
    chapters,
    currentChapter,
    currentHtml,
    audioFiles,
    images,
    progress,
    totalChapters,
    goToChapter,
    nextChapter,
    previousChapter,
    hasNextChapter,
    hasPreviousChapter,
    refetch: loadEpub,
  };
}

export default useEpubReader;
