export type Langue = 'pulaar' | 'soninke' | 'wolof' | 'french' | 'arabic';

export interface CourseCategory {
  id: number;
  name: string;
  description: string;
}

export interface CourseSection {
  id: number;
  courseid: number;
  name: string;
  summary: string;
  section: number;
  hiddenbynumsections: number;
  uservisible: number;
}

export interface CourseModule {
  id: number;
  courseid: number;
  sectionid: number;
  name: string;
  modname: string;
  modplural: string;
  modicon: string;
  indent: number;
  url: string;
  description: string;
  visible: number;
  uservisible: number;
  completion: number;
}

export interface ModuleContent {
  id?: number; 
  moduleid: number;
  type: string;
  filename: string;
  filepath: string;
  filesize: number;
  fileurl: string;
  timecreated: number;
  timemodified: number;
  sortorder: number;
  userid: number;
  author: string;
  license: string;
}

export type Niveau = 'fondamental' | 'intermediaire' | 'avance';

export interface MoodleCustomField {
  shortname: string;
  value: string;
  type: string;
  name: string;
}

export interface MoodleUser {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  fullname: string;
  email: string;
  profileimageurl?: string;
  profileimageurlsmall?: string;
  lastaccess: number;
  customfields?: MoodleCustomField[];
  ipelan_xp?: number;
  coins?: number;
  streak?: number;
}

export interface IPELANUser {
  id: number;
  username: string;
  image?: string;
  firstname?: string;
  lastname?: string;
  fullname: string;
  email: string;
  avatar?: string;
  // custom fields & gamification
  langue?: Langue;
  niveau?: Niveau;
  level?: number;
  ipelan_xp: number;
  xp?: number; 
  coins: number;
  streak: number;
  modules?: string;
  notifs?: boolean;
  sons?: boolean;
  avatarUrl?: string;
  token?: string;
}

export interface TokenResponse {
  token?: string;
  error?: string;
  stacktrace?: string;
}

export interface AuthState {
  user: IPELANUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginForm {
  username: string;
  password: string;
}

export interface SignupForm {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  city: string;
  username?: string;
  langue?: Langue;
}

export interface FormErrors<T> {
  [K: string]: string | undefined;
  general?: string;
}