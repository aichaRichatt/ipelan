import * as SecureStore from 'expo-secure-store';
import { moodleFetch } from '../api/moodleClient';
import { getAllScoresForCourse, markActivitySynced } from '../storage/activity-progress';
import { updateCourseProgressFromActivities } from '../storage/course-progress';

const IS_DEV = process.env.NODE_ENV === 'development';

export interface MoodleCompletionStatus {
  cmid: number;
  module: string;
  instance: number;
  completionstate: number;
  timemodified: number;
}

export interface MoodleQuizAttempt {
  id: number;
  quiz: number;
  userid: number;
  attemptnum: number;
  state: number;
  sumgrades: number;
  timemodified: number;
  timestart: number;
  timefinish: number;
}

export interface SyncResult {
  success: boolean;
  syncedActivities: number;
  syncedScores: number;
  errors: string[];
}

async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('auth_token');
  } catch {
    return null;
  }
}

export const checkInternetConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors'
    });
    return response.ok || response.type === 'opaque';
  } catch {
    return false;
  }
};

export const syncCourseCompletion = async (
  token: string,
  courseId: number
): Promise<MoodleCompletionStatus[]> => {
  if (IS_DEV) console.log('[ProgressSync] Syncing completion for course:', courseId);

  try {
    const params = {
      wstoken: token,
      wsfunction: 'core_completion_get_course_completion_status',
      courseid: courseId,
      moodlewsrestformat: 'json',
    };

    const result = await moodleFetch('/webservice/rest/server.php', params, 'POST');

    if (result?.exception) {
      if (IS_DEV) console.warn('[ProgressSync] Completion API error:', result.message);
      return [];
    }

    const statuses: MoodleCompletionStatus[] = [];
    if (result?.statuses && Array.isArray(result.statuses)) {
      for (const s of result.statuses) {
        if (s.cmid) {
          statuses.push({
            cmid: s.cmid,
            module: s.module || '',
            instance: s.instance,
            completionstate: s.completionstate,
            timemodified: s.timemodified,
          });
        }
      }
    }

    if (IS_DEV) console.log('[ProgressSync] Completion statuses:', statuses.length);
    return statuses;
  } catch (error) {
    if (IS_DEV) console.error('[ProgressSync] Failed to sync completion:', error);
    return [];
  }
};

export const syncQuizScores = async (
  token: string,
  quizInstanceId: number
): Promise<MoodleQuizAttempt[]> => {
  if (IS_DEV) console.log('[ProgressSync] Syncing quiz scores for:', quizInstanceId);

  try {
    const params = {
      wstoken: token,
      wsfunction: 'mod_quiz_get_user_attempts',
      quizid: quizInstanceId,
      status: 'all',
      moodlewsrestformat: 'json',
    };

    const result = await moodleFetch('/webservice/rest/server.php', params, 'POST');

    if (result?.exception) {
      if (IS_DEV) console.warn('[ProgressSync] Quiz attempts API error:', result.message);
      return [];
    }

    const attempts: MoodleQuizAttempt[] = [];
    if (result?.attempts && Array.isArray(result.attempts)) {
      for (const a of result.attempts) {
        attempts.push({
          id: a.id,
          quiz: a.quiz,
          userid: a.userid,
          attemptnum: a.attemptnum,
          state: a.state,
          sumgrades: a.sumgrades || 0,
          timemodified: a.timemodified,
          timestart: a.timestart,
          timefinish: a.timefinish,
        });
      }
    }

    if (IS_DEV) console.log('[ProgressSync] Quiz attempts:', attempts.length);
    return attempts;
  } catch (error) {
    if (IS_DEV) console.error('[ProgressSync] Failed to sync quiz scores:', error);
    return [];
  }
};

export const getBestQuizAttempt = (
  attempts: MoodleQuizAttempt[],
  totalGrade: number
): { bestScore: number; total: number } => {
  if (!attempts || attempts.length === 0) {
    return { bestScore: 0, total: totalGrade };
  }

  let bestScore = 0;
  for (const attempt of attempts) {
    if (attempt.state === 2 && attempt.sumgrades > bestScore) {
      bestScore = attempt.sumgrades;
    }
  }

  return { bestScore, total: totalGrade };
};

export const syncCourseProgress = async (
  token: string,
  courseId: number,
  totalActivities: number
): Promise<SyncResult> => {
  const result: SyncResult = {
    success: false,
    syncedActivities: 0,
    syncedScores: 0,
    errors: [],
  };

  try {
    const isConnected = await checkInternetConnection();
    if (!isConnected) {
      if (IS_DEV) console.log('[ProgressSync] No internet connection, skipping sync');
      result.errors.push('Pas de connexion internet');
      return result;
    }

    const localScores = await getAllScoresForCourse(courseId);
    const completionStatuses = await syncCourseCompletion(token, courseId);

    if (completionStatuses.length > 0) {
      result.syncedActivities = completionStatuses.filter(
        (s) => s.completionstate === 2
      ).length;
    }

    for (const [moduleId] of localScores) {
      const completion = completionStatuses.find(
        (c) => c.instance === moduleId || c.cmid === moduleId
      );
      if (completion) {
        result.syncedActivities++;
      }
    }

    await updateCourseProgressFromActivities(courseId, totalActivities);

    result.success = true;
    if (IS_DEV)
      console.log('[ProgressSync] Sync completed:', {
        activities: result.syncedActivities,
        scores: result.syncedScores,
      });
  } catch (error: any) {
    if (IS_DEV) console.error('[ProgressSync] Sync failed:', error);
    result.errors.push(error.message || 'Erreur de synchronisation');
  }

  return result;
};

export const syncAfterActivity = async (
  moduleId: number,
  courseId: number,
  activityType: string,
  score: number,
  total: number,
  xpEarned: number,
  instanceId: number,
  tokenParam?: string,
  userId?: number
): Promise<void> => {
  console.log('[ProgressSync] ========== START SYNC ==========');
  console.log('[ProgressSync] Params:', { moduleId, instanceId, courseId, activityType, score, total, xpEarned, userId });

  if (!moduleId || moduleId === 0) {
    console.log('[ProgressSync] ❌ Invalid moduleId, skipping sync');
    return;
  }

  try {
    const isConnected = await checkInternetConnection();
    console.log('[ProgressSync] Connection status:', isConnected);
    if (!isConnected) {
      console.log('[ProgressSync] ❌ Offline, skipping Moodle sync');
      return;
    }

    const token = tokenParam || await getStoredToken();
    console.log('[ProgressSync] Token available:', !!token);
    if (!token) {
      console.log('[ProgressSync] ❌ No token, cannot sync to Moodle');
      return;
    }

    console.log('[ProgressSync] ✅ Online, syncing to Moodle...');

    const quizId = activityType === 'quiz' ? instanceId : moduleId;

    if (activityType === 'quiz') {
      const attempts = await syncQuizScores(token, quizId);
      console.log('[ProgressSync] Quiz attempts synced:', attempts.length);
    }

    console.log('[ProgressSync] Updating completion for cmid:', moduleId);
    const completionResult = await updateActivityCompletion(token, moduleId, true);
    console.log('[ProgressSync] Completion update result:', completionResult);

    const gradePercent = total > 0 ? (score / total) * 100 : 0;
    console.log('[ProgressSync] Updating grade:', gradePercent, '% for instanceId:', instanceId, '(cmid:', moduleId, ')');
    const gradeResult = await updateActivityGrade(token, courseId, moduleId, instanceId, gradePercent, activityType, userId);
    console.log('[ProgressSync] Grade update result:', gradeResult);

    // ✅ Mark as synced to prevent duplicate submissions
    await markActivitySynced(moduleId, courseId);
    console.log('[ProgressSync] ✅ Marked as synced');

    console.log('[ProgressSync] ========== SYNC COMPLETE ==========');

  } catch (error) {
    console.error('[ProgressSync] ❌ Sync failed:', error);
  }
};

export const updateActivityCompletion = async (
  token: string,
  cmId: number,
  completed: boolean
): Promise<boolean> => {
  console.log('[ProgressSync] updateActivityCompletion called:', { cmId, completed });

  try {
    const params = {
      wstoken: token,
      wsfunction: 'core_completion_update_activity_completion_status_manually',
      cmid: Number(cmId),
      completed: completed ? 1 : 0,
      moodlewsrestformat: 'json'
    };

    console.log('[ProgressSync] Completion API params:', JSON.stringify(params));
    console.log('[ProgressSync] Calling completion API...');
    const result = await moodleFetch('/webservice/rest/server.php', params, 'POST');
    console.log('[ProgressSync] Completion API result:', JSON.stringify(result));

    if (result?.exception) {
      console.warn('[ProgressSync] ❌ Completion update failed:', result.message, result.exception);
      return false;
    }

    if (result?.status === 0 || result?.status === false) {
      console.warn('[ProgressSync] ❌ Completion update returned status 0');
      return false;
    }

    console.log('[ProgressSync] ✅ Completion updated successfully');
    return true;
  } catch (error) {
    if (IS_DEV) console.error('[ProgressSync] Failed to update completion:', error);
    return false;
  }
};

export const updateActivityGrade = async (
  token: string,
  courseId: number,
  moduleId: number,
  instanceId: number,
  grade: number,
  activityType: string,
  userId?: number
): Promise<boolean> => {
  console.log('[ProgressSync] updateActivityGrade called:', { courseId, moduleId, instanceId, grade, activityType, userId });

  // Map activity type to Moodle component
  const componentMap: Record<string, string> = {
    'quiz': 'mod_quiz',
    'dictation': 'mod_assign',
    'assign': 'mod_assign',
    'assignment': 'mod_assign',
    'lesson': 'mod_lesson',
    'choice': 'mod_choice',
    'listening': 'mod_choice',
    'association': 'mod_lesson',
    'wordOrder': 'mod_lesson',
  };

  const component = componentMap[activityType] || 'mod_grade';

  // For choice/lesson activities, instanceId from Moodle is often wrong (1).
  // Use moduleId (cmid) as activityid for grade updates.
  const activityId = instanceId === 1 ? moduleId : instanceId;
  console.log('[ProgressSync] Using activityId for grade:', activityId, '(moduleId:', moduleId, ', instanceId:', instanceId, ')');

  try {
    const params: any = {
      wstoken: token,
      wsfunction: 'core_grades_update_grades',
      source: 'ipelan_app',
      component: component,
      courseid: courseId,
      'grades[0][activityid]': activityId,
      'grades[0][rawgrade]': grade,
      moodlewsrestformat: 'json',
    };

    // ✅ CRITICAL: Add userid to prevent grade assignment errors
    if (userId) {
      params['grades[0][userid]'] = userId;
    }

    console.log('[ProgressSync] Calling core_grades_update_grades with params:', JSON.stringify(params));

    const result = await moodleFetch('/webservice/rest/server.php', params, 'POST');
    console.log('[ProgressSync] Grade API result:', JSON.stringify(result));

    if (result?.exception) {
      console.warn('[ProgressSync] ❌ Grade update failed:', result.message);
      return false;
    }

    console.log('[ProgressSync] ✅ Grade updated successfully');
    return true;
  } catch (error) {
    console.error('[ProgressSync] ❌ Failed to update grade:', error);
    return false;
  }
};

export const batchSyncAllCourses = async (
  token: string,
  courseProgressMap: Map<number, number>
): Promise<{ synced: number; failed: number }> => {
  let synced = 0;
  let failed = 0;

  try {
    const isConnected = await checkInternetConnection();
    if (!isConnected) {
      return { synced: 0, failed: 0 };
    }

    for (const [courseId, totalActivities] of courseProgressMap) {
      try {
        const result = await syncCourseProgress(token, courseId, totalActivities);
        if (result.success) {
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
  } catch (error) {
    if (IS_DEV) console.error('[ProgressSync] Batch sync failed:', error);
  }

  return { synced, failed };
};

/**
 * Sync user's total XP to Moodle custom field 'ipelan_xp'
 */
export const syncUserXPToMoodle = async (
  token: string,
  userId: number,
  totalXP: number
): Promise<boolean> => {
  try {
    console.log('[ProgressSync] Syncing XP:', totalXP, 'for user:', userId);

    // Format data correctly for Moodle's x-www-form-urlencoded requirements
    // This will be flattened by moodleFetch to: users[0][id]=X&users[0][customfields][0][type]=...
    const params = {
      wstoken: token,
      wsfunction: 'core_user_update_users',
      users: [
        {
          id: userId,
          customfields: [
            {
              type: 'ipelan_xp',
              value: String(totalXP),
            },
          ],
        },
      ],
      moodlewsrestformat: 'json',
    };

    const result = await moodleFetch('/webservice/rest/server.php', params, 'POST');

    if (result?.exception) {
      console.warn('[ProgressSync] ❌ XP sync failed:', result.message);
      return false;
    }

    console.log('[ProgressSync] ✅ XP synced successfully');
    return true;
  } catch (error) {
    console.error('[ProgressSync] Failed to sync XP:', error);
    return false;
  }
};

/**
 * Sync activity with automatic retry on failure
 * Uses exponential backoff: 1s, 2s, 4s
 */
export const syncAfterActivityWithRetry = async (
  moduleId: number,
  courseId: number,
  activityType: string,
  score: number,
  total: number,
  xpEarned: number,
  instanceId: number,
  maxRetries: number = 3,
  tokenParam?: string,
  userId?: number
): Promise<{ success: boolean; attempts: number; error?: string }> => {
  let lastError: any = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;
    try {
      console.log(`[ProgressSync] ⏳ Attempt ${attempt}/${maxRetries}`);

      await syncAfterActivity(
        moduleId,
        courseId,
        activityType,
        score,
        total,
        xpEarned,
        instanceId,
        tokenParam,
        userId
      );

      console.log('[ProgressSync] ✅ Sync succeeded');
      return { success: true, attempts };
    } catch (error) {
      lastError = error;
      console.warn(`[ProgressSync] ❌ Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`[ProgressSync] ⏳ Waiting ${delayMs}ms before retry...`);

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error(
    '[ProgressSync] ❌ Sync failed after',
    maxRetries,
    'attempts:',
    lastError
  );

  return {
    success: false,
    attempts,
    error: lastError?.message || 'Unknown error',
  };
};