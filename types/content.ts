import { Langue } from ".";
import { MoodleContentFile } from "./course";

export interface Page {
  id      : number;
  coursemodule: number;
  course  : number;
  name    : string;
  content : string;          
  contentformat: number;
  displayoptions: string;
}
 
export interface VocabWord {
  id          : number;        
  word        : string;        
  translation : string;         
  example     : string;         
  audioUrl?   : string;         
  emoji?      : string;         
}
 
export interface MoodleResource {
  id          : number;
  coursemodule: number;
  course      : number;
  name        : string;
  intro       : string;          
  introformat : number;
  contentfiles: MoodleContentFile[];
}
 
export interface WordTimestamp {
  text : string;                
  tr   : string;      
  t    : number;                 
}
 
export interface AudioBook {
  id       : number;
  title    : string;
  langue   : Langue;
  level    : string;
  version  : 'locuteur_natif' | 'non_locuteur';
  annee    : '1' | '2' | '3';
  audioUrl : string;
  pages    : AudioBookPage[];
  duration : number;           
}
 
export interface AudioBookPage {
  pageNumber : number;
  imageEmoji : string;
  imageGradient: string;
  lines      : AudioBookLine[];
}
 
export interface AudioBookLine {
  words: WordTimestamp[];
}
 