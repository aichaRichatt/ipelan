 
export type Langue = 'pulaar' | 'soninke' | 'wolof';
 
export type Niveau = 'fondamental' | 'intermediaire' | 'avance';
 
export interface MoodleCustomField {
  shortname : string;
  value     : string;
  type      : string;
  name      : string;
}
 
export interface MoodlUser {
  id                : number;
  username          : string;
  firstname         : string;
  lastname          : string;
  fullname          : string;
  email             : string;
  profileimageurl?   : string;
  profileimageurlsmall?: string;
  lastaccess        : number;       
  customfields?     : MoodleCustomField[];
}
 
export interface IPELANUser {
  id       : number;
  username : string;
  firstname: string;
  lastname : string;
  fullname : string;
  email    : string;
  avatar?   : string;           
  // custom fields
  langue   : Langue;
  niveau   : Niveau;
  level    : number;             
  xp       : number;             
  coins    : number;            
  streak?   : number;           
  modules  : string;             
  notifs   : boolean;           
  sons?     : boolean;         
  avatarUrl?: string;            
}
 
export interface TokenResponse {
  token?      : string;
  error?      : string;
  stacktrace? : string;
}
 
export interface AuthState {
  token     : string | null;
  user      : IPELANUser | null;
  isLoading : boolean;
  error     : string | null;
}
 
export interface LoginForm {
  email : string;
  password : string;
}
 
export interface SignupForm {
  firstname : string;
  lastname  : string;
  email     : string;
  password  : string;
  langue    : Langue;
}
 
export interface FormErrors<T> {
  [K: string]: string | undefined;
  general?   : string;
}
 