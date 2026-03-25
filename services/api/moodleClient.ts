export const Config = {
  baseURL: process.env.EXPO_PUBLIC_MOODLE_API_URL!,
  service: "ipelan_service_test_mobile",
};

 
function serializeMoodleParams(params: any, prefix: string = ""): string {
  const queryParts: string[] = [];

  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const value = params[key];
      const fullKey = prefix ? `${prefix}[${key}]` : key;

      if (value !== null && typeof value === "object") {
        queryParts.push(serializeMoodleParams(value, fullKey));
      } else if (value !== undefined) {
        queryParts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(value)}`);
      }
    }
  }

  return queryParts.join("&");
}

export async function moodleFetch(endpoint: string, params: any = {}, method: string = "POST") {
  let url = `${Config.baseURL}${endpoint}`;
  
  if (endpoint.includes("/webservice/server.php") || endpoint.includes("/webservice/rest/server.php")) {
    params.moodlewsrestformat = "json";
  }

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };

  const serializedParams = serializeMoodleParams(params);

  if (method === "GET") {
    if (serializedParams) {
      url += `?${serializedParams}`;
    }
  } else if (method === "POST") {
    options.body = serializedParams;
  }

  console.log(` Response : ${method} ${url}`);
  console.log(`Data :`, JSON.stringify(options));

  try {
    const response = await fetch(url, options);
    const responseText = await response.text();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Il ne retourne pas json format", responseText);
      throw new Error(` ${responseText.substring(0, 100)}...${parseError}`);
    }

    if (!response.ok || !data || data.error || data.exception) {
      throw new Error(data?.error || data?.message || data?.exception || "Server retourn vide ou nexiste");
    }

    return data;
  } catch (error: any) {
    console.log("API :", error.message || error);
    throw error;
  }
}
