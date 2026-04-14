import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEnrolledCoursesByTimeline, getUserCourses, getCourseContents, getAllCourses, getCoursesForLanguageAndGrade } from '../services/api/courseService';

const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_TOKEN;
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
      
      if (preferences) {
        const langCourses = await getCoursesForLanguageAndGrade(cleanToken, preferences.language, preferences.grade);
        if (langCourses.length > 0) {
          rawCourses = langCourses;
        }
      }
      
      if (rawCourses.length === 0) {
        let response = await getEnrolledCoursesByTimeline(cleanToken);
        
        if (response?.courses && Array.isArray(response.courses)) {
          rawCourses = response.courses;
        } else if (response?.exception && ADMIN_TOKEN) {
          const adminCourses = await getUserCourses(ADMIN_TOKEN);
          rawCourses = adminCourses;
        }
      }
      
      if (rawCourses.length === 0 && ADMIN_TOKEN) {
        const fallbackCourses = await getAllCourses(ADMIN_TOKEN);
        rawCourses = fallbackCourses;
      }
      
      const mappedCourses = rawCourses.map((course: any) => ({
        id: course.id,
        fullname: course.fullname || course.shortname || "Cours",
        shortname: course.shortname || "",
        summary: course.summary || "",
        progress: course.progress || 0,
        visible: course.visible ?? true,
        courseimage: course.courseimage || "",
        coursecategory: course.coursecategory || course.category || "",
        viewurl: course.viewurl || ""
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