import { LoginForm } from "@/types";
import { moodleFetch } from "./moodleClient";

export async function login(email:string, password:string) {
  const user:LoginForm = {
    email,
    password
  }
  
  return moodleFetch("/login/token.php", {
    user,
    service: "auth"
  });
}

export async function signUp(username, email, password, dob) {
  return moodleFetch(
    "/webservice/server.php",
    {
      email,
      password
    }
  )
}