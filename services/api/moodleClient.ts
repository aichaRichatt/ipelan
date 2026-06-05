import { ENV } from '../../constants/env';

const IS_DEV = process.env.NODE_ENV === "development";

export const Config = {
  baseURL:  ENV.API.MOODLE_URL,
  service: "IPELAN_FULL_SERVICE",
};

export async function moodleFetch(
  endpoint: string,
  params: Record<string, any> = {},
  method: string = "POST",
  timeoutMs: number = ENV.API.API_TIMEOUT
) {
  const url = new URL(`${Config.baseURL}${endpoint}`);

  let body: URLSearchParams | null = null;
  if (method === "GET") {
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  } else {
    body = new URLSearchParams();
    body.append("moodlewsrestformat", "json");
    Object.keys(params).forEach(key => {
      if (key === "moodlewsrestformat") return;
      if (params[key] === null || params[key] === undefined) return;

      if (typeof params[key] === 'object' && params[key] !== null) {
        const flatten = (obj: any, prefix: string = '') => {
          Object.keys(obj).forEach(k => {
            if (obj[k] === null || obj[k] === undefined) return;
            const propName = prefix ? `${prefix}[${k}]` : k;
            if (typeof obj[k] === 'object' && obj[k] !== null) {
              flatten(obj[k], propName);
            } else {
              body!.append(propName, obj[k]);
            }
          });
        };
        flatten(params[key], key);
      } else {
        body!.append(key, params[key]);
      }
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: method !== "GET" ? body?.toString() : null,
      signal: controller.signal,
    });

    const text = await response.text();

    if (!text || text.trim() === "") {
      throw new Error("Serveur a retourne vide");
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (IS_DEV) console.error("[API] Not JSON:", text.slice(0, 80));
      throw new Error("Reponse nest pas JSON valide");
    }

    if (data?.exception) {
      const err = new Error(data.message || data.exception);
      (err as any).errorcode = data.errorcode;
      (err as any).exception = data.exception;
      throw err;
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  } catch (error: any) {
    if (error.name === "AbortError") throw new Error("Délai de connexion dépassé");
    if (IS_DEV) {
      if ((error as any).exception) {
        console.warn("[API] Moodle:", error.message);
      } else {
        console.error("[API] Error:", error.message);
      }
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function moodleCall(
  wsfunction: string,
  params: Record<string, any> = {},
  token?: string,
  timeoutMs?: number
) {
  const callParams: any = {
    ...params,
    wsfunction,
  };

  if (token) {
    callParams.wstoken = token;
  }

  return moodleFetch('/webservice/rest/server.php', callParams, 'POST', timeoutMs ?? ENV.API.API_TIMEOUT);
}

export async function isMoodleOnline(timeoutMs: number = 3000): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${Config.baseURL}/login/index.php`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
