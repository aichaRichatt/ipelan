import { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../services/redux/store';
import {
  downloadQuizForOffline,
  getQuizOffline,
  isQuizDownloaded,
  saveOfflineQuizAttempt,
  clearQuizCache,
  buildAnswerFieldName,
  QuizCacheEntry,
  OfflineAnswer,
} from '../services/quiz/quizOfflineService';

const IS_DEV = process.env.NODE_ENV === 'development';

export type OfflineQuizState =
  | 'idle'
  | 'downloading'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'error';

export interface UseOfflineQuizReturn {
  state          : OfflineQuizState;
  isDownloaded   : boolean;
  quizCache      : QuizCacheEntry | null;
  error          : string | null;
  currentQuestion: QuizCacheEntry['questions'][0] | null;
  currentPage    : number;
  totalQuestions : number;
  answers        : Record<number, string>;  // slot → value
  download       : (cmid: number, quizId: number, courseId: number) => Promise<void>;
  loadCached     : (cmid: number) => Promise<void>;
  startOffline   : () => void;
  setAnswer      : (slot: number, value: string) => void;
  nextQuestion   : () => void;
  prevQuestion   : () => void;
  submitOffline  : (userId: number, score: number, maxScore: number) => Promise<void>;
  clearCache     : (cmid: number) => Promise<void>;
}

export function useOfflineQuiz(): UseOfflineQuizReturn {
  const token = useSelector((s: RootState) => s.auth.token) || '';

  const [state, setState]           = useState<OfflineQuizState>('idle');
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [quizCache, setQuizCache]   = useState<QuizCacheEntry | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers]       = useState<Record<number, string>>({});
  const [startedAt, setStartedAt]   = useState<number>(0);

  // ── Télécharger pour offline ──────────────────────────────────────────────
  const download = useCallback(async (cmid: number, quizId: number, courseId: number) => {
    if (!token) { setError('Token manquant'); return; }
    setState('downloading');
    setError(null);
    try {
      await downloadQuizForOffline(cmid, quizId, courseId, token);
      const cached = await getQuizOffline(cmid);
      setQuizCache(cached);
      setIsDownloaded(true);
      setState('ready');
      if (IS_DEV) console.log('[useOfflineQuiz] Téléchargé:', cmid);
    } catch (e: any) {
      setError(e.message || 'Téléchargement échoué');
      setState('error');
    }
  }, [token]);

  // ── Charger depuis le cache ───────────────────────────────────────────────
  const loadCached = useCallback(async (cmid: number) => {
    const downloaded = await isQuizDownloaded(cmid);
    setIsDownloaded(downloaded);
    if (downloaded) {
      const cached = await getQuizOffline(cmid);
      setQuizCache(cached);
      setState('ready');
    }
  }, []);

  // ── Démarrer le quiz offline ──────────────────────────────────────────────
  const startOffline = useCallback(() => {
    setCurrentPage(0);
    setAnswers({});
    setStartedAt(Date.now());
    setState('in_progress');
  }, []);

  // ── Enregistrer une réponse ───────────────────────────────────────────────
  const setAnswer = useCallback((slot: number, value: string) => {
    setAnswers(prev => ({ ...prev, [slot]: value }));
  }, []);

  const nextQuestion = useCallback(() => {
    if (!quizCache) return;
    setCurrentPage(p => Math.min(p + 1, quizCache.questions.length - 1));
  }, [quizCache]);

  const prevQuestion = useCallback(() => {
    setCurrentPage(p => Math.max(p - 1, 0));
  }, []);

  // ── Soumettre offline ─────────────────────────────────────────────────────
  const submitOffline = useCallback(async (
    userId  : number,
    score   : number,
    maxScore: number
  ) => {
    if (!quizCache?.attemptId) {
      setError('Pas de tentative pré-chargée');
      return;
    }

    // Convertir answers (slot → value) en format Moodle
    const moodleAnswers: OfflineAnswer[] = Object.entries(answers).map(([slot, value]) => ({
      slot : Number(slot),
      name : buildAnswerFieldName(quizCache.attemptId!, 0, Number(slot)),
      value,
    }));

    try {
      await saveOfflineQuizAttempt(
        userId,
        quizCache.cmid,
        quizCache.quizId,
        quizCache.attemptId,
        moodleAnswers,
        score,
        maxScore,
        startedAt
      );
      setState('completed');
      if (IS_DEV) console.log('[useOfflineQuiz] Attempt sauvegardé pour sync');
    } catch (e: any) {
      setError(e.message || 'Sauvegarde échouée');
    }
  }, [quizCache, answers, startedAt]);

  // ── Vider le cache ────────────────────────────────────────────────────────
  const clearCache = useCallback(async (cmid: number) => {
    await clearQuizCache(cmid);
    setQuizCache(null);
    setIsDownloaded(false);
    setState('idle');
  }, []);

  const questions       = quizCache?.questions ?? [];
  const currentQuestion = questions[currentPage] ?? null;

  return {
    state,
    isDownloaded,
    quizCache,
    error,
    currentQuestion,
    currentPage,
    totalQuestions: questions.length,
    answers,
    download,
    loadCached,
    startOffline,
    setAnswer,
    nextQuestion,
    prevQuestion,
    submitOffline,
    clearCache,
  };
}
