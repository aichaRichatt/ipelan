import { useState, useCallback, useEffect } from 'react';
import { moodleFetch } from '../services/api/moodleClient';
import { getAuthToken } from '../services/contentLoader';
import { resolveActivityInstanceId, stripHtml } from '../services/utils/moodleIdResolver';
import { categorizeMoodleError, logActivityFetch, getUserFriendlyError } from '../services/utils/moodleErrorHandler';

const IS_DEV = process.env.NODE_ENV === "development";

const FALLBACK_PAIRS = [
  { word: 'Aboro', translation: 'Bonjour Mock' },
];

export interface AssociationPair {
  word: string;
  translation: string;
  id?: number;
}

export interface AssociationExercise {
  id: number;
  title: string;
  pairs: AssociationPair[];
  courseName?: string;
}

export interface AssociationResult {
  exercise: AssociationExercise | null;
  isLoading: boolean;
  error: string | null;
  userError: string | null;
  refetch: () => Promise<void>;
}

export function useAssociationContent(
  token: string,
  moduleId: number,
  instanceId: number,
  courseId: number,
  cmid?: number
): AssociationResult {
  const [exercise, setExercise] = useState<AssociationExercise | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const fetchAssociationContent = useCallback(async () => {
    const authToken = getAuthToken(token);
    if (!authToken) {
      const err = { type: 'auth' as const, message: 'Token manquant', originalError: null, fallbackUsed: true };
      setUserError(getUserFriendlyError(err));
      loadFallbackPairs();
      return;
    }

    setIsLoading(true);
    setError(null);
    setUserError(null);

    try {
      logActivityFetch('Association', 'START', { moduleId, instanceId, courseId });

      // Step 1: Résoudre cmid → glossary.id
      const effectiveCmid = moduleId > 0 ? moduleId : instanceId;
      let glossaryTitle = 'Association de mots';
      
      if (courseId > 0 && effectiveCmid > 0) {
        const resolved = await resolveActivityInstanceId(
          courseId,
          'glossary',
          effectiveCmid,
          token
        );
        
        if (resolved) {
          glossaryTitle = resolved.name;
          logActivityFetch('Association', 'RESOLVED', {
            cmid: effectiveCmid,
            instanceId: resolved.instanceId,
            name: glossaryTitle
          });

          // Step 2: Charger les entrées du glossaire
          try {
            const entriesResult = await moodleFetch('/webservice/rest/server.php', {
              wstoken: authToken,
              wsfunction: 'mod_glossary_get_entries_by_letter',
              moodlewsrestformat: 'json',
              id: resolved.instanceId,
              letter: 'ALL',
              from: 0,
              limit: 50,
            });

            if (entriesResult?.exception) {
              const moodleError = categorizeMoodleError(entriesResult, 'get_glossary_entries');
              logActivityFetch('Association', 'ENTRIES_ERROR', moodleError);
            } else if (entriesResult?.entries && Array.isArray(entriesResult.entries)) {
              const entries = entriesResult.entries;
              logActivityFetch('Association', 'ENTRIES_LOADED', { count: entries.length });

              if (entries.length > 0) {
                const pairs: AssociationPair[] = entries.map((entry: any) => ({
                  word: stripHtml(entry.concept || ''),
                  translation: stripHtml(entry.definition || ''),
                  id: entry.id,
                }));

                if (pairs.length > 0) {
                  setExercise({
                    id: resolved.instanceId,
                    title: glossaryTitle,
                    pairs: pairs.slice(0, 10),
                    courseName: 'Pulaar',
                  });
                  logActivityFetch('Association', 'SUCCESS', { pairsCount: pairs.length });
                  setIsLoading(false);
                  return;
                }
              }
            }
          } catch (err: any) {
            const moodleError = categorizeMoodleError(err, 'get_glossary_entries');
            logActivityFetch('Association', 'ENTRIES_EXCEPTION', moodleError);
          }
        } else {
          logActivityFetch('Association', 'RESOLVE_FAILED', { cmid: effectiveCmid });
        }
      }

      // Step 3: Fallback sur les paires Pulaar
      logActivityFetch('Association', 'FALLBACK', 'Using Pulaar word pairs');
      loadFallbackPairs();

    } catch (err: any) {
      const moodleError = categorizeMoodleError(err, 'fetch_association');
      logActivityFetch('Association', 'ERROR', moodleError);
      setError(moodleError.message);
      setUserError(getUserFriendlyError(moodleError));
      loadFallbackPairs();
    } finally {
      setIsLoading(false);
    }
  }, [token, moduleId, instanceId, courseId, cmid]);

  function loadFallbackPairs() {
    const shuffledPairs = [...FALLBACK_PAIRS].sort(() => Math.random() - 0.5);
    setExercise({
      id: instanceId || moduleId,
      title: 'Association de mots',
      pairs: shuffledPairs.slice(0, 8),
      courseName: 'Pulaar',
    });
  }

  useEffect(() => {
    fetchAssociationContent();
  }, [fetchAssociationContent]);

  return {
    exercise,
    isLoading,
    error,
    userError,
    refetch: fetchAssociationContent,
  };
}

export default useAssociationContent;