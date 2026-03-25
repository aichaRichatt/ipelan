import { useState } from "react";
import { login } from "../services/api/moodleAuth";
import { saveToken } from "../services/storage/tokenStorage";

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const signIn = async (email: string, password: string) => {
    setLoading(true)
    setError("")
    try {
      const data = await login(email, password);
      if (data.token) {
        await saveToken(data.token)
        return  {"sucess":true}
      } else {
        throw new  Error("identifiants invalides `token`")
      }
      
      
    } catch (err) {
      setError(err.message);
      return  {success:false,"messsaege":err.message}
    }
    finally {
      setLoading(false);
    }
  }
  
  return { signIn, loading, error };
}

