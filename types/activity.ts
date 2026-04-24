import { ActivityType } from '../utils/xpCalculator';

export type { ActivityType };

export interface ActivityProgress {
  moduleId: number;
  courseId: number;
  type: ActivityType;
  bestScore: number;
  totalScore: number;
  attempts: number;
  isCompleted: boolean;
  lastAttempt: string;
  xpEarned: number;
}

export interface ActivityCardData {
  id: number;
  instanceId: number;
  title: string;
  type: ActivityType;
  xp: number;
  order: number;
  sectionId: number;
  sectionName: string;
}

export interface ActivityWithProgress extends ActivityCardData {
  progress?: ActivityProgress;
}

export type SortMode = 'moodle' | 'type';
export type FilterTab = ActivityType | 'all';

export interface PaginationState {
  page: number;
  totalPages: number;
  itemsPerPage: number;
  hasMore: boolean;
}