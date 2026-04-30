/**
 * useQuiz — hook React qui orchestre le flux Moodle Quiz natif.
 *
 * Flux :
 *   1. mount       → resolve cmid → instanceId, getOrCreateAttempt, fetchAllQuizQuestions
 *   2. selectAnswer→ stocke localement la sélection
 *   3. submitAnswer→ saveQuizAnswers + reload questions (sync sequencecheck)
 *   4. nextQuestion / prevQuestion → navigation locale dans la liste
 *   5. finishQuiz  → finishQuizAttempt + getAttemptReview → score final
 *
 * Évite `submissionoutofsequence` en rechargeant TOUJOURS le sequencecheck
 * après chaque save.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  extractFinalScore,
  fetchAllQuizQuestions,
  finishQuizAttempt,
  getAttemptReview,
  getOrCreateAttempt,
  ParsedQuestion,
  saveQuizAnswers,
} from '../services/api/quizService';
import { resolveActivityInstanceId } from '../services/utils/moodleIdResolver';

const IS_DEV = process.env.NODE_ENV === 'development';

export interface QuizScore {
  correct: number;       // sumgrades arrondi
  total: number;         // maxgrade arrondi (ou nombre de questions)
  percentage: number;    // 0–100
  timeSpent: number;     // secondes
}

export interface UseQuizState {
  // Données
  questions: ParsedQuestion[];
  attemptId: number | null;
  quizName: string;
  // Navigation
  currentIndex: number;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  // Réponses (inputName → value)
  answers: Record<string, string>;
  selectedValue: string | null;
  // États
  isLoading: boolean;
  isSaving: boolean;
  isComplete: boolean;
  error: string | null;
  score: QuizScore | null;
}

export interface UseQuizActions {
  selectAnswer: (value: string) => void;
  submitAnswer: () => Promise<boolean>;
  nextQuestion: () => void;
  prevQuestion: () => void;
  finishQuiz: () => Promise<QuizScore | null>;
  reload: () => Promise<void>;
  reset: () => void;
}

export type UseQuizReturn = UseQuizState & UseQuizActions;

export function useQuiz(
  token: string,
  cmid: number,
  courseId: number,
  fallbackInstanceId?: number
): UseQuizReturn {
  // ─── State ───────────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [quizName, setQuizName] = useState<string>('Quiz');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<QuizScore | null>(null);
  const [startTime] = useState(Date.now());

  const currentQuestion = questions[currentIndex] ?? null;

  // ─── Loader ──────────────────────────────────────────────────────────────
  const loadQuiz = useCallback(async () => {
    if (!token) {
      setError('Token manquant');
      setIsLoading(false);
      return;
    }
    if (!cmid && !fallbackInstanceId) {
      setError('Identifiant de quiz manquant');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Résoudre cmid → instanceId
      let instanceId = fallbackInstanceId ?? cmid;
      if (courseId > 0 && cmid > 0) {
        const resolved = await resolveActivityInstanceId(courseId, 'quiz', cmid, token);
        if (resolved) {
          instanceId = resolved.instanceId;
          if (resolved.name) setQuizName(resolved.name);
          if (IS_DEV) console.log('[useQuiz] Resolved cmid', cmid, '→ instance', instanceId);
        }
      }

      if (!instanceId || instanceId <= 0) {
        throw new Error("Impossible de résoudre l'ID du quiz");
      }

      // 2. Démarrer / reprendre une tentative
      const aId = await getOrCreateAttempt(token, instanceId);
      if (!aId) {
        throw new Error(
          "Impossible de démarrer le quiz. Vérifiez que vous êtes inscrit au cours."
        );
      }
      setAttemptId(aId);

      // 3. Charger TOUTES les questions (multi-pages)
      const qs = await fetchAllQuizQuestions(token, aId);
      if (qs.length === 0) {
        throw new Error('Aucune question dans ce quiz.');
      }
      setQuestions(qs);
      setCurrentIndex(0);
      setSelectedValue(null);
      if (IS_DEV) {
        console.log('[useQuiz] Loaded', qs.length, 'questions for attempt', aId);
      }
    } catch (err: any) {
      if (IS_DEV) console.warn('[useQuiz] load failed:', err?.message);
      setError(err?.message || 'Erreur de chargement du quiz');
    } finally {
      setIsLoading(false);
    }
  }, [token, cmid, courseId, fallbackInstanceId]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const selectAnswer = useCallback((value: string) => {
    setSelectedValue(value);
  }, []);

  /**
   * Sauvegarde la réponse courante puis recharge les questions pour mettre à
   * jour les sequencechecks. Idempotent.
   */
  const submitAnswer = useCallback(async (): Promise<boolean> => {
    if (!attemptId || !currentQuestion || selectedValue === null) return false;
    if (!currentQuestion.answerInputName) return false;

    setIsSaving(true);
    try {
      const newAnswers = {
        ...answers,
        [currentQuestion.answerInputName]: selectedValue,
      };
      setAnswers(newAnswers);

      const ok = await saveQuizAnswers(
        token,
        attemptId,
        { [currentQuestion.answerInputName]: selectedValue },
        { [currentQuestion.slot]: currentQuestion.sequencecheck }
      );

      if (!ok) {
        if (IS_DEV) console.warn('[useQuiz] save failed for slot', currentQuestion.slot);
        return false;
      }

      // Recharger pour rafraîchir les sequencechecks
      const refreshed = await fetchAllQuizQuestions(token, attemptId);
      if (refreshed.length > 0) {
        setQuestions(refreshed);
      }
      return true;
    } catch (err: any) {
      if (IS_DEV) console.warn('[useQuiz] submitAnswer:', err?.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [token, attemptId, currentQuestion, selectedValue, answers]);

  const nextQuestion = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
      setSelectedValue(null);
    }
  }, [currentIndex, questions.length]);

  const prevQuestion = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setSelectedValue(null);
    }
  }, [currentIndex]);

  /**
   * Termine la tentative et récupère le score final via la review Moodle.
   */
  const finishQuiz = useCallback(async (): Promise<QuizScore | null> => {
    if (!attemptId) return null;

    setIsSaving(true);
    try {
      const sequencechecks: Record<number, number> = {};
      for (const q of questions) {
        sequencechecks[q.slot] = q.sequencecheck;
      }

      const ok = await finishQuizAttempt(token, attemptId, answers, sequencechecks);
      if (!ok) {
        if (IS_DEV) console.warn('[useQuiz] finish failed');
        return null;
      }

      const review = await getAttemptReview(token, attemptId);
      let finalScore: QuizScore;

      if (review) {
        const { sumgrades, maxgrade, percentage } = extractFinalScore(review);
        finalScore = {
          correct: Math.round(sumgrades),
          total: Math.round(maxgrade) || questions.length,
          percentage,
          timeSpent: Math.floor((Date.now() - startTime) / 1000),
        };
      } else {
        // Fallback : score local basé sur les réponses saisies
        const answered = Object.keys(answers).length;
        finalScore = {
          correct: 0,
          total: questions.length,
          percentage: questions.length > 0
            ? Math.round((answered / questions.length) * 100)
            : 0,
          timeSpent: Math.floor((Date.now() - startTime) / 1000),
        };
      }

      setScore(finalScore);
      setIsComplete(true);
      return finalScore;
    } catch (err: any) {
      if (IS_DEV) console.warn('[useQuiz] finishQuiz:', err?.message);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [token, attemptId, questions, answers, startTime]);

  const reset = useCallback(() => {
    setQuestions([]);
    setAttemptId(null);
    setCurrentIndex(0);
    setAnswers({});
    setSelectedValue(null);
    setIsComplete(false);
    setError(null);
    setScore(null);
  }, []);

  return {
    questions,
    attemptId,
    quizName,
    currentIndex,
    isFirstQuestion: currentIndex === 0,
    isLastQuestion: currentIndex === questions.length - 1,
    answers,
    selectedValue,
    isLoading,
    isSaving,
    isComplete,
    error,
    score,
    selectAnswer,
    submitAnswer,
    nextQuestion,
    prevQuestion,
    finishQuiz,
    reload: loadQuiz,
    reset,
  };
}

export default useQuiz;
