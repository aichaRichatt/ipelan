import { getCourseModules } from './moduleResolver';
import { moodleFetch } from './moodleClient';

export interface ListeningOption {
  id: number;
  text: string;
}

export interface ListeningExercise {
  choiceId: number;
  name: string;
  audioUrl: string;
  options: ListeningOption[];
  correctIndex: number; 
}

function buildAudioUrl(fileurl: string, token: string): string {
  return fileurl
    .replace('/pluginfile.php/', '/webservice/pluginfile.php/')
    + `?token=${token}`;
}

export async function getListeningExercise(
  courseId: number,
  choiceId: number,
  token: string
): Promise<ListeningExercise | null> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_choice_get_choice_options',
      moodlewsrestformat: 'json',
      choiceid: choiceId,
    });

    if (result?.exception) {
      console.warn('[listeningService] get_choice_options error:', result.message);
      return null;
    }

    const options: ListeningOption[] = (result?.options || []).map((o: any) => ({
      id: o.id,
      text: o.text,
    }));

    const modules = await getCourseModules(courseId, token);
    const mod = modules.find(m => m.modname === 'choice' && m.instance === choiceId);

    if (!mod) {
      console.warn('[listeningService] Choice module not found:', choiceId);
      return null;
    }

    const audioFile = mod.introfiles?.find((f: any) =>
      f.filename?.match(/\.(mp3|wav|ogg|m4a)$/i)
    );

    if (!audioFile) {
      console.warn('[listeningService] No audio file found for choice:', choiceId);
      return null;
    }

    // Moodle ne renvoie pas la "bonne réponse" via mod_choice côté élève.
    // On tente plusieurs heuristiques, sinon on renvoie -1 (à gérer côté UI).
    const answerId = result?.choice?.answer ?? result?.choice?.optionid ?? null;
    let correctIndex = -1;
    if (answerId !== null && answerId !== undefined) {
      correctIndex = options.findIndex((o: any) => o.id === answerId);
    }

    return {
      choiceId: mod.instance,
      name: mod.name,
      audioUrl: buildAudioUrl(audioFile.fileurl, token),
      options,
      correctIndex,
    };
  } catch (err: any) {
    console.warn('[listeningService] Exception:', err.message);
    return null;
  }
}

export async function saveListeningChoice(
  token: string,
  choiceId: number,
  optionId: number,
  courseId: number
): Promise<boolean> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_choice_submit_choice_response',
      moodlewsrestformat: 'json',
      choiceid: choiceId,
      'responses[0]': optionId,
    });

    if (result?.exception) {
      console.warn('[listeningService] submit_choice_response error:', result.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[listeningService] saveListeningChoice exception:', err.message);
    return false;
  }
}

export async function getListeningResults(
  token: string,
  choiceId: number
): Promise<{ optionId: number; count: number; percentage: number }[]> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'mod_choice_get_choice_options',
      moodlewsrestformat: 'json',
      choiceid: choiceId,
    });

    if (result?.exception) {
      console.warn('[listeningService] get_results error:', result.message);
      return [];
    }

    return (result?.options || []).map((o: any) => ({
      optionId: o.id,
      count: o.countresponds || 0,
      percentage: o.percentresponds || 0,
    }));
  } catch (err: any) {
    console.warn('[listeningService] getListeningResults exception:', err.message);
    return [];
  }
}