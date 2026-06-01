import { useCallback, useEffect, useRef, useState } from 'react';
import { moodleFetch } from '../services/api/moodleClient';
import { categorizeMoodleError, getUserFriendlyError, logActivityFetch } from '../services/utils/moodleErrorHandler';
import { convertFileUrlForAuth, resolveActivityInstanceId } from '../services/utils/moodleIdResolver';
import { shuffle } from '../utils/shuffle';

export interface ListeningExercise {
  id: number;
  word: string;
  translation: string;
  audioUrl?: string;
  options: string[];
  correctIndex: number;
  courseName?: string;
}

export interface ListeningResult {
  exercises: ListeningExercise[];
  isLoading: boolean;
  error: string | null;
  userError: string | null;
  audioUrl: string | null;
  refetch: () => Promise<void>;
}

export function useListeningContent(
  token: string,
  moduleId: number,
  instanceId: number,
  courseId: number,
  cmid?: number
): ListeningResult {
  const [exercises, setExercises] = useState<ListeningExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

const fetchListeningContent = useCallback(async () => {
    const authToken = token;
    if (!authToken) {
      const err = { type: 'auth' as const, message: 'Token manquant', originalError: null, fallbackUsed: true };
      setUserError(getUserFriendlyError(err));
      setError('Aucun token authentication');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setUserError(null);

    try {
      logActivityFetch('Listening', 'START', { moduleId, instanceId, courseId });

      const effectiveCmid = moduleId > 0 ? moduleId : instanceId;
      let choiceAudioUrl: string | undefined;
      let resolvedModule: { instanceId: number; name: string; audioUrl?: string } | null = null;

      if (courseId > 0 && effectiveCmid > 0) {
        const resolved = await resolveActivityInstanceId(
          courseId,
          'choice',
          effectiveCmid,
          token
        );

        if (resolved) {
          resolvedModule = resolved;
          choiceAudioUrl = resolved.audioUrl;
          if (choiceAudioUrl) {
            setAudioUrl(convertFileUrlForAuth(choiceAudioUrl, authToken));
          }
          logActivityFetch('Listening', 'RESOLVED', {
            cmid: effectiveCmid,
            instanceId: resolved.instanceId,
            name: resolved.name,
            hasAudio: !!choiceAudioUrl
          });
        } else {
          logActivityFetch('Listening', 'RESOLVE_FAILED', { cmid: effectiveCmid });
        }
      }

      // Step 2: Charger les options du Choice
      let choiceExercises: ListeningExercise[] = [];

      if (resolvedModule?.instanceId) {
        let options: string[] = [];
        
        // Première tentative: via API standard
        try {
          const choiceOptions = await moodleFetch('/webservice/rest/server.php', {
            wstoken: authToken,
            wsfunction: 'mod_choice_get_choice_options',
            moodlewsrestformat: 'json',
            choiceid: resolvedModule.instanceId,
          });

          if (choiceOptions?.options && Array.isArray(choiceOptions.options)) {
            options = choiceOptions.options
              .filter((o: any) => o.enabled !== false)
              .map((o: any) => stripHtml(o.text || String(o.id)));
            logActivityFetch('Listening', 'OPTIONS_LOADED', { count: options.length });
          }
        } catch (apiErr: any) {
          logActivityFetch('Listening', 'API_ERROR', apiErr.message);
        }

        // Deuxième tentative: via mod_choice_view_choice (alternative)
        if (options.length < 2) {
          try {
            const viewResult = await moodleFetch('/webservice/rest/server.php', {
              wstoken: authToken,
              wsfunction: 'mod_choice_view_choice',
              moodlewsrestformat: 'json',
              choiceid: resolvedModule.instanceId,
            });

            if (viewResult?.options) {
              options = viewResult.options.map((o: any) => stripHtml(o.text || o.name || String(o.id)));
              logActivityFetch('Listening', 'FROM_VIEW', { count: options.length });
            }
          } catch (viewErr: any) {
            logActivityFetch('Listening', 'VIEW_ERROR', viewErr.message);
          }
        }

        // Troisième tentative: via contents du cours
        if (options.length < 2) {
          try {
            const contents = await moodleFetch('/webservice/rest/server.php', {
              wstoken: authToken,
              wsfunction: 'core_course_get_contents',
              moodlewsrestformat: 'json',
              courseid: courseId,
              options: [{ name: 'includemodules', value: 1 }],
            });
            
            for (const section of Array.isArray(contents) ? contents : [contents]) {
              for (const mod of section.modules || []) {
                if (mod.modname === 'choice' && mod.instance === resolvedModule.instanceId) {
                  if (mod.contents?.length > 0) {
                    const file = mod.contents.find((f: any) => f?.filename?.endsWith('.xml'));
                    if (file) {
                      logActivityFetch('Listening', 'FOUND_FILE', { file: file.filename });
                    }
                  }
                  break;
                }
              }
            }
          } catch (contentsErr: any) {
            logActivityFetch('Listening', 'CONTENTS_ERROR', contentsErr.message);
          }
        }

        // Générer les exercices si on a des options (max 10 pour éviter session trop longue)
        const MAX_EXERCISES = 10;
        if (options.length >= 2) {
          const exerciseOptions = options.slice(0, MAX_EXERCISES);
          choiceExercises = exerciseOptions.map((option: string, index: number) => {
            const wrongOptions = shuffle(
              options.filter((_: string, i: number) => i !== index)
            ).slice(0, Math.min(3, options.length - 1));

            const allOptions = shuffle([option, ...wrongOptions]);
            const correctIndex = allOptions.indexOf(option);
            
            return {
              id: index + 1,
              word: resolvedModule?.name || 'Écoute',
              translation: option,
              audioUrl: choiceAudioUrl ? convertFileUrlForAuth(choiceAudioUrl, authToken) : undefined,
              options: allOptions,
              correctIndex,
              courseName: resolvedModule?.name || 'Pulaar',
            };
          });
        }
      }

      // Step 3: Si pas d'options, afficher erreur Moodle
      if (!isMountedRef.current) return;

      if (choiceExercises.length > 0) {
        setExercises(choiceExercises);
        logActivityFetch('Listening', 'SUCCESS', { count: choiceExercises.length });
      } else {
        const errMsg = resolvedModule?.instanceId
          ? "Impossible de charger les options du sondage. Permissions insuffisantes."
          : "Module de choix non trouvé.";
        setUserError(errMsg);
        setError(errMsg);
        logActivityFetch('Listening', 'NO_OPTIONS', errMsg);
      }

    } catch (err: any) {
      if (!isMountedRef.current) return;
      const moodleError = categorizeMoodleError(err, 'fetch_listening');
      logActivityFetch('Listening', 'ERROR', moodleError);
      setError(moodleError.message);
      setUserError(getUserFriendlyError(moodleError));
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [token, moduleId, instanceId, courseId]);

  function stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  useEffect(() => {
    fetchListeningContent();
  }, [fetchListeningContent]);

  return {
    exercises,
    isLoading,
    error,
    userError,
    audioUrl,
    refetch: fetchListeningContent,
  };
}

export default useListeningContent;