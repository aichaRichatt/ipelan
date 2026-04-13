import { useState, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getCompletion, getCourseSections, getUserCourses, parseSections } from '../services/api/courseService';
import { 
  getDBConnection, 
  saveCourses, 
  getCourses, 
  saveCourseSections, 
  getCourseSectionsByCourse, 
  saveCourseModules, 
  getCourseModulesBySection,
  saveModuleContents
} from '../services/storage/db-service';
import { CourseSection, CourseModule, ModuleContent } from '../types';
import { RootState } from '../services/redux/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchStart, fetchSuccess, fetchFailure,
         selectSections, selectCurrentSection, selectIsLoading } from '../services/redux/slices/coursesSlice';
import { useLogin } from './useLogin';

const CACHE_KEY     = '@ipelan_sections_';
const CACHE_EXPIRY = 5 * 60 * 1000;  

export const useLessons = (courseId: number) => {
  const dispatch        = useDispatch();
  const { user, token } = useLogin();
  const sections        = useSelector(selectSections);
  const currentSection  = useSelector(selectCurrentSection);
  const isLoading       = useSelector(selectIsLoading);

  const loadSections = useCallback(async (forceRefresh = false) => {
    if (!courseId || !user || !token) return;

    dispatch(fetchStart());

    try {
      const cacheKey = CACHE_KEY + courseId;

      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const isExpired = Date.now() - timestamp > CACHE_EXPIRY;

          if (!isExpired) {
            dispatch(fetchSuccess(data));
            return;
          }
        }
      }

      const [rawSections, completion] = await Promise.all([
        getCourseSections(token, courseId),
        getCompletion({ userId: user.id, courseId, token }),
      ]);

      const sections = parseSections(rawSections, completion);

      try {
        const db = await getDBConnection();
        const dbSections: CourseSection[] = sections.map((s: any) => ({
          id: s.id,
          courseid: courseId,
          name: s.title,
          summary: '', 
          section: 0, 
          hiddenbynumsections: 0,
          uservisible: 1
        }));
        await saveCourseSections(db, dbSections);

        for (const section of sections) {
          const dbModules: CourseModule[] = section.modules.map((m: any) => ({
            id: m.id,
            courseid: courseId,
            sectionid: section.id,
            name: m.name,
            modname: m.modname,
            modplural: m.modplural,
            modicon: '', 
            indent: 0,
            url: m.url,
            description: m.description || '',
            visible: m.visible,
            uservisible: 1,
            completion: m.completion
          }));
          await saveCourseModules(db, dbModules);

          for (const m of section.modules) {
            if (m.contents && m.contents.length > 0) {
              const dbContents: ModuleContent[] = m.contents.map((c: any) => ({
                moduleid: m.id,
                type: 'file',
                filename: c.filename,
                filepath: c.filepath,
                filesize: c.filesize,
                fileurl: c.fileurl,
                timecreated: c.timecreated,
                timemodified: c.timemodified,
                sortorder: 0,
                userid: user.id,
                author: '',
                license: ''
              }));
              await saveModuleContents(db, dbContents);
            }
          }
        }
      } catch (sqliteErr) {
        console.warn("Failed to persist sections to SQLite:", sqliteErr);
      }

      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ data: sections, timestamp: Date.now() }),
      );

      dispatch(fetchSuccess(sections));

    } catch (err: any) {
      console.warn("Fetch sections failed, trying local storage:", err.message);
      try {
        const db = await getDBConnection();
        const localSections = await getCourseSectionsByCourse(db, courseId);
        
        if (localSections.length > 0) {
          const parsedSections: any[] = [];
          for (const ls of localSections) {
            const modules = await getCourseModulesBySection(db, ls.id);
            parsedSections.push({
              id: ls.id,
              title: ls.name,
              modules: modules,
              status: 'not_started',
              progress: 0,
              isLocked: false,
              isCurrent: false
            });
          }
          dispatch(fetchSuccess(parsedSections));
          return;
        }
      } catch (localErr) {
        console.error("Local fetch failed:", localErr);
      }
      
      dispatch(fetchFailure(err.message ?? 'Erreur chargement leçons'));
    }
  }, [courseId, user, token, dispatch]);

  useEffect(() => {
    loadSections();
  }, [courseId]);

  return {
    sections,
    currentSection,
    isLoading,
    refetch: () => loadSections(true),
  };
};

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
      console.log("[useCourses] Fetching courses for user id:", user.id);
      const { getEnrolledCoursesByTimeline } = await import("../services/api/courseService");
      
      let apiCourses: any = null;
       try {
        console.log("[useCourses] Tier 1: Fetching courses with Student Token for ID:", user.id);
        const res = await getUserCourses(token, Number(user.id));
        if (Array.isArray(res) && res.length > 0) apiCourses = res;
      } catch (err: any) {
        console.log("[useCourses] Tier 1 failed:", err.message);
      }

       if (!apiCourses || apiCourses.length === 0) {
        try {
          console.log("[useCourses] Tier 2: Fallback to Admin Token for Student ID:", user.id);
          const adminCourses = await getUserCourses(process.env.EXPO_PUBLIC_MOODLE_TOKEN!, Number(user.id));
          if (Array.isArray(adminCourses) && adminCourses.length > 0) apiCourses = adminCourses;
        } catch (adminErr: any) {
          console.log("[useCourses] Tier 2 failed:", adminErr.message);
        }
      }

      const finalCourses = Array.isArray(apiCourses) ? apiCourses : [];
      if (finalCourses.length === 0) {
        console.warn("[useCourses] Both Student and Admin tokens returned 0 enrolled courses. CHECK MOODLE ENROLMENT.");
      }

      const db = await getDBConnection();
      const mappedCourses = finalCourses.map((c: any) => ({
        ...c,
        categoryid: c.category || c.categoryid || 0
      }));
      await saveCourses(db, mappedCourses);
      setCourses(mappedCourses);;
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
