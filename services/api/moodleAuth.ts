import { moodleFetch, Config } from "./moodleClient";


export async function login(username: string, password: string) {
  return moodleFetch("/login/token.php", {
    username,
    password,
    service: Config.service
  }, "GET");
}


export async function getMoodleSiteInfo(token: string) {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: token,
    wsfunction: "core_webservice_get_site_info"
  }, "POST");
}

export async function getMoodleProfile(token: string, usernameOrId: string | number, field: string = "username") {
  const params: any = {
    wstoken: token,
    wsfunction: "core_user_get_users_by_field",
    field: field,
    values: [usernameOrId]
  };

  return moodleFetch("/webservice/rest/server.php", params, "POST");
}

export async function signUp(username: string, email: string, password: string, firstname: string, lastname: string, city: string = "Nouakchott") {
  
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: process.env.EXPO_PUBLIC_MOODLE_TOKEN,
    wsfunction: "core_user_create_users",
    users: [{
      username,
      email,
      password,
      firstname,
      lastname,
      city: city,
      country: "MR"
    }]
  }, "POST");
}