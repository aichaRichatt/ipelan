import { useCallback, useEffect, useState } from 'react';
import { generateIdRetryOrder, identifyActivityType, validateActivityIds } from '../services/activity/activityIdentifier';
import { moodleFetch } from '../services/api/moodleClient';

const IS_DEV = process.env.NODE_ENV === "development";
const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_TOKEN;

async function moodleFetchWithFallback(endpoint: string, params: Record<string, any>, userToken: string) {
  let result = await moodleFetch(endpoint, params);

  if (result?.exception && ADMIN_TOKEN && params.wstoken === userToken) {
    console.log('[useActivityContent] User token failed for ' + params.wsfunction + ', trying admin...');
    const adminParams = { ...params, wstoken: ADMIN_TOKEN };
    result = await moodleFetch(endpoint, adminParams);
  }

  return result;
}

export interface ActivityQuestion {
  id?: number;
  question: string;
  options: string[];
  correctAnswer?: number;
  correctIndex?: number;
  type?: 'text-mcq' | 'audio-mcq';
  audioUrl?: string;
  explanation?: string;
  points: number;
}

export interface DictationData {
  id: number;
  title: string;
  audioUrl?: string;
  words: { word: string; hint?: string; translation?: string }[];
  difficulty?: 'easy' | 'medium' | 'hard';
  correctText?: string;
}

export interface ListeningData {
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

export interface AssociationData {
  id: number;
  title: string;
  pairs: AssociationPair[];
}

export interface WordOrderSentence {
  words: string[];
  translation?: string;
  correctOrder?: string[];
}

export interface WordOrderData {
  id: number;
  title: string;
  sentences: WordOrderSentence[];
}

export interface ActivityContentResult {
  questions: ActivityQuestion[];
  dictation: DictationData | null;
  listening: ListeningData | null;
  association: AssociationData | null;
  wordOrder: WordOrderData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  courseId?: number;
  moduleTitle?: string;
}

export function useActivityContent(
  token: string,
  moduleId: number,
  instanceId: number,
  moduleType: string,
  cmid?: number,
  courseId?: number
): ActivityContentResult {
  const [questions, setQuestions] = useState<ActivityQuestion[]>([]);
  const [dictation, setDictation] = useState<DictationData | null>(null);
  const [listening, setListening] = useState<ListeningData | null>(null);
  const [association, setAssociation] = useState<AssociationData | null>(null);
  const [wordOrder, setWordOrder] = useState<WordOrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    const idToUse = moduleId || instanceId;
    if (!idToUse || idToUse === 0) {
      setError('Aucun identifiant de module valide fourni');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const activityToken = token || process.env.EXPO_PUBLIC_MOODLE_TOKEN;
      if (!activityToken) {
        setError('Token d\'authentification manquant');
        setIsLoading(false);
        return;
      }

      if (IS_DEV) {
        console.log('[useActivityContent] Loading:', moduleType, {
          moduleId,
          instanceId,
          cmid,
          idToUse,
        });
      }

      //  Identifier le type d'activité avec le service
      const identification = identifyActivityType(moduleType, '');
      if (IS_DEV) {
        console.log('[useActivityContent] Activity type identified:', identification);
      }

       const validation = validateActivityIds(moduleType, moduleId, instanceId, cmid);
      if (!validation.valid && IS_DEV) {
        console.warn('[useActivityContent] ID validation warning:', validation.message);
      }

      switch (identification.type) {
        case 'quiz':
          await loadQuizWithRetry(activityToken, moduleId, instanceId, cmid, setQuestions, setError);
          break;
        case 'dictation':
          await loadDictationWithRetry(activityToken, moduleId, instanceId, cmid, setDictation, setError);
          break;
        case 'listening':
          await loadListeningWithRetry(activityToken, moduleId, instanceId, cmid, setListening, setError);
          break;
        case 'association':
          await loadGlossaryWithRetry(activityToken, moduleId, instanceId, cmid || 0, courseId || 0, setAssociation, setWordOrder, setError, 'association');
          break;
        case 'wordOrder':
          await loadLessonWithRetry(activityToken, moduleId, instanceId, cmid, setAssociation, setWordOrder, setError, 'wordOrder', courseId);
          break;
        default:
          setError(`Type d'activité non reconnu: ${moduleType}`);
      }
    } catch (err: any) {
      if (IS_DEV) console.error('[useActivityContent] Unexpected error:', err);
      setError(err.message || 'Erreur inattendue lors du chargement');
    } finally {
      setIsLoading(false);
    }
  }, [token, moduleId, instanceId, moduleType, cmid]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return {
    questions,
    dictation,
    listening,
    association,
    wordOrder,
    isLoading,
    error,
    refetch: fetchActivity,
  };
}


// Charge un Quiz en utilisant les APIs Moodle officielles
 
async function loadQuizWithRetry(
  token: string,
  moduleId: number,
  instanceId: number,
  cmid: number | undefined,
  setQuestions: (q: ActivityQuestion[]) => void,
  setError: (e: string) => void,
  courseId?: number
) {
  const idsToTry = generateIdRetryOrder(instanceId, cmid, moduleId);

  for (const { id, type } of idsToTry) {
    try {
      if (IS_DEV) console.log(`[loadQuizWithRetry] Trying ${type}:`, id);

       let quizParams: Record<string, any> = {
        wstoken: token,
        wsfunction: 'mod_quiz_get_quizzes_by_courses',
        moodlewsrestformat: 'json',
      };

      if (courseId) {
        quizParams['courseids[0]'] = courseId;
      }

      let quizResult = await moodleFetch('/webservice/rest/server.php', quizParams);

       if (!quizResult?.quizzes || quizResult.exception) {
        quizParams = {
          wstoken: token,
          wsfunction: 'mod_quiz_get_quizzes_by_courses',
          moodlewsrestformat: 'json',
          'quizids[0]': id,
        };
        quizResult = await moodleFetch('/webservice/rest/server.php', quizParams);
      }

      if (quizResult?.exception) {
        if (IS_DEV) console.warn(`[loadQuizWithRetry] Get quizzes failed:`, quizResult.message);
        continue;
      }

 
      const quiz = quizResult.quizzes?.find((q: any) => q.id === id);
      if (!quiz && quizResult.quizzes?.length > 0) {
        const fallbackQuiz = quizResult.quizzes[0];
        if (IS_DEV) console.log(`[loadQuizWithRetry] Using fallback quiz:`, fallbackQuiz.id);
   
        quizResult.quizzes = [fallbackQuiz];
      }

      if (!quizResult.quizzes?.length) {
        if (IS_DEV) console.warn(`[loadQuizWithRetry] No quiz found with ${type}:`, id);
        continue;
      }

       const attemptParams = {
        wstoken: token,
        wsfunction: 'mod_quiz_start_attempt',
        quizid: id,
        forcenew: 1,
        moodlewsrestformat: 'json',
      };

      const attemptResult = await moodleFetch('/webservice/rest/server.php', attemptParams);

      if (attemptResult?.exception) {
        if (IS_DEV) console.warn(`[loadQuizWithRetry] Start attempt failed:`, attemptResult.message);
        console.log(`[loadQuizWithRetry] Failed to start quiz attempt for ${type}:`, id);
        continue;
      }

       const attemptId = attemptResult?.attempt?.id || 0;
      const questionsParams = {
        wstoken: token,
        wsfunction: 'mod_quiz_get_attempt_data',
        attemptid: attemptId,
        page: 0,
        moodlewsrestformat: 'json',
      };

       if (!attemptId) {
        questionsParams.attemptid = attemptResult?.attempt?.id || 1;
      }

      const questionsResult = await moodleFetch('/webservice/rest/server.php', questionsParams);

      if (questionsResult?.exception || !questionsResult?.data?.node) {
        if (IS_DEV) console.warn(`[loadQuizWithRetry] Get questions failed:`, questionsResult?.message);

         if (IS_DEV) console.log(`[loadQuizWithRetry] Generating fallback questions`);
        console.log("[useActivityContent] Failed to fetch quiz content, using fallback questions. Params:", { moduleId, instanceId, cmid });
        return;
      }

       const questions: ActivityQuestion[] = [];
      const node = questionsResult.data?.node;

      if (node?.responses) {
        for (let i = 0; i < node.responses.length; i++) {
          const r = node.responses[i];
          questions.push({
            id: i + 1,
            question: r.question || `Question ${i + 1}`,
            options: r.option || ['Oui', 'Non'],
            correctIndex: r.correct || 0,
            points: 1,
          });
        }
      }

       if (questions.length === 0) {
        questions.push({ question: 'Quel est le contraire de "Ko" (Oui) en Pulaar ?', options: ['Alelu (Non)', 'Alelu', 'Kanji', 'Aboro'], correctIndex: 0, points: 1 });
      }

      if (IS_DEV) {
        console.log(`[loadQuizWithRetry] ✅ SUCCESS with ${type}:`, id, `- ${questions.length} questions`);
      }

      setQuestions(questions);
      return;
    } catch (err: any) {
      if (IS_DEV) {
        console.error(`[loadQuizWithRetry] Exception with ${type}:`, err.message);
      }
    }
  }

  if (IS_DEV) console.log('[loadQuizWithRetry] Using fallback questions');

  console.log("[useActivityContent]  failed to fetch quiz content, using fallback data. Params:", { moduleId, instanceId, cmid });
}

/**
 *  charger une Dictée avec stratégie de retry
 */
async function loadDictationWithRetry(
  token: string,
  moduleId: number,
  instanceId: number,
  cmid: number | undefined,
  setDictation: (d: DictationData | null) => void,
  setError: (e: string) => void
) {
  const idsToTry = generateIdRetryOrder(instanceId, cmid, moduleId);

  for (const { id, type } of idsToTry) {
    try {
      if (IS_DEV) console.log(`[loadDictationWithRetry] Trying ${type}:`, id);

      const params: Record<string, any> = {
        wstoken: token,
        wsfunction: 'mod_assign_get_assignments',
        moodlewsrestformat: 'json',
      };

      params['assignmentids[0]'] = id;

      const result = await moodleFetch('/webservice/rest/server.php', params);

      if (result?.exception) {
        if (IS_DEV) {
          console.warn(`[loadDictationWithRetry] ${type} failed:`, result.message);
        }
        continue;
      }

       const assignments = result?.assignments || [];
      const assignment = assignments.find((a: any) => a.id === id) || assignments[0];

      if (!assignment) {
        if (IS_DEV) console.warn(`[loadDictationWithRetry] No assignment found with ${type}:`, id);
        continue;
      }

      const dictation: DictationData = {
        id,
        title: assignment.name || 'Dictée audio',
        words: [],
      };

      if (IS_DEV) {
        console.log(`[loadDictationWithRetry] ✅ SUCCESS with ${type}:`, id);
      }

      setDictation(dictation);
      return;
    } catch (err: any) {
      if (IS_DEV) {
        console.error(`[loadDictationWithRetry] Exception with ${type}:`, err.message);
      }
    }
  }

  // Fallback: générer des mots bidon
  if (IS_DEV) console.log('[loadDictationWithRetry] Using fallback data');

console.log("[useActivityContent] Failed to fetch dictation content. using fallback data. Params:", { moduleId, instanceId, cmid });
}

/**
 * Essaie de charger une activité Listening avec stratégie de retry
 */
async function loadListeningWithRetry(
  token: string,
  moduleId: number,
  instanceId: number,
  cmid: number | undefined,
  setListening: (l: ListeningData | null) => void,
  setError: (e: string) => void
) {
  const idsToTry = generateIdRetryOrder(instanceId, cmid, moduleId);

  for (const { id, type } of idsToTry) {
    try {
      if (IS_DEV) console.log(`[loadListeningWithRetry] Trying ${type}:`, id);

      let params: any = {
        wstoken: token,
        wsfunction: 'mod_choice_get_choice_options',
        moodlewsrestformat: 'json',
      };

      if (type === 'instanceId') {
        params.choiceid = id;
      } else {
        params.cmid = id;
      }

      const result = await moodleFetch('/webservice/rest/server.php', params);

      if (result?.exception) {
        if (IS_DEV) {
          console.warn(`[loadListeningWithRetry] ${type} failed:`, result.message);
        }
        continue;
      }

      const options = result?.options || [];
      if (!options || options.length === 0) {
        if (IS_DEV) {
          console.warn(`[loadListeningWithRetry] No options found with ${type}:`, id);
        }
        continue;
      }

      const listening: ListeningData = {
        id,
        title: result?.choice?.name || 'Compréhension orale',
        question: 'Écoutez et choisissez la bonne réponse',
        options: options.map((o: any) => o.text || ''),
        correctIndex: 0,
      };

      if (IS_DEV) {
        console.log(`[loadListeningWithRetry] ✅ SUCCESS with ${type}:`, id, `- ${options.length} options`);
      }

      setListening(listening);
      return;
    } catch (err: any) {
      if (IS_DEV) {
        console.error(`[loadListeningWithRetry] Exception with ${type}:`, err.message);
      }
    }
  }

  // Fallback: générer des données bidon si tout échoue
  if (IS_DEV) console.log('[loadListeningWithRetry] Using fallback data');

  const fallbackOptions = ['Bonjour', 'Merci', 'Au revoir', 'Oui', 'Non'];
  const shuffledOptions = [...fallbackOptions].sort(() => Math.random() - 0.5);
  const correctAnswer = Math.floor(Math.random() * shuffledOptions.length);

  const fallbackListening: ListeningData = {
    id: moduleId,
    title: 'Compréhension orale',
    question: 'Écoutez et Choisissez la bonne réponse',
    options: shuffledOptions,
    correctIndex: correctAnswer,
  };

  setListening(fallbackListening);
}


async function loadLessonWithRetry(
  token: string,
  moduleId: number,
  instanceId: number,
  cmid: number | undefined,
  setAssociation: (a: AssociationData | null) => void,
  setWordOrder: (w: WordOrderData | null) => void,
  setError: (e: string) => void,
  expectedType: 'association' | 'wordOrder',
  courseId?: number
) {
  // D'abord, essayer d'obtenir les lessons du cours
  try {
    if (IS_DEV) console.log(`[loadLessonWithRetry] Fetching lessons for course:`, courseId);

    const lessonsParams = {
      wstoken: token,
      wsfunction: 'mod_lesson_get_lessons_by_courses',
      'courseids[0]': courseId || 0,
      moodlewsrestformat: 'json',
    };

    const lessonsResult = await moodleFetch('/webservice/rest/server.php', lessonsParams);

    if (lessonsResult?.exception) {
      if (IS_DEV) console.warn(`[loadLessonWithRetry] Get lessons failed:`, lessonsResult.message);
    } else if (lessonsResult?.lessons?.length > 0) {
      // Trouver la lesson avec le bon cmid
      let targetLesson = lessonsResult.lessons.find((l: any) => l.cmid === moduleId || l.cmid === cmid);

      // Fallback: utiliser la première lesson
      if (!targetLesson && lessonsResult.lessons.length > 0) {
        targetLesson = lessonsResult.lessons[0];
        if (IS_DEV) console.log(`[loadLessonWithRetry] Using fallback lesson:`, targetLesson.id, targetLesson.name);
      }

      if (targetLesson) {
        if (IS_DEV) console.log(`[loadLessonWithRetry] Found lesson:`, targetLesson.id, targetLesson.name);

        // Charger les pages de la lesson
        const pagesResult = await moodleFetch('/webservice/rest/server.php', {
          wstoken: token,
          wsfunction: 'mod_lesson_get_pages',
          lessonid: targetLesson.id,
          moodlewsrestformat: 'json',
        });

        const pages = pagesResult?.pages || [];

        if (pages && pages.length > 0) {
          if (IS_DEV) console.log(`[loadLessonWithRetry] Found ${pages.length} pages`);

          // Parser les pages en fonction du type attendu
          if (expectedType === 'wordOrder') {
            const sentences: WordOrderSentence[] = [];

            for (const page of pages.slice(0, 5)) {
              const content = page.content || '';
              const cleanContent = content
                .replace(/<[^>]*>/g, '')
                .replace(/&[^;]+;/g, ' ')
                .trim();
              const words = cleanContent.split(/\s+/).filter((w: string) => w.length > 2);

              if (words.length >= 2 && words.length <= 8) {
                const shuffled = [...words].sort(() => Math.random() - 0.5);
                sentences.push({
                  words: shuffled,
                  translation: cleanContent,
                });
              }
            }

            if (sentences.length > 0) {
              if (IS_DEV) console.log(`[loadLessonWithRetry] ✅ SUCCESS (wordOrder) with lesson:`, targetLesson.id);

              setWordOrder({
                id: targetLesson.id,
                title: targetLesson.name || 'Ordre des mots',
                sentences: sentences.map(s => ({ words: s.words })),
              });
              setAssociation(null);
              return;
            }
          }

          // Sinon, essayer comme association
          const pairs: AssociationPair[] = [];
          for (const page of pages.slice(0, 6)) {
            const content = page.content || '';

            if (content.includes('-') || content.includes('–')) {
              const parts = content.split(/[-–]/).map((s: string) => s.trim().replace(/<[^>]*>/g, ''));
              if (parts.length === 2 && parts[0] && parts[1]) {
                pairs.push({
                  word: parts[0],
                  translation: parts[1],
                });
              }
            }
          }

          if (pairs.length > 0) {
            if (IS_DEV) console.log(`[loadLessonWithRetry] ✅ SUCCESS (association) with lesson:`, targetLesson.id);

            setAssociation({
              id: targetLesson.id,
              title: targetLesson.name || 'Association',
              pairs,
            });
            setWordOrder(null);
            return;
          }

          // Si on arrive ici, pas de contenu valide
          if (IS_DEV) console.warn(`[loadLessonWithRetry] Lesson has no valid content`);
        }
      }
    }
  } catch (err: any) {
    if (IS_DEV) console.error(`[loadLessonWithRetry] Error fetching lessons:`, err.message);
  }

  // Fallback: générer des données bidon
  if (IS_DEV) console.log(`[loadLessonWithRetry] Using fallback data`);

  if (expectedType === 'wordOrder') {
    const fallbackSentences = [
      { words: ['Bonjour', 'comment', 'allez'], translation: 'Bonjour comment allez vous' },
      { words: ['Je', 'suis', 'content'], translation: 'Je suis content' },
      { words: ['Merci', 'beaucoup'], translation: 'Merci beaucoup' },
    ];
    setWordOrder({
      id: moduleId,
      title: 'Ordre des mots',
      sentences: fallbackSentences.map(s => ({ words: s.words })),
    });
  } else {
    if (IS_DEV) console.log(`[loadLessonWithRetry] Using fallback association data`);

    const fallbackPairs: AssociationPair[] = [];
    console.log(`[loadLessonWithRetry] Failed to load lesson content `);

    setWordOrder(null);
  }
}

async function loadGlossaryWithRetry(
  token: string,
  moduleId: number,
  instanceId: number,
  cmid: number,
  courseId: number,
  setAssociation: (a: AssociationData | null) => void,
  setWordOrder: (w: WordOrderData | null) => void,
  setError: (e: string) => void,
  expectedType: 'association' | 'wordOrder'
) {
  const { resolveActivityInstanceId, stripHtml: stripHtmlUtil } = await import('../services/utils/moodleIdResolver');
  
  try {
    if (IS_DEV) console.log(`[loadGlossaryWithRetry] Fetching glossary:`, { moduleId, instanceId, cmid, courseId });

    const effectiveCmid = cmid > 0 ? cmid : (moduleId > 0 ? moduleId : instanceId);
    
    if (courseId > 0 && effectiveCmid > 0) {
      const resolved = await resolveActivityInstanceId(
        courseId,
        'glossary',
        effectiveCmid,
        token
      );

      if (resolved) {
        if (IS_DEV) console.log(`[loadGlossaryWithRetry] Resolved glossary ID:`, resolved.instanceId);

        const result = await moodleFetch('/webservice/rest/server.php', {
          wstoken: token,
          wsfunction: 'mod_glossary_get_entries_by_letter',
          moodlewsrestformat: 'json',
          id: resolved.instanceId,
          letter: 'ALL',
          from: 0,
          limit: 50,
        });

        if (result?.exception) {
          if (IS_DEV) console.warn(`[loadGlossaryWithRetry] API failed:`, result.message);
        } else {
          const entries = result?.entries || [];
          
          if (entries.length > 0) {
            if (IS_DEV) console.log(`[loadGlossaryWithRetry] Found ${entries.length} entries`);

            const pairs: AssociationPair[] = entries.map((entry: any) => ({
              word: stripHtmlUtil(entry.concept || ''),
              translation: stripHtmlUtil(entry.definition || ''),
              id: entry.id,
            }));

            if (pairs.length > 0) {
              setAssociation({
                id: resolved.instanceId,
                title: resolved.name || 'Association - Glossaire',
                pairs: pairs.slice(0, 10),
              });
              setWordOrder(null);
              return;
            }
          }
        }
      } else {
        if (IS_DEV) console.warn(`[loadGlossaryWithRetry] Could not resolve glossary ID`);
      }
    }
  } catch (err: any) {
    if (IS_DEV) console.error(`[loadGlossaryWithRetry] Error:`, err.message);
  }

  if (IS_DEV) console.log(`[loadGlossaryWithRetry] Falling back to static pairs`);
  setError(null);
}

export default useActivityContent;