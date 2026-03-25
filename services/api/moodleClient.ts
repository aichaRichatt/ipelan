
export const Config = {
"baseURL":process.env.MOODLE_API_URL!,
"service":"moodle_mobile_app",
}

export async function moodleFetch(endpoint: string,params={}, method= "POST") {
  const url = `${Config.baseURL}/${endpoint}?${params}`
  const options = {
    method,
    "Content-Type": "application/x-www-form-urlencoded",
    "body":""
  };
  if( method === "POST"){
    options.body = new URLSearchParams(params).toString();
  }
  
  const response = await fetch(url, options);
  if (!response) {
    throw new Error("Reponse du reseau echoue");
  }
  return response.json();
}
