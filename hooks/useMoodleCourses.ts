// hooks/useMoodleCourses.ts
import { useState, useEffect, useCallback } from 'react';
import { moodleCall } from '../services/api/moodleClient';
import { getToken } from '../services/storage/tokenStorage';
import { useStreak } from '../services/storage/streak';
import { getAllBadgesWithStatus } from '../constants/badges';
import { getDBConnection } from '../services/storage/db-service';

export interface CourseProgress {
  courseId:           number;
  courseName:         string;
  completedActivities: number;
  totalActivities:    number;
  completionPercent:  number;
  totalXP:            number;
  perfectScores:      number;
  breakdown: Record<string, { completed: number; total: number }>;
}

export interface CourseInput {
  id: number;
  name?: string;
}

const EXCLUDED_MODNAMES = new Set(['label']);
const XP_PER_ACTIVITY = 20;

function calculateXP(score: number, maxScore: number, baseXP: number = XP_PER_ACTIVITY): number {
  if (!maxScore || maxScore === 0) return score > 0 ? baseXP : 0;
  const ratio = score / maxScore;
  return Number.isFinite(ratio) ? Math.round(ratio * baseXP) : 0;
}

function getCompletableModules(sections: any[]): any[] {
  if (!Array.isArray(sections)) return [];
  const result: any[] = [];
  for (const section of sections) {
    if (section.visible === 0) continue;
    for (const mod of section.modules ?? []) {
      if (!mod.completion || mod.completion === 0) continue;
      if (EXCLUDED_MODNAMES.has(mod.modname)) continue;
      if (mod.visible === 0) continue;
      if (!mod.instance || mod.instance === 0) continue;
      result.push(mod);
    }
  }
  return result;
}

async function getLocalCompletions(courseId: number) {
  try {
    const db = await getDBConnection();
    return await db.getAllAsync<any>(
      `SELECT module_id as cmid, is_completed, best_score as score, total_score as max_score, type as modname
       FROM activity_progress
       WHERE course_id = ?`,
      [courseId]
    );
  } catch { return []; }
}

async function fetchCourseProgress(token: string, course: CourseInput): Promise<CourseProgress | null> {
  try {
    const sections = await moodleCall('core_course_get_contents', { courseid: String(course.id) }, token);
    if (sections?.exception) throw new Error(sections.message || `Moodle error: ${sections.exception}`);

    const completableModules = getCompletableModules(sections);
    const totalActivities = completableModules.length;

    let completionMap: Record<number, boolean> = {};
    try {
      const completionResult = await moodleCall('core_completion_get_activities_completion_status', { courseid: String(course.id) }, token);
      if (!completionResult?.exception) {
        for (const stat of completionResult?.statuses ?? []) {
          completionMap[stat.cmid] = stat.state >= 1;
        }
      }
    } catch {}

    const localRows = await getLocalCompletions(course.id);
    const localMap = new Map(localRows.map(r => [r.cmid, r]));

    const breakdown: Record<string, { completed: number; total: number }> = {};
    let completedActivities = 0;
    let totalXP = 0;
    let perfectScores = 0;

    for (const mod of completableModules) {
      const type = mod.modname;
      if (!breakdown[type]) breakdown[type] = { completed: 0, total: 0 };
      breakdown[type].total++;

      const isCompleted = !!completionMap[mod.id] || (localMap.get(mod.id)?.is_completed === 1);
      if (isCompleted) {
        breakdown[type].completed++;
        completedActivities++;
        const localRow = localMap.get(mod.id);
        if (localRow) {
          totalXP += calculateXP(localRow.score ?? 0, localRow.max_score ?? 0);
          if (localRow.score > 0 && localRow.score === localRow.max_score) perfectScores++;
        } else {
          totalXP += XP_PER_ACTIVITY;
        }
      }
    }

    return {
      courseId: course.id,
      courseName: course.name || `Cours ${course.id}`,
      completedActivities,
      totalActivities,
      completionPercent: totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0,
      totalXP,
      perfectScores,
      breakdown,
    };
  } catch (e: any) {
    console.error('[useMoodleCourses] Erreur:', e.message);
    return null;
  }
}

export function useMoodleCourses(courses: CourseInput[], userId: number | null) {
  const [progressList, setProgressList] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { streak, recordActivity } = useStreak(userId);

  const coursesString = JSON.stringify(courses);

  const loadProgress = useCallback(async () => {
    const inputCourses = JSON.parse(coursesString) as CourseInput[];
    if (!inputCourses.length) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Non authentifié');
      const results = await Promise.all(inputCourses.map(c => fetchCourseProgress(token, c)));
      setProgressList(results.filter(Boolean) as CourseProgress[]);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [coursesString]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  const totalXP = progressList.reduce((s, c) => s + c.totalXP, 0);
  const totalCompleted = progressList.reduce((s, c) => s + c.completedActivities, 0);
  const perfectScores = progressList.reduce((s, c) => s + c.perfectScores, 0);

  const badgesWithStatus = getAllBadgesWithStatus({
    completedLessons: totalCompleted,
    currentStreak: streak?.currentStreak ?? 0,
    totalXP,
    quizPassed: 0,
    perfectScores,
    daysActive: streak?.totalDaysActive ?? 0,
  });

  return {
    progressList, loading, error, reload: loadProgress,
    totalXP, totalCompleted,
    currentStreak: streak?.currentStreak ?? 0,
    bestStreak: streak?.bestStreak ?? 0,
    earnedBadges: badgesWithStatus.filter(b => b.earned),
    badgesWithStatus, recordActivity,
  };
}