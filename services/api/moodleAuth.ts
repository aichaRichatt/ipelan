import { IPELANUser } from "../../types";

const MOODLE_BASE_URL = process.env.EXPO_PUBLIC_MOODLE_API_URL || "https://moodle.richatt.com";
const IS_DEV = process.env.NODE_ENV === "development";

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
  
  if (data.exception) {
    throw new Error(data.message || "API Exception");
  }
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  if (!data || (Array.isArray(data) && data.length < 1)) {
    throw new Error("No data returned from API. Check Moodle configuration.");
  }
  return data;
}

export async function login(username: string, password: string) {
  if (IS_DEV) console.log("[moodleAuth.login] Starting login for:", username);
  
  const result = await moodleFetch("/login/token.php", {
    username,
    password,
    service: "ipelan_full", 
  });
  
  if (!result?.token) {
    throw new Error("Login failed: no token");
  }
  
  if (IS_DEV) console.log("[moodleAuth.login] Login successful");
  return result;
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
    wsfunction: "auth_email_signup_user",
    username,
    password,
    firstname,
    lastname,
    email,
    moodlewsrestformat: "json",
  }, "POST");
}

 
export async function updateUserProfile(id: number, firstname: string, lastname: string, email?: string, city?: string) {
   const userUpdate: any = { id: Number(id) };
   
   if (firstname) userUpdate.firstname = firstname;
   if (lastname) userUpdate.lastname = lastname;
   if (email) userUpdate.email = email;
   if (city) userUpdate.city = city;
   
   return moodleFetch("/webservice/rest/server.php", {
     wstoken: process.env.EXPO_PUBLIC_MOODLE_TOKEN,
     wsfunction: "core_user_update_users",
     users: [userUpdate],
     moodlewsrestformat: "json"
   }, "POST");
 }

export async function agreeToSitePolicy(token: string, userId?: number) {
  const adminToken = process.env.EXPO_PUBLIC_MOODLE_TOKEN;
  
  try {
    return await moodleFetch("/webservice/rest/server.php", {
      wstoken: token,
      wsfunction: "core_user_agree_site_policy",
      moodlewsrestformat: "json"
    }, "POST");
  } catch (e: any) {
    if (userId && adminToken) {
      return moodleFetch("/webservice/rest/server.php", {
        wstoken: adminToken,
        wsfunction: "core_user_agree_site_policy",
        userid: userId,
        moodlewsrestformat: "json"
      }, "POST");
    }
    throw e;
  }
}

export async function enrolUserInCourse(userId: number, courseId: number = 81) {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: process.env.EXPO_PUBLIC_MOODLE_TOKEN,
    wsfunction: "enrol_manual_enrol_users",
    enrolments: [{
      roleid: 5,
      userid: userId,
      courseid: courseId
    }],
    moodlewsrestformat: "json"
  }, "POST");
}