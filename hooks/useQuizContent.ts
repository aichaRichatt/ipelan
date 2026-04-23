import { useState, useEffect, useCallback } from 'react';
import { QuizQuestion, loadQuizFromMoodle, loadQuizQuestions, QuizData } from '../services/contentLoader';

const IS_DEV = process.env.NODE_ENV === "development";

export interface UseQuizContentReturn {
  quiz: QuizData | null;
  questions: QuizQuestion[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useQuizContent(
token: string, quizInstanceId: number, courseId: number, instanceId: number): UseQuizContentReturn {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuizContent = useCallback(async () => {
    if (!token || !quizInstanceId) {
      console.error('[useQuizContent] Missing params - token:', !!token, 'quizInstanceId:', quizInstanceId);
      setError(" useQuizContent: Paramètres manquants pour charger le quiz");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (IS_DEV) console.log('[useQuizContent] Loading quiz:', quizInstanceId);

      const quizData = await loadQuizFromMoodle(token, quizInstanceId, courseId);
      
      if (quizData) {
        setQuiz(quizData);
        if (IS_DEV) console.log('[useQuizContent] Quiz loaded:', quizData.name);

        if (IS_DEV) console.log('[useQuizContent] Loading questions...');
        const quizQuestions = await loadQuizQuestions(token, quizInstanceId, courseId);
        
        setQuestions(quizQuestions);
        if (IS_DEV) console.log('[useQuizContent] Questions loaded:', quizQuestions.length);
      } else {
        if (IS_DEV) console.log('[useQuizContent] No quiz data, using defaults');
      }
    } catch (err: any) {
      if (IS_DEV) console.error('[useQuizContent] Error:', err);
      setError(err.message || "Erreur lors du chargement du quiz");
    } finally {
      setIsLoading(false);
    }
  }, [token, quizInstanceId, courseId]);

  useEffect(() => {
    fetchQuizContent();
  }, [fetchQuizContent]);

  return {
    quiz,
    questions,
    isLoading,
    error,
    refetch: fetchQuizContent,
  };
}

export default useQuizContent;
