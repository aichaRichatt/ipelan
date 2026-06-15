import { getCourseModules } from './moduleResolver';
import { moodleFetch } from './moodleClient';

const IS_DEV = process.env.NODE_ENV === 'development';

export interface WordPair {
  id: number;
  concept: string;
  definition: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export async function getAssociationPairs(
  courseId: number,
  glossaryInstanceId: number,
  token: string
): Promise<WordPair[]> {
  try {
    if (glossaryInstanceId > 0) {
      const result = await moodleFetch('/webservice/rest/server.php', {
        wstoken: token,
        wsfunction: 'mod_glossary_get_entries_by_letter',
        moodlewsrestformat: 'json',
        id: glossaryInstanceId,
        letter: 'ALL',
        from: 0,
        limit: 100,
      });

      if (result?.exception) {
        if (IS_DEV) console.warn('[associationService] get_entries error:', result.message);
        return [];
      }

      return (result?.entries || []).map((e: any) => ({
        id: e.id,
        concept: e.concept,
        definition: stripHtml(e.definition || ''),
      }));
    }

    const modules = await getCourseModules(courseId, token);

    if (IS_DEV) console.log('[associationService] All modules:', modules.map(m => ({
      id: m.id,
      name: m.name,
      modname: m.modname
    })));

    const glossary = modules.find(m => m.modname === 'glossary');

    if (!glossary) {
      if (IS_DEV) console.warn('[associationService] No glossary found in course:', courseId);
      if (IS_DEV) console.warn('[associationService] Available modnames:', [...new Set(modules.map(m => m.modname))]);
      return [];
    }

    if (IS_DEV) console.log('[associationService] Found glossary:', {
      id: glossary.id,
      name: glossary.name,
      instance: glossary.instance
    });

    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_glossary_get_entries_by_letter',
      moodlewsrestformat: 'json',
      id: glossary.instance,
      letter: 'ALL',
      from: 0,
      limit: 100,
    });

    if (result?.exception) {
      if (IS_DEV) console.warn('[associationService] get_entries error:', result.message);
      return [];
    }

    return (result?.entries || []).map((e: any) => ({
      id: e.id,
      concept: e.concept,
      definition: stripHtml(e.definition || ''),
    }));
  } catch (err: any) {
    if (IS_DEV) console.warn('[associationService] Exception:', err.message);
    return [];
  }
}