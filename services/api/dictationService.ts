import { moodleFetch } from './moodleClient';

export interface DictationExercise {
  assignId    : number;
  name        : string;
  audioUrl    : string;      // URL authentifiée (avec token) — pour lecture immédiate
  rawAudioUrl : string;      // fileurl Moodle brut (sans token) — pour cache/download
  word        : string;
}

function buildAudioUrl(fileurl: string, token: string): string {
  const url = fileurl.includes('/webservice/pluginfile.php/')
    ? fileurl
    : fileurl.replace('/pluginfile.php/', '/webservice/pluginfile.php/');
  return url + (url.includes('?') ? '&' : '?') + `token=${token}`;
}

export async function getDictationExercise(
  courseId: number,
  assignId: number,
  token: string
): Promise<DictationExercise | null> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_assign_get_assignments',
      moodlewsrestformat: 'json',
      'courseids[0]': courseId,
    });

    if (result?.exception) {
      console.warn('[dictationService] get_assignments error:', result.message);
      return null;
    }

    const courses = result?.courses || [];
    let assignment: any = null;

    for (const course of courses) {
      const assignments = course.assignments || [];
      assignment = assignments.find((a: any) => a.id === assignId);
      if (assignment) break;
    }

    if (!assignment) {
      console.warn('[dictationService] Assignment not found:', assignId);
      return null;
    }

    const audioFile = assignment.introfiles?.find((f: any) =>
      f.filename?.match(/\.(mp3|wav|ogg|m4a|opus|aac)$/i)
    );

    if (!audioFile) {
      console.warn('[dictationService] No audio file in assignment:', assignId);
      return null;
    }

    return {
      assignId    : assignment.id,
      name        : assignment.name,
      audioUrl    : buildAudioUrl(audioFile.fileurl, token),
      rawAudioUrl : audioFile.fileurl,
      word        : assignment.name.replace(/^Dictée[:\s-]*/i, '').trim() || assignment.name,
    };
  } catch (err: any) {
    console.warn('[dictationService] Exception:', err.message);
    return null;
  }
}

export async function submitDictationAnswer(
  token: string,
  assignId: number,
  userId: number,
  answer: string,
  courseId: number
): Promise<boolean> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_assign_save_submission',
      moodlewsrestformat: 'json',
      assignmentid: assignId,
      userid: userId,
      'plugindata[onlinetext_editor][text]': answer,
      'plugindata[onlinetext_editor][format]': '1',
      'plugindata[onlinetext_editor][itemid]': '0',
    });

    if (result?.exception) {
      console.warn('[dictationService] save_submission error:', result.message);
      return false;
    }

    const submitResult = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_assign_submit_for_grading',
      moodlewsrestformat: 'json',
      assignmentid: assignId,
      acceptsubmissionstatement: '1',
    });

    if (submitResult?.exception) {
      console.warn('[dictationService] submit_for_grading error:', submitResult.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[dictationService] submitDictationAnswer exception:', err.message);
    return false;
  }
}

export async function getDictationSubmissions(
  token: string,
  assignId: number
): Promise<any[]> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_assign_get_submissions',
      moodlewsrestformat: 'json',
      assignmentid: assignId,
      'status[0]': 'submitted',
    });

    if (result?.exception) {
      console.warn('[dictationService] get_submissions error:', result.message);
      return [];
    }

    return result?.submissions || [];
  } catch (err: any) {
    console.warn('[dictationService] getDictationSubmissions exception:', err.message);
    return [];
  }
}