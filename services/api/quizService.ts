import { moodleFetch } from './moodleClient';
import { getAuthToken } from '../contentLoader';

export interface ParsedQuestion {
  slot: number;
  type: string;
  text: string;
  options: { value: string; label: string; inputName: string }[];
  sequencecheck: number;
  rawHtml: string;
  maxmark?: number;
}

function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à')
    .replace(/&ccedil;/g, 'ç');
}

function cleanHtml(html: string): string {
  return decodeEntities(
    html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
        .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  );
}

function parseQuestionHtml(slot: number, sequencecheck: number, html: string, maxmark?: number): ParsedQuestion {
  const typeMatch = html.match(/class="que\s+([a-z]+)/);
  const type = typeMatch?.[1] ?? 'multichoice';

  const qtextMatch = html.match(/<div[^>]+class="[^"]*qtext[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  const text = qtextMatch ? cleanHtml(qtextMatch[1]) : '';

  const options: ParsedQuestion['options'] = [];
  const re = /<input[^>]+type="(?:radio|checkbox)"[^>]+name="([^"]+)"[^>]+value="([^"]*)"[^>]*>[\s\S]*?<label[^>]*>([\s\S]*?)<\/label>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    options.push({ inputName: m[1], value: m[2], label: cleanHtml(m[3]) });
  }

  return { slot, type, text, options, sequencecheck, rawHtml: html, maxmark };
}

export async function getOrCreateAttempt(authToken: string, quizInstanceId: number): Promise<number | null> {
  try {
    const attemptsResult = await moodleFetch('/webservice/rest/server.php', {
      wstoken: authToken,
      wsfunction: 'mod_quiz_get_user_attempts',
      moodlewsrestformat: 'json',
      quizid: quizInstanceId,
      status: 'all',
    });

    if (attemptsResult?.exception) {
      console.warn('[quizService] get_attempts error:', attemptsResult.message);
      return null;
    }

    if (attemptsResult?.attempts?.length > 0) {
      const inProgress = attemptsResult.attempts.find((a: any) => a.state === 'inprogress' && a.sumgrades != null);
      if (inProgress?.id) {
        console.log('[quizService] Resuming valid attempt:', inProgress.id);
        return inProgress.id;
      }

      const blockedAttempts = attemptsResult.attempts.filter((a: any) => a.state === 'inprogress' && a.sumgrades == null);
      for (const blocked of blockedAttempts) {
        console.log('[quizService] Abandoning blocked attempt:', blocked.id);
        await moodleFetch('/webservice/rest/server.php', {
          wstoken: authToken,
          wsfunction: 'mod_quiz_process_attempt',
          moodlewsrestformat: 'json',
          attemptid: blocked.id,
          finishattempt: '0',
          timeup: '0',
        }).catch(() => {});
      }
    }

    const startResult = await moodleFetch('/webservice/rest/server.php', {
      wstoken: authToken,
      wsfunction: 'mod_quiz_start_attempt',
      moodlewsrestformat: 'json',
      quizid: quizInstanceId,
      forcenew: '1',
      'preflightdata[0][name]': 'confirm',
      'preflightdata[0][value]': '1',
    });

    if (startResult?.exception) {
      const errMsg = startResult.message || '';
      if (errMsg.includes('non enregistrées') || errMsg.includes('attemptstillinprogress')) {
        console.warn('[quizService] Blocked attempt:', errMsg);
        return null;
      }
      console.warn('[quizService] start_attempt error:', errMsg);
      return null;
    }

    console.log('[quizService] New attempt started:', startResult.attempt?.id);
    return startResult.attempt?.id ?? null;
  } catch (err: any) {
    console.warn('[quizService] getOrCreateAttempt exception:', err.message);
    return null;
  }
}

export async function fetchAllQuizQuestions(authToken: string, attemptId: number): Promise<ParsedQuestion[]> {
  const allQuestions: ParsedQuestion[] = [];
  let page = 0;

  try {
    while (true) {
      const data = await moodleFetch('/webservice/rest/server.php', {
        wstoken: authToken,
        wsfunction: 'mod_quiz_get_attempt_data',
        moodlewsrestformat: 'json',
        attemptid: attemptId,
        page: page,
        'preflightdata[0][name]': 'confirm',
        'preflightdata[0][value]': '1',
      });

      if (data?.exception) {
        console.warn('[quizService] get_attempt_data error:', data.message);
        break;
      }

      if (!data.questions || !Array.isArray(data.questions)) {
        break;
      }

      for (const q of data.questions) {
        allQuestions.push(
          parseQuestionHtml(q.slot, q.sequencecheck ?? 1, q.html, q.maxmark)
        );
      }

      if (data.nextpage === -1 || data.nextpage == null) break;
      page = data.nextpage;

      if (page > 100) {
        console.warn('[quizService] Safety limit reached');
        break;
      }
    }
  } catch (err: any) {
    console.warn('[quizService] fetchAllQuizQuestions exception:', err.message);
  }

  return allQuestions;
}

export async function saveQuizAnswers(
  authToken: string,
  attemptId: number,
  answers: Record<string, string>,
  sequencechecks: Record<number, number>
): Promise<boolean> {
  try {
    const dataParams: Record<string, any> = {
      wstoken: authToken,
      wsfunction: 'mod_quiz_save_attempt',
      moodlewsrestformat: 'json',
      attemptid: attemptId,
    };

    let idx = 0;
    Object.entries(answers).forEach(([name, value]) => {
      dataParams[`data[${idx}][name]`] = name;
      dataParams[`data[${idx}][value]`] = value;
      idx++;
    });

    Object.entries(sequencechecks).forEach(([slot, sc]) => {
      dataParams[`data[${idx}][name]`] = `q${slot}:_sequencecheck`;
      dataParams[`data[${idx}][value]`] = String(sc);
      idx++;
    });

    const result = await moodleFetch('/webservice/rest/server.php', dataParams);

    if (result?.exception) {
      console.warn('[quizService] save_attempt error:', result.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[quizService] saveQuizAnswers exception:', err.message);
    return false;
  }
}

export async function finishQuizAttempt(
  authToken: string,
  attemptId: number,
  answers: Record<string, string>,
  sequencechecks: Record<number, number>
): Promise<boolean> {
  try {
    const saved = await saveQuizAnswers(authToken, attemptId, answers, sequencechecks);
    if (!saved) return false;

    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: authToken,
      wsfunction: 'mod_quiz_process_attempt',
      moodlewsrestformat: 'json',
      attemptid: attemptId,
      finishattempt: '1',
      timeup: '0',
    });

    if (result?.exception) {
      console.warn('[quizService] finish_attempt error:', result.message);
      return false;
    }

    console.log('[quizService] Attempt finished:', attemptId);
    return true;
  } catch (err: any) {
    console.warn('[quizService] finishQuizAttempt exception:', err.message);
    return false;
  }
}

export async function processSingleAnswer(
  authToken: string,
  attemptId: number,
  slot: number,
  answerValue: string,
  sequencecheck: number
): Promise<boolean> {
  try {
    const result = await moodleFetch('/webservice/rest/server.php', {
      wstoken: authToken,
      wsfunction: 'mod_quiz_process_attempt',
      moodlewsrestformat: 'json',
      attemptid: attemptId,
      data: [
        { name: `q${slot}:_sequencecheck`, value: String(sequencecheck) },
        { name: `q${slot}:_answer`, value: answerValue },
      ],
    });

    if (result?.exception) {
      console.warn('[quizService] process_answer error:', result.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[quizService] processSingleAnswer exception:', err.message);
    return false;
  }
}