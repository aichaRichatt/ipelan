export type SyncActionType =
  | 'quiz_result'
  | 'completion'
  | 'xp_update'
  | 'coins_update'
  | 'streak_update';
 
export interface SyncQueueItem {
  id         : string;         
  type       : SyncActionType;
  payload    : Record<string, any>;
  createdAt  : number;         
  attempts   : number;
  lastAttempt: number | null;
  status     : SyncStatus;
}
 
export type SyncStatus = 'pending' | 'syncing' | 'done' | 'failed';
 
export interface OfflineState {
  isOnline         : boolean;
  pendingSyncCount : number;
  isSyncing        : boolean;
  cachedCourseIds  : number[];
  downloadedFiles  : string[];  
  lastSyncAt       : number | null;
}
 