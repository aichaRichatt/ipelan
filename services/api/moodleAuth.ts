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
  const { username, password, email, firstname, lastname, city } = user;

  if (!ADMIN_TOKEN) {
    throw new Error("Configuration serveur invalide: token administrateur manquant");
  }

  // Champs de base attendus par auth_email_signup_user
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

  // Le champ city n'est pas accepté nativement par auth_email_signup_user :
  // on le passe via customprofile pour que Moodle le persiste.
  if (city) {
    params['customprofilefields[0][type]'] = 'text';
    params['customprofilefields[0][name]'] = 'city';
    params['customprofilefields[0][value]'] = String(city);
  }

  const result = await moodleFetch("/webservice/rest/server.php", params, "POST");

  // Si l'utilisateur est créé mais city n'a pas été persisté (pas de customprofile),
  // on tente une mise à jour postérieure via core_user_update_users.
  if (city && result?.success && (result.id || result.userid)) {
    const userId = Number(result.id || result.userid);
    try {
      await updateUserProfile(userId, firstname, lastname, email, city);
    } catch (e: any) {
      // Best-effort : ne casse pas l'inscription si la mise à jour échoue
      if (process.env.NODE_ENV === 'development') {
        console.warn('[moodleAuth.signUp] city update failed:', e?.message);
      }
    }
  }

  return result;
}

export async function updateUserProfile(id: number, firstname: string, lastname: string, email?: string, city?: string) {
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

export async function agreeToSitePolicy(token: string, userId?: number) {

  try {
    return await moodleFetch("/webservice/rest/server.php", {
      wstoken: token,
      wsfunction: "core_user_agree_site_policy",
      moodlewsrestformat: "json"
    }, "POST");
  } catch (e: any) {
    if (userId && ADMIN_TOKEN) {
      return moodleFetch("/webservice/rest/server.php", {
        wstoken: ADMIN_TOKEN,
        wsfunction: "core_user_agree_site_policy",
        userid: userId,
        moodlewsrestformat: "json"
      }, "POST");
    }
    throw e;
  }
}

/**
 * Inscrit un utilisateur dans un cours Moodle (rôle élève = 5).
 *
 * @param userId   ID Moodle de l'utilisateur
 * @param courseId ID Moodle du cours (obligatoire — aucun fallback codé en dur)
 *
 * Le courseId doit être déterminé par l'appelant en fonction de la langue
 * et du niveau choisis par l'élève (cf. courseService.getCoursesForLanguageAndGrade).
 */
export async function enrolUserInCourse(userId: number, courseId: number) {
  const IS_DEV = process.env.NODE_ENV === "development";

  if (!Number.isFinite(courseId) || courseId <= 0) {
    throw new Error(
      "courseId invalide: utilisez courseService.getCoursesForLanguageAndGrade pour le déterminer"
    );
  }

  if (IS_DEV) {
    console.log(`[enrolUserInCourse] Enrolling user ${userId} in course ${courseId}`);
  }

  if (!ADMIN_TOKEN) {
    throw new Error("Configuration serveur invalide: token administrateur manquant");
  }

  // Format for Moodle REST API - enrolments array with indexed keys
  const params: any = {
    wstoken: ADMIN_TOKEN,
    wsfunction: "enrol_manual_enrol_users",
    moodlewsrestformat: "json",
    'enrolments[0][roleid]': 5,  // 5 = Student role
    'enrolments[0][userid]': userId,
    'enrolments[0][courseid]': courseId,
  };

  return moodleFetch("/webservice/rest/server.php", params, "POST");
}