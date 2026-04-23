/**
 * useDictation - Hook pour charger et gérer les dictées audio Moodle
 * 
 * Flux complet:
 * 1. Résoudre cmid → assign.id (instance ID)
 * 2. Extraire l'URL audio de introfiles
 * 3. Charger les infos du devoir
 * 4. Fallback sur mots Pulaar si erreur
 */

import { useState, useCallback, useEffect } from 'react';
import { moodleFetch } from '../services/api/moodleClient';
import { getAuthToken } from '../services/contentLoader';
import { resolveActivityInstanceId, convertFileUrlForAuth, stripHtml } from '../services/utils/moodleIdResolver';
import { categorizeMoodleError, logActivityFetch, getUserFriendlyError } from '../services/utils/moodleErrorHandler';

const IS_DEV = process.env.NODE_ENV === "development";

const DICTATION_WORDS = [
  { word: 'Aboro', hint: 'Salutation', translation: 'Bonjour' },
  { word: 'Maas', hint: 'Politesse', translation: 'Merci' },
  { word: 'Nde', hint: 'Réponse affirmative', translation: 'Oui' },
  { word: 'Alelu', hint: 'Négation', translation: 'Non' },
  { word: 'Yaaya', hint: 'Famille', translation: 'Mère' },
  { word: 'Baaba', hint: 'Famille', translation: 'Père' },
  { word: 'Yidda', hint: 'Relations', translation: 'Ami' },
  { word: 'Sey', hint: 'Lieu', translation: 'Maison' },
  { word: 'Kerde', hint: 'Nécessité', translation: 'Eau' },
  { word: 'Skol', hint: 'Éducation', translation: 'École' },
];

export interface DictationWord {
  word: string;
  hint?: string;
  translation?: string;
  audioUrl?: string;
}

export interface DictationExercise {
  id: number;
  title: string;
  words: DictationWord[];
  audioUrl?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface DictationResult {
  exercise: DictationExercise | null;
  isLoading: boolean;
  error: string | null;
  userError: string | null;
  refetch: () => Promise<void>;
}

export function useDictationContent(
  token: string,
  moduleId: number,
  instanceId: number,
  courseId: number,
  cmid?: number
): DictationResult {
  const [exercise, setExercise] = useState<DictationExercise | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const fetchDictationContent = useCallback(async () => {
    const authToken = getAuthToken(token);
    if (!authToken) {
      const err = { type: 'auth' as const, message: 'Token manquant', originalError: null, fallbackUsed: true };
      setUserError(getUserFriendlyError(err));
      loadFallbackExercise();
      return;
    }

    setIsLoading(true);
    setError(null);
    setUserError(null);

    try {
      logActivityFetch('Dictation', 'START', { moduleId, instanceId, courseId });

      // Step 1: Résoudre cmid → assign.id
      const effectiveCmid = moduleId > 0 ? moduleId : instanceId;
      let audioUrl: string | undefined;
      let dictationTitle = 'Dictée audio';
      
      if (courseId > 0 && effectiveCmid > 0) {
        const resolved = await resolveActivityInstanceId(
          courseId,
          'assign',
          effectiveCmid,
          token
        );
        
        if (resolved) {
          dictationTitle = resolved.name;
          logActivityFetch('Dictation', 'RESOLVED', {
            cmid: effectiveCmid,
            instanceId: resolved.instanceId,
            name: dictationTitle
          });

          // Step 2: Charger les assignments pour extraire l'audio
          try {
            const assignResult = await moodleFetch('/webservice/rest/server.php', {
              wstoken: authToken,
              wsfunction: 'mod_assign_get_assignments',
              moodlewsrestformat: 'json',
              'courseids[0]': courseId,
            });

            if (assignResult?.exception) {
              const moodleError = categorizeMoodleError(assignResult, 'get_assignments');
              logActivityFetch('Dictation', 'ASSIGN_ERROR', moodleError);
            } else if (assignResult?.assignments) {
              const assignment = assignResult.assignments.find(
                (a: any) => a.id === resolved.instanceId
              );
              
              if (assignment) {
                // Extraire l'URL audio depuis introfiles
                const introFiles = assignment.introfiles || [];
                const audioFile = introFiles.find((f: any) => 
                  f.filename?.match(/\.(mp3|wav|m4a|ogg)$/i)
                );
                
                if (audioFile?.fileurl) {
                  audioUrl = convertFileUrlForAuth(audioFile.fileurl, authToken);
                  logActivityFetch('Dictation', 'AUDIO_FOUND', audioFile.filename);
                } else {
                  // Chercher dans le contenu HTML de intro
                  const htmlAudioMatch = (assignment.intro || '').match(
                    /src=["']([^"']*(?:mp3|wav|m4a|ogg)[^"']*)["']/i
                  );
                  if (htmlAudioMatch) {
                    audioUrl = convertFileUrlForAuth(htmlAudioMatch[1], authToken);
                    logActivityFetch('Dictation', 'AUDIO_HTML', audioUrl);
                  }
                }

                // Vérifier s'il y a des mots à dicter dans l'intro
                const introText = stripHtml(assignment.intro || '');
                if (introText && introText.length > 0) {
                  logActivityFetch('Dictation', 'INTRO', introText.slice(0, 100));
                }
              }
            }
          } catch (err: any) {
            const moodleError = categorizeMoodleError(err, 'get_assignments');
            logActivityFetch('Dictation', 'ASSIGN_EXCEPTION', moodleError);
          }
        } else {
          logActivityFetch('Dictation', 'RESOLVE_FAILED', { cmid: effectiveCmid });
        }
      }

      // Step 3: Créer l'exercice avec les données extraites ou fallback
      if (audioUrl) {
        setExercise({
          id: instanceId || moduleId,
          title: dictationTitle,
          words: DICTATION_WORDS.slice(0, 5).map(w => ({
            ...w,
            audioUrl
          })),
          audioUrl,
          difficulty: 'medium',
        });
        logActivityFetch('Dictation', 'SUCCESS', { hasAudio: true });
      } else {
        logActivityFetch('Dictation', 'FALLBACK', 'No audio found');
        loadFallbackExercise();
      }

    } catch (err: any) {
      const moodleError = categorizeMoodleError(err, 'fetch_dictation');
      logActivityFetch('Dictation', 'ERROR', moodleError);
      setError(moodleError.message);
      setUserError(getUserFriendlyError(moodleError));
      loadFallbackExercise();
    } finally {
      setIsLoading(false);
    }
  }, [token, moduleId, instanceId, courseId, cmid]);

  function loadFallbackExercise() {
    setExercise({
      id: instanceId || moduleId,
      title: 'Dictée audio',
      words: DICTATION_WORDS.map(w => ({ ...w })),
      difficulty: 'medium',
    });
  }

  useEffect(() => {
    fetchDictationContent();
  }, [fetchDictationContent]);

  return {
    exercise,
    isLoading,
    error,
    userError,
    refetch: fetchDictationContent,
  };
}

export default useDictationContent;