import { Langue } from ".";

export type LibraryFileType = 'pdf' | 'audio' | 'video';
 
export type ManualVersion = 'locuteur_natif' | 'non_locuteur';
 
export type SchoolYear = '1' | '2' | '3';
 
export interface LibraryBook {
  id           : number;
  moduleId     : number;         
  title        : string;
  langue       : Langue;
  annee        : SchoolYear;
  version      : ManualVersion;
  fileType     : LibraryFileType;
  fileUrl      : string;
  fileSize     : number;        
  mimeType     : string;
  coverColor   : string;      
  tags         : string[];
  popularityScore: number;     
  isDownloaded : boolean;
  localPath?   : string;         
  lastRead?    : number;       
}
 
export interface LibraryFilter {
  annee    : SchoolYear | 'all';
  version  : ManualVersion | 'all';
  fileType : LibraryFileType | 'all';
  sort     : 'popular' | 'recent' | 'name';
}
 
export interface LibraryState {
  books     : LibraryBook[];
  filter    : LibraryFilter;
  isLoading : boolean;
  error     : string | null;
}