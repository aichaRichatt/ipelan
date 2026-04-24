export type ActivityType = 'quiz' | 'dictation' | 'listening' | 'association' | 'wordOrder' | 'lesson' | 'html' | 'resource' | 'folder' | 'book' | 'label';

export interface XPConfig {
  baseXP: number;
  perfectBonus: number;
  timeBonus: number;
  streakBonus: number;
  attemptPenalty: number;
}

export const XP_CONFIG: Record<ActivityType, XPConfig> = {
  quiz: {
    baseXP: 20,
    perfectBonus: 10,
    timeBonus: 5,
    streakBonus: 3,
    attemptPenalty: 2,
  },
  dictation: {
    baseXP: 15,
    perfectBonus: 10,
    timeBonus: 5,
    streakBonus: 2,
    attemptPenalty: 2,
  },
  listening: {
    baseXP: 15,
    perfectBonus: 10,
    timeBonus: 5,
    streakBonus: 2,
    attemptPenalty: 2,
  },
  association: {
    baseXP: 15,
    perfectBonus: 10,
    timeBonus: 5,
    streakBonus: 2,
    attemptPenalty: 2,
  },
  wordOrder: {
    baseXP: 15,
    perfectBonus: 10,
    timeBonus: 5,
    streakBonus: 2,
    attemptPenalty: 2,
  },
  lesson: {
    baseXP: 10,
    perfectBonus: 0,
    timeBonus: 0,
    streakBonus: 0,
    attemptPenalty: 0,
  },
  html: {
    baseXP: 5,
    perfectBonus: 0,
    timeBonus: 0,
    streakBonus: 0,
    attemptPenalty: 0,
  },
  resource: {
    baseXP: 5,
    perfectBonus: 0,
    timeBonus: 0,
    streakBonus: 0,
    attemptPenalty: 0,
  },
  folder: {
    baseXP: 5,
    perfectBonus: 0,
    timeBonus: 0,
    streakBonus: 0,
    attemptPenalty: 0,
  },
  book: {
    baseXP: 10,
    perfectBonus: 0,
    timeBonus: 0,
    streakBonus: 0,
    attemptPenalty: 0,
  },
  label: {
    baseXP: 0,
    perfectBonus: 0,
    timeBonus: 0,
    streakBonus: 0,
    attemptPenalty: 0,
  },
};

export interface XPScore {
  totalXP: number;
  breakdown: {
    base: number;
    perfectBonus: number;
    timeBonus: number;
    streakBonus: number;
  };
  level: number;
  nextLevelXP: number;
}

export function calculateXP(
  activityType: ActivityType,
  correctAnswers: number,
  totalQuestions: number,
  options: {
    timeSpent?: number;
    perfectScore?: boolean;
    streak?: number;
    attempts?: number;
  } = {}
): XPScore {
  const config = XP_CONFIG[activityType];
  const { perfectScore = false, streak = 0, attempts = 1 } = options;

  const percentage = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
  const baseXP = Math.round(config.baseXP * percentage);

  let perfectBonus = 0;
  if (perfectScore && percentage === 1) {
    perfectBonus = config.perfectBonus;
  }

  let timeBonus = 0;
  if (options.timeSpent && options.timeSpent < 60) {
    timeBonus = config.timeBonus;
  }

  let streakBonus = 0;
  if (streak >= 3) {
    streakBonus = config.streakBonus * Math.min(streak, 5);
  }

  const attemptPenalty = Math.max(0, (attempts - 1) * config.attemptPenalty);

  const totalXP = Math.max(0, baseXP + perfectBonus + timeBonus + streakBonus - attemptPenalty);

  const currentXP = totalXP;
  const levelXP = 100;
  const level = Math.floor(currentXP / levelXP) + 1;
  const nextLevelXP = levelXP - (currentXP % levelXP);

  return {
    totalXP,
    breakdown: {
      base: baseXP,
      perfectBonus,
      timeBonus,
      streakBonus,
    },
    level,
    nextLevelXP,
  };
}

export function getXPForCompletion(activityType: ActivityType): number {
  return XP_CONFIG[activityType].baseXP + XP_CONFIG[activityType].perfectBonus;
}

export function getGradeFromXP(totalXP: number): { grade: string; level: number; progress: number } {
  const levels = [
    { min: 0, max: 100, name: 'Débutant', level: 1 },
    { min: 100, max: 300, name: 'Apprenant', level: 2 },
    { min: 300, max: 600, name: 'Intermédiaire', level: 3 },
    { min: 600, max: 1000, name: 'Avancé', level: 4 },
    { min: 1000, max: 1500, name: 'Expert', level: 5 },
    { min: 1500, max: Infinity, name: 'Maître', level: 6 },
  ];

  for (const lvl of levels) {
    if (totalXP < lvl.max) {
      const progress = ((totalXP - lvl.min) / (lvl.max - lvl.min)) * 100;
      return { grade: lvl.name, level: lvl.level, progress: Math.min(100, Math.max(0, progress)) };
    }
  }

  return { grade: 'Maître', level: 6, progress: 100 };
}
