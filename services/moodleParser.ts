import { ParsedModule, MappedContent, ModuleContent } from '../utils/contentMapper';
import { mapModuleToContentType, isActivity } from '../utils/contentMapper';
import { ActivityType } from '../utils/xpCalculator';

export interface MoodleSection {
  id: number;
  name: string;
  summary: string;
  summaryFormat: number;
  modules: MoodleModuleRaw[];
  sequence?: number[];
  availability?: string;
}

export interface MoodleModuleRaw {
  id: number;
  name: string;
  modname: string;
  modplural: string;
  instance: number;
  contextLevel?: number;
  instanceid?: number;
  description?: string;
  contents?: ModuleContent[];
  visible: number;
  uservisible?: boolean;
  available?: boolean;
  availability?: string;
  completion?: number;
  completiondata?: any;
  url?: string;
  icon?: {
    theme: string;
    component: string;
    pix: string;
  };
}

export interface ParsedSection {
  id: number;
  title: string;
  summary: string;
  modules: ParsedModule[];
  moduleCount: number;
  hasActivities: boolean;
  hasLessons: boolean;
  isAvailable: boolean;
  status: 'locked' | 'available' | 'completed' | 'in_progress';
  progress: number;
}

export interface CourseContent {
  courseId: number;
  sections: ParsedSection[];
  totalModules: number;
  totalActivities: number;
  totalLessons: number;
  completionPercentage: number;
}

export function parseMoodleSection(section: MoodleSection, index: number): ParsedSection {
  const modules: ParsedModule[] = [];
  let hasActivities = false;
  let hasLessons = false;

  if (section.modules && Array.isArray(section.modules)) {
    for (const mod of section.modules) {
      const parsedModule: ParsedModule = {
        id: mod.id,
        name: mod.name || `Module ${mod.id}`,
        modname: mod.modname || 'unknown',
        modplural: mod.modplural || '',
        instance: mod.instance,
        contextLevel: mod.contextLevel,
        instanceId: mod.instanceid,
        description: mod.description,
        contents: mod.contents || [],
        visible: mod.visible,
        uservisible: mod.uservisible,
        available: mod.available,
        availability: mod.availability,
        completion: mod.completion,
        completiondata: mod.completiondata,
      };

      const mapped = mapModuleToContentType(parsedModule);
      if (isActivity(mapped.type)) {
        hasActivities = true;
      } else {
        hasLessons = true;
      }

      modules.push(parsedModule);
    }
  }

  const completedModules = modules.filter(m => m.completiondata?.completionstate === 2).length;
  const progress = modules.length > 0 ? Math.round((completedModules / modules.length) * 100) : 0;

  const isAvailable = section.modules?.some(m => m.visible === 1 && m.available !== false) ?? true;
  const isCompleted = progress === 100 && modules.length > 0;
  const isInProgress = progress > 0 && progress < 100;

  let status: ParsedSection['status'] = 'available';
  if (!isAvailable) {
    status = 'locked';
  } else if (isCompleted) {
    status = 'completed';
  } else if (isInProgress) {
    status = 'in_progress';
  }

  return {
    id: section.id || index,
    title: section.name || `Section ${index + 1}`,
    summary: section.summary?.replace(/<[^>]*>/g, '') || '',
    modules,
    moduleCount: modules.length,
    hasActivities,
    hasLessons,
    isAvailable,
    status,
    progress,
  };
}

export function parseMoodleSections(sections: MoodleSection[]): ParsedSection[] {
  if (!Array.isArray(sections)) {
    console.warn('[moodleParser] Sections is not an array:', typeof sections);
    return [];
  }

  return sections.map((section, index) => parseMoodleSection(section, index));
}

export function parseCourseContent(courseId: number, sections: MoodleSection[]): CourseContent {
  const parsedSections = parseMoodleSections(sections);
  
  let totalModules = 0;
  let totalActivities = 0;
  let totalLessons = 0;

  for (const section of parsedSections) {
    totalModules += section.moduleCount;
    for (const module of section.modules) {
      const mapped = mapModuleToContentType(module);
      if (isActivity(mapped.type)) {
        totalActivities++;
      } else {
        totalLessons++;
      }
    }
  }

  const completedSections = parsedSections.filter(s => s.status === 'completed').length;
  const completionPercentage = parsedSections.length > 0 
    ? Math.round((completedSections / parsedSections.length) * 100) 
    : 0;

  return {
    courseId,
    sections: parsedSections,
    totalModules,
    totalActivities,
    totalLessons,
    completionPercentage,
  };
}

export function groupSectionContents(section: ParsedSection): {
  lessons: ParsedModule[];
  activities: ParsedModule[];
  quizzes: ParsedModule[];
  audioContent: ParsedModule[];
  documents: ParsedModule[];
  other: ParsedModule[];
} {
  const lessons: ParsedModule[] = [];
  const activities: ParsedModule[] = [];
  const quizzes: ParsedModule[] = [];
  const audioContent: ParsedModule[] = [];
  const documents: ParsedModule[] = [];
  const other: ParsedModule[] = [];

  for (const module of section.modules) {
    const mapped = mapModuleToContentType(module);

    switch (mapped.type) {
      case 'quiz':
        quizzes.push(module);
        activities.push(module);
        break;
      case 'listening':
        audioContent.push(module);
        break;
      case 'dictation':
      case 'association':
      case 'wordOrder':
        activities.push(module);
        break;
      default:
        if (mapped.type === 'lesson' || mapped.type === 'html') {
          if (mapped.audioUrl) {
            audioContent.push(module);
          } else if (mapped.pdfUrl || mapped.epubUrl) {
            documents.push(module);
          } else {
            lessons.push(module);
          }
        } else {
          other.push(module);
        }
    }
  }

  return {
    lessons,
    activities,
    quizzes,
    audioContent,
    documents,
    other,
  };
}

export function findModuleInSections(sections: ParsedSection[], moduleId: number): ParsedModule | null {
  for (const section of sections) {
    const found = section.modules.find(m => m.id === moduleId);
    if (found) return found;
  }
  return null;
}

export function getNextModule(sections: ParsedSection[], currentModuleId: number): ParsedModule | null {
  const allModules: ParsedModule[] = [];
  for (const section of sections) {
    allModules.push(...section.modules);
  }

  const currentIndex = allModules.findIndex(m => m.id === currentModuleId);
  if (currentIndex >= 0 && currentIndex < allModules.length - 1) {
    return allModules[currentIndex + 1];
  }
  return null;
}

export function getPreviousModule(sections: ParsedSection[], currentModuleId: number): ParsedModule | null {
  const allModules: ParsedModule[] = [];
  for (const section of sections) {
    allModules.push(...section.modules);
  }

  const currentIndex = allModules.findIndex(m => m.id === currentModuleId);
  if (currentIndex > 0) {
    return allModules[currentIndex - 1];
  }
  return null;
}
