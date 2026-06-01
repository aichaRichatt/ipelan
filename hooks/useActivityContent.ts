import { useCallback, useEffect, useRef, useState } from 'react';
import { generateIdRetryOrder, identifyActivityType, validateActivityIds } from '../services/activity/activityIdentifier';
import { moodleFetch } from '../services/api/moodleClient';

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
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

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
          await loadListeningWithRetry(activityToken, moduleId, instanceId, cmid, courseId || 0, setListening, setError);
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
      if (!isMountedRef.current) return;
      if (IS_DEV) console.error('[useActivityContent] Unexpected error:', err);
      setError(err.message || 'Erreur inattendue lors du chargement');
    } finally {
      if (isMountedRef.current) setIsLoading(false);
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
        if (IS_DEV) console.warn(`[loadQuizWithRetry] Get questions failed for ${type}=${id}:`, questionsResult?.message);
        // Ce quiz utilise le format HTML natif (mod_quiz_get_attempt_data → questions[].html)
        // → l'écran quiz-native gère ce cas via useQuiz. Signaler l'erreur clairement.
        setError('Ce quiz utilise le format natif Moodle. Il sera chargé via l\'écran de quiz dédié.');
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
        console.log(`[loadQuizWithRetry]   SUCCESS with ${type}:`, id, `- ${questions.length} questions`);
      }

      setQuestions(questions);
      return;
    } catch (err: any) {
      if (IS_DEV) {
        console.error(`[loadQuizWithRetry] Exception with ${type}:`, err.message);
      }
    }
  }

  setError('Impossible de charger les questions du quiz. Vérifie que le quiz est bien configuré dans Moodle.');
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
  const AUDIO_RE = /\.(mp3|wav|m4a|ogg|opus|aac)(\?|$)/i;
  const MOODLE_URL = (process.env.EXPO_PUBLIC_MOODLE_API_URL || '').replace(/\/$/, '');

  for (const id of [courseId]) {
    try {
      if (IS_DEV) console.log(`[loadDictationWithRetry] Trying courseId:`, id);

      const params: Record<string, any> = {
        wstoken: token,
        wsfunction: 'mod_assign_get_assignments',
        moodlewsrestformat: 'json',
        'courseids[0]': id,
      };

      // Use fallback to admin token if user token has restricted permissions
      const result = await moodleFetchWithFallback('/webservice/rest/server.php', params, token);

      if (result?.exception) {
        if (IS_DEV) console.warn(`[loadDictationWithRetry] courseId ${id} failed:`, result.message);
        continue;
      }

      // Rechercher l'assignment par instanceId
      const courses = result?.courses || [];
      let assignment: any = null;
      for (const course of courses) {
        assignment = (course.assignments || []).find((a: any) => a.id === instanceId);
        if (assignment) break;
      }

      if (!assignment) {
        if (IS_DEV) console.warn(`[loadDictationWithRetry] Assignment ${instanceId} not found in course ${id}`);
        continue;
      }

      // Debug : voir exactement ce que Moodle retourne
      if (IS_DEV) {
        console.log(`[loadDictationWithRetry] Assignment keys:`, Object.keys(assignment));
        console.log(`[loadDictationWithRetry] introfiles (${(assignment.introfiles || []).length}):`,
          JSON.stringify((assignment.introfiles || []).map((f: any) => ({ name: f.filename, url: f.fileurl }))));
        console.log(`[loadDictationWithRetry] introattachments (${(assignment.introattachments || []).length}):`,
          JSON.stringify((assignment.introattachments || []).map((f: any) => ({ name: f.filename, url: f.fileurl }))));
        console.log(`[loadDictationWithRetry] intro (100 chars):`, (assignment.intro || '').substring(0, 100));
      }

      // Cherche dans introfiles + introattachments par filename OU fileurl
      const allFiles: any[] = [
        ...(assignment.introfiles || []),
        ...(assignment.introattachments || []),
      ];
      const audioFile = allFiles.find((f: any) =>
        AUDIO_RE.test(f?.filename || '') || AUDIO_RE.test(f?.fileurl || '')
      );
      let rawAudioUrl: string = audioFile?.fileurl || '';

      // Fallback 1 : parser le HTML intro pour <audio src=...> ou href direct
      if (!rawAudioUrl && assignment.intro) {
        const m = assignment.intro.match(/<(?:audio|source)[^>]*src=["']([^"']+)["']/i)
          || assignment.intro.match(/(https?:\/\/[^"'\s]+\.(?:mp3|wav|m4a|ogg|opus|aac)(?:\?[^"'\s]*)?)/i);
        if (m) rawAudioUrl = m[1];
      }

      // Fallback 2 : si Moodle renvoie @@PLUGINFILE@@ (stockage interne TinyMCE)
      // → construire l'URL avec le contextId du module (assignment.cmid = contextId de type module)
      if (!rawAudioUrl && assignment.intro && assignment.intro.includes('@@PLUGINFILE@@')) {
        const pluginMatch = assignment.intro.match(/@@PLUGINFILE@@([^"'<\s]+)/i);
        if (pluginMatch) {
          // contextId pour un assign = id du course_modules context (≈ cmid + offset)
          // On utilise introattachment filearea + instanceId comme approximation
          rawAudioUrl = `${MOODLE_URL}/webservice/pluginfile.php/${assignment.cmid || cmid}/mod_assign/intro${pluginMatch[1]}`;
        }
      }

      if (IS_DEV) console.log(`[loadDictationWithRetry] rawAudioUrl:`, rawAudioUrl || 'NONE');

      // Convertir pluginfile.php → webservice/pluginfile.php SEULEMENT si pas déjà fait
      // (Moodle retourne déjà /webservice/pluginfile.php/ via les WS — ne pas doubler)
      // Ne pas ajouter le token s'il est déjà présent dans l'URL (évite le double-token → 403)
      let audioUrl: string | undefined;
      if (rawAudioUrl) {
        const wsUrl = rawAudioUrl.includes('/webservice/pluginfile.php/')
          ? rawAudioUrl
          : rawAudioUrl.replace('/pluginfile.php/', '/webservice/pluginfile.php/');
        const hasToken = wsUrl.includes('token=') || wsUrl.includes('wstoken=');
        audioUrl = hasToken ? wsUrl : wsUrl + (wsUrl.includes('?') ? '&' : '?') + `token=${token}`;
      }

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
        console.log(`[loadDictationWithRetry]   instanceId ${instanceId}: ${words.length} mots, audio=${audioUrl ? 'oui' : 'non'}`);
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
  courseId: number,
  setListening: (l: ListeningData | null) => void,
  setError: (e: string) => void
) {
  const AUDIO_RE = /\.(mp3|wav|m4a|ogg|opus|aac)(\?|$)/i;
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

      // Récupérer l'URL audio depuis core_course_get_contents
      let audioUrl: string | undefined;
      if (courseId > 0) {
        try {
          const contents = await moodleFetch('/webservice/rest/server.php', {
            wstoken: token,
            wsfunction: 'core_course_get_contents',
            moodlewsrestformat: 'json',
            courseid: courseId,
          });
          if (Array.isArray(contents)) {
            outer: for (const section of contents) {
              for (const mod of section.modules || []) {
                if (mod.modname === 'choice' && (mod.instance === id || mod.id === cmid)) {
                  const allFiles = [...(mod.introfiles || []), ...(mod.contents || [])];
                  const audioFile = allFiles.find((f: any) =>
                    AUDIO_RE.test(f?.filename || '') || AUDIO_RE.test(f?.fileurl || '')
                  );
                  if (audioFile?.fileurl) {
                    const raw = audioFile.fileurl as string;
                    const wsUrl = raw.includes('/webservice/pluginfile.php/')
                      ? raw
                      : raw.replace('/pluginfile.php/', '/webservice/pluginfile.php/');
                    const hasToken = wsUrl.includes('token=') || wsUrl.includes('wstoken=');
                    audioUrl = hasToken ? wsUrl : wsUrl + (wsUrl.includes('?') ? '&' : '?') + `token=${token}`;
                  }
                  break outer;
                }
              }
            }
          }
        } catch {
          if (IS_DEV) console.warn('[loadListeningWithRetry] Failed to fetch audio URL from course contents');
        }
      }

      if (IS_DEV) {
        console.log(`[loadListeningWithRetry] ✅ SUCCESS with ${type}:`, id, `- ${options.length} options, audio=${audioUrl ? 'oui' : 'non'}`);
      }

      const listening: ListeningData = {
        id,
        title: result?.choice?.name || 'Compréhension orale',
        audioUrl,
        question: 'Écoutez et choisissez la bonne réponse',
        options: options.map((o: any) => o.text || ''),
        correctIndex: 0,
      };

      setListening(listening);
      return;
    } catch (err: any) {
      if (IS_DEV) {
        console.error(`[loadListeningWithRetry] Exception with ${type}:`, err.message);
      }
    }
  }

  setError('Impossible de charger cet exercice d\'écoute. Vérifie ta connexion et la configuration du module Moodle.');
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

        // Lancer une tentative pour créer le lesson_timer (requis par mod_lesson_get_page_data)
        if (expectedType === 'wordOrder') {
          const launchResult = await moodleFetch('/webservice/rest/server.php', {
            wstoken: token,
            wsfunction: 'mod_lesson_launch_attempt',
            lessonid: targetLesson.id,
            moodlewsrestformat: 'json',
          });
          if (IS_DEV) {
            if (launchResult?.exception) {
              console.warn(`[loadLessonWithRetry] launch_attempt warning:`, launchResult.message);
            } else {
              console.log(`[loadLessonWithRetry] Attempt launched for lesson:`, targetLesson.id);
            }
          }
        }

        // Charger les pages de la lesson
        let pagesResult = await moodleFetch('/webservice/rest/server.php', {
          wstoken: token,
          wsfunction: 'mod_lesson_get_pages',
          lessonid: targetLesson.id,
          moodlewsrestformat: 'json',
        });

        if (!pagesResult?.exception &&  (pagesResult?.pages?.length ?? 0) > 0) {
          const userPages: any[] = pagesResult.pages;
          const allMissingContent = userPages.every((p: any) => {
            const pg = p.page ?? p;
            return !pg?.contents && !pg?.content && !pg?.title;
          });
          if (allMissingContent) {
            if (IS_DEV) console.log('[loadLessonWithRetry] User token returned no content — retrying with admin token');
            const adminResult = await moodleFetch('/webservice/rest/server.php', {
              wstoken: ADMIN_TOKEN,
              wsfunction: 'mod_lesson_get_pages',
              lessonid: targetLesson.id,
              moodlewsrestformat: 'json',
            });
            if (!adminResult?.exception && (adminResult?.pages?.length ?? 0) > 0) {
              pagesResult = adminResult;
            }
          }
        }

        const pages = pagesResult?.pages || [];

        if (pages && pages.length > 0) {
          if (IS_DEV) console.log(`[loadLessonWithRetry] Found ${pages.length} pages`);

          // Parser les pages en fonction du type attendu
          if (expectedType === 'wordOrder') {
            const sentences: WordOrderSentence[] = [];

            // Strip HTML and decode common HTML entities
            const clean = (s: string) => String(s)
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&[^;]+;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            for (const page of pages.slice(0, 10)) {
              // mod_lesson_get_pages returns { page: {...}, answerids: [...] }
              // In Moodle 4.x, page.contents/title are VALUE_OPTIONAL and omitted for student tokens.
              // We fall back to mod_lesson_get_page_data which is designed for students.
              const pageObj = page.page ?? page;
              const pageId = pageObj?.id;

              let rawContent = pageObj?.contents ?? pageObj?.content ?? '';
              let rawTitle = pageObj?.title ?? '';

              if (!rawContent && pageId) {
                if (IS_DEV) console.log(`[loadLessonWithRetry] contents missing — calling mod_lesson_get_page_data for page ${pageId}`);
                const pageDataResult = await moodleFetch('/webservice/rest/server.php', {
                  wstoken: token,
                  wsfunction: 'mod_lesson_get_page_data',
                  lessonid: targetLesson.id,
                  pageid: pageId,
                  moodlewsrestformat: 'json',
                });

                if (pageDataResult && !pageDataResult.exception) {
                  // page.contents is the raw HTML; pagecontent is the rendered version
                  rawContent = pageDataResult.page?.contents ?? pageDataResult.pagecontent ?? '';
                  rawTitle = pageDataResult.page?.title ?? '';
                  if (IS_DEV) console.log(`[loadLessonWithRetry] page_data:`, {
                    contentsSnippet: String(rawContent).slice(0, 150),
                    title: rawTitle,
                  });
                } else if (IS_DEV) {
                  console.warn(`[loadLessonWithRetry] mod_lesson_get_page_data failed:`, pageDataResult?.message);
                }
              }

              const cleanContent = clean(rawContent) || clean(rawTitle);
              if (!cleanContent) {
                if (IS_DEV) console.warn(`[loadLessonWithRetry] Page ${pageId}: no content after clean`);
                continue;
              }

              // Support pipe/comma separators OR plain whitespace
              let words: string[];
              if (/[|,]/.test(cleanContent)) {
                words = cleanContent.split(/[|,]/).map((w: string) => w.trim()).filter((w: string) => w.length > 0);
              } else {
                words = cleanContent.split(/\s+/).filter((w: string) => w.length > 0);
              }

              if (IS_DEV) console.log(`[loadLessonWithRetry] Page ${pageId} words:`, { cleanContent, words, count: words.length });

              if (words.length >= 2 && words.length <= 20) {
                sentences.push({
                  words,
                  correctOrder: words,
                  translation: cleanContent,
                });
              } else if (IS_DEV) {
                console.warn(`[loadLessonWithRetry] Page ${pageId} skipped: word count=${words.length} (need 2–20)`);
              }
            }

            if (sentences.length > 0) {
              if (IS_DEV) console.log(`[loadLessonWithRetry] ✅ SUCCESS (wordOrder) with lesson:`, targetLesson.id);

              setWordOrder({
                id: targetLesson.id,
                title: targetLesson.name || 'Ordre des mots',
                sentences,
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
    setAssociation(null);
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
  try {
    if (IS_DEV) console.log(`[loadGlossaryWithRetry] Starting:`, { moduleId, instanceId, cmid, courseId });

    // Imports statiques avec fallback
    let resolver;
    try {
      resolver = await import('../services/utils/moodleIdResolver');
    } catch (e) {
      if (IS_DEV) console.error('[loadGlossaryWithRetry] Failed to import moodleIdResolver');
      setError('Erreur de chargement interne');
      return;
    }

    const effectiveCmid = cmid > 0 ? cmid : (moduleId > 0 ? moduleId : instanceId);
    let glossaryInstanceId: number | null = null;
    let glossaryName = 'Glossaire';

    // Première tentative : résoudre via cmid direct
    if (courseId > 0 && effectiveCmid > 0 && resolver.resolveActivityInstanceId) {
      if (IS_DEV) console.log(`[loadGlossaryWithRetry] Resolving cmid:`, effectiveCmid);
      try {
        const resolved = await resolver.resolveActivityInstanceId(courseId, 'glossary', effectiveCmid, token);
        if (resolved) {
          glossaryInstanceId = resolved.instanceId;
          glossaryName = resolved.name || 'Glossaire';
          if (IS_DEV) console.log(`[loadGlossaryWithRetry] Resolved:`, { instanceId: glossaryInstanceId, name: glossaryName });
        }
      } catch (e: any) {
        if (IS_DEV) console.warn(`[loadGlossaryWithRetry] Resolve failed:`, e.message);
      }
    }

    // Deuxième tentative : chercher tous les glossaires du cours
    if (!glossaryInstanceId && courseId > 0 && resolver.getModulesByType) {
      if (IS_DEV) console.log(`[loadGlossaryWithRetry] Fallback: get all glossaries`);
      try {
        const glossaries = await resolver.getModulesByType(courseId, 'glossary', token);
        if (glossaries && glossaries.length > 0) {
          glossaryInstanceId = glossaries[0].instanceId;
          glossaryName = glossaries[0].name;
          if (IS_DEV) console.log(`[loadGlossaryWithRetry] Fallback found:`, { instanceId: glossaryInstanceId, name: glossaryName });
        }
      } catch (e: any) {
        if (IS_DEV) console.warn(`[loadGlossaryWithRetry] Fallback failed:`, e.message);
      }
    }

    // Charger les entrées du glossaire
    if (glossaryInstanceId) {
      if (IS_DEV) console.log(`[loadGlossaryWithRetry] Loading entries:`, glossaryInstanceId);

      let result;
      try {
        result = await moodleFetch('/webservice/rest/server.php', {
          wstoken: token,
          wsfunction: 'mod_glossary_get_entries_by_letter',
          moodlewsrestformat: 'json',
          id: glossaryInstanceId,
          letter: 'ALL',
          from: 0,
          limit: 50,
        });
      } catch (e: any) {
        if (IS_DEV) console.warn(`[loadGlossaryWithRetry] API call failed:`, e.message);
        setError('Erreur de connexion au glossaire');
        return;
      }

      if (result?.exception) {
        if (IS_DEV) console.warn(`[loadGlossaryWithRetry] API error:`, result.message);
        setError(result.message || 'Erreur du glossaire');
        return;
      }

      const entries = result?.entries || [];
      if (IS_DEV) console.log(`[loadGlossaryWithRetry] Entries count:`, entries.length);

      if (entries.length > 0 && resolver.stripHtml) {
        const pairs: AssociationPair[] = entries.map((entry: any) => ({
          word: resolver.stripHtml(entry.concept || ''),
          translation: resolver.stripHtml(entry.definition || ''),
          id: entry.id,
        })).filter((p: AssociationPair) => p.word && p.translation);

        if (pairs.length > 0) {
          if (IS_DEV) console.log(`[loadGlossaryWithRetry] SUCCESS: ${pairs.length} pairs`);
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

    if (IS_DEV) console.warn(`[loadGlossaryWithRetry] No glossary data found`);
    setError('Aucune donnée de glossaire trouvée');

  } catch (err: any) {
    if (IS_DEV) console.error(`[loadGlossaryWithRetry] Fatal error:`, err?.message || err);
    setError('Erreur lors du chargement du glossaire');
  }
}
