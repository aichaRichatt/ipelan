import { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getUserCourses } from '../services/api/courseService';
import { getDBConnection, saveCourses, getCourses } from '../services/storage/db-service';
import { RootState } from '../services/redux/store';

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
      const apiCourses = await getUserCourses(token, user.id);
      
      if (Array.isArray(apiCourses)) {
        const db = await getDBConnection();
        await saveCourses(db, apiCourses);
        setCourses(apiCourses);
      } else {
        throw new Error("Failed to fetch courses from API");
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
  }, [token, user]);

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

  return {
    courses,
    isLoading,
    error,
    fetchCourses,
    loadLocalCourses
  };
}
