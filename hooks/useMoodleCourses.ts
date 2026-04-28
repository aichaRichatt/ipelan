import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { getAllCourses, getCourseContents, getCoursesForLanguageAndGrade, getEnrolledCoursesByTimeline, getFirstCourseFromLanguageAndGrade, getUserCourses } from '../services/api/courseService';

const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_ADMIN_TOKEN;
const PREFERENCES_KEY = '@ipelan_preferences';

interface UserPreferences {
  language: string;
  grade: number;
}

interface MoodleCourse {
  id: number;
  fullname: string;
  shortname: string;
  summary: string;
  progress: number;
  visible: boolean;
  courseimage: string;
  coursecategory: string;
  viewurl: string;
  lessonsCount: number;
}

interface UseMoodleCoursesReturn {
  courses: MoodleCourse[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMoodleCourses(token: string): UseMoodleCoursesReturn {
  const [courses, setCourses] = useState<MoodleCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    const cleanToken = token?.trim();

    if (!cleanToken || cleanToken.length < 10) {
      setError("Connectez-vous pour voir vos cours");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let rawCourses: any[] = [];

      const prefsStr = await AsyncStorage.getItem(PREFERENCES_KEY);
      const preferences: UserPreferences | null = prefsStr ? JSON.parse(prefsStr) : null;

      console.log('[useMoodleCourses] Token available, fetching courses...');
      console.log('[useMoodleCourses] Admin token available:', !!ADMIN_TOKEN);
      console.log('[useMoodleCourses] Preferences:', preferences);

      // Try to get courses by language preference first
      if (preferences?.language) {
        try {
          const langCourses = await getCoursesForLanguageAndGrade(cleanToken, preferences.language, preferences.grade);
          if (langCourses && langCourses.length > 0) {
            rawCourses = langCourses;
          }
        } catch (e) {
          console.warn('[useMoodleCourses] Language courses failed, falling back');
        }
      }

      // Fallback: Get user's enrolled courses directly
      if (rawCourses.length === 0) {
        try {
          let response = await getEnrolledCoursesByTimeline(cleanToken);

          if (response?.courses && Array.isArray(response.courses) && response.courses.length > 0) {
            rawCourses = response.courses;
          } else if (Array.isArray(response)) {
            // Sometimes API returns array directly
            rawCourses = response;
          }
        } catch (e) {
          console.warn('[useMoodleCourses] Enrolled courses failed:', e);
        }
      }

      // Try getUserCourses as alternative
      if (rawCourses.length === 0) {
        try {
          const userCourses = await getUserCourses(cleanToken, 0); // 0 = current user
          if (userCourses && userCourses.length > 0) {
            rawCourses = userCourses;
          }
        } catch (e) {
          console.warn('[useMoodleCourses] getUserCourses failed:', e);
        }
      }

      // Last resort: Get all courses via admin
      if (rawCourses.length === 0 && ADMIN_TOKEN) {
        try {
          const allCourses = await getAllCourses(ADMIN_TOKEN);
          rawCourses = allCourses;
        } catch (e) {
          console.warn('[useMoodleCourses] Admin fallback failed:', e);
        }
      }

      console.log('[useMoodleCourses] Total raw courses found:', rawCourses.length);

      const mappedCourses = await Promise.all(rawCourses.map(async (course: any) => {
        let realLessonCount = 0;
        try {
          // Utilise getCourseContents importé depuis courseService.ts pour avoir le vrai chiffre
          const sections = await getCourseContents(cleanToken, course.id);
          if (Array.isArray(sections)) {
            let count = 0;
            sections.forEach(sec => {
              if (sec.modules) count += sec.modules.length;
            });
            realLessonCount = count;
          }
        } catch (e) {
          // Ignorer l'erreur pour ne pas bloquer le chargement
        }

        return {
          id: course.id,
          fullname: course.fullname || course.shortname || "Cours",
          shortname: course.shortname || "",
          summary: course.summary || "",
          progress: course.progress || 0,
          visible: course.visible ?? true,
          courseimage: course.courseimage || "",
          coursecategory: course.coursecategory || course.category || "",
          viewurl: course.viewurl || "",
          lessonsCount: realLessonCount === 0 && course.progress > 0 ? 1 : realLessonCount // Si 0 mais progrès, on met min 1
        };
      }));

      setCourses(mappedCourses);

      if (mappedCourses.length === 0) {
        setError("Aucun cours trouvé. Inscrivez-vous à des cours sur Moodle.");
      }
    } catch (err: any) {
      console.error("[useMoodleCourses] Catch error:", err.message);
      setError(err.message || "Erreur chargement cours");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return {
    courses,
    isLoading,
    error,
    refetch: fetchCourses
  };
}

// Hook for home screen - fetches only the FIRST course of user's preferred language/grade
export function useFirstCourse(token: string) {
  const [course, setCourse] = useState<MoodleCourse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourse = useCallback(async () => {
    const cleanToken = token?.trim();

    if (!cleanToken || cleanToken.length < 10) {
      setError("Connectez-vous pour voir vos cours");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const prefsStr = await AsyncStorage.getItem(PREFERENCES_KEY);
      const preferences: UserPreferences | null = prefsStr ? JSON.parse(prefsStr) : null;

      console.log('[useFirstCourse] Token available, fetching first course...');
      console.log('[useFirstCourse] Preferences:', preferences);

      if (!preferences?.language) {
        setError("Sélectionnez une langue d'apprentissage");
        setIsLoading(false);
        return;
      }

      // Get only the first course from user's language and grade
      const firstCourse = await getFirstCourseFromLanguageAndGrade(cleanToken, preferences.language, preferences.grade);

      if (firstCourse) {
        console.log('[useFirstCourse] Found first course:', firstCourse.fullname);

        // Get lesson count for this course
        let realLessonCount = 0;
        try {
          const sections = await getCourseContents(cleanToken, firstCourse.id);
          if (Array.isArray(sections)) {
            let count = 0;
            sections.forEach(sec => {
              if (sec.modules) count += sec.modules.length;
            });
            realLessonCount = count;
          }
        } catch (e) {
          // Ignore error
        }

        const mappedCourse: MoodleCourse = {
          id: firstCourse.id,
          fullname: firstCourse.fullname || firstCourse.shortname || "Cours",
          shortname: firstCourse.shortname || "",
          summary: firstCourse.summary || "",
          progress: firstCourse.progress || 0,
          visible: firstCourse.visible ?? true,
          courseimage: firstCourse.courseimage || "",
          coursecategory: firstCourse.coursecategory || firstCourse.category || "",
          viewurl: firstCourse.viewurl || "",
          lessonsCount: realLessonCount
        };

        setCourse(mappedCourse);
      } else {
        console.log('[useFirstCourse] No course found for', preferences.language, 'grade', preferences.grade);
        setError("Aucun cours trouvé pour votre langue et année.");
      }
    } catch (err: any) {
      console.error("[useFirstCourse] Error:", err.message);
      setError(err.message || "Erreur chargement cours");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  return {
    course,
    isLoading,
    error,
    refetch: fetchCourse
  };
}

export function useCourseSections(token: string, courseId: number, userId?: number) {
  const [sections, setSections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSections = useCallback(async () => {
    if (!courseId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let response = await getCourseContents(token, courseId);

      if ((!response || response.length === 0) && ADMIN_TOKEN) {
        console.log("[useCourseSections] User token failed, trying admin...");
        response = await getCourseContents(ADMIN_TOKEN, courseId);
      }

      if (Array.isArray(response)) {
        setSections(response);
      } else {
        setSections([]);
      }
    } catch (err: any) {
      console.error("Failed to fetch sections:", err);
      setError(err.message || "Failed to fetch sections");
    } finally {
      setIsLoading(false);
    }
  }, [token, courseId]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  return { sections, isLoading, error, refetch: fetchSections };
}