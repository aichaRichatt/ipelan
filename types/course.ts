import { Langue, Niveau } from ".";

export interface Category {
  id          : number;
  name        : string;
  parent      : number;
  coursecount : number;
  description : string;
  visible     : number;
}
 
export interface Course {
  id                : number;
  shortname         : string;
  fullname          : string;
  displayname       : string;
  categoryid        : number;
  summary           : string;
  summaryformat     : number;
  visible           : number;
  enablecompletion  : number;
  progress?         : number;      
  completed?        : boolean;
  enrolledusercount?: number;
  timecreated       : number;
}
 

export interface IPELANCourse extends Course {
  langue          : Langue;
  progressPercent : number;      
  completedModules: number;
  totalModules    : number;
  isEnrolled      : boolean;
}
 
export interface MoodleContentFile {
  filename    : string;
  filepath    : string;
  filesize    : number;
  fileurl     : string;
  timecreated : number;
  timemodified: number;
  mimetype    : string;
  isexternalfile: boolean;
}
 
export interface MoodleModule {
  id                : number;
  url               : string;
  name              : string;
  instance          : number;
  contextid         : number;
  description?      : string;
  visible           : number;
  modname           : ModuleType;   
  modplural         : string;
  completion        : number;        // 0=desactive, 1=manuel, 2=auto
  completiondata?   : CompletionData;
  contents?         : MoodleContentFile[];
}
 

export type ModuleType = 'page' | 'resource' | 'quiz' | 'url' | 'label' | 'assign';
 
export interface CompletionData {
  state           : CompletionState;
  timecompleted   : number;
  overrideby      : number | null;
  valueused       : boolean;
  hascompletion   : boolean;
  isautomatic     : boolean;
}
 

export type CompletionState = 0 | 1 | 2;
// 0 = non commence | 1 = complete | 2 = complete avec note
 
export interface MoodleSection {
  id          : number;
  name        : string;
  visible     : number;
  summary     : string;
  summaryformat: number;
  section     : number;             
  uservisible : boolean;
  availabilityinfo?: string;
  modules     : MoodleModule[];
}
 
export interface IPELANSection {
  id          : number;
  title       : string;
  tag         : Niveau;             
  icon        : string;  //imoji            
  xpReward    : number;
  status      : SectionStatus;
  progress    : number;             
  modules     : MoodleModule[];
  isLocked    : boolean;
  isCurrent   : boolean;
}
 
export type SectionStatus = 'not_started' | 'in_progress' | 'completed' | 'locked';
 
 