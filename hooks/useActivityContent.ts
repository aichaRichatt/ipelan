import { useCallback, useEffect, useState } from 'react';
import { generateIdRetryOrder, identifyActivityType, validateActivityIds } from '../services/activity/activityIdentifier';
import { moodleFetch } from '../services/api/moodleClient';
import { shuffle } from '../utils/shuffle';

const IS_DEV = process.env.NODE_ENV === "development";
const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_ADMIN_TOKEN;

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
  courseId?: number,
  moduleTitle?: string
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
      const activityToken = token || process.env.EXPO_PUBLIC_MOODLE_ADMIN_TOKEN;
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
      const identification = identifyActivityType(moduleType, moduleTitle || '');
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
          await loadDictationWithRetry(activityToken, moduleId, instanceId, cmid, courseId || 0, setDictation, setError);
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
        'preflightdata[0][name]': 'confirm',
        'preflightdata[0][value]': '1',
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
        'preflightdata[0][name]': 'confirm',
        'preflightdata[0][value]': '1',
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
        if (IS_DEV) {
          console.warn(`[loadQuizWithRetry] Aucune question Moodle exploitable pour ${type}=${id}`);
        }
        setError(`Aucune question disponible pour ce quiz (id=${id}). Vérifiez le contenu Moodle.`);
        continue;
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

  setQuestions([]);
}

/**
 * Extrait une liste de mots à dicter depuis le HTML d'intro Moodle.
 *
 * Conventions supportées (par ordre de priorité) :
 *   1. Balises <li>...</li>  → un mot par item
 *   2. Marqueurs `mot | indice` → format <mot>|<hint optionnel>
 *   3. Lignes séparées par <br> ou retours chariot
 *   4. Mots séparés par virgules ou points-virgules
 *
 * Renvoie [] si rien d'exploitable n'est trouvé.
 */
function parseDictationWordsFromIntro(
  introHtml: string
): { word: string; hint?: string }[] {
  if (!introHtml) return [];

  const decoded = introHtml
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'");

  // 1. Liste <li>
  const liMatches = Array.from(decoded.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
  if (liMatches.length > 0) {
    return liMatches
      .map(m => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(s => s.length > 0)
      .map(splitWordHint);
  }

  
  const plain = decoded.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '\n');
  const lines = plain
    .split(/\n|\r/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let candidates: string[] = [];
  if (lines.length >= 2) {
    candidates = lines;
  } else if (lines.length === 1) {
     candidates = lines[0]
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  return candidates
    .filter(s => /\S/.test(s))
    .map(splitWordHint);
}

function splitWordHint(raw: string): { word: string; hint?: string } {
  const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { word: parts[0], hint: parts.slice(1).join(' | ') };
  }
  return { word: parts[0] || raw.trim() };
}

 
async function loadDictationWithRetry(
  token: string,
  moduleId: number,
  instanceId: number,
  cmid: number | undefined,
  courseId: number,
  setDictation: (d: DictationData | null) => void,
  setError: (e: string) => void
) {
   const idsToTry = [courseId];  

  for (const id of idsToTry) {
    try {
      if (IS_DEV) console.log(`[loadDictationWithRetry] Trying courseId:`, id);

      const params: Record<string, any> = {
        wstoken: token,
        wsfunction: 'mod_assign_get_assignments',
        moodlewsrestformat: 'json',
      };

      params['courseids[0]'] = id;

      const result = await moodleFetch('/webservice/rest/server.php', params);

      if (result?.exception) {
        if (IS_DEV) {
          console.warn(`[loadDictationWithRetry] courseId ${id} failed:`, result.message);
        }
        continue;
      }

      // Rechercher l'assignment par instanceId
      const courses = result?.courses || [];
      let assignment: any = null;

      for (const course of courses) {
        const assignments = course.assignments || [];
        assignment = assignments.find((a: any) => a.id === instanceId);
        if (assignment) break;
      }

      if (!assignment) {
        if (IS_DEV) console.warn(`[loadDictationWithRetry] No assignment ${instanceId} in course ${id}`);
        continue;
      }

       const introFiles: any[] = assignment.introfiles || [];
      const audioFile = introFiles.find((f: any) =>
        f?.filename && /\.(mp3|wav|ogg|m4a|aac)$/i.test(f.filename)
      );
      const audioUrl = audioFile?.fileurl
        ? `${audioFile.fileurl.replace('/pluginfile.php/', '/webservice/pluginfile.php/')}?token=${token}`
        : undefined;

       const words = parseDictationWordsFromIntro(assignment.intro || '');

      if (words.length === 0) {
        const msg = `Aucun mot trouvé dans l'intro de la dictée (assignment ${instanceId}). Format attendu : liste <li> ou un mot par ligne.`;
        if (IS_DEV) console.warn('[loadDictationWithRetry]', msg);
        setError(msg);
      }

      const dictation: DictationData = {
        id: instanceId,
        title: assignment.name || 'Dictée audio',
        audioUrl,
        words,
      };

      if (IS_DEV) {
        console.log(`[loadDictationWithRetry] ✅ instanceId ${instanceId}: ${words.length} mots, audio=${audioUrl ? 'oui' : 'non'}`);
      }

      setDictation(dictation);
      return;
    } catch (err: any) {
      if (IS_DEV) {
        console.error(`[loadDictationWithRetry] Exception:`, err.message);
      }
    }
  }

  setDictation(null);
}


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

  

  setListening(null);
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
       let targetLesson = lessonsResult.lessons.find((l: any) => l.cmid === moduleId || l.cmid === cmid);

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
              const words: string[] = String(cleanContent).split(/\s+/).filter((w: string) => w.length > 2);

              if (words.length >= 2 && words.length <= 8) {
                const shuffled = shuffle(words);
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

  if (expectedType === 'wordOrder') {
    setWordOrder(null);
  } else {
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
  const { resolveActivityInstanceId, getModulesByType, stripHtml: stripHtmlUtil } = await import('../services/utils/moodleIdResolver');
  const { moodleFetch } = await import('../services/api/moodleClient');
  
  try {
    if (IS_DEV) console.log(`[loadGlossaryWithRetry] Fetching glossary:`, { moduleId, instanceId, cmid, courseId });

    const effectiveCmid = cmid > 0 ? cmid : (moduleId > 0 ? moduleId : instanceId);
    let glossaryInstanceId: number | null = null;
    let glossaryName = 'Glossaire';
    
    // Première tentative : résoudre via cmid direct
    if (courseId > 0 && effectiveCmid > 0) {
      const resolved = await resolveActivityInstanceId(
        courseId,
        'glossary',
        effectiveCmid,
        token
      );

      if (resolved) {
        glossaryInstanceId = resolved.instanceId;
        glossaryName = resolved.name || 'Glossaire';
      }
    }
    
    // Deuxième tentative : chercher tous les glossaires du cours si la première échoue
    if (!glossaryInstanceId && courseId > 0) {
      if (IS_DEV) console.log(`[loadGlossaryWithRetry] Trying fallback: get all glossaries`);
      const glossaries = await getModulesByType(courseId, 'glossary', token);
      if (glossaries.length > 0) {
        glossaryInstanceId = glossaries[0].instanceId;
        glossaryName = glossaries[0].name;
        if (IS_DEV) console.log(`[loadGlossaryWithRetry] Found fallback glossary:`, { instanceId: glossaryInstanceId, name: glossaryName });
      }
    }
    
    // Charger les entrées du glossaire
    if (glossaryInstanceId) {
      if (IS_DEV) console.log(`[loadGlossaryWithRetry] Loading entries for glossary:`, glossaryInstanceId);

      const result = await moodleFetch('/webservice/rest/server.php', {
        wstoken: token,
        wsfunction: 'mod_glossary_get_entries_by_letter',
        moodlewsrestformat: 'json',
        id: glossaryInstanceId,
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
              id: glossaryInstanceId,
              title: glossaryName,
              pairs: pairs.slice(0, 10),
            });
            setWordOrder(null);
            return;
          }
        }
      }
    }
  } catch (err: any) {
    if (IS_DEV) console.error(`[loadGlossaryWithRetry] Error:`, err.message);
    setError('Erreur lors du chargement du glossaire');
  }
}
