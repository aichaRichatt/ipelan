import { useCallback, useEffect, useState } from 'react';
import { moodleFetch } from '../services/api/moodleClient';
import { getAuthToken } from '../services/contentLoader';
import { categorizeMoodleError, getUserFriendlyError, logActivityFetch } from '../services/utils/moodleErrorHandler';
import { convertFileUrlForAuth, resolveActivityInstanceId } from '../services/utils/moodleIdResolver';

const PULAAR_WORDS = [
  { word: 'Aboro', translation: 'Bonjour' },
  { word: 'Maas', translation: 'Merci' },
  { word: 'Nde', translation: 'Oui' },
  { word: 'Alelu', translation: 'Non' },
  { word: 'Ndeerka', translation: 'Comment allez-vous?' },
  { word: 'Yaaya', translation: 'Mère' },
  { word: 'Baaba', translation: 'Père' },
  { word: 'Kerde', translation: 'Eau' },
  { word: 'Ndimball', translation: 'Pain' },
  { word: 'Sey', translation: 'Maison' },
  { word: 'Yidda', translation: 'Ami' },
  { word: 'Skol', translation: 'École' },
  { word: 'Lifnde', translation: 'Livre' },
  { word: 'Tottom', translation: 'Main' },
  { word: 'Lok', translation: 'Pied' },
  { word: 'Hoore', translation: 'Cheval' },
  { word: 'Boggol', translation: 'Chien' },
  { word: 'Malalam', translation: 'Chat' },
  { word: 'Joonkil', translation: 'Oiseau' },
  { word: 'Ko', translation: 'Tête' },
];

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
  courseId: number
): ListeningResult {
  const [exercises, setExercises] = useState<ListeningExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const fetchListeningContent = useCallback(async () => {
    const authToken = getAuthToken(token);
    if (!authToken) {
      const err = { type: 'auth' as const, message: 'Token manquant', originalError: null, fallbackUsed: true };
      setUserError(getUserFriendlyError(err));
      loadFallbackExercises();
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
        try {
          const choiceOptions = await moodleFetch('/webservice/rest/server.php', {
            wstoken: authToken,
            wsfunction: 'mod_choice_get_choice_options',
            moodlewsrestformat: 'json',
            choiceid: resolvedModule.instanceId,
          });

          if (choiceOptions?.exception) {
            const moodleError = categorizeMoodleError(choiceOptions, 'get_choice_options');
            logActivityFetch('Listening', 'OPTIONS_ERROR', moodleError);
          } else if (choiceOptions?.options && Array.isArray(choiceOptions.options)) {
            const options = choiceOptions.options
              .filter((o: any) => o.enabled !== false)
              .map((o: any) => stripHtml(o.text || String(o.id)));

            logActivityFetch('Listening', 'OPTIONS_LOADED', { count: options.length });

            if (options.length >= 2) {
              choiceExercises = options.map((option: string, index: number) => {
                const wrongOptions = options
                  .filter((_, i) => i !== index)
                  .sort(() => Math.random() - 0.5)
                  .slice(0, 3);
                
                const allOptions = [option, ...wrongOptions].sort(() => Math.random() - 0.5);
                const correctIndex = allOptions.indexOf(option);
                
                return {
                  id: index + 1,
                  word: resolvedModule?.name || 'Écoute',
                  translation: option,
                  audioUrl: choiceAudioUrl ? convertFileUrlForAuth(choiceAudioUrl, authToken) : undefined,
                  options: allOptions,
                  correctIndex,
                  courseName: 'Pulaar',
                };
              });
            }
          }
        } catch (err: any) {
          const moodleError = categorizeMoodleError(err, 'get_choice_options');
          logActivityFetch('Listening', 'OPTIONS_EXCEPTION', moodleError);
        }
      }

      // Step 3: Utiliser les exercices Choice ou générer des fallback
      if (choiceExercises.length > 0) {
        setExercises(choiceExercises);
        logActivityFetch('Listening', 'SUCCESS', { fromChoice: true, count: choiceExercises.length });
      } else {
        logActivityFetch('Listening', 'FALLBACK', 'Generating from Pulaar words');
        loadFallbackExercises(choiceAudioUrl);
      }

    } catch (err: any) {
      const moodleError = categorizeMoodleError(err, 'fetch_listening');
      logActivityFetch('Listening', 'ERROR', moodleError);
      setError(moodleError.message);
      setUserError(getUserFriendlyError(moodleError));
      loadFallbackExercises();
    } finally {
      setIsLoading(false);
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

  function loadFallbackExercises(existingAudioUrl?: string) {
    const shuffledWords = [...PULAAR_WORDS].sort(() => Math.random() - 0.5);
    const selectedWords = shuffledWords.slice(0, 5);

    const fallback = selectedWords.map((wordData, index) => {
      const wrongOptions = PULAAR_WORDS
        .filter(w => w.translation !== wordData.translation)
        .map(w => w.translation)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      const allOptions = [wordData.translation, ...wrongOptions].sort(() => Math.random() - 0.5);
      const correctIndex = allOptions.indexOf(wordData.translation);

      return {
        id: index + 1,
        word: wordData.word,
        translation: wordData.translation,
        audioUrl: existingAudioUrl,
        options: allOptions,
        correctIndex,
        courseName: 'Pulaar',
      };
    });

    setExercises(fallback);
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