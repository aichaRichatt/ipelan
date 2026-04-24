import { moodleFetch } from './moodleClient';

const IS_DEV = process.env.NODE_ENV === 'development';

export interface QuizAttempt {
  id: number;
  quiz: number;
  userid: number;
  attempt: number;
  uniqueid: string;
  state: 'inprogress' | 'finished' | 'overdue' | 'abandoned';
  timestart: number;
  timefinish: number;
  timestarttext: string;
  timefinishtext: string;
  sumgrades: number | null;
  grade: number | null;
  timetaken: number;
}

export interface GetAttemptsResult {
  attempts: QuizAttempt[];
  warning?: any;
}

export interface ChoiceOption {
  id: number;
  text: string;
  maxanswers: number;
  countanswers: number;
  checked: boolean;
  disabled: boolean;
}

export interface GetChoiceOptionsResult {
  choiceid: number;
  options: ChoiceOption[];
  completions: any[];
}

/**
 * Récupère TOUTES les tentatives d'un quiz
 * @param token - Token Moodle
 * @param quizId - ID du quiz
 */
export async function getUserAttempts(token: string, quizId: number): Promise<GetAttemptsResult | null> {
  if (!token || !quizId) {
    if (IS_DEV) console.error('[MoodleApi] getUserAttempts: missing params');
    return null;
  }

  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_quiz_get_user_attempts',
      moodlewsrestformat: 'json',
      quizid: quizId,
      status: 'all',
    });

    if (result?.exception) {
      if (IS_DEV) console.error('[MoodleApi] getUserAttempts error:', result.message);
      return null;
    }

    if (IS_DEV) console.log('[MoodleApi] getUserAttempts success:', {
      quizId,
      count: result.attempts?.length || 0,
      states: result.attempts?.map((a: QuizAttempt) => a.state) || []
    });

    return {
      attempts: result.attempts || [],
    };
  } catch (error: any) {
    if (IS_DEV) console.error('[MoodleApi] getUserAttempts exception:', error.message);
    return null;
  }
}

/**
 * Démarre une nouvelle tentative de quiz
 * @param token - Token Moodle
 * @param quizId - ID du quiz
 * @param forceNew - Forcer une nouvelle tentative (rare)
 */
export async function startQuizAttempt(
  token: string, 
  quizId: number,
  forceNew: boolean = false
): Promise<{ attemptid: number } | null> {
  if (!token || !quizId) {
    if (IS_DEV) console.error('[MoodleApi] startQuizAttempt: missing params');
    return null;
  }

  try {
    const params: Record<string, any> = {
      wstoken: token,
      wsfunction: 'mod_quiz_start_attempt',
      moodlewsrestformat: 'json',
      quizid: quizId,
    };

    if (forceNew) {
      params.forcenew = 1;
    }

    const result = await moodleFetch('/webservice/rest/server.php', params, 'POST');

    if (result?.exception) {
      if (IS_DEV) console.error('[MoodleApi] startQuizAttempt error:', result.message);
      
      // Si une tentative existe déjà, on ne peut pas forcer
      if (result.message?.includes('attemptstillinprogress')) {
        if (IS_DEV) console.log('[MoodleApi] Attempt exists, should resume');
        return null; // Caller doit récupérer l'attempt existante
      }
      
      return null;
    }

    if (IS_DEV) console.log('[MoodleApi] startQuizAttempt success:', {
      quizId,
      attemptId: result.attempt?.id
    });

    return {
      attemptid: result.attempt?.id || null,
    };
  } catch (error: any) {
    if (IS_DEV) console.error('[MoodleApi] startQuizAttempt exception:', error.message);
    return null;
  }
}

/**
 * FALLBACK: Récupère les infos d'accès au quiz (utilise quand get_attempts échoue)
 * @param token - Token Moodle
 * @param quizId - ID du quiz
 */
export async function getQuizAccessInfo(
  token: string,
  quizId: number
): Promise<{
  canretry: boolean;
  canedit: boolean;
  latestattempt?: number;
  attemptsused?: number;
  warning?: string;
} | null> {
  if (!token || !quizId) {
    if (IS_DEV) console.error('[MoodleApi] getQuizAccessInfo: missing params');
    return null;
  }

  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_quiz_get_attempt_access_information',
      moodlewsrestformat: 'json',
      quizid: quizId,
    });

    if (result?.exception) {
      if (IS_DEV) console.error('[MoodleApi] getQuizAccessInfo error:', result.message);
      return null;
    }

    if (IS_DEV) console.log('[MoodleApi] getQuizAccessInfo success:', {
      quizId,
      canretry: result.canretry,
      latestattempt: result.latestattempt,
      attemptsused: result.attemptsused,
    });

    return {
      canretry: result.canretry ?? true,
      canedit: result.canedit ?? false,
      latestattempt: result.latestattempt,
      attemptsused: result.attemptsused,
      warning: result.warnings?.[0]?.warningcode,
    };
  } catch (error: any) {
    if (IS_DEV) console.error('[MoodleApi] getQuizAccessInfo exception:', error.message);
    return null;
  }
}

/**
 * Récupère les options d'un choice/sondage
 * @param token - Token Moodle
 * @param choiceId - ID du choice
 */
export async function getChoiceOptions(
  token: string, 
  choiceId: number
): Promise<GetChoiceOptionsResult | null> {
  if (!token || !choiceId) {
    if (IS_DEV) console.error('[MoodleApi] getChoiceOptions: missing params');
    return null;
  }

  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_choice_get_choice_options',
      moodlewsrestformat: 'json',
      choiceid: choiceId,
    });

    if (result?.exception) {
      if (IS_DEV) console.error('[MoodleApi] getChoiceOptions error:', result.message);
      return null;
    }

    if (IS_DEV) console.log('[MoodleApi] getChoiceOptions success:', {
      choiceId,
      count: result.options?.length || 0,
    });

    return {
      choiceid: result.choiceid,
      options: result.options || [],
      completions: result.completions || [],
    };
  } catch (error: any) {
    if (IS_DEV) console.error('[MoodleApi] getChoiceOptions exception:', error.message);
    return null;
  }
}

/**
 * Soumet une réponse à un choice
 * @param token - Token Moodle
 * @param choiceId - ID du choice
 * @param optionId - ID de l'option choisie
 */
export async function submitChoiceResponse(
  token: string,
  choiceId: number,
  optionId: number
): Promise<{ success: boolean } | null> {
  if (!token || !choiceId || !optionId) {
    if (IS_DEV) console.error('[MoodleApi] submitChoiceResponse: missing params');
    return null;
  }

  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_choice_submit_choice',
      moodlewsrestformat: 'json',
      choiceid: choiceId,
      optionid: optionId,
    }, 'POST');

    if (result?.exception) {
      if (IS_DEV) console.error('[MoodleApi] submitChoiceResponse error:', result.message);
      return { success: false };
    }

    if (IS_DEV) console.log('[MoodleApi] submitChoiceResponse success:', { choiceId, optionId });

    return { success: true };
  } catch (error: any) {
    if (IS_DEV) console.error('[MoodleApi] submitChoiceResponse exception:', error.message);
    return { success: false };
  }
}

/**
 * Sauvegarde une réponse de quiz
 * @param token - Token Moodle
 * @param attemptId - ID de la tentative
 * @param data - Réponses au format Moodle
 */
export async function processQuizAttempt(
  token: string,
  attemptId: number,
  data: Record<string, any>
): Promise<{ success: boolean; finished: boolean } | null> {
  if (!token || !attemptId || !data) {
    if (IS_DEV) console.error('[MoodleApi] processQuizAttempt: missing params');
    return null;
  }

  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_quiz_process_attempt',
      moodlewsrestformat: 'json',
      attemptid: attemptId,
      data: JSON.stringify(data),
    }, 'POST');

    if (result?.exception) {
      if (IS_DEV) console.error('[MoodleApi] processQuizAttempt error:', result.message);
      return null;
    }

    return {
      success: true,
      finished: result?.status === 'finished' || false,
    };
  } catch (error: any) {
    if (IS_DEV) console.error('[MoodleApi] processQuizAttempt exception:', error.message);
    return null;
  }
}