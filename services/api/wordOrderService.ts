import { moodleFetch } from './moodleClient';
import { getCourseModules } from './moduleResolver';

export interface WordOrderSentence {
  id: number;
  words: string[];
  correctOrder: string[];
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function getWordOrderSentences(
  courseId: number,
  token: string,
  lessonInstanceId?: number
): Promise<WordOrderSentence[]> {
  try {
    const modules = await getCourseModules(courseId, token);
    
    let lessons = modules.filter(m => m.modname === 'lesson');
    
    const specificLessonId = lessonInstanceId ?? 0;
    if (specificLessonId > 0) {
      lessons = lessons.filter(l => l.instance === specificLessonId);
    }

    const sentences: WordOrderSentence[] = [];

for (const lesson of lessons) {
      const result = await moodleFetch('/webservice/rest/server.php', {
        wstoken: token,
        wsfunction: 'mod_lesson_get_pages',
        moodlewsrestformat: 'json',
        lessonid: lesson.instance,
      });

      if (result?.exception) {
        console.warn('[wordOrderService] get_pages error:', result.message);
        continue;
      }

      const pages = result?.pages || [];
      
      for (const p of pages) {
        const page = p.page || p;
        if (page.contents) {
          const words = page.contents.split(/[|,]/).map((w: string) => w.trim()).filter(Boolean);
          
          if (words.length >= 2) {
            sentences.push({
              id: page.id,
              words: shuffleArray([...words]),
              correctOrder: [...words],
            });
          }
        }
      }
    }

      const pages = result?.pages || [];
      
      for (const page of pages) {
        if (page.contents) {
          const words = page.contents.split(/[|,]/).map((w: string) => w.trim()).filter(Boolean);
          
          if (words.length >= 2) {
            sentences.push({
              id: page.id,
              words: shuffleArray(words),
              correctOrder: [...words],
            });
          }
        }
      }
    }

    return sentences;
  } catch (err: any) {
    console.warn('[wordOrderService] Exception:', err.message);
    return [];
  }
}

export async function submitWordOrderAnswer(
  token: string,
  lessonId: number,
  pageId: number,
  userAnswer: string[]
): Promise<boolean> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_lesson_process_page',
      moodlewsrestformat: 'json',
      lessonid: lessonId,
      pageid: pageId,
      data: userAnswer.join('|'),
    });

    if (result?.exception) {
      console.warn('[wordOrderService] submit answer error:', result.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[wordOrderService] submitWordOrderAnswer exception:', err.message);
    return false;
  }
}

export async function finishWordOrderLesson(
  token: string,
  lessonId: number
): Promise<boolean> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_lesson_finish_attempt',
      moodlewsrestformat: 'json',
      lessonid: lessonId,
    });

    if (result?.exception) {
      console.warn('[wordOrderService] finish lesson error:', result.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[wordOrderService] finishWordOrderLesson exception:', err.message);
    return false;
  }
}