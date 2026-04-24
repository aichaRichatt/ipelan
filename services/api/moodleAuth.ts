import { moodleFetch, Config } from "./moodleClient";

const IS_DEV = process.env.NODE_ENV === "development";

export async function login(username: string, password: string) {
  if (IS_DEV) console.log("[moodleAuth.login] Starting login for:", username);
  
  let loginUsername = username;
  
  if (username.includes("@")) {
    if (IS_DEV) console.log("[moodleAuth.login] Email detected, finding username...");
    
    try {
      const adminToken = process.env.EXPO_PUBLIC_MOODLE_TOKEN;
      if (adminToken) {
        const usersByEmail = await moodleFetch("/webservice/rest/server.php", {
          wstoken: adminToken,
          wsfunction: "core_user_get_users_by_field",
          field: "email",
          values: [username],
          moodlewsrestformat: "json",
        }, "POST");
        
        const userArray = usersByEmail?.users || usersByEmail;
        if (userArray && userArray.length > 0 && userArray[0]?.username) {
          loginUsername = userArray[0].username;
          if (IS_DEV) console.log("[moodleAuth.login] Found username:", loginUsername);
        } else {
          throw new Error("Aucun compte trouvé avec cette adresse email");
        }
      }
    } catch (emailErr: any) {
      if (IS_DEV) console.warn("[moodleAuth.login] Email lookup failed:", emailErr.message);
      throw new Error("Aucun compte trouvé avec cette adresse email");
    }
  }
  
  const result = await moodleFetch("/login/token.php", {
    username: loginUsername,
    password,
    service: "ipelan_full", 
  });
  
  if (!result?.token) {
    throw new Error("Identifiants incorrects");
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