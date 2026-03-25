import { useState } from 'react';
import { signUp as moodleSignUp } from '../services/api/moodleAuth';

export function useSignup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const signup = async (username: string, email: string, password: string, firstname: string, lastname: string, city: string) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await moodleSignUp(username, email, password, firstname, lastname, city);
      if (result && Array.isArray(result) && result.length > 0) {
        setSuccess(true);
        return result[0];
      } else if (result.error) {
        throw new Error(result.error);
      } else {
        throw new Error("Failed to create user");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during signup");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signup,
    isLoading,
    error,
    success
  };
}
