import { moodleFetch } from './moodleClient';

export interface MoodleModule {
  id: number;
  instance: number;
  modname: string;
  name: string;
  description?: string;
  intro?: string;
  introfiles?: Array<{ fileurl: string; filename: string }>;
  contents?: Array<{ fileurl: string; filename: string; mimetype: string }>;
}

const moduleCache = new Map<number, MoodleModule[]>();

export async function getCourseModules(courseId: number, token: string): Promise<MoodleModule[]> {
  if (moduleCache.has(courseId)) return moduleCache.get(courseId)!;

  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_course_get_contents',
      moodlewsrestformat: 'json',
      courseid: courseId,
    });

    if (result?.exception) {
      console.warn('[moduleResolver] get_contents failed:', result.message);
      return [];
    }

    const modules: MoodleModule[] = [];
    for (const section of result || []) {
      for (const mod of section.modules ?? []) {
        modules.push({
          id: mod.id,
          instance: mod.instance,
          modname: mod.modname,
          name: mod.name,
          description: mod.description,
          intro: mod.intro,
          introfiles: mod.introfiles,
          contents: mod.contents,
        });
      }
    }

    moduleCache.set(courseId, modules);
    return modules;
  } catch (err: any) {
    console.warn('[moduleResolver] Exception:', err.message);
    return [];
  }
}

export async function resolveInstanceId(
  courseId: number,
  cmid: number,
  modname: string,
  token: string
): Promise<number | null> {
  const modules = await getCourseModules(courseId, token);
  const mod = modules.find(m => m.id === cmid && m.modname === modname);
  return mod?.instance ?? null;
}

export function clearModuleCache(courseId?: number): void {
  if (courseId) {
    moduleCache.delete(courseId);
  } else {
    moduleCache.clear();
  }
}