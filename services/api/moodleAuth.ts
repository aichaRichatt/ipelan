import { getToken } from "../storage/tokenStorage";
import { moodleFetch } from "./moodleClient";

const IS_DEV = process.env.NODE_ENV === "development";

const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_ADMIN_TOKEN;

export async function login(username: string, password: string) {
  if (IS_DEV) console.log("[moodleAuth.login] Starting login for:", username);

  let loginUsername = username;

  if (username.includes("@")) {
    if (IS_DEV) console.log("[moodleAuth.login] Email detected, finding username...");

    try {
      if (ADMIN_TOKEN) {
        const usersByEmail = await moodleFetch("/webservice/rest/server.php", {
          wstoken: ADMIN_TOKEN,
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
      } else {
        throw new Error("Aucun compte trouvé avec cette adresse email");
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
  // Retourner aussi le username résolu (utile pour paralléliser les appels suivants)
  return { ...result, resolvedUsername: loginUsername };
}

export async function getMoodleSiteInfo(token: string) {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: token,
    wsfunction: "core_webservice_get_site_info",
    moodlewsrestformat: "json",
  }, "POST");
}

export async function getCurrentUserSiteInfo() {
  const token = await getToken();

  if (!token) {
    throw new Error("Token Moodle introuvable");
  }

  return getMoodleSiteInfo(token);
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
  const { username, password, email, firstname, lastname } = user;

  if (!ADMIN_TOKEN) {
    throw new Error("Configuration serveur invalide: token administrateur manquant");
  }

  const params: Record<string, any> = {
    wstoken: ADMIN_TOKEN,
    wsfunction: "auth_email_signup_user",
    username,
    password,
    firstname,
    lastname,
    email,
    moodlewsrestformat: "json",
  };

  return moodleFetch("/webservice/rest/server.php", params, "POST");
}

export async function updateUserProfile(id: number, firstname: string, lastname: string, email?: string, city?: string) {
  if (!ADMIN_TOKEN) throw new Error("Admin token manquant");

  const userUpdate: any = { id: Number(id) };

  if (firstname) userUpdate.firstname = firstname;
  if (lastname) userUpdate.lastname = lastname;
  if (email) userUpdate.email = email;
  if (city) userUpdate.city = city;

  return moodleFetch("/webservice/rest/server.php", {
    wstoken: ADMIN_TOKEN,
    wsfunction: "core_user_update_users",
    users: [userUpdate],
    moodlewsrestformat: "json"
  }, "POST");
}

export async function requestPasswordReset(email: string) {
  if (!email || !email.trim()) {
    throw new Error("Veuillez entrer votre adresse email");
  }

  const cleanEmail = email.trim().toLowerCase();

  if (IS_DEV) {
    console.log('[moodleAuth.requestPasswordReset] Requesting reset for:', cleanEmail);
  }

  const result = await moodleFetch("/webservice/rest/server.php", {
    wstoken: ADMIN_TOKEN,
    wsfunction: "core_auth_request_password_reset",
    email: cleanEmail,
    moodlewsrestformat: "json",
  }, "POST");

  if (IS_DEV) {
    console.log('[moodleAuth.requestPasswordReset] Result:', result);
  }

  return result;
}

export async function agreeToSitePolicy(token: string) {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: token,
    wsfunction: "core_user_agree_site_policy",
    moodlewsrestformat: "json"
  }, "POST");
}

export async function enrolUserInCourse(userId: number, courseId: number) {
  const numericCourseId = Number(courseId);
  const numericUserId = Number(userId);

  if (!Number.isFinite(numericCourseId) || numericCourseId <= 0) {
    throw new Error(
      "courseId invalide: utilisez courseService.getCoursesForLanguageAndGrade pour le déterminer"
    );
  }

  if (IS_DEV) {
    console.log(`[enrolUserInCourse] Enrolling user ${numericUserId} in course ${numericCourseId}`);
  }

  if (!ADMIN_TOKEN) {
    throw new Error("Configuration serveur invalide: token administrateur manquant");
  }

  const params: any = {
    wstoken: ADMIN_TOKEN,
    wsfunction: "enrol_manual_enrol_users",
    moodlewsrestformat: "json",
    'enrolments[0][roleid]': 5,
    'enrolments[0][userid]': numericUserId,
    'enrolments[0][courseid]': numericCourseId,
  };

  try {
    return await moodleFetch("/webservice/rest/server.php", params, "POST");
  } catch (error: any) {
    if (error.message?.includes("Valeur incorrecte de paramètre") || error.errorcode === "invalidparameter") {
      if (IS_DEV) {
        console.log(`[enrolUserInCourse] User ${numericUserId} may already be enrolled in course ${numericCourseId} or parameters invalid`);
      }
      return { status: "already_enrolled_or_error", courseId: numericCourseId, userId: numericUserId };
    }
    throw error;
  }
}

export async function enrolUsersInCourses(userId: number, courseIds: number[]) {
  if (!ADMIN_TOKEN) throw new Error("Admin token manquant");

  const numericUserId = Number(userId);
  const validIds = courseIds
    .map(id => Number(id))
    .filter(id => Number.isFinite(id) && id > 0);

  if (validIds.length === 0) return;

  const params: any = {
    wstoken: ADMIN_TOKEN,
    wsfunction: "enrol_manual_enrol_users",
    moodlewsrestformat: "json",
  };

  validIds.forEach((courseId, i) => {
    params[`enrolments[${i}][roleid]`] = 5;
    params[`enrolments[${i}][userid]`] = numericUserId;
    params[`enrolments[${i}][courseid]`] = courseId;
  });

  try {
    return await moodleFetch("/webservice/rest/server.php", params, "POST");
  } catch (error: any) {
    if (error.message?.includes("Valeur incorrecte de paramètre") || error.errorcode === "invalidparameter") {
      if (IS_DEV) {
        console.log(`[enrolUsersInCourses] User ${numericUserId} may already be enrolled or parameters invalid`);
      }
      return { status: "already_enrolled_or_error", courseIds: validIds, userId: numericUserId };
    }
    throw error;
  }
}
