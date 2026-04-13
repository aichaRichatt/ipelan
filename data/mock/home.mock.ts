import { Grade } from '@/types';

export interface HomeModule {
  id: string;
  title: string;
  description: string;
  xp: number;
  isLocked: boolean;
  lessonsCount: number;
  completedLessons: number;
  icon: string;
  iconColor: string;
  iconBg: string;
  levelId: number;
  language: string;
  grade: Grade;
}

export interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  bgColor: string;
  iconColor: string;
  route: string;
}

export interface HomeStats {
  totalXp: number;
  streak: number;
  badges: number;
  lessonsCompleted: number;
  currentLesson: string;
  currentProgress: number;
}

export const MOCK_HOME_MODULES: HomeModule[] = [
  {
    id: "course_pulaar_1_lecture",
    title: "Lecture Pulaar",
    description: "Apprends à lire en Pulaar",
    xp: 30,
    isLocked: false,
    lessonsCount: 5,
    completedLessons: 5,
    icon: "book",
    iconColor: "#10B981",
    iconBg: "bg-green-100",
    levelId: 1,
    language: "pulaar",
    grade: 1,
  },
  {
    id: "course_pulaar_1_vocab",
    title: "Vocabulaire",
    description: "Les mots de base",
    xp: 30,
    isLocked: false,
    lessonsCount: 4,
    completedLessons: 2,
    icon: "message-circle",
    iconColor: "#6366F1",
    iconBg: "bg-indigo-100",
    levelId: 1,
    language: "pulaar",
    grade: 1,
  },
  {
    id: "course_pulaar_2_lecture",
    title: "Lecture avancée",
    description: "Niveau intermédiaire",
    xp: 40,
    isLocked: true,
    lessonsCount: 6,
    completedLessons: 0,
    icon: "book-open",
    iconColor: "#F59E0B",
    iconBg: "bg-amber-100",
    levelId: 2,
    language: "pulaar",
    grade: 2,
  },
  {
    id: "course_pulaar_2_vocab",
    title: "Vocabulaire avancé",
    description: "Nouveau vocabulaire",
    xp: 35,
    isLocked: true,
    lessonsCount: 5,
    completedLessons: 0,
    icon: "message-square",
    iconColor: "#EC4899",
    iconBg: "bg-pink-100",
    levelId: 2,
    language: "pulaar",
    grade: 2,
  },
];

export const MOCK_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "qa-quiz",
    title: "Quiz",
    subtitle: "Teste tes connaissances",
    icon: "edit-2",
    bgColor: "bg-blue-50",
    iconColor: "#4a90e2",
    route: "/(quiz)/index",
  },
  {
    id: "qa-oral",
    title: "Oral",
    subtitle: "Écoute et apprends",
    icon: "headphones",
    bgColor: "bg-green-50",
    iconColor: "#10B981",
    route: "/(stacks)/(cours)/listening",
  },
  {
    id: "qa-dictation",
    title: "Dictée",
    subtitle: "Écris ce que tu entends",
    icon: "edit-3",
    bgColor: "bg-amber-50",
    iconColor: "#F59E0B",
    route: "/(stacks)/(cours)/dictation",
  },
  {
    id: "qa-association",
    title: "Association",
    subtitle: "Associe les mots",
    icon: "link",
    bgColor: "bg-purple-50",
    iconColor: "#9333EA",
    route: "/(stacks)/(cours)/association",
  },
];

export const MOCK_HOME_STATS: HomeStats = {
  totalXp: 1240,
  streak: 5,
  badges: 3,
  lessonsCompleted: 12,
  currentLesson: "La famille en Pulaar",
  currentProgress: 60,
};

export const getModulesByLevel = (level: number): HomeModule[] => {
  return MOCK_HOME_MODULES.filter(m => m.levelId === level);
};

export const getModulesByLanguage = (language: string): HomeModule[] => {
  return MOCK_HOME_MODULES.filter(m => m.language === language);
};
