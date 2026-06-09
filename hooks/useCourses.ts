import { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getDBConnection, getCourses, saveCourses } from '../services/storage/db-service';
import { RootState } from '../services/redux/store';
import { getUserCourses } from '../services/api/courseService';

export function useCourses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { token, user } = useSelector((state: RootState) => state.auth);

  const fetchCourses = useCallback(async () => {
    if (!token || !user) {
      setError("User not authenticated");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let apiCourses: any = null;
       try {
        const res = await getUserCourses(token, Number(user.id));
        if (Array.isArray(res) && res.length > 0) apiCourses = res;
      } catch (err: any) {
        console.warn("[useCourses] Tier 1 failed:", err.message);
      }

       if (!apiCourses || apiCourses.length === 0) {
        try {
          const adminCourses = await getUserCourses(process.env.EXPO_PUBLIC_MOODLE_ADMIN_TOKEN!, Number(user.id));
          if (Array.isArray(adminCourses) && adminCourses.length > 0) apiCourses = adminCourses;
        } catch (adminErr: any) {
          console.warn("[useCourses] Tier 2 failed:", adminErr.message);
        }
      }

      const finalCourses = Array.isArray(apiCourses) ? apiCourses : [];
      const db = await getDBConnection();

      if (finalCourses.length > 0) {
        const mappedCourses = finalCourses.map((c: any) => ({
          ...c,
          categoryid: c.category || c.categoryid || 0
        }));
        await saveCourses(db, mappedCourses);
        setCourses(mappedCourses);
      } else {
        // Both tiers returned empty (offline or not enrolled) — use SQLite cache
        const localCourses = await getCourses(db);
        if (localCourses.length > 0) {
          console.warn("[useCourses] Network returned 0 courses, using SQLite cache.");
          setCourses(localCourses);
        } else {
          console.warn("[useCourses] Both Student and Admin tokens returned 0 enrolled courses. CHECK MOODLE ENROLMENT.");
        }
      }
    } catch (err: any) {
      console.warn("API fetch failed, trying local storage:", err.message);
      try {
        const db = await getDBConnection();
        const localCourses = await getCourses(db);
        setCourses(localCourses);
      } catch (dbErr: any) {
        setError(dbErr.message || "Failed to load courses");
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, user?.id]);

  const loadLocalCourses = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await getDBConnection();
      const localCourses = await getCourses(db);
      setCourses(localCourses);
    } catch (err: any) {
      setError(`Failed to load local courses : ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCoursesByLevel = useCallback((levelId: number) => {
    return courses.filter(c => c.categoryid === levelId);
  }, [courses]);

  return {
    courses,
    isLoading,
    error,
    fetchCourses,
    loadLocalCourses,
    getCoursesByLevel
  };
}
