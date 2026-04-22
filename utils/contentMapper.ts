import { ActivityType } from './xpCalculator';

export interface ModuleContent {
  filename: string;
  fileurl: string;
  type: string;
  mimetype?: string;
  fileSize?: number;
}

export interface ParsedModule {
  id: number;
  name: string;
  modname: string;
  modplural: string;
  instance: number;
  contextLevel?: number;
  instanceId?: number;
  description?: string;
  contents: ModuleContent[];
  visible: number;
  uservisible?: boolean;
  available?: boolean;
  availability?: string;
  completion?: number;
  completiondata?: any;
}

export interface MappedContent {
  type: ActivityType;
  source: 'moodle' | 'fallback';
  module: ParsedModule;
  fileUrl?: string;
  htmlContent?: string;
  audioUrl?: string;
  epubUrl?: string;
  pdfUrl?: string;
  imageUrls?: string[];
  externalUrl?: string;
}

const MODNAME_MAP: Record<string, ActivityType> = {
  quiz: 'quiz',
  lesson: 'association',
  page: 'html',
  resource: 'resource',
  assign: 'dictation',
  choice: 'listening',
  scorm: 'lesson',
  folder: 'folder',
  forum: 'forum',
  feedback: 'quiz',
  survey: 'quiz',
  workshop: 'quiz',
  lti: 'lesson',
  imscp: 'lesson',
  tracker: 'lesson',
  data: 'lesson',
  chat: 'lesson',
  glossary: 'association',
  label: 'label',
  book: 'book',
  url: 'url',
  h5p: 'h5p',
  bigbluebuttonbn: 'bbb',
  zoom: 'zoom',
  custom: 'lesson',
};

const AUDIO_MIMETYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
];

const IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

export function mapModuleToContentType(module: ParsedModule): MappedContent {
  const modname = module.modname?.toLowerCase() || '';
  
  const result: MappedContent = {
    type: MODNAME_MAP[modname] || 'html',
    source: 'moodle',
    module,
  };

  if (!module.contents || module.contents.length === 0) {
    if (module.description) {
      result.type = 'html';
      result.htmlContent = module.description;
    }
    return result;
  }

  for (const content of module.contents) {
    const filename = content.filename?.toLowerCase() || '';
    const mimetype = content.mimetype || '';
    const type = content.type || '';

    if (AUDIO_MIMETYPES.some(m => mimetype.includes(m.split('/')[1])) || 
        filename.endsWith('.mp3') || 
        filename.endsWith('.wav') ||
        filename.endsWith('.ogg') ||
        type.includes('audio')) {
      result.type = 'listening';
      result.audioUrl = content.fileurl;
      return result;
    }

    if (filename.endsWith('.epub') || filename.endsWith('.epub+zip')) {
      result.type = 'lesson';
      result.epubUrl = content.fileurl;
      return result;
    }

    if (filename.endsWith('.pdf')) {
      result.type = 'lesson';
      result.pdfUrl = content.fileurl;
      return result;
    }

    if (filename.endsWith('.html') || filename.endsWith('.xhtml') || filename.endsWith('.htm')) {
      result.type = 'html';
      result.htmlContent = content.fileurl;
      result.fileUrl = content.fileurl;
      return result;
    }

    if (IMAGE_MIMETYPES.some(m => mimetype.includes(m.split('/')[1])) || 
        filename.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
      if (!result.imageUrls) result.imageUrls = [];
      result.imageUrls.push(content.fileurl);
    }
  }

  if (result.type === 'resource' || result.type === 'lesson' || result.type === 'folder') {
    if (module.contents[0]?.fileurl) {
      result.fileUrl = module.contents[0].fileurl;
      const firstFilename = module.contents[0].filename?.toLowerCase() || '';
      if (firstFilename.endsWith('.pdf')) {
        result.pdfUrl = module.contents[0].fileurl;
      } else if (firstFilename.endsWith('.epub') || firstFilename.endsWith('.epub+zip')) {
        result.epubUrl = module.contents[0].fileurl;
      }
    }
  }

  return result;
}

export function getContentTypeLabel(type: ActivityType): string {
  const labels: Record<ActivityType, string> = {
    quiz: 'Quiz',
    dictation: 'Dictée',
    listening: 'Compréhension orale',
    association: 'Association',
    wordOrder: 'Ordre des mots',
    lesson: 'Leçon',
    html: 'Contenu',
    resource: 'Fichier',
    folder: 'Dossier',
    book: 'Livre',
    label: 'Note',
  };
  return labels[type] || 'Activité';
}

export function getContentTypeIcon(type: ActivityType): string {
  const icons: Record<ActivityType, string> = {
    quiz: 'edit-2',
    dictation: 'edit-3',
    listening: 'headphones',
    association: 'link',
    wordOrder: 'layers',
    lesson: 'book-open',
    html: 'file-text',
    resource: 'file',
    folder: 'folder',
    book: 'book',
    label: 'info',
  };
  return icons[type] || 'file';
}

export function getContentTypeColor(type: ActivityType): string {
  const colors: Record<ActivityType, string> = {
    quiz: '#F87171',
    dictation: '#F59E0B',
    listening: '#10B981',
    association: '#9333EA',
    wordOrder: '#4a90e2',
    lesson: '#002366',
    html: '#6B7280',
    resource: '#059669',
    folder: '#D97706',
    book: '#7C3AED',
    label: '#EC4899',
  };
  return colors[type] || '#6B7280';
}

export function isActivity(type: ActivityType): boolean {
  return ['quiz', 'dictation', 'listening', 'association', 'wordOrder'].includes(type);
}

export function isContent(type: ActivityType): boolean {
  return ['lesson', 'html'].includes(type);
}
