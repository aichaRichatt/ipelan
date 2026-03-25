import { moodleFetch, Config } from "./moodleClient";


export async function getMoodleToken(username: string, password: string) {
  return moodleFetch("/login/token.php", {
    username,
    password,
    service: Config.service
  }, "GET");
}


export async function getMoodleProfile(token: string, username: string) {
  return moodleFetch("/webservice/server.php", {
    wstoken: token,
    wsfunction: "core_user_get_users_by_field",
    moodlewsrestformat: "json",
    field: "username",
    values: [username]
  }, "POST");
}

export async function signUp(username: string, email: string, password: string, firstname: string, lastname: string) {
  
  return moodleFetch("/webservice/server.php", {
    wsfunction: "core_user_create_users",
    moodlewsrestformat: "json",
    users: [{
      username,
      email,
      password,
      firstname,
      lastname
    }]
  }, "POST");
}