export interface BadgeDefinition {
  id:          string;
  name:        string;
  description: string;
  icon:        string;
  condition:   (data: BadgeProgressData) => boolean;
}

export interface BadgeProgressData {
  completedLessons: number;
  currentStreak:    number;
  totalXP:          number;
  quizPassed:       number;
  perfectScores:    number;
  daysActive:       number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id:          'first_step',
    name:        'Premier pas',
    description: 'Compléter votre première activité',
    icon:        '🎯',
    condition:   d => d.completedLessons >= 1,
  },
  {
    id:          'learner',
    name:        'Apprenant',
    description: 'Compléter 5 activités',
    icon:        '📚',
    condition:   d => d.completedLessons >= 5,
  },
  {
    id:          'dedicated',
    name:        'Assidu',
    description: 'Compléter 10 activités',
    icon:        '⭐',
    condition:   d => d.completedLessons >= 10,
  },
  {
    id:          'streak_3',
    name:        'En feu',
    description: '3 jours consécutifs',
    icon:        '🔥',
    condition:   d => d.currentStreak >= 3,
  },
  {
    id:          'streak_7',
    name:        'Semaine parfaite',
    description: '7 jours consécutifs',
    icon:        '🏆',
    condition:   d => d.currentStreak >= 7,
  },
  {
    id:          'xp_100',
    name:        'Centurion',
    description: 'Gagner 100 XP',
    icon:        '💯',
    condition:   d => d.totalXP >= 100,
  },
  {
    id:          'xp_500',
    name:        'Expert',
    description: 'Gagner 500 XP',
    icon:        '🎓',
    condition:   d => d.totalXP >= 500,
  },
  {
    id:          'perfect',
    name:        'Perfectionniste',
    description: 'Obtenir un score parfait',
    icon:        '✨',
    condition:   d => d.perfectScores >= 1,
  },
  {
    id:          'perfect_10',
    name:        'Savant',
    description: '10 scores parfaits',
    icon:        '🧠',
    condition:   d => d.perfectScores >= 10,
  },
  {
    id:          'streak_30',
    name:        'Légende',
    description: '30 jours consécutifs',
    icon:        '👑',
    condition:   d => d.currentStreak >= 30,
  },
  {
    id:          'xp_1000',
    name:        'Maître',
    description: 'Gagner 1000 XP',
    icon:        '💎',
    condition:   d => d.totalXP >= 1000,
  },
  {
    id:          'lessons_50',
    name:        'Vétéran',
    description: 'Compléter 50 activités',
    icon:        '🛡️',
    condition:   d => d.completedLessons >= 50,
  },
];

// Retourne uniquement les badges mérités
export function getEarnedBadges(data: BadgeProgressData): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter(b => b.condition(data));
}

// Retourne tous les badges avec leur statut
export function getAllBadgesWithStatus(
  data: BadgeProgressData
): Array<BadgeDefinition & { earned: boolean }> {
  return BADGE_DEFINITIONS.map(b => ({
    ...b,
    earned: b.condition(data),
  }));
}
