export interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  isEarned: boolean;
  earnedAt?: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatar: string;
  xp: number;
  streak: number;
  level: number;
  isCurrentUser: boolean;
}

export interface UserProgress {
  totalXp: number;
  level: number;
  streak: number;
  coins: number;
  lessonsCompleted: number;
  quizzesCompleted: number;
  timeSpentMinutes: number;
  rank: number;
  totalUsers: number;
}

export const MOCK_BADGES: Badge[] = [
  {
    id: "badge-first-lesson",
    name: "Premier Pas",
    description: "Complète ta première leçon",
    emoji: "🎯",
    tier: "bronze",
    isEarned: true,
    earnedAt: "2026-03-15",
  },
  {
    id: "badge-5-lessons",
    name: "Apprenti",
    description: "Complète 5 leçons",
    emoji: "📚",
    tier: "bronze",
    isEarned: true,
    earnedAt: "2026-03-20",
  },
  {
    id: "badge-streak-3",
    name: "Série de 3 jours",
    description: "Connecte-toi 3 jours de suite",
    emoji: "🔥",
    tier: "bronze",
    isEarned: true,
    earnedAt: "2026-03-22",
  },
  {
    id: "badge-quiz-master",
    name: "Quiz Master",
    description: "Score 100% à un quiz",
    emoji: "🏆",
    tier: "silver",
    isEarned: true,
    earnedAt: "2026-03-25",
  },
  {
    id: "badge-streak-7",
    name: "Série de 7 jours",
    description: "Connecte-toi 7 jours de suite",
    emoji: "💎",
    tier: "gold",
    isEarned: false,
  },
  {
    id: "badge-100-lessons",
    name: "Expert",
    description: "Complète 100 leçons",
    emoji: "👑",
    tier: "platinum",
    isEarned: false,
  },
  {
    id: "badge-all-languages",
    name: "Polyglotte",
    description: "Étudie les 3 langues",
    emoji: "🌍",
    tier: "platinum",
    isEarned: false,
  },
];

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    username: "Ahmed_M",
    avatar: "👨‍🎓",
    xp: 2450,
    streak: 28,
    level: 12,
    isCurrentUser: false,
  },
  {
    rank: 2,
    username: "Fatima_S",
    avatar: "👩‍🎓",
    xp: 2180,
    streak: 21,
    level: 11,
    isCurrentUser: false,
  },
  {
    rank: 3,
    username: "Omar_D",
    avatar: "👨‍🎓",
    xp: 1950,
    streak: 15,
    level: 10,
    isCurrentUser: false,
  },
  {
    rank: 4,
    username: "Aminata_K",
    avatar: "👩‍🎓",
    xp: 1720,
    streak: 18,
    level: 9,
    isCurrentUser: false,
  },
  {
    rank: 5,
    username: "Mamadou_L",
    avatar: "👨‍🎓",
    xp: 1450,
    streak: 12,
    level: 8,
    isCurrentUser: false,
  },
  {
    rank: 6,
    username: "You",
    avatar: "🧑‍💻",
    xp: 1240,
    streak: 5,
    level: 7,
    isCurrentUser: true,
  },
  {
    rank: 7,
    username: "Khadija_B",
    avatar: "👩‍🎓",
    xp: 980,
    streak: 8,
    level: 6,
    isCurrentUser: false,
  },
  {
    rank: 8,
    username: "Moustapha_N",
    avatar: "👨‍🎓",
    xp: 720,
    streak: 3,
    level: 4,
    isCurrentUser: false,
  },
];

export const MOCK_USER_PROGRESS: UserProgress = {
  totalXp: 1240,
  level: 7,
  streak: 5,
  coins: 45,
  lessonsCompleted: 23,
  quizzesCompleted: 18,
  timeSpentMinutes: 245,
  rank: 6,
  totalUsers: 156,
};

export const getBadgesByTier = (tier: Badge['tier']): Badge[] => {
  return MOCK_BADGES.filter(b => b.tier === tier);
};

export const getEarnedBadges = (): Badge[] => {
  return MOCK_BADGES.filter(b => b.isEarned);
};

export const getLockedBadges = (): Badge[] => {
  return MOCK_BADGES.filter(b => !b.isEarned);
};
