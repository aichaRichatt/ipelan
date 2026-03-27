import { IPELANUser } from "../../types";

const MOODLE_BASE_URL = "https://moodle.richatt.com";

async function moodleFetch(endpoint: string, params: Record<string, any>, method: string = "GET") {
  const url = new URL(`${MOODLE_BASE_URL}${endpoint}`);
  
  let body: URLSearchParams | null = null;
  if (method === "GET") {
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  } else {
    body = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (typeof params[key] === 'object') {
        const flatten = (obj: any, prefix: string = '') => {
          Object.keys(obj).forEach(k => {
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

  const response = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method !== "GET" ? body?.toString() : null,
  });

  const data = await response.json();
  console.log(` LOG   Response : ${method} ${url.pathname}`);
  if (data.exception) {
    console.log(` LOG  API Error : ${data.message} (${data.errorcode})`);
  }
  return data;
}

export async function login(username: string, password: string) {
  return moodleFetch("/login/token.php", {
    username,
    password,
    service: "ipelan_full", 
  });
}

export async function getMoodleSiteInfo(token: string) {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: token,
    wsfunction: "core_webservice_get_site_info",
    moodlewsrestformat: "json",
  }, "POST");
}

export async function getMoodleProfile(token: string, fieldValue: string | number, field: string = "username") {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: token,
    wsfunction: "core_user_get_users_by_field",
    field,
    values: [fieldValue],
    moodlewsrestformat: "json",
  }, "POST");
}

export async function signUp(user: any) {
  const { username, password, email, firstname, lastname, city } = user;
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: process.env.EXPO_PUBLIC_MOODLE_TOKEN,
    wsfunction: "core_user_create_users",
    users: [{
      username,
      email,
      password,
      firstname,
      lastname,
      city,
      country: "MR",
      confirmed: 1
    }],
    moodlewsrestformat: "json",
  }, "POST");
}

 
export async function updateUserProfile(id: number, firstname: string, lastname: string, email: string, city: string = "Nktt") {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: process.env.EXPO_PUBLIC_MOODLE_TOKEN,
    wsfunction: "core_user_update_users",
    users: [{
      id,
      firstname,
      lastname,
      email,
      city,
      country: "MR",
      confirmed: 1,
      preferences: [
        { name: 'policyagreed', value: '1' }
      ]
    }],
    moodlewsrestformat: "json"
  }, "POST");
}

export async function agreeToSitePolicy(token: string) {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: token,
    wsfunction: "core_user_agree_site_policy",
    moodlewsrestformat: "json"
  }, "POST");
}

export async function enrolUserInCourse(userId: number, courseId: number = 81) {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: process.env.EXPO_PUBLIC_MOODLE_TOKEN,
    wsfunction: "enrol_manual_enrol_users",
    enrolments: [{
      roleid: 5, // Student role id
      userid: userId,
      courseid: courseId
    }],
    moodlewsrestformat: "json"
  }, "POST");
}