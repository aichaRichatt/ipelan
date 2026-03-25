export const Config = {
  baseURL: process.env.MOODLE_API_URL || 'https://your-moodle-instance.com', // Fallback URL
  service: "moodle_mobile_app",
};

export async function moodleFetch(endpoint: string, params: any = {}, method: string = "POST") {
  let url = `${Config.baseURL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };

  if (method === "GET") {
    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  } else if (method === "POST") {
    options.body = new URLSearchParams(params).toString();
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok || data.error || data.exception) {
      throw new Error(data.error || data.message || data.exception || "Network response was not ok");
    }

    return data;
  } catch (error: any) {
    console.error("Moodle API Error:", error);
    throw error;
  }
}
