import { useState, useCallback, useEffect } from 'react';
import { moodleFetch } from '../services/api/moodleClient';
import { getAuthToken } from '../services/contentLoader';
import { resolveActivityInstanceId, stripHtml } from '../services/utils/moodleIdResolver';
import { categorizeMoodleError, logActivityFetch, getUserFriendlyError } from '../services/utils/moodleErrorHandler';

const IS_DEV = process.env.NODE_ENV === "development";

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
      setError('Aucun token authentication');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setUserError(null);

    try {
      logActivityFetch('Association', 'START', { moduleId, instanceId, courseId });

      const effectiveCmid = moduleId > 0 ? moduleId : instanceId;
      let glossaryInstanceId = instanceId;

      if (courseId > 0 && effectiveCmid > 0) {
        const resolved = await resolveActivityInstanceId(
          courseId,
          'glossary',
          effectiveCmid,
          token
        );

        if (resolved) {
          glossaryInstanceId = resolved.instanceId;
          logActivityFetch('Association', 'RESOLVED', {
            cmid: effectiveCmid,
            instanceId: glossaryInstanceId,
            name: resolved.name
          });
        }
      }

      if (!glossaryInstanceId) {
        const errMsg = "Glossary non trouvé dans ce cours.";
        setError(errMsg);
        setUserError(errMsg);
        return;
      }

      const glossaryResult = await moodleFetch('/webservice/rest/server.php', {
        wstoken: authToken,
        wsfunction: 'mod_glossary_get_entries_by_letter',
        moodlewsrestformat: 'json',
        glossaryid: glossaryInstanceId,
        letter: 'ALL',
      });

      if (glossaryResult?.exception) {
        logActivityFetch('Association', 'ENTRIES_ERROR', glossaryResult.message);
        const moodleError = categorizeMoodleError(glossaryResult, 'fetch_association');
        setError(moodleError.message);
        setUserError(getUserFriendlyError(moodleError));
        return;
      }

      const entries = glossaryResult?.entries || [];
      
      const pairs: AssociationPair[] = [];
      
      for (const entry of entries) {
        if (entry.concept && entry.definition) {
          pairs.push({
            id: entry.id,
            word: stripHtml(entry.concept),
            translation: stripHtml(entry.definition),
          });
        }
      }

      if (pairs.length === 0) {
        const errMsg = "Aucune entrée de glossaire trouvée.";
        setError(errMsg);
        setUserError(errMsg);
        logActivityFetch('Association', 'NO_ENTRIES', errMsg);
        return;
      }

      setExercise({
        id: glossaryInstanceId,
        title: 'Associations',
        pairs,
        courseName: 'Glossary',
      });

      logActivityFetch('Association', 'SUCCESS', { count: pairs.length });

    } catch (err: any) {
      const moodleError = categorizeMoodleError(err, 'fetch_association');
      logActivityFetch('Association', 'ERROR', moodleError);
      setError(moodleError.message);
      setUserError(getUserFriendlyError(moodleError));
    } finally {
      setIsLoading(false);
    }
  }, [token, moduleId, instanceId, courseId]);

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