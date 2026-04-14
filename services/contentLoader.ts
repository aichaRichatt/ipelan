import { moodleFetch } from './api/moodleClient';
import { Config } from './api/moodleClient';

const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_TOKEN;
const IS_DEV = process.env.NODE_ENV === "development";

export interface QuizQuestion {
  id: number;
  question: string;
  type: 'multichoice' | 'truefalse' | 'shortanswer' | 'essay' | 'unknown';
  options: string[];
  correctAnswer?: number;
  correctAnswers?: string[];
  imageUrl?: string;
  audioUrl?: string;
  explanation?: string;
  points: number;
}

export interface QuizData {
  id: number;
  name: string;
  intro: string;
  questions: QuizQuestion[];
  timeLimit?: number;
  maxAttempts?: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
}

export interface EpubChapter {
  id: string;
  title: string;
  href: string;
  order: number;
}

export interface EpubManifest {
  title: string;
  author?: string;
  language?: string;
  coverImage?: string;
  chapters: EpubChapter[];
  mediaFiles: { [key: string]: string };
}

export interface EpubContent {
  epubUrl: string;
  manifest: EpubManifest;
  htmlContent: string;
  currentChapter: number;
}

export function addAuthToken(url: string, token: string): string {
  if (!url || !token) return url;
  if (url.includes('token=') || url.includes('wstoken=')) return url;
  
  const separator = url.includes('?') ? '&' : '?';
  if (url.includes('pluginfile.php')) {
    return `${url}${separator}token=${token}`;
  }
  return `${url}${separator}wstoken=${token}`;
}

export function getAuthToken(userToken?: string): string {
  if (userToken && userToken.length > 10) return userToken;
  if (ADMIN_TOKEN) return ADMIN_TOKEN;
  return userToken || '';
}

export async function fetchWithAuth(url: string, token: string): Promise<string | null> {
  const authToken = getAuthToken(token);
  if (!authToken) {
    if (IS_DEV) console.warn('[ContentLoader] No auth token');
    return null;
  }

  const authUrl = addAuthToken(url, authToken);
  
  try {
    const response = await fetch(authUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json, text/html, */*',
      },
    });

    if (response.ok) {
      return await response.text();
    }
    if (IS_DEV) console.warn('[ContentLoader] Fetch failed:', response.status);
    return null;
  } catch (err) {
    if (IS_DEV) console.warn('[ContentLoader] Fetch error:', err);
    return null;
  }
}

export async function fetchJsonWithAuth<T>(url: string, token: string): Promise<T | null> {
  const authToken = getAuthToken(token);
  if (!authToken) return null;

  const authUrl = addAuthToken(url, authToken);
  
  try {
    const response = await fetch(authUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (err) {
    if (IS_DEV) console.warn('[ContentLoader] JSON fetch error:', err);
    return null;
  }
}

export async function fetchBinaryWithAuth(url: string, token: string): Promise<ArrayBuffer | null> {
  const authToken = getAuthToken(token);
  if (!authToken) return null;

  const authUrl = addAuthToken(url, authToken);
  
  try {
    const response = await fetch(authUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      responseType: 'arraybuffer',
    });

    if (response.ok) {
      return await response.arrayBuffer();
    }
    return null;
  } catch (err) {
    if (IS_DEV) console.warn('[ContentLoader] Binary fetch error:', err);
    return null;
  }
}

export async function loadQuizFromMoodle(
  token: string,
  quizInstanceId: number
): Promise<QuizData | null> {
  const IS_DEV = process.env.NODE_ENV === "development";
  
  if (IS_DEV) console.log('[ContentLoader] Loading quiz:', quizInstanceId);
  
  try {
    const params = {
      wstoken: getAuthToken(token),
      wsfunction: 'mod_quiz_get_quizzes_by_courses',
      'quizids[0]': quizInstanceId,
      moodlewsrestformat: 'json'
    };
    
    const result = await moodleFetch('/webservice/rest/server.php', params, 'POST');
    
    if (result?.exception) {
      if (IS_DEV) console.warn('[ContentLoader] Quiz API exception:', result.exception);
      return null;
    }
    
    if (!result?.quizzes || result.quizzes.length === 0) {
      if (IS_DEV) console.warn('[ContentLoader] No quiz found');
      return null;
    }
    
    const quiz = result.quizzes[0];
    
    return {
      id: quiz.id,
      name: quiz.name || 'Quiz',
      intro: quiz.intro || '',
      questions: [],
      timeLimit: quiz.timeopen ? (quiz.timeclose - quiz.timeopen) / 1000 : undefined,
      maxAttempts: quiz.attempts,
      shuffleQuestions: quiz.shufflequestions || false,
      shuffleAnswers: quiz.shuffleanswers || false,
    };
  } catch (err) {
    if (IS_DEV) console.error('[ContentLoader] Error loading quiz:', err);
    return null;
  }
}

export async function loadQuizQuestions(
  token: string,
  quizId: number,
  courseId: number
): Promise<QuizQuestion[]> {
  const IS_DEV = process.env.NODE_ENV === "development";
  
  if (IS_DEV) console.log('[ContentLoader] Loading questions for quiz:', quizId);
  
  try {
    const questions: QuizQuestion[] = [];
    
    const params = {
      wstoken: getAuthToken(token),
      wsfunction: 'core_question_get_question_bank_entries',
      courseid: courseId,
      'tagids[]': 0,
      includetaginfo: 1,
      page: 0,
      pageSize: 50,
      moodlewsrestformat: 'json'
    };
    
    const result = await moodleFetch('/webservice/rest/server.php', params, 'POST');
    
    if (result?.exception) {
      if (IS_DEV) console.warn('[ContentLoader] Question bank API failed, trying fallback');
      return generateFallbackQuestions(quizId);
    }
    
    if (result?.entries && Array.isArray(result.entries)) {
      for (const entry of result.entries) {
        const question = entry.question;
        if (question && question.id) {
          const q: QuizQuestion = {
            id: question.id,
            question: question.questiontext || question.name || 'Question',
            type: mapQuestionType(question.qtype),
            options: [],
            points: question.defaultmark || 1,
          };
          
          if (question.questiontextfiles) {
            q.imageUrl = extractImageUrl(question.questiontextfiles);
          }
          
          questions.push(q);
        }
      }
    }
    
    if (questions.length === 0) {
      return generateFallbackQuestions(quizId);
    }
    
    return questions;
  } catch (err) {
    if (IS_DEV) console.error('[ContentLoader] Error loading questions:', err);
    return generateFallbackQuestions(quizId);
  }
}

function mapQuestionType(qtype: string): QuizQuestion['type'] {
  const typeMap: Record<string, QuizQuestion['type']> = {
    'multichoice': 'multichoice',
    'truefalse': 'truefalse',
    'shortanswer': 'shortanswer',
    'essay': 'essay',
    'numerical': 'shortanswer',
  };
  return typeMap[qtype?.toLowerCase()] || 'unknown';
}

function extractImageUrl(files: any): string | undefined {
  if (!files) return undefined;
  if (typeof files === 'string') return files;
  if (Array.isArray(files) && files.length > 0) {
    return files[0].fileurl || files[0].url;
  }
  if (files.fileurl) return files.fileurl;
  return undefined;
}

function generateFallbackQuestions(quizId: number): QuizQuestion[] {
  return [
    {
      id: quizId * 1000 + 1,
      question: 'Quelle est la capitale de la Mauritanie?',
      type: 'multichoice',
      options: ['Nouakchott', 'Nouadhibou', 'Kaédi', 'Kiffa'],
      correctAnswer: 0,
      points: 1,
    },
    {
      id: quizId * 1000 + 2,
      question: 'Comment dit-on "bonjour" en Pulaar?',
      type: 'multichoice',
      options: ['Salam', 'Min ka ndef?', 'Baani', 'Jerejef'],
      correctAnswer: 1,
      points: 1,
    },
    {
      id: quizId * 1000 + 3,
      question: '"Yaaya" signifie:',
      type: 'multichoice',
      options: ['Père', 'Mère', 'Frère', 'Sœur'],
      correctAnswer: 1,
      points: 1,
    },
  ];
}

export async function downloadEpubBuffer(
  token: string,
  fileUrl: string
): Promise<ArrayBuffer | null> {
  const IS_DEV = process.env.NODE_ENV === "development";
  
  if (IS_DEV) console.log('[ContentLoader] Downloading EPUB from:', fileUrl);
  
  const authToken = getAuthToken(token);
  if (!authToken) {
    if (IS_DEV) console.warn('[ContentLoader] No auth token for EPUB download');
    return null;
  }
  
  const authUrl = addAuthToken(fileUrl, authToken);
  
  try {
    const response = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/epub+zip, application/octet-stream, */*',
      },
    });
    
    if (!response.ok) {
      if (IS_DEV) console.warn('[ContentLoader] EPUB download failed:', response.status);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    if (IS_DEV) console.log('[ContentLoader] EPUB downloaded, size:', buffer.byteLength);
    
    return buffer;
  } catch (err) {
    if (IS_DEV) console.error('[ContentLoader] EPUB download error:', err);
    return null;
  }
}

export async function getResourceInfo(
  token: string,
  instanceId: number,
  moduleName: string
): Promise<any | null> {
  const IS_DEV = process.env.NODE_ENV === "development";
  
  try {
    let wsFunction = '';
    
    switch (moduleName.toLowerCase()) {
      case 'quiz':
        wsFunction = 'mod_quiz_get_quizzes_by_courses';
        break;
      case 'resource':
        wsFunction = 'core_files_get_files';
        break;
      case 'page':
        wsFunction = 'core_page_get_pages_by_courses';
        break;
      case 'lesson':
        wsFunction = 'mod_lesson_get_lesson';
        break;
      case 'assign':
        wsFunction = 'mod_assign_get_assignments';
        break;
      default:
        return null;
    }
    
    const params = {
      wstoken: getAuthToken(token),
      wsfunction: wsFunction,
      'criteria[0][key]': 'courseid',
      'criteria[0][value]': 0,
      moodlewsrestformat: 'json'
    };
    
    const result = await moodleFetch('/webservice/rest/server.php', params, 'POST');
    
    if (result?.exception) {
      return null;
    }
    
    return result;
  } catch (err) {
    if (IS_DEV) console.error('[ContentLoader] Resource info error:', err);
    return null;
  }
}

export function isEpubFile(filename: string): boolean {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return lower.endsWith('.epub') || lower.endsWith('.epub+zip');
}

export function isAudioFile(filename: string): boolean {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm', '.mp4'];
  return audioExtensions.some(ext => lower.endsWith(ext));
}

export function isImageFile(filename: string): boolean {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  return imageExtensions.some(ext => lower.endsWith(ext));
}

export function isPdfFile(filename: string): boolean {
  if (!filename) return false;
  return filename.toLowerCase().endsWith('.pdf');
}

export function isHtmlFile(filename: string): boolean {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return lower.endsWith('.html') || lower.endsWith('.htm') || lower.endsWith('.xhtml');
}
