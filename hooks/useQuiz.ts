import { useState, useEffect, useCallback } from 'react';
import { moodleFetch } from '../services/api/moodleClient';
import { getAuthToken } from '../services/contentLoader';
import { resolveActivityInstanceId, extractAudioUrl, stripHtml } from '../services/utils/moodleIdResolver';
import { categorizeMoodleError, logActivityFetch, getUserFriendlyError } from '../services/utils/moodleErrorHandler';
import {
  getOrCreateAttempt,
  fetchAllQuizQuestions,
  finishQuizAttempt as finishQuizAttemptApi,
  processSingleAnswer,
} from '../services/api/quizService';

export interface QuizScore {
  correct: number;
  total: number;
  timeSpent: number;
}

export interface QuizQuestion {
  id: number;
  question: string;
  type: 'text-mcq' | 'audio-mcq';
  options: { value: string; label: string; inputName: string }[];
  correctIndex: number;
  points: number;
  explanation?: string;
  sequencecheck?: number;
  audioUrl?: string;
  slot?: number;
  inputName?: string;
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
  saveAndFinish: () => Promise<boolean>;
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [startTime] = useState(Date.now());
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [score, setScore] = useState<QuizScore>({ correct: 0, total: 0, timeSpent: 0 });
  const [attemptId, setAttemptId] = useState<number | null>(null);

  const fetchQuizContent = useCallback(async () => {
    const authToken = getAuthToken(token);
    if (!authToken) {
      const err = { type: 'auth' as const, message: 'Token manquant', originalError: null, fallbackUsed: true };
      setUserError(getUserFriendlyError(err));
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
      
      // ===== FLUX OBLIGATOIRE =====
      // 1. get_user_attempts (status=all)
      // 2. si attempt.state == "inprogress" → RESUME
      // 3. sinon → start_attempt
      
      try {
        // ÉTAPE 1: Récupérer TOUTES les tentatives
        const attemptsResult = await moodleFetch('/webservice/rest/server.php', {
          wstoken: authToken,
          wsfunction: 'mod_quiz_get_user_attempts',
          moodlewsrestformat: 'json',
          quizid: actualQuizId,
          status: 'all',
        });

        if (attemptsResult?.exception) {
          logActivityFetch('Quiz', 'GET_ATTEMPTS_ERROR', { error: attemptsResult.message });
        } 
        
        // ÉTAPE 2: Chercher tentative "inprogress"
        if (attemptsResult?.attempts?.length > 0) {
          const validAttempts = attemptsResult.attempts.filter(
            (a: any) => a.state === 'inprogress' && a.sumgrades != null
          );
          const corruptedAttempts = attemptsResult.attempts.filter(
            (a: any) => a.state === 'inprogress' && a.sumgrades == null
          );
          
          // Supprimer les tentatives corrompues d'abord
          for (const corrupted of corruptedAttempts) {
            logActivityFetch('Quiz', 'CLEANUP_CORRUPTED', { id: corrupted.id });
            try {
              await moodleFetch('/webservice/rest/server.php', {
                wstoken: authToken,
                wsfunction: 'mod_quiz_process_attempt',
                moodlewsrestformat: 'json',
                attemptid: corrupted.id,
                timeup: '0',
                finishattempt: '0',
              }).catch(() => {});
            } catch (e) {}
          }
          
          if (validAttempts.length > 0) {
            currentAttemptId = validAttempts[0].id;
            setAttemptId(currentAttemptId);
            logActivityFetch('Quiz', 'RESUME', { attemptId: currentAttemptId });
          }
        }
        
        // ÉTAPE 3: Si pas d'inprogress, démarrer une nouvelle tentative
        if (!currentAttemptId) {
          logActivityFetch('Quiz', 'NO_INPROGRESS', 'Starting new attempt');
          
          const startResult = await moodleFetch('/webservice/rest/server.php', {
            wstoken: authToken,
            wsfunction: 'mod_quiz_start_attempt',
            moodlewsrestformat: 'json',
            quizid: actualQuizId,
            forcenew: '1',
            'preflightdata[0][name]': 'confirm',
            'preflightdata[0][value]': '1',
          });

          if (startResult?.exception) {
            const errMsg = startResult.message || '';
            
            // Gérer l'erreur "données non enregistrées" - attempt bloquée côté Moodle
            if (errMsg.includes('non enregistrées')) {
              logActivityFetch('Quiz', 'BLOCKED', { error: errMsg });
              setUserError("Une tentative de quiz est bloquée sur le serveur Moodle. Veuillez la terminer depuis Moodle Web.");
              setError("Tentative bloquée");
              setIsLoading(false);
              return;
            }
            
            // Gérer l'erreur "attemptstillinprogress"
            if (errMsg.includes('attemptstillinprogress')) {
              logActivityFetch('Quiz', 'ALREADY_EXISTS', 'Cannot start new attempt');
              setUserError("Vous avez déjà une tentative en cours pour ce quiz. Veuillez la terminer ou attendre.");
              setError("Tentative en cours");
              setIsLoading(false);
              return;
            }
            
            logActivityFetch('Quiz', 'START_ERROR', { error: errMsg });
            setUserError(errMsg);
            setIsLoading(false);
            return;
          }
          
          //Nouvelle tentative créée
          currentAttemptId = startResult?.attempt?.id;
          setAttemptId(currentAttemptId);
          logActivityFetch('Quiz', 'STARTED', { attemptId: currentAttemptId });
        }
      } catch (err: any) {
        logActivityFetch('Quiz', 'ATTEMPTS_EXCEPTION', err.message);
      }

      if (!currentAttemptId) {
        const errMsg = "Impossible de récupérer la tentative de quiz. Soit le quiz n'existe pas, soit vous n'y êtes pas enrolled.";
        logActivityFetch('Quiz', 'NO_ATTEMPT', errMsg);
        setUserError(errMsg);
        setError(errMsg);
        setIsLoading(false);
        return;
      }

      const questions = await loadQuestionsFromAttempt(authToken, currentAttemptId);
      
      if (questions.length === 0) {
        const errMsg = "Aucune question trouvée pour cette tentative. Le quiz peut être vide ou les questions ne sont pas accessibles.";
        logActivityFetch('Quiz', 'NO_QUESTIONS', errMsg);
        setError(errMsg);
        setUserError(errMsg);
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
    } finally {
      setIsLoading(false);
    }
  }, [token, quizInstanceId, courseId]);

  async function loadQuestionsFromAttempt(authToken: string, attemptId: number): Promise<QuizQuestion[]> {
    const questions: QuizQuestion[] = [];
    let page = 0;

    try {
      while (true) {
        const dataResult = await moodleFetch('/webservice/rest/server.php', {
          wstoken: authToken,
          wsfunction: 'mod_quiz_get_attempt_data',
          moodlewsrestformat: 'json',
          attemptid: attemptId,
          page: page,
          'preflightdata[0][name]': 'confirm',
          'preflightdata[0][value]': '1',
        });

        if (dataResult?.exception) {
          const errMsg = dataResult.message || '';
          
          if (errMsg.includes('non enregistrées') || errMsg.includes(' Veuillez vérifier')) {
            logActivityFetch('Quiz', 'ATTEMPT_INVALID_STATE', { error: errMsg });
            return [];
          }
          
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
          
          const questionText = extractQuestionText(html);
          const parsedOptions = extractOptionsFromHtml(html);
          
          if (parsedOptions.length >= 2) {
            questions.push({
              id: q.slot || questions.length + 1,
              question: questionText || `Question ${questions.length + 1}`,
              type: html.includes('audio') || html.match(/\.(mp3|wav|m4a)/i) ? 'audio-mcq' : 'text-mcq',
              options: parsedOptions,
              correctIndex: 0,
              points: q.maxmark || 1,
              sequencecheck: q.sequencecheck,
              audioUrl: extractAudioUrl(html),
              slot: q.slot,
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
    } catch (err: any) {
      const moodleError = categorizeMoodleError(err, 'load_questions');
      logActivityFetch('Quiz', 'LOAD_QUESTIONS_ERROR', moodleError);
    }

    return questions;
  }

  async function saveAnswerToMoodle(
    authToken: string, 
    attemptId: number, 
    slot: number, 
    answerIndex: number,
    sequenceCheck: number
  ): Promise<boolean> {
    try {
      const question = allQuestions.find(q => q.id === slot || q.id === slot);
      if (!question) {
        logActivityFetch('Quiz', 'SAVE_ANSWER_NO_QUESTION', { slot });
        return false;
      }
      
      const data = await moodleFetch('/webservice/rest/server.php', {
        wstoken: authToken,
        wsfunction: 'mod_quiz_process_attempt',
        moodlewsrestformat: 'json',
        attemptid: attemptId,
        'data[0]': {
          name: `q${slot}:_sequencecheck`,
          value: sequenceCheck || 0
        },
        'data[1]': {
          name: `q${slot}:_answer`,
          value: answerIndex
        },
      });

      if (data?.exception) {
        logActivityFetch('Quiz', 'SAVE_ANSWER_ERROR', { slot, error: data.message });
        return false;
      }

      logActivityFetch('Quiz', 'ANSWER_SAVED', { slot, answerIndex });
      return true;
    } catch (err: any) {
      logActivityFetch('Quiz', 'SAVE_ANSWER_EXCEPTION', { slot, error: err.message });
      return false;
    }
  }

  async function finishQuizAttempt(authToken: string, attemptId: number): Promise<boolean> {
    try {
      const result = await moodleFetch('/webservice/rest/server.php', {
        wstoken: authToken,
        wsfunction: 'mod_quiz_finish_attempt',
        moodlewsrestformat: 'json',
        attemptid: attemptId,
      });

      if (result?.exception) {
        logActivityFetch('Quiz', 'FINISH_ERROR', { error: result.message });
        return false;
      }

      logActivityFetch('Quiz', 'FINISHED', { attemptId });
      return true;
    } catch (err: any) {
      logActivityFetch('Quiz', 'FINISH_EXCEPTION', { error: err.message });
      return false;
    }
  }

  async function saveAnswersToMoodle(authToken: string, attemptId: number): Promise<boolean> {
    let allSaved = true;
    
    for (let i = 0; i < answers.length; i++) {
      if (answers[i] !== null) {
        const question = allQuestions[i];
        if (question) {
          const saved = await saveAnswerToMoodle(
            authToken,
            attemptId,
            question.id,
            answers[i] as number,
            question.sequencecheck || 0
          );
          if (!saved) allSaved = false;
        }
      }
    }
    
    return allSaved;
  }

  function extractQuestionText(html: string): string {
    const match = html.match(/class="[^"]*qtext[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (match) return stripHtml(match[1]);
    
    const textOnly = html.replace(/<[^>]*>/g, '').trim();
    return textOnly.length > 0 ? textOnly.slice(0, 500) : '';
  }

  function extractOptionsFromHtml(html: string): { value: string; label: string; inputName: string }[] {
    const options: { value: string; label: string; inputName: string }[] = [];
    
    const inputMatches = Array.from(html.matchAll(/<input[^>]+type="(?:radio|checkbox)"[^>]+name="([^"]+)"[^>]+value="([^"]*)"[^>]*>[\s\S]*?<label[^>]*>([\s\S]*?)<\/label>/gi));
    for (const match of inputMatches) {
      const inputName = match[1];
      const value = match[2];
      const label = stripHtml(match[3]);
      if (label && !options.find(o => o.value === value)) {
        options.push({ inputName, value, label });
      }
    }
    
    if (options.length === 0) {
      const labelMatches = Array.from(html.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/gi));
      for (const match of labelMatches) {
        const label = stripHtml(match[1]);
        if (label && !options.find(o => o.label === label)) {
          options.push({ inputName: '', value: String(options.length), label });
        }
      }
    }
    
    return options;
  }

  useEffect(() => {
    fetchQuizContent();
  }, [fetchQuizContent]);

  const totalQuestions = allQuestions.length;
  const currentQuestion = allQuestions[currentIndex] || null;
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = totalQuestions > 0 && currentIndex >= totalQuestions - 1;
  const isComplete = score.total > 0 && currentIndex >= totalQuestions - 1 && answers.filter(a => a !== null).length === totalQuestions;

  const handleSubmitAnswer = useCallback(async () => {
    if (selectedAnswer === null) return;
    
    const newAnswers = [...answers];
    newAnswers[currentIndex] = selectedAnswer;
    setAnswers(newAnswers);
    
    const moodleToken = getAuthToken(token);
    const currentQ = allQuestions[currentIndex];
    const slot = currentQ?.id || currentIndex + 1;
    
    if (attemptId && moodleToken && currentQ) {
      const answerValue = currentQ.options[selectedAnswer]?.value || String(selectedAnswer);
      await processSingleAnswer(
        moodleToken, 
        attemptId, 
        slot, 
        answerValue, 
        currentQ.sequencecheck || 0
      );
    }
    
    let correctCount = 0;
    for (let i = 0; i < newAnswers.length; i++) {
      if (newAnswers[i] === allQuestions[i]?.correctIndex) {
        correctCount++;
      }
    }
    
    setScore({
      correct: correctCount,
      total: currentIndex + 1,
      timeSpent: Math.round((Date.now() - startTime) / 1000)
    });
  }, [selectedAnswer, currentIndex, answers, allQuestions, startTime, attemptId, token]);

  const handleSaveAndFinish = useCallback(async (): Promise<boolean> => {
    const moodleToken = getAuthToken(token);
    if (!attemptId || !moodleToken) return false;
    
    const answersObj: Record<string, string> = {};
    const seqChecks: Record<number, number> = {};
    
    for (let i = 0; i < answers.length; i++) {
      if (answers[i] !== null) {
        const question = allQuestions[i];
        if (question && question.options[answers[i] as number]) {
          const slot = question.id;
          answersObj[`q${slot}:_answer`] = question.options[answers[i] as number].value || String(answers[i]);
          seqChecks[slot] = question.sequencecheck || 0;
        }
      }
    }
    
    return await finishQuizAttemptApi(moodleToken, attemptId, answersObj, seqChecks);
  }, [attemptId, token, answers, allQuestions]);

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
  }, [answers, allQuestions, startTime]);

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
    saveAndFinish: handleSaveAndFinish,
    isLastQuestion,
    isFirstQuestion,
  };
}

export default useQuiz;