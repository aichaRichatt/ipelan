import { moodleFetch } from "./moodleClient";

export async function getUserCourses(token: string, userId: number) {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: token,
    wsfunction: "core_enrol_get_users_courses",
    userid: userId
  }, "POST");
}
