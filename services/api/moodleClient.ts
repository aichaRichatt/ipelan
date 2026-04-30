const IS_DEV = process.env.NODE_ENV === "development";

export const Config = {
  baseURL: process.env.EXPO_PUBLIC_MOODLE_API_URL || "https://moodle.richatt.com",
  service: "IPELAN_FULL_SERVICE",
};

export async function moodleFetch(
  endpoint: string,
  params: Record<string, any> = {},
  method: string = "POST"
) {
  const url = new URL(`${Config.baseURL}${endpoint}`);

  let body: URLSearchParams | null = null;
  if (method === "GET") {
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  } else {
    body = new URLSearchParams();
    body.append("moodlewsrestformat", "json");
    Object.keys(params).forEach(key => {
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

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: method !== "GET" ? body?.toString() : null,
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
      return { exception: data.exception, errorcode: data.errorcode, message: data.message };
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  } catch (error: any) {
    if (IS_DEV) console.error("[API] Error:", error.message);
    throw error;
  }
}

export async function moodleCall(
  wsfunction: string,
  params: Record<string, any> = {},
  token?: string
) {
  const callParams: any = {
    ...params,
    wsfunction,
  };

  if (token) {
    callParams.wstoken = token;
  }

  return moodleFetch('/webservice/rest/server.php', callParams, 'POST');
}

/**
 * Vérifie la connectivité avec le serveur Moodle.
 * Implémentation centralisée — ne pas dupliquer dans les services de sync.
 *
 * Stratégie : HEAD /login/index.php (endpoint léger toujours présent),
 * timeout 3 s. Toute réponse < 500 (200, 302...) est considérée comme « online ».
 */
export async function isMoodleOnline(timeoutMs: number = 3000): Promise<boolean> {
  try {
    const res = await fetch(`${Config.baseURL}/login/index.php`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}