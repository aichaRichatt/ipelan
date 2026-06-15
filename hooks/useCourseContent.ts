import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCourseContents } from '../services/api/courseService';
import { isMoodleOnline } from '../services/api/moodleClient';
import {
  parseCourseContent,
  parseMoodleSections,
  ParsedSection,
  CourseContent,
} from '../services/moodleParser';
import { mapModuleToContentType, MappedContent, ParsedModule } from '../utils/contentMapper';
import { ActivityType } from '../utils/xpCalculator';

const IS_DEV = process.env.NODE_ENV === "development";
const courseContentKey = (id: number) => `@ipelan_course_content_${id}`;

export interface UseCourseContentReturn {
  sections: ParsedSection[];
  courseContent: CourseContent | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getModule: (moduleId: number) => ParsedModule | null;
  getModuleContent: (moduleId: number) => MappedContent | null;
  getModuleContentType: (moduleId: number) => ActivityType | null;
  getSectionById: (sectionId: number) => ParsedSection | null;
  getNextModule: (currentModuleId: number) => ParsedModule | null;
  getPreviousModule: (currentModuleId: number) => ParsedModule | null;
}

export function useCourseContent(
  token: string,
  courseId: number
): UseCourseContentReturn {
  const [sections, setSections] = useState<ParsedSection[]>([]);
  const [courseContent, setCourseContent] = useState<CourseContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    if (!token || !courseId) {
      // Token not yet restored from SecureStore — wait silently, useEffect re-runs when token arrives
      if (IS_DEV) console.log('[useCourseContent] Waiting for token (courseId:', courseId, ')');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (IS_DEV) console.log("[useCourseContent] Fetching content for course:", courseId);

      // Offline-first : si pas de réseau, charger le cache immédiatement sans attendre le timeout API
      const online = await isMoodleOnline();
      if (!online) {
        const cached = await AsyncStorage.getItem(courseContentKey(courseId)).catch(() => null);
        if (cached) {
          const cachedContents = JSON.parse(cached);
          if (IS_DEV) console.log('[useCourseContent] Offline — cache chargé immédiatement pour:', courseId);
          setSections(parseMoodleSections(cachedContents));
          setCourseContent(parseCourseContent(courseId, cachedContents));
          setIsLoading(false);
          return;
        }
        setError('Hors ligne — ouvre ce cours en ligne une première fois pour le rendre disponible hors connexion');
        setIsLoading(false);
        return;
      }

      const rawContents = await getCourseContents(token, courseId);

      if (!rawContents || rawContents.length === 0) {
        // Network returned empty (offline or Moodle unreachable) — try cache first
        try {
          const cached = await AsyncStorage.getItem(courseContentKey(courseId));
          if (cached) {
            const cachedContents = JSON.parse(cached);
            if (IS_DEV) console.log('[useCourseContent] Network empty, using AsyncStorage cache for course:', courseId);
            setSections(parseMoodleSections(cachedContents));
            setCourseContent(parseCourseContent(courseId, cachedContents));
            return;
          }
        } catch {}
        if (IS_DEV) console.warn("[useCourseContent] No content and no cache for course:", courseId);
        setError("Aucun contenu disponible pour ce cours");
        setSections([]);
        setCourseContent(null);
        setIsLoading(false);
        return;
      }

      if (IS_DEV) {
        console.log("[useCourseContent] Raw sections:", rawContents.length);
        for (const section of rawContents) {
          console.log(`  Section "${section.name}":`, section.modules?.length || 0, "modules");
          if (section.modules) {
            for (const mod of section.modules) {
              console.log(`    - ${mod.name} (${mod.modname})`);
            }
          }
        }
      }

      // Persist raw sections for offline use
      AsyncStorage.setItem(courseContentKey(courseId), JSON.stringify(rawContents)).catch(() => {});

      const parsedSections = parseMoodleSections(rawContents);
      const parsedCourse = parseCourseContent(courseId, rawContents);

      if (IS_DEV) {
        console.log("[useCourseContent] Parsed sections:", parsedSections.length);
        for (const section of parsedSections) {
          console.log(`  Section "${section.title}":`, section.moduleCount, "modules", 
            section.hasActivities ? "[HAS ACTIVITIES]" : "",
            section.hasLessons ? "[HAS LESSONS]" : "");
        }
      }

      setSections(parsedSections);
      setCourseContent(parsedCourse);
    } catch (err: any) {
      if (IS_DEV) console.error("[useCourseContent] Error:", err.message);
      try {
        const cached = await AsyncStorage.getItem(courseContentKey(courseId));
        if (cached) {
          const rawContents = JSON.parse(cached);
          setSections(parseMoodleSections(rawContents));
          setCourseContent(parseCourseContent(courseId, rawContents));
          if (IS_DEV) console.log('[useCourseContent] Loaded from offline cache:', courseId);
          return;
        }
      } catch {}
      setError(err.message || "Erreur lors du chargement du contenu");
      setSections([]);
      setCourseContent(null);
    } finally {
      setIsLoading(false);
    }
  }, [token, courseId]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const getModule = useCallback((moduleId: number): ParsedModule | null => {
    for (const section of sections) {
      const found = section.modules.find(m => m.id === moduleId);
      if (found) return found;
    }
    return null;
  }, [sections]);

  const getModuleContent = useCallback((moduleId: number): MappedContent | null => {
    const module = getModule(moduleId);
    if (!module) return null;
    return mapModuleToContentType(module);
  }, [getModule]);

  const getModuleContentType = useCallback((moduleId: number): ActivityType | null => {
    const content = getModuleContent(moduleId);
    return content?.type || null;
  }, [getModuleContent]);

  const getSectionById = useCallback((sectionId: number): ParsedSection | null => {
    return sections.find(s => s.id === sectionId) || null;
  }, [sections]);

  const getNextModule = useCallback((currentModuleId: number): ParsedModule | null => {
    const allModules: ParsedModule[] = [];
    for (const section of sections) {
      allModules.push(...section.modules);
    }

    const currentIndex = allModules.findIndex(m => m.id === currentModuleId);
    if (currentIndex >= 0 && currentIndex < allModules.length - 1) {
      return allModules[currentIndex + 1];
    }
    return null;
  }, [sections]);

  const getPreviousModule = useCallback((currentModuleId: number): ParsedModule | null => {
    const allModules: ParsedModule[] = [];
    for (const section of sections) {
      allModules.push(...section.modules);
    }

    const currentIndex = allModules.findIndex(m => m.id === currentModuleId);
    if (currentIndex > 0) {
      return allModules[currentIndex - 1];
    }
    return null;
  }, [sections]);

  return {
    sections,
    courseContent,
    isLoading,
    error,
    refetch: fetchContent,
    getModule,
    getModuleContent,
    getModuleContentType,
    getSectionById,
    getNextModule,
    getPreviousModule,
  };
}

export default useCourseContent;
