export type QuestionType =
  | 'multichoice'    
  | 'shortanswer'    
  | 'match'          
  | 'truefalse'      
  | 'essay';         
 
export interface Quiz {
  id           : number;
  coursemodule : number;
  course       : number;
  name         : string;
  intro        : string;
  timeopen     : number;
  timeclose    : number;
  timelimit    : number;
  attempts     : number;        
  grade        : number;
  sumgrades    : number;
  hasquestions : number;
}
 
export interface MoodleAttempt {
  id          : number;
  quiz        : number;
  userid      : number;
  attempt     : number;
  state       : AttemptState;
  timestart   : number;
  timefinish  : number;
  sumgrades   : number | null;
  gradednotificationsenttime: number;
}
 
export type AttemptState = 'inprogress' | 'overdue' | 'finished' | 'abandoned';
 
export interface MoodleQuestion {
  slot        : number;
  type        : QuestionType;
  page        : number;
  html        : string;         
  sequencecheck: number;
  flagged     : boolean;
  status      : string;
  blockedbyprevious: boolean;
  settings?   : string;        
}
 

export interface QuizChoice {
  id      : number;
  text    : string;
  correct?: boolean;           
}
 
export interface IPELANQuestion {
  slot        : number;
  type        : QuestionType;
  questionText: string;
  audioUrl?   : string;        
  imageEmoji? : string;          
  choices     : QuizChoice[]
  matchPairs? : MatchPair[];     
  correctAnswer?: string;   
}
 
/** Paire pour l'exercice d'association */
export interface MatchPair {
  id          : number;
  question    : string;         
  answer      : string;         
  isMatched   : boolean;
  isSelected  : boolean;
}
 
/** Reponse soumise pour une question */
export interface QuizAnswer {
  slot  : number;
  order : number;
  answer: string;                
}
 

export interface QuizResult {
  score       : number;         
  total       : number;          
  percentage  : number;      
  stars       : 1 | 2 | 3;
  xpEarned    : number;
  coinsEarned : number;
  answers     : AnswerResult[];  
  timeTaken   : number;         
}
 
export interface AnswerResult {
  slot        : number;
  isCorrect   : boolean;
  givenAnswer : string;
  correctAnswer: string;
  questionText: string;
}
 
export interface QuizState {
  currentQuiz  : Quiz | null;
  attemptId    : number | null;
  questions    : IPELANQuestion[];
  currentIndex : number;
  answers      : QuizAnswer[];
  score        : number;
  hearts       : number;
  isLoading    : boolean;
  isFinished   : boolean;
  result       : QuizResult | null;
}
 
 