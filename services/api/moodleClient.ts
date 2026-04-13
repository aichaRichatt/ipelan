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
  const url = `${Config.baseURL}${endpoint}`;

  const queryString = Object.keys(params)
    .filter((k) => params[k] != null)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
    .join("&");

  const fullBody = queryString + (queryString ? "&" : "") + "moodlewsrestformat=json";

  try {
    const response = await fetch(url, {
      method,
      body: method === "POST" ? fullBody : undefined,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "*/*",
      },
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