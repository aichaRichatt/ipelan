import { moodleFetch } from './api/moodleClient';

const IS_DEV = process.env.NODE_ENV === "development";

export interface MoodleActivity {
  id: number;
  course: number;
  name: string;
  intro?: string;
  introformat?: number;
  instance?: number;
  modulename?: string;
  section?: number;
  visible?: number;
  contents?: MoodleContent[];
}

export interface MoodleContent {
  type: string;
  filename: string;
  fileurl: string;
  filesize: number;
  mimetype?: string;
  timecreated?: number;
  timemodified?: number;
  sortorder?: number;
}

export interface ActivityQuestion {
  id: number;
  question: string;
  type: string;
  options?: string[];
  correctAnswer?: number;
  correctAnswers?: string[];
  imageUrl?: string;
  audioUrl?: string;
  explanation?: string;
  points: number;
}

export interface DictationActivity {
  id: number;
  title: string;
  audioUrl?: string;
  words: { word: string; hint?: string; translation?: string }[];
  difficulty?: 'easy' | 'medium' | 'hard';
  correctText?: string;
}

export interface ListeningActivity {
  id: number;
  title: string;
  audioUrl?: string;
  question: string;
  options: string[];
  correctIndex: number;
  translation?: string;
  courseName?: string;
}

export interface AssociationPair {
  word: string;
  translation?: string;
  image?: string;
}

export interface AssociationActivity {
  id: number;
  title: string;
  pairs: AssociationPair[];
}

export interface WordOrderSentence {
  words: string[];
  translation?: string;
  correctOrder?: string[];
}

export interface WordOrderActivity {
  id: number;
  title: string;
  sentences: WordOrderSentence[];
}

export async function loadActivityFromMoodle(
  token: string,
  moduleId: number,
  instanceId: number,
  moduleType: string
): Promise<{
  activity: MoodleActivity | null;
  questions: ActivityQuestion[];
  error?: string;
}> {
  const activityToken = process.env.EXPO_PUBLIC_MOODLE_TOKEN || token;

  if (IS_DEV) console.log('[ActivityLoader] Loading activity:', moduleType, instanceId);

  try {
    switch (moduleType.toLowerCase()) {
      case 'quiz':
        return await loadQuizActivity(activityToken, instanceId);
      case 'lesson':
        return await loadLessonActivity(activityToken, instanceId);
      case 'assign':
        return await loadDictationActivity(activityToken, instanceId);
      case 'choice':
        return await loadListeningActivity(activityToken, instanceId);
      default:
        return {
          activity: null,
          questions: [],
          error: `Type d'activité non supporté: ${moduleType}`
        };
    }
  } catch (err: any) {
    if (IS_DEV) console.error('[ActivityLoader] Error:', err);
    return {
      activity: null,
      questions: [],
      error: err.message || 'Erreur de chargement'
    };
  }
}

async function loadQuizActivity(
  token: string,
  quizId: number
): Promise<{ activity: MoodleActivity | null; questions: ActivityQuestion[] }> {
  try {
    const startParams = {
      wstoken: token,
      wsfunction: 'mod_quiz_start_attempt',
      quizid: quizId,
      moodlewsrestformat: 'json'
    };
    const startResult = await moodleFetch('/webservice/rest/server.php', startParams);

    if (startResult?.exception) {
      if (IS_DEV) console.warn('[Quiz] start_attempt failed:', startResult.message);
      return { activity: null, questions: [] };
    }

    const attemptId = startResult?.attemptid;
    if (!attemptId) {
      if (IS_DEV) console.warn('[Quiz] No attempt ID returned');
      return { activity: null, questions: [] };
    }

    const dataParams = {
      wstoken: token,
      wsfunction: 'mod_quiz_get_attempt_data',
      attemptid: attemptId,
      moodlewsrestformat: 'json'
    };
    const dataResult = await moodleFetch('/webservice/rest/server.php', dataParams);

    if (dataResult?.exception) {
      if (IS_DEV) console.warn('[Quiz] get_attempt_data failed:', dataResult.message);
      return { activity: null, questions: [] };
    }

    const activity: MoodleActivity = {
      id: quizId,
      course: dataResult?.quiz?.course || 0,
      name: dataResult?.quiz?.name || 'Quiz',
      intro: dataResult?.quiz?.intro || ''
    };

    const questions: ActivityQuestion[] = [];

    if (dataResult?.questions && Array.isArray(dataResult.questions)) {
      for (const q of dataResult.questions) {
        const options: string[] = [];
        
        if (q.options && Array.isArray(q.options)) {
          for (const o of q.options) {
            options.push(o.answer || '');
          }
        }

        questions.push({
          id: q.id || 0,
          question: q.text || q.question || '',
          type: q.type || 'multichoice',
          options,
          correctAnswer: q.correctanswer !== undefined ? parseInt(q.correctanswer) : undefined,
          imageUrl: q.imageurl || undefined,
          points: q.defaultmark || 1
        });
      }
    }

    if (IS_DEV) console.log('[Quiz] Loaded', questions.length, 'questions');
    return { activity, questions };
  } catch (err: any) {
    if (IS_DEV) console.warn('[Quiz] Error:', err.message);
    return { activity: null, questions: [] };
  }
}

async function loadLessonActivity(
  token: string,
  lessonId: number
): Promise<{ activity: MoodleActivity | null; questions: ActivityQuestion[] }> {
  const params = {
    wstoken: token,
    wsfunction: 'mod_lesson_get_lesson',
    lessonid: lessonId,
    moodlewsrestformat: 'json'
  };

  const result = await moodleFetch('/webservice/rest/server.php', params);

  if (result?.exception) {
    return { activity: null, questions: [] };
  }

  const activity: MoodleActivity = {
    id: lessonId,
    course: result?.lesson?.course || 0,
    name: result?.lesson?.name || 'Leçon',
    intro: result?.lesson?.intro || ''
  };

  const questions: ActivityQuestion[] = [];

  if (result?.pages && Array.isArray(result.pages)) {
    for (const page of result.pages) {
      if (page.answers && Array.isArray(page.answers)) {
        for (const answer of page.answers) {
          questions.push({
            id: page.id || 0,
            question: page.content || '',
            type: 'multichoice',
            options: answer.answer ? [answer.answer] : [],
            correctAnswer: 0,
            points: 1
          });
        }
      }
    }
  }

  return { activity, questions };
}

async function loadDictationActivity(
  token: string,
  assignId: number
): Promise<{ activity: MoodleActivity | null; questions: ActivityQuestion[] }> {
  const params = {
    wstoken: token,
    wsfunction: 'mod_assign_get_assignments',
    'courseids[0]': 0,
    moodlewsrestformat: 'json'
  };

  const result = await moodleFetch('/webservice/rest/server.php', params);

  if (result?.exception) {
    return { activity: null, questions: [] };
  }

  const activity: MoodleActivity = {
    id: assignId,
    course: 0,
    name: 'Dictée'
  };

  return { activity, questions: [] };
}

async function loadListeningActivity(
  token: string,
  choiceId: number
): Promise<{ activity: MoodleActivity | null; questions: ActivityQuestion[] }> {
  const params = {
    wstoken: token,
    wsfunction: 'mod_choice_get_choice_options',
    choiceid: choiceId,
    moodlewsrestformat: 'json'
  };

  const result = await moodleFetch('/webservice/rest/server.php', params);

  if (result?.exception) {
    return { activity: null, questions: [] };
  }

  const activity: MoodleActivity = {
    id: choiceId,
    course: 0,
    name: result?.choice?.name || 'Compréhension orale'
  };

  return { activity, questions: [] };
}

export function createDefaultActivities(): ActivityQuestion[][] {
  return [[], [], [], []];
}

export async function fetchActivityFromMoodle(
  token: string,
  moduleId: number,
  instanceId: number,
  moduleType: string
): Promise<ActivityQuestion[]> {
  if (!instanceId || instanceId === 0) {
    if (IS_DEV) console.log('[ActivityLoader] No instance ID, using defaults');
    return [];
  }

  const { questions, error } = await loadActivityFromMoodle(token, moduleId, instanceId, moduleType);

  if (error || questions.length === 0) {
    if (IS_DEV) console.log('[ActivityLoader] No questions from Moodle, may need custom content');
    return [];
  }

  return questions;
}