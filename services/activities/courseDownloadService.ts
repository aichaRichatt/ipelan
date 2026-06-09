/**
 * courseDownloadService — Téléchargement en batch de toutes les activités d'un cours.
 *
 * Principe offline-first :
 *   1. Fetch les données depuis Moodle (1 appel réseau par type si possible)
 *   2. Cache SQLite via cacheActivity()
 *   3. Télécharge les fichiers audio localement via downloadActivityAudio()
 *
 * Appelé depuis [courseId].tsx bouton "Télécharger pour hors-ligne".
 */

import { moodleCall }                      from '../api/moodleClient';
import {
  cacheActivity,
  downloadActivityAudio,
  type ActivityType,
}                                          from './activityOfflineService';

const IS_DEV = process.env.NODE_ENV === 'development';

const AUDIO_RE = /\.(mp3|wav|m4a|ogg|opus|aac)(\?|$)/i;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DownloadableActivity {
  cmid      : number;
  instanceId: number;
  type      : ActivityType | 'quiz';
  title     : string;
  courseId  : number;
}

export interface CourseDownloadProgress {
  current     : number;
  total       : number;
  currentTitle: string;
  done        : boolean;
}

export type ProgressCallback = (p: CourseDownloadProgress) => void;

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Télécharge et met en cache toutes les activités interactives d'un cours.
 * Les quiz sont ignorés (ils ont leur propre service `quizOfflineService`).
 */
export async function downloadCourseActivities(
  courseId  : number,
  token     : string,
  activities: DownloadableActivity[],
  onProgress?: ProgressCallback
): Promise<void> {
  const interactive = activities.filter(a => a.type !== 'quiz');
  const total = interactive.length;
  let   current = 0;

  // Pré-charger en 1 appel chacun (évite N appels pour N activités du même type)
  const allAssignments  = await fetchAllAssignments(courseId, token);
  const courseContents  = await fetchCourseContents(courseId, token);

  for (const activity of interactive) {
    onProgress?.({ current, total, currentTitle: activity.title, done: false });

    try {
      switch (activity.type) {
        case 'dictation':
          await cacheDictation(activity, token, allAssignments);
          break;
        case 'listening':
          await cacheListening(activity, token, courseContents);
          break;
        case 'association':
          await cacheAssociation(activity, token);
          break;
        case 'word_order':
          await cacheWordOrder(activity, token);
          break;
      }
    } catch (e) {
      if (IS_DEV) console.warn(`[CourseDownload] cmid ${activity.cmid} (${activity.type}) failed:`, e);
    }

    current++;
    onProgress?.({ current, total, currentTitle: activity.title, done: false });
  }

  onProgress?.({ current: total, total, currentTitle: '', done: true });
}

// ─── Fetch helpers (1 appel par type autant que possible) ────────────────────

async function fetchAllAssignments(courseId: number, token: string): Promise<any[]> {
  try {
    const result = await moodleCall('mod_assign_get_assignments', {
      'courseids[0]': courseId,
    }, token);
    if (result?.exception) return [];
    const assignments: any[] = [];
    for (const c of result?.courses ?? []) {
      assignments.push(...(c.assignments ?? []));
    }
    return assignments;
  } catch {
    return [];
  }
}

async function fetchCourseContents(courseId: number, token: string): Promise<any[]> {
  try {
    const result = await moodleCall('core_course_get_contents', { courseid: courseId }, token);
    if (result?.exception || !Array.isArray(result)) return [];
    return result;
  } catch {
    return [];
  }
}

// ─── Par type d'activité ──────────────────────────────────────────────────────

async function cacheDictation(
  activity   : DownloadableActivity,
  token      : string,
  assignments: any[]
): Promise<void> {
  const assignment = assignments.find((a: any) => a.id === activity.instanceId);
  if (!assignment) {
    if (IS_DEV) console.warn(`[CourseDownload] assign ${activity.instanceId} not found in batch`);
    return;
  }

  // Extraire les mots depuis l'intro HTML
  const words = parseDictationWords(assignment.intro || '');

  // Extraire l'URL audio brute (sans token)
  const allFiles = [...(assignment.introfiles ?? []), ...(assignment.introattachments ?? [])];
  const audioFile = allFiles.find((f: any) =>
    AUDIO_RE.test(f?.filename || '') || AUDIO_RE.test(f?.fileurl || '')
  );
  let rawAudioUrl: string | null = audioFile?.fileurl
    ? stripToken(audioFile.fileurl.replace('/pluginfile.php/', '/webservice/pluginfile.php/'))
    : null;

  const data = {
    id       : activity.instanceId,
    title    : assignment.name || activity.title,
    audioUrl : rawAudioUrl ?? undefined,
    words,
  };

  await cacheActivity(activity.cmid, 'dictation', activity.courseId, data, rawAudioUrl);

  if (rawAudioUrl) {
    await downloadActivityAudio(activity.cmid, rawAudioUrl, token);
  }
}

async function cacheListening(
  activity      : DownloadableActivity,
  token         : string,
  courseContents: any[]    // pré-chargé une fois pour tout le cours
): Promise<void> {
  // 1. Options du sondage (choices)
  const choiceData = await moodleCall('mod_choice_get_choice_options', {
    choiceid: activity.instanceId,
  }, token);

  if (choiceData?.exception || !choiceData?.options?.length) {
    if (IS_DEV) console.warn(`[CourseDownload] choice ${activity.instanceId} no options`);
    return;
  }

  const options: string[] = choiceData.options
    .map((o: any) => stripHtml(o.text || ''))
    .filter(Boolean);

  // 2. URL audio depuis les contenus déjà pré-chargés (pas de nouvel appel réseau)
  let rawAudioUrl: string | null = null;
  outer: for (const section of courseContents) {
    for (const mod of section.modules ?? []) {
      if (mod.modname === 'choice' && mod.instance === activity.instanceId) {
        const allFiles = [...(mod.introfiles ?? []), ...(mod.contents ?? [])];
        const af = allFiles.find((f: any) =>
          AUDIO_RE.test(f?.filename || '') || AUDIO_RE.test(f?.fileurl || '')
        );
        if (af?.fileurl) {
          rawAudioUrl = stripToken(
            af.fileurl.replace('/pluginfile.php/', '/webservice/pluginfile.php/')
          );
        }
        break outer;
      }
    }
  }

  const data = {
    id          : activity.instanceId,
    title       : choiceData.choice?.name || activity.title,
    question    : 'Écoutez et choisissez la bonne réponse',
    options,
    correctIndex: 0,
  };

  await cacheActivity(activity.cmid, 'listening', activity.courseId, data, rawAudioUrl);

  if (rawAudioUrl) {
    await downloadActivityAudio(activity.cmid, rawAudioUrl, token);
  }
}

async function cacheAssociation(
  activity: DownloadableActivity,
  token   : string
): Promise<void> {
  const result = await moodleCall('mod_glossary_get_entries_by_letter', {
    id    : activity.instanceId,
    letter: 'ALL',
    from  : 0,
    limit : 50,
  }, token);

  if (result?.exception || !result?.entries?.length) return;

  const pairs = result.entries
    .map((e: any) => ({
      word       : stripHtml(e.concept     || ''),
      translation: stripHtml(e.definition  || ''),
    }))
    .filter((p: any) => p.word && p.translation);

  if (!pairs.length) return;

  await cacheActivity(activity.cmid, 'association', activity.courseId, {
    id   : activity.instanceId,
    title: activity.title,
    pairs: pairs.slice(0, 10),
  }, null);
}

async function cacheWordOrder(
  activity: DownloadableActivity,
  token   : string
): Promise<void> {
  // Lance l'attempt pour créer le timer (requis par mod_lesson_get_page_data)
  await moodleCall('mod_lesson_launch_attempt', { lessonid: activity.instanceId }, token)
    .catch(() => {});

  const result = await moodleCall('mod_lesson_get_pages', {
    lessonid: activity.instanceId,
  }, token);

  if (result?.exception || !result?.pages?.length) return;

  const clean = (s: string) => String(s)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')   // g flag — collapse ALL whitespace groups
    .trim();

  const sentences: { words: string[]; correctOrder: string[]; translation: string }[] = [];

  for (const page of result.pages.slice(0, 10)) {
    const pageObj = page.page ?? page;
    let   content = clean(pageObj?.contents ?? pageObj?.content ?? pageObj?.title ?? '');

    if (!content && pageObj?.id) {
      // Fallback page_data
      const pd = await moodleCall('mod_lesson_get_page_data', {
        lessonid: activity.instanceId,
        pageid  : pageObj.id,
      }, token).catch(() => null);
      content = clean(pd?.page?.contents ?? pd?.pagecontent ?? '');
    }

    if (!content) continue;
    const words = /[|,]/.test(content)
      ? content.split(/[|,]/).map((w: string) => w.trim()).filter(Boolean)
      : content.split(/\s+/).filter(Boolean);

    if (words.length >= 2 && words.length <= 20) {
      sentences.push({ words, correctOrder: words, translation: content });
    }
  }

  if (!sentences.length) return;

  await cacheActivity(activity.cmid, 'word_order', activity.courseId, {
    id       : activity.instanceId,
    title    : activity.title,
    sentences,
  }, null);
}

// ─── Utils ────────────────────────────────────────────────────────────────────

/** Retire le token Moodle d'une URL pour stockage (re-authentifiée à la lecture). */
function stripToken(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete('token');
    u.searchParams.delete('wstoken');
    return u.toString();
  } catch {
    return url.replace(/[?&](?:token|wstoken)=[^&]*/g, '').replace(/[?&]$/, '');
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')   // g flag — collapse ALL whitespace groups
    .trim();
}

function parseDictationWords(introHtml: string): { word: string; hint?: string }[] {
  if (!introHtml) return [];
  const decoded = introHtml
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'");

  const liMatches = Array.from(decoded.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
  if (liMatches.length > 0) {
    return liMatches
      .map(m => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(s => s.length > 0)
      .map(splitWordHint);
  }

  const plain = decoded.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '\n');
  const lines = plain.split(/\n|\r/).map(s => s.trim()).filter(s => s.length > 0);

  const candidates = lines.length >= 2
    ? lines
    : lines[0]?.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0) ?? [];

  return candidates.filter(s => /\S/.test(s)).map(splitWordHint);
}

function splitWordHint(raw: string): { word: string; hint?: string } {
  const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
  return parts.length >= 2
    ? { word: parts[0], hint: parts.slice(1).join(' | ') }
    : { word: parts[0] || raw.trim() };
}
