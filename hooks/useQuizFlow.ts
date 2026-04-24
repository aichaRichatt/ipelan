import { useState, useCallback } from 'react';
import { getAuthToken } from '../services/contentLoader';
import { 
  getUserAttempts, 
  startQuizAttempt, 
  getQuizAccessInfo,
  QuizAttempt 
} from '../services/api/moodleActivities';

const IS_DEV = process.env.NODE_ENV === 'development';

export interface QuizState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  currentAttempt: QuizAttempt | null;
  allAttempts: QuizAttempt[];
  errorMessage: string | null;
}

export function useQuizFlow(quizId: number) {
  const [state, setState] = useState<QuizState>({
    status: 'idle',
    currentAttempt: null,
    allAttempts: [],
    errorMessage: null,
  });

  const initQuiz = useCallback(async (token: string) => {
    const authToken = getAuthToken(token);
    
    if (!authToken || !quizId) {
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: 'Paramètres manquants',
      }));
      return;
    }

    setState(prev => ({ ...prev, status: 'loading', errorMessage: null }));

    try {
      // ÉTAPE 1: Récupérer toutes les tentatives
      if (IS_DEV) console.log('[useQuizFlow] Get attempts for quiz:', quizId);
      
      let attemptsResult = await getUserAttempts(authToken, quizId);
      
      // FALLBACK: Si get_attempts échoue, utiliser get_attempt_access_information
      if (!attemptsResult) {
        if (IS_DEV) console.log('[useQuizFlow] get_attempts failed, trying get_attempt_access_information');
        
        const accessInfo = await getQuizAccessInfo(authToken, quizId);
        
        if (accessInfo?.latestattempt) {
          setState({
            status: 'ready',
            currentAttempt: {
              id: accessInfo.latestattempt,
              quiz: quizId,
              userid: 0,
              attempt: accessInfo.attemptsused || 1,
              uniqueid: String(accessInfo.latestattempt),
              state: 'inprogress',
              timestart: Math.floor(Date.now() / 1000),
              timefinish: 0,
              timestarttext: new Date().toLocaleString(),
              timefinishtext: '',
              sumgrades: null,
              grade: null,
              timetaken: 0,
            },
            allAttempts: [],
            errorMessage: null,
          });
          return;
        }
        
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: 'Impossible de récupérer les infos du quiz',
        }));
        return;
      }

      const attempts = attemptsResult.attempts;
      
      if (IS_DEV) console.log('[useQuizFlow] Attempts:', {
        total: attempts.length,
        states: attempts.map((a: QuizAttempt) => a.state)
      });

      // ÉTAPE 2: Chercher une tentative "inprogress"
      const inProgressAttempt = attempts.find(
        (a: QuizAttempt) => a.state === 'inprogress'
      );

      if (inProgressAttempt) {
        if (IS_DEV) console.log('[useQuizFlow] RESUME inprogress attempt:', inProgressAttempt.id);
        
        setState({
          status: 'ready',
          currentAttempt: inProgressAttempt,
          allAttempts: attempts,
          errorMessage: null,
        });
        return;
      }

      // ÉTAPE 3: AUCUNE TENTATIVE EN COURS → CRÉER UNE NOUVELLE
      if (IS_DEV) console.log('[useQuizFlow] No inprogress, start new attempt');
      
      const startResult = await startQuizAttempt(authToken, quizId);
      
      if (!startResult?.attemptid) {
        // FALLBACK: Essayer get_attempt_access_information
        if (IS_DEV) console.log('[useQuizFlow] Cannot start, trying fallback');
        
        const retryAccessInfo = await getQuizAccessInfo(authToken, quizId);
        
        if (retryAccessInfo?.latestattempt) {
          if (IS_DEV) console.log('[useQuizFlow] Found from access info:', retryAccessInfo.latestattempt);
          
          setState({
            status: 'ready',
            currentAttempt: {
              id: retryAccessInfo.latestattempt,
              quiz: quizId,
              userid: 0,
              attempt: retryAccessInfo.attemptsused || 1,
              uniqueid: String(retryAccessInfo.latestattempt),
              state: 'inprogress',
              timestart: Math.floor(Date.now() / 1000),
              timefinish: 0,
              timestarttext: new Date().toLocaleString(),
              timefinishtext: '',
              sumgrades: null,
              grade: null,
              timetaken: 0,
            },
            allAttempts: [],
            errorMessage: null,
          });
          return;
        }
        
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: 'Impossible de démarrer le quiz',
        }));
        return;
      }

      // Nouvelle tentative créée
      const newAttemptsResult = await getUserAttempts(authToken, quizId);
      const newAttempt = newAttemptsResult?.attempts?.find(
        (a: QuizAttempt) => a.id === startResult.attemptid
      );

      if (IS_DEV) console.log('[useQuizFlow] Started new attempt:', startResult.attemptid);

      setState({
        status: 'ready',
        currentAttempt: newAttempt || {
          id: startResult.attemptid,
          quiz: quizId,
          userid: 0,
          attempt: 1,
          uniqueid: '',
          state: 'inprogress',
          timestart: Math.floor(Date.now() / 1000),
          timefinish: 0,
          timestarttext: new Date().toLocaleString(),
          timefinishtext: '',
          sumgrades: null,
          grade: null,
          timetaken: 0,
        },
        allAttempts: newAttemptsResult?.attempts || [],
        errorMessage: null,
      });

    } catch (error: any) {
      if (IS_DEV) console.error('[useQuizFlow] Exception:', error.message);
      
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error.message || 'Erreur inattendue',
      }));
    }
  }, [quizId]);

  const resetQuiz = useCallback(() => {
    setState({
      status: 'idle',
      currentAttempt: null,
      allAttempts: [],
      errorMessage: null,
    });
  }, []);

  return {
    ...state,
    initQuiz,
    resetQuiz,
  };
}