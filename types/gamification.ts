import { Langue, Niveau } from ".";

export interface Badge {
  id          : number;
  name        : string;
  description : string;
  timecreated : number;
  timemodified: number;
  usercreated : number;
  usermodified: number;
  issuername  : string;
  issuerurl   : string;
  issuercontact: string;
  expiredate  : number | null;
  expireperiod: number | null;
  type        : number;
  courseid    : number | null;
  message     : string;
  messagesubject: string;
  attachment  : number;
  notification: number;
  status      : number;
  issuedid?   : number;         
  dateissued? : number;
  uniquehash? : string;
  badgeurl    : string;
}
 

export interface IPELANBadge {
  id          : number;
  name        : string;
  description : string;
  emoji       : string;          
  condition   : string;          
  xpReward    : number;
  isEarned    : boolean;
  dateEarned? : number;
}
 

export interface LeaderboardEntry {
  rank     : number;
  userId   : number;
  username : string;
  fullname : string;
  avatar   : string;
  xp       : number;
  level    : number;
  langue   : Langue;
  streak   : number;
  isCurrentUser: boolean;
}
 
export interface LeaderboardFilter {
  langue  : Langue | 'all';
  period  : 'week' | 'month' | 'alltime';
}
 
export interface UserState {
  xp       : number;
  coins    : number;
  streak   : number;
  level    : number;
  langue   : Langue;
  niveau   : Niveau;
  badges   : IPELANBadge[];
  isLoading: boolean;
}
 