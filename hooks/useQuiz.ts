import { useState, useEffect, useCallback } from 'react';
import { moodleFetch } from '../services/api/moodleClient';
import { Config } from '../services/api/moodleClient';

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
  // Data
  quiz: QuizData | null;
  questions: QuizQuestion[];
  isLoading: boolean;
  error: string | null;
  
  // Current question state
  currentQuestion: QuizQuestion | null;
  currentIndex: number;
  totalQuestions: number;
  selectedAnswer: number | null;
  
  // Quiz state
  isComplete: boolean;
  score: QuizScore;
  quizAttempt: any[];
  
  // Actions
  setSelectedAnswer: (index: number | null) => void;
  submitAnswer: () => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  refetch: () => Promise<void>;
  resetQuiz: () => void;
  
  // Computed
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
  
  // Navigation state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [startTime] = useState(Date.now());
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  
  // Score tracking
  const [score, setScore] = useState<QuizScore>({ correct: 0, total: 0, timeSpent: 0 });

// Additional state for attempt management
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [sequenceChecks, setSequenceChecks] = useState<Record<number, number>>({});
  const [attemptState, setAttemptState] = useState<string>('new');

  const fetchQuizContent = useCallback(async () => {
    if (!token || !quizInstanceId) {
      setError("Paramètres manquants");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (IS_DEV) console.log('[useQuiz] Loading quiz:', quizInstanceId, 'course:', courseId);

      setQuiz({
        id: quizInstanceId,
        name: 'Quiz',
        intro: '',
        questions: [],
        shuffleQuestions: false,
        shuffleAnswers: true,
      });

      // Step 1: Get the actual quiz ID from mod_quiz_get_quizzes_by_courses
      // This ensures we use quiz.id (instance), not cmid
      let actualQuizId = quizInstanceId;
      let quizInfo: any = null;
      
      if (courseId && courseId > 0) {
        const quizzesResult = await moodleFetch('/webservice/rest/server.php', {
          wstoken: token,
          wsfunction: 'mod_quiz_get_quizzes_by_courses',
          moodlewsrestformat: 'json',
          'courseids[0]': courseId,
        });

        if (!quizzesResult?.exception && quizzesResult?.quizzes) {
          // Find quiz by ID or by coursemodule (cmid)
          const foundQuiz = quizzesResult.quizzes.find((q: any) => 
            q.id === quizInstanceId || q.coursemodule === quizInstanceId
          );
          if (foundQuiz) {
            actualQuizId = foundQuiz.id;
            quizInfo = foundQuiz;
            if (IS_DEV) console.log('[useQuiz] Found quiz ID:', actualQuizId, 'cmid:', foundQuiz.coursemodule, 'maxAttempts:', foundQuiz.attempts);
          }
        }
      }

      // Step 2: Check for existing attempts
      const attemptsResult = await moodleFetch('/webservice/rest/server.php', {
        wstoken: token,
        wsfunction: 'mod_quiz_get_user_attempts',
        moodlewsrestformat: 'json',
        quizid: actualQuizId,
        status: 'all',
        includepreviews: 0,
      });

      let currentAttemptId: number | null = null;
      let existingAttempt: any = null;
      
      if (!attemptsResult?.exception && attemptsResult?.attempts?.length > 0) {
        // Find in-progress attempt first
        existingAttempt = attemptsResult.attempts.find((a: any) => a.state === 'inprogress');
        
        if (existingAttempt) {
          currentAttemptId = existingAttempt.id;
          setAttemptState('inprogress');
          if (IS_DEV) console.log('[useQuiz] Resuming in-progress attempt:', currentAttemptId);
        } else {
          // Check max attempts
          const finishedAttempts = attemptsResult.attempts.filter((a: any) => a.state === 'finished');
          if (quizInfo?.attempts > 0 && finishedAttempts.length >= quizInfo.attempts) {
            if (IS_DEV) console.warn('[useQuiz] Max attempts reached:', finishedAttempts.length, '/', quizInfo.attempts);
            // Use fallback for demo purposes
            const fallback = generateFallbackQuestions();
            setAllQuestions(fallback);
            setAnswers(new Array(fallback.length).fill(null));
            setError('Nombre maximum de tentatives atteint');
            setIsLoading(false);
            return;
          }
        }
      }

      // Step 3: Start new attempt ONLY if no in-progress attempt
      if (!currentAttemptId) {
        setAttemptState('new');
        
        const startResult = await moodleFetch('/webservice/rest/server.php', {
          wstoken: token,
          wsfunction: 'mod_quiz_start_attempt',
          moodlewsrestformat: 'json',
          quizid: actualQuizId,
          // NO forcenew: 1 - let Moodle handle existing attempts
        });

        if (startResult?.exception) {
          if (IS_DEV) console.warn('[useQuiz] Start attempt failed:', startResult.message);
          const fallback = generateFallbackQuestions();
          setAllQuestions(fallback);
          setAnswers(new Array(fallback.length).fill(null));
          setIsLoading(false);
          return;
        }
        
        currentAttemptId = startResult?.attempt?.id;
        setAttemptState(startResult.attempt?.state || 'inprogress');
        if (IS_DEV) console.log('[useQuiz] New attempt created:', currentAttemptId, 'state:', startResult.attempt?.state);
      }

      if (!currentAttemptId) {
        if (IS_DEV) console.warn('[useQuiz] No attempt ID available');
        const fallback = generateFallbackQuestions();
        setAllQuestions(fallback);
        setAnswers(new Array(fallback.length).fill(null));
        setIsLoading(false);
        return;
      }

      setAttemptId(currentAttemptId);

      // Step 4: Get questions from mod_quiz_get_attempt_data (page by page)
      // This endpoint has sequencecheck which is needed for saving answers
      const allQuestions: QuizQuestion[] = [];
      const seqChecks: Record<number, number> = {};
      let page = 0;
      let hasMorePages = true;

      while (hasMorePages) {
        const dataResult = await moodleFetch('/webservice/rest/server.php', {
          wstoken: token,
          wsfunction: 'mod_quiz_get_attempt_data',
          moodlewsrestformat: 'json',
          attemptid: currentAttemptId,
          page: page,
        });

        if (dataResult?.exception || !dataResult?.questions) {
          if (IS_DEV) console.warn('[useQuiz] Get attempt data failed:', dataResult?.message);
          break;
        }

        if (IS_DEV) console.log(`[useQuiz] Page ${page}:`, dataResult.questions.length, 'questions');

        for (let i = 0; i < dataResult.questions.length; i++) {
          const q = dataResult.questions[i];
          const html = q.html || '';
          
          // Store sequencecheck for saving answers later
          if (q.sequencecheck !== undefined) {
            seqChecks[q.slot] = q.sequencecheck;
          }
          
          const questionText = extractQuestionText(html) || `Question ${allQuestions.length + 1}`;
          const options = extractOptionsFromHtml(html);
          
          allQuestions.push({
            id: q.slot || allQuestions.length + 1,
            question: questionText,
            type: 'text-mcq',
            options: options.length > 0 ? options : ['Oui', 'Non'],
            correctIndex: 0, // Will be determined from mod_quiz_get_attempt_review if finished
            points: q.maxmark || 1,
            sequencecheck: q.sequencecheck,
          });
        }

        hasMorePages = dataResult.nextpage !== -1;
        page++;
        
        // Safety limit
        if (page > 100) {
          if (IS_DEV) console.warn('[useQuiz] Safety limit reached');
          break;
        }
      }

      setSequenceChecks(seqChecks);

      if (allQuestions.length === 0) {
        if (IS_DEV) console.log('[useQuiz] No questions from API, using fallback');
        const fallback = generateFallbackQuestions();
        setAllQuestions(fallback);
        setAnswers(new Array(fallback.length).fill(null));
      } else {
        if (IS_DEV) console.log('[useQuiz] Total questions:', allQuestions.length, 'sequenceChecks:', Object.keys(seqChecks).length);
        setAllQuestions(allQuestions);
        setAnswers(new Array(allQuestions.length).fill(null));
      }
    } catch (err: any) {
      if (IS_DEV) console.error('[useQuiz] Error:', err);
      setError(err.message);
      const fallback = generateFallbackQuestions();
      setAllQuestions(fallback);
      setAnswers(new Array(fallback.length).fill(null));
    } finally {
      setIsLoading(false);
    }
  }, [token, quizInstanceId, courseId]);

  useEffect(() => {
    fetchQuizContent();
  }, [fetchQuizContent]);

  // Computed values
  const totalQuestions = allQuestions.length;
  const currentQuestion = allQuestions[currentIndex] || null;
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex >= totalQuestions - 1;
  const isComplete = score.total > 0 && currentIndex >= totalQuestions - 1 && answers.filter(a => a !== null).length === totalQuestions;

  // Actions
  const handleSubmitAnswer = useCallback(() => {
    if (selectedAnswer === null) return;
    
    // Record the answer
    const newAnswers = [...answers];
    newAnswers[currentIndex] = selectedAnswer;
    setAnswers(newAnswers);
    
    // Calculate score so far
    let correctCount = 0;
    for (let i = 0; i <= currentIndex; i++) {
      if (newAnswers[i] !== null && allQuestions[i]) {
        const correctIndex = allQuestions[i].correctIndex;
        if (newAnswers[i] === correctIndex) {
          correctCount++;
        }
      }
    }
    
    // Update score
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    setScore({
      correct: correctCount,
      total: currentIndex + 1,
      timeSpent
    });
    
    // Add to attempt
    setQuizAttempt(prev => [...prev, {
      question: currentIndex + 1,
      answer: selectedAnswer,
      correct: selectedAnswer === allQuestions[currentIndex]?.correctIndex
    }]);
  }, [selectedAnswer, currentIndex, answers, allQuestions, startTime, currentQuestion]);

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

  // Calculate final score when quiz is complete
  useEffect(() => {
    if (allQuestions.length > 0 && answers.filter(a => a !== null).length === allQuestions.length) {
      let correctCount = 0;
      for (let i = 0; i < allQuestions.length; i++) {
        const correctIndex = allQuestions[i].correctIndex;
        if (answers[i] === correctIndex) {
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
    // Data
    quiz,
    questions: allQuestions,
    isLoading,
    error,
    
    // Current question
    currentQuestion,
    currentIndex,
    totalQuestions,
    selectedAnswer,
    
    // Quiz state
    isComplete,
    score,
    quizAttempt,
    
    // Actions
    setSelectedAnswer,
    submitAnswer: handleSubmitAnswer,
    nextQuestion: handleNextQuestion,
    prevQuestion: handlePrevQuestion,
    refetch: fetchQuizContent,
    resetQuiz: handleResetQuiz,
    
    // Computed
    isLastQuestion,
    isFirstQuestion,
  };
}

function extractQuestionText(html: string): string | null {
  const match = html.match(/class="[^"]*qtext[^"]*"[^>]*>([^<]+)/i);
  if (match) return match[1].trim();
  
  const textOnly = html.replace(/<[^>]*>/g, '').trim();
  return textOnly.length > 0 ? textOnly.slice(0, 500) : null;
}

function extractOptionsFromHtml(html: string): string[] {
  const options: string[] = [];
  
  const labelMatches = html.matchAll(/<label[^>]*>([^<]+)/gi);
  for (const match of labelMatches) {
    const option = match[1].trim().replace(/&apos;/g, "'").replace(/&quot;/g, '"');
    if (option && !options.includes(option)) {
      options.push(option);
    }
  }
  
  if (options.length === 0) {
    const radioMatches = html.matchAll(/value="([^"]+)"/g);
    for (const match of radioMatches) {
      const option = match[1].trim();
      if (option && !options.includes(option)) {
        options.push(option);
      }
    }
  }
  
  return options;
}

function parseQuestionsFromAttemptData(
  attemptData: any,
  setAllQuestions: (q: QuizQuestion[]) => void,
  setAnswers: (a: (number | null)[]) => void,
  setIsLoading: (l: boolean) => void
) {
  const questions: QuizQuestion[] = [];
  
  if (attemptData?.questions && Array.isArray(attemptData.questions)) {
    for (let i = 0; i < attemptData.questions.length; i++) {
      const q = attemptData.questions[i];
      const html = q.html || q.content || '';
      
      const questionText = extractQuestionText(html) || `Question ${i + 1}`;
      const options = extractOptionsFromHtml(html);
      
      questions.push({
        id: q.slot || i + 1,
        question: questionText,
        type: 'text-mcq',
        options: options.length > 0 ? options : ['Oui', 'Non'],
        correctIndex: 0,
        points: 1,
      });
    }
  }
  
  if (questions.length === 0) {
    if (IS_DEV) console.log('[useQuiz] No questions from attempt data, using fallback');
    const fallback = generateFallbackQuestions();
    setAllQuestions(fallback);
    setAnswers(new Array(fallback.length).fill(null));
  } else {
    if (IS_DEV) console.log('[useQuiz] Questions from attempt data:', questions.length);
    setAllQuestions(questions);
    setAnswers(new Array(questions.length).fill(null));
  }
  
  setIsLoading(false);
}

function generateFallbackQuestions(): QuizQuestion[] {
  return [
    {
      id: 1,
      question: 'Comment dit-on "Bonjour" en Pulaar?',
      type: 'text-mcq',
      options: ['Aboro', 'Maas', 'Nde', 'Alelu'],
      correctIndex: 0,
      points: 10
    },
    {
      id: 2,
      question: 'Comment dit-on "Merci" en Pulaar?',
      type: 'text-mcq',
      options: ['Maas', 'Aboro', 'Nde', 'Alelu'],
      correctIndex: 0,
      points: 10
    },
    {
      id: 3,
      question: 'Comment dit-on "Oui" en Pulaar?',
      type: 'text-mcq',
      options: ['Nde', 'Alelu', 'Maas', 'Aboro'],
      correctIndex: 0,
      points: 10
    },
    {
      id: 4,
      question: 'Comment dit-on "Non" en Pulaar?',
      type: 'text-mcq',
      options: ['Alelu', 'Nde', 'Maas', 'Aboro'],
      correctIndex: 0,
      points: 10
    },
    {
      id: 5,
      question: 'Comment dit-on "Comment allez-vous?" en Pulaar?',
      type: 'text-mcq',
      options: ['Ndeerka', 'Mi', 'Aboro', 'Maas'],
      correctIndex: 0,
      points: 10
    }
  ];
}

export default useQuiz;