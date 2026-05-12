import { getLevelFromXP, getXPToNextLevel } from './levelCalculator';

export type ActivityType = 'quiz' | 'dictation' | 'listening' | 'association' | 'wordOrder' | 'lesson' | 'html' | 'resource' | 'folder' | 'book' | 'label';

export interface XPConfig {
  baseXP: number;
  perfectBonus: number;
  timeBonus: number;
  streakBonus: number;
  attemptPenalty: number;
}

export const STREAK_BONUS_CAP = 5;
/** @deprecated Use TIME_BONUS_THRESHOLDS[activityType] instead */
export const TIME_BONUS_THRESHOLD_SECONDS = 60;

/** Seuil de temps (secondes) en-dessous duquel le time bonus est accordé, par type d'activité */
export const TIME_BONUS_THRESHOLDS: Record<ActivityType, number> = {
  quiz:        90,   // plusieurs questions — 90 s
  dictation:  120,   // écoute + frappe — 2 min
  listening:   90,   // écoute + QCM — 90 s
  association: 45,   // matching rapide — 45 s
  wordOrder:   60,   // remise en ordre — 60 s
  lesson:       0,
  html:         0,
  resource:     0,
  folder:       0,
  book:         0,
  label:        0,
};

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
    cumulativeXP?: number;
  } = {}
): XPScore {
  const config = XP_CONFIG[activityType];
  const { perfectScore = false, streak = 0, attempts = 1, cumulativeXP = 0 } = options;

  const percentage = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
  const baseXP = Math.round(config.baseXP * percentage);

  let perfectBonus = 0;
  if (perfectScore && percentage === 1) {
    perfectBonus = config.perfectBonus;
  }

  let timeBonus = 0;
  const timeBonusThreshold = TIME_BONUS_THRESHOLDS[activityType];
  if (options.timeSpent && timeBonusThreshold > 0 && options.timeSpent < timeBonusThreshold) {
    timeBonus = config.timeBonus;
  }

  let streakBonus = 0;
  if (streak >= 3) {
    streakBonus = config.streakBonus * Math.min(streak, STREAK_BONUS_CAP);
  }

  const attemptPenalty = Math.max(0, (attempts - 1) * config.attemptPenalty);

  const totalXP = Math.max(0, baseXP + perfectBonus + timeBonus + streakBonus - attemptPenalty);

  const cumulativeTotal = cumulativeXP + totalXP;
  const { level } = getLevelFromXP(cumulativeTotal);
  const nextLevelXP = getXPToNextLevel(cumulativeTotal);

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
  const info = getLevelFromXP(totalXP);
  return { grade: info.title, level: info.level, progress: info.progress };
}
