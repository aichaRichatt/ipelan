import { moodleFetch } from '../api/moodleClient';
import { getAuthToken } from '../contentLoader';

const IS_DEV = process.env.NODE_ENV === "development";

export interface MoodleModule {
  id: number;
  instance: number;
  modname: string;
  name: string;
  description?: string;
  contents?: any[];
  url?: string;
}

export interface ResolvedActivityIds {
  cmid: number;
  instanceId: number;
  modname: string;
  name: string;
  description?: string;
  audioUrl?: string;
}

/**
 
 * 
 * @param courseId  
 * @param modname - Type d'activite ('quiz', 'assign', 'choice', 'glossary')
 * @param cmid - Course Module ID (depuis l'URL ou navigation)
 * @param token - Token d'authentification
 * @returns Les IDs résolus + infos de l'activité
 */
export async function resolveActivityInstanceId(
  courseId: number,
  modname: 'quiz' | 'assign' | 'choice' | 'glossary' | string,
  cmid: number,
  token: string
): Promise<ResolvedActivityIds | null> {
  const authToken = getAuthToken(token);
  if (!authToken || !courseId || !cmid) {
    if (IS_DEV) console.warn('[MoodleIdResolver] Missing params:', { courseId, modname, cmid });
    return null;
  }

  try {
    if (IS_DEV) console.log('[MoodleIdResolver] Resolving:', { courseId, modname, cmid });

    const contentsResult = await moodleFetch('/webservice/rest/server.php', {
      wstoken: authToken,
      wsfunction: 'core_course_get_contents',
      moodlewsrestformat: 'json',
      courseid: courseId,
      options: [],
    });

    if (contentsResult?.exception) {
      if (IS_DEV) console.warn('[MoodleIdResolver] API error:', contentsResult.message);
      return null;
    }

    const sections = Array.isArray(contentsResult) ? contentsResult : [contentsResult];

    for (const section of sections) {
      const modules = section.modules || [];

      for (const mod of modules) {
        if (mod.modname === modname && mod.id === cmid) {
          if (IS_DEV) console.log('[MoodleIdResolver] Found:', {
            cmid: mod.id,
            instanceId: mod.instance,
            modname: mod.modname,
            name: mod.name
          });

          const audioUrl = extractAudioUrl(mod.description || mod.intro || '');

          return {
            cmid: mod.id,
            instanceId: mod.instance,
            modname: mod.modname,
            name: mod.name || mod.instancename || 'Unknown',
            description: mod.description || mod.intro || '',
            audioUrl,
          };
        }
      }
    }

    if (IS_DEV) console.warn('[MoodleIdResolver] Module not found:', { modname, cmid });
    return null;

  } catch (err: any) {
    if (IS_DEV) console.error('[MoodleIdResolver] Error:', err.message);
    return null;
  }
}


export async function getModulesByType(
  courseId: number,
  modname: 'quiz' | 'assign' | 'choice' | 'glossary' | string,
  token: string
): Promise<ResolvedActivityIds[]> {
  const authToken = getAuthToken(token);
  if (!authToken || !courseId) return [];

  try {
    const contentsResult = await moodleFetch('/webservice/rest/server.php', {
      wstoken: authToken,
      wsfunction: 'core_course_get_contents',
      moodlewsrestformat: 'json',
      courseid: courseId,
      options: [],
    });

    if (contentsResult?.exception) return [];

    const results: ResolvedActivityIds[] = [];
    const sections = Array.isArray(contentsResult) ? contentsResult : [contentsResult];

    for (const section of sections) {
      for (const mod of section.modules || []) {
        if (mod.modname === modname) {
          const audioUrl = extractAudioUrl(mod.description || mod.intro || '');
          results.push({
            cmid: mod.id,
            instanceId: mod.instance,
            modname: mod.modname,
            name: mod.name || mod.instancename || 'Unknown',
            description: mod.description || mod.intro || '',
            audioUrl,
          });
        }
      }
    }

    if (IS_DEV) console.log(`[MoodleIdResolver] Found ${results.length} ${modname} modules`);
    return results;

  } catch (err: any) {
    if (IS_DEV) console.error('[MoodleIdResolver] Error:', err.message);
    return [];
  }
}


export function extractAudioUrl(html: string): string | undefined {
  if (!html) return undefined;

  const audioMatch = html.match(/<audio[^>]*src=["']([^"']+)["']/i);
  if (audioMatch) return audioMatch[1];

  const sourceMatch = html.match(/<source[^>]*src=["']([^"']+\.(mp3|wav|m4a|ogg))["']/i);
  if (sourceMatch) return sourceMatch[1];

  const linkMatch = html.match(/(https?:\/\/[^"']+\.(mp3|wav|m4a|ogg))/i);
  if (linkMatch) return linkMatch[1];

  const pluginMatch = html.match(/(https?:\/\/[^"']+pluginfile\.php[^"']+\.(mp3|wav|m4a|ogg))/i);
  if (pluginMatch) return pluginMatch[1];

  return undefined;
}

/**
 * Convertit une URL pluginfile.php en URL avec token pour les web services
 */
export function convertFileUrlForAuth(fileUrl: string, token: string): string {
  if (!fileUrl) return '';

  let url = fileUrl;

  // Remplacer pluginfile.php → webservice/pluginfile.php
  url = url.replace('/pluginfile.php/', '/webservice/pluginfile.php/');

  if (!url.includes('token=') && !url.includes('wstoken=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}token=${token}`;
  }

  return url;
}


export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export default {
  resolveActivityInstanceId,
  getModulesByType,
  extractAudioUrl,
  convertFileUrlForAuth,
  stripHtml,
};