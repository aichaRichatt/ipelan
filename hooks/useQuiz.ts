
import { useState, useEffect, useCallback } from 'react';
import { moodleFetch } from '../services/api/moodleClient';
import { getAuthToken } from '../services/contentLoader';
import { resolveActivityInstanceId, extractAudioUrl, stripHtml } from '../services/utils/moodleIdResolver';
import { categorizeMoodleError, logActivityFetch, shouldUseFallback, getUserFriendlyError } from '../services/utils/moodleErrorHandler';

const IS_DEV = process.env.NODE_ENV === "development";

export interface QuizScore {
  correct: number;
  total: number;
  timeSpent: number;
}

export interface QuizQuestion {
  id: number;
  question: string;
  type: 'text-mcq' | 'audio-mcq';
  options: string[];
  correctIndex: number;
  points: number;
  explanation?: string;
  sequencecheck?: number;
  audioUrl?: string;
}

export interface QuizData {
  id: number;
  name: string;
  intro: string;
  questions: QuizQuestion[];
  timeLimit?: number;
  maxAttempts?: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
}

export interface UseQuizReturn {
  quiz: QuizData | null;
  questions: QuizQuestion[];
  isLoading: boolean;
  error: string | null;
  userError: string | null;
  currentQuestion: QuizQuestion | null;
  currentIndex: number;
  totalQuestions: number;
  selectedAnswer: number | null;
  isComplete: boolean;
  score: QuizScore;
  attemptId: number | null;
  setSelectedAnswer: (index: number | null) => void;
  submitAnswer: () => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  refetch: () => Promise<void>;
  resetQuiz: () => void;
  isLastQuestion: boolean;
  isFirstQuestion: boolean;
}

export function useQuiz(
  token: string,
  quizInstanceId: number,
  courseId: number,
  instanceId: number
): UseQuizReturn {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [allQuestions, setAllQuestions] = useState<QuizQuestion[]>([]);
  const [quizAttempt, setQuizAttempt] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [startTime] = useState(Date.now());
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [score, setScore] = useState<QuizScore>({ correct: 0, total: 0, timeSpent: 0 });
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [sequenceChecks, setSequenceChecks] = useState<Record<number, number>>({});

  const fetchQuizContent = useCallback(async () => {
    const authToken = getAuthToken(token);
    if (!authToken) {
      const err = { type: 'auth' as const, message: 'Token manquant', originalError: null, fallbackUsed: true };
      setUserError(getUserFriendlyError(err));
      loadFallbackQuestions();
      return;
    }

    if (!quizInstanceId) {
      setUserError("Paramètres du quiz manquants");
      loadFallbackQuestions();
      return;
    }

    setIsLoading(true);
    setError(null);
    setUserError(null);

    try {
      logActivityFetch('Quiz', 'START', { quizInstanceId, courseId });

       let actualQuizId = quizInstanceId;
      let quizName = 'Quiz';
      
      if (courseId && courseId > 0) {
        const resolved = await resolveActivityInstanceId(
          courseId,
          'quiz',
          quizInstanceId,
          token
        );
        
        if (resolved) {
          actualQuizId = resolved.instanceId;
          quizName = resolved.name;
          logActivityFetch('Quiz', 'RESOLVED', { cmid: quizInstanceId, instanceId: actualQuizId });
        } else {
          logActivityFetch('Quiz', 'RESOLVE_FAILED', { quizInstanceId });
        }
      }
      
      setQuiz({
        id: actualQuizId,
        name: quizName,
        intro: '',
        questions: [],
        shuffleQuestions: false,
        shuffleAnswers: true,
      });

       let currentAttemptId: number | null = null;
      
      try {
        const attemptsResult = await moodleFetch('/webservice/rest/server.php', {
          wstoken: authToken,
          wsfunction: 'mod_quiz_get_user_attempts',
          moodlewsrestformat: 'json',
          quizid: actualQuizId,
          status: 'inprogress',
        });

        if (attemptsResult?.exception) {
          const moodleError = categorizeMoodleError(attemptsResult, 'get_attempts');
          logActivityFetch('Quiz', 'ATTEMPTS_ERROR', moodleError);
        } else if (attemptsResult?.attempts?.length > 0) {
          currentAttemptId = attemptsResult.attempts[attemptsResult.attempts.length - 1].id;
          setAttemptId(currentAttemptId);
          logActivityFetch('Quiz', 'RESUMING', { attemptId: currentAttemptId });
        }
      } catch (err: any) {
        logActivityFetch('Quiz', 'ATTEMPTS_EXCEPTION', err.message);
      }

       if (!currentAttemptId) {
        try {
          const startResult = await moodleFetch('/webservice/rest/server.php', {
            wstoken: authToken,
            wsfunction: 'mod_quiz_start_attempt',
            moodlewsrestformat: 'json',
            quizid: actualQuizId,
          });

          if (startResult?.exception) {
            const moodleError = categorizeMoodleError(startResult, 'start_attempt');
            
            if (moodleError.type === 'not_found') {
              setUserError(moodleError.message);
              loadFallbackQuestions();
              setIsLoading(false);
              return;
            }
            
            logActivityFetch('Quiz', 'START_FAILED', moodleError);
          } else {
            currentAttemptId = startResult?.attempt?.id;
            setAttemptId(currentAttemptId);
            logActivityFetch('Quiz', 'STARTED', { attemptId: currentAttemptId });
          }
        } catch (err: any) {
          const moodleError = categorizeMoodleError(err, 'start_attempt');
          logActivityFetch('Quiz', 'START_EXCEPTION', moodleError);
        }
      }

       if (!currentAttemptId) {
        logActivityFetch('Quiz', 'NO_ATTEMPT', 'Using fallback');
        setUserError("Impossible de démarrer le quiz");
        loadFallbackQuestions();
        setIsLoading(false);
        return;
      }

      const questions = await loadQuestionsFromAttempt(authToken, currentAttemptId);
      
      if (questions.length === 0) {
        logActivityFetch('Quiz', 'NO_QUESTIONS', 'Using fallback');
        loadFallbackQuestions();
      } else {
        setAllQuestions(questions);
        setAnswers(new Array(questions.length).fill(null));
        logActivityFetch('Quiz', 'SUCCESS', { questionsCount: questions.length });
      }

    } catch (err: any) {
      const moodleError = categorizeMoodleError(err, 'fetch_quiz');
      logActivityFetch('Quiz', 'ERROR', moodleError);
      setError(moodleError.message);
      setUserError(getUserFriendlyError(moodleError));
      loadFallbackQuestions();
    } finally {
      setIsLoading(false);
    }
  }, [token, quizInstanceId, courseId]);

  async function loadQuestionsFromAttempt(authToken: string, attemptId: number): Promise<QuizQuestion[]> {
    const questions: QuizQuestion[] = [];
    const seqChecks: Record<number, number> = {};
    let page = 0;

    try {
      while (true) {
        const dataResult = await moodleFetch('/webservice/rest/server.php', {
          wstoken: authToken,
          wsfunction: 'mod_quiz_get_attempt_data',
          moodlewsrestformat: 'json',
          attemptid: attemptId,
          page: page,
        });

        if (dataResult?.exception) {
          const moodleError = categorizeMoodleError(dataResult, `load_page_${page}`);
          logActivityFetch('Quiz', 'PAGE_ERROR', moodleError);
          break;
        }

        if (!dataResult?.questions || !Array.isArray(dataResult.questions)) {
          logActivityFetch('Quiz', 'NO_QUESTIONS_PAGE', page);
          break;
        }

        logActivityFetch('Quiz', `PAGE_${page}`, { count: dataResult.questions.length });

        for (const q of dataResult.questions) {
          const html = q.html || '';
          
          if (q.sequencecheck !== undefined) {
            seqChecks[q.slot] = q.sequencecheck;
          }
          
          const questionText = extractQuestionText(html);
          const options = extractOptionsFromHtml(html);
          
          if (options.length >= 2) {
            questions.push({
              id: q.slot || questions.length + 1,
              question: questionText || `Question ${questions.length + 1}`,
              type: html.includes('audio') || html.match(/\.(mp3|wav|m4a)/i) ? 'audio-mcq' : 'text-mcq',
              options: options,
              correctIndex: 0,
              points: q.maxmark || 1,
              sequencecheck: q.sequencecheck,
              audioUrl: extractAudioUrl(html),
            });
          }
        }

        if (dataResult.nextpage === -1) break;
        page++;
        
        if (page > 100) {
          logActivityFetch('Quiz', 'SAFETY_LIMIT', page);
          break;
        }
      }

      setSequenceChecks(seqChecks);
    } catch (err: any) {
      const moodleError = categorizeMoodleError(err, 'load_questions');
      logActivityFetch('Quiz', 'LOAD_QUESTIONS_ERROR', moodleError);
    }

    return questions;
  }

  function extractQuestionText(html: string): string {
    const match = html.match(/class="[^"]*qtext[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (match) return stripHtml(match[1]);
    
    const textOnly = html.replace(/<[^>]*>/g, '').trim();
    return textOnly.length > 0 ? textOnly.slice(0, 500) : '';
  }

  function extractOptionsFromHtml(html: string): string[] {
    const options: string[] = [];
    
    const labelMatches = Array.from(html.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/gi));
    for (const match of labelMatches) {
      const option = stripHtml(match[1]);
      if (option && !options.includes(option)) {
        options.push(option);
      }
    }
    
    if (options.length === 0) {
      const inputMatches = Array.from(html.matchAll(/<input[^>]+value="([^"]+)"[^>]*>/gi));
      for (const match of inputMatches) {
        const option = stripHtml(match[1]);
        if (option && !options.includes(option)) {
          options.push(option);
        }
      }
    }
    
    return options;
  }

  function loadFallbackQuestions() {
    const fallback = generateFallbackQuestions();
    setAllQuestions(fallback);
    setAnswers(new Array(fallback.length).fill(null));
  }

  function generateFallbackQuestions(): QuizQuestion[] {
    return [
      { id: 1, question: 'Comment dit-on "Bonjour" en Pulaar?', type: 'text-mcq', options: ['Aboro', 'Maas', 'Nde', 'Alelu'], correctIndex: 0, points: 1 },
      { id: 2, question: 'Comment dit-on "Merci" en Pulaar?', type: 'text-mcq', options: ['Maas', 'Aboro', 'Nde', 'Alelu'], correctIndex: 0, points: 1 },
      { id: 3, question: 'Comment dit-on "Oui" en Pulaar?', type: 'text-mcq', options: ['Nde', 'Alelu', 'Maas', 'Aboro'], correctIndex: 0, points: 1 },
      { id: 4, question: 'Comment dit-on "Non" en Pulaar?', type: 'text-mcq', options: ['Alelu', 'Nde', 'Maas', 'Aboro'], correctIndex: 0, points: 1 },
      { id: 5, question: 'Comment dit-on "Comment allez-vous?" en Pulaar?', type: 'text-mcq', options: ['Ndeerka', 'Mi', 'Aboro', 'Maas'], correctIndex: 0, points: 1 },
    ];
  }

  useEffect(() => {
    fetchQuizContent();
  }, [fetchQuizContent]);

  // Computed values
  const totalQuestions = allQuestions.length;
  const currentQuestion = allQuestions[currentIndex] || null;
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = totalQuestions > 0 && currentIndex >= totalQuestions - 1;
  const isComplete = score.total > 0 && currentIndex >= totalQuestions - 1 && answers.filter(a => a !== null).length === totalQuestions;

  // Actions
  const handleSubmitAnswer = useCallback(() => {
    if (selectedAnswer === null) return;
    
    const newAnswers = [...answers];
    newAnswers[currentIndex] = selectedAnswer;
    setAnswers(newAnswers);
    
    let correctCount = 0;
    for (let i = 0; i <= currentIndex; i++) {
      if (newAnswers[i] !== null && allQuestions[i]) {
        if (newAnswers[i] === allQuestions[i].correctIndex) {
          correctCount++;
        }
      }
    }
    
    setScore({
      correct: correctCount,
      total: currentIndex + 1,
      timeSpent: Math.round((Date.now() - startTime) / 1000)
    });
    
    setQuizAttempt(prev => [...prev, {
      question: currentIndex + 1,
      answer: selectedAnswer,
      correct: selectedAnswer === allQuestions[currentIndex]?.correctIndex
    }]);
  }, [selectedAnswer, currentIndex, answers, allQuestions, startTime]);

  const handleNextQuestion = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(answers[currentIndex + 1]);
    }
  }, [currentIndex, totalQuestions, answers]);

  const handlePrevQuestion = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setSelectedAnswer(answers[currentIndex - 1]);
    }
  }, [currentIndex, answers]);

  const handleResetQuiz = useCallback(() => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAnswers(new Array(allQuestions.length).fill(null));
    setScore({ correct: 0, total: 0, timeSpent: 0 });
    setQuizAttempt([]);
  }, [allQuestions]);

  useEffect(() => {
    if (allQuestions.length > 0 && answers.filter(a => a !== null).length === allQuestions.length) {
      let correctCount = 0;
      for (let i = 0; i < allQuestions.length; i++) {
        if (answers[i] === allQuestions[i].correctIndex) {
          correctCount++;
        }
      }
      setScore({
        correct: correctCount,
        total: allQuestions.length,
        timeSpent: Math.round((Date.now() - startTime) / 1000)
      });
    }
  }, [answers, allQuestions]);

  return {
    quiz,
    questions: allQuestions,
    isLoading,
    error,
    userError,
    currentQuestion,
    currentIndex,
    totalQuestions,
    selectedAnswer,
    isComplete,
    score,
    attemptId,
    setSelectedAnswer,
    submitAnswer: handleSubmitAnswer,
    nextQuestion: handleNextQuestion,
    prevQuestion: handlePrevQuestion,
    refetch: fetchQuizContent,
    resetQuiz: handleResetQuiz,
    isLastQuestion,
    isFirstQuestion,
  };
}

export default useQuiz;