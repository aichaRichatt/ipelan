import { useState } from 'react';
import { signUp as moodleSignUp } from '../services/api/moodleAuth';
import { SignupForm } from '../types';

const IS_DEV = process.env.NODE_ENV === "development";

export function useSignup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const signup = async (formData: SignupForm) => {
    const { username, email, password, firstname, lastname, city } = formData;
    if (!username) throw new Error("Username is required");
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await moodleSignUp({ username, email, password, firstname, lastname, city });
      
      if (IS_DEV) console.log("Signup API response:", JSON.stringify(result));
      
      if (result && result.success === true) {
        setSuccess(true);
        return { id: result.id || 0, username, email, success: true };
      }
      
      if (result && Array.isArray(result) && result.length > 0) {
        setSuccess(true);
        return result[0];
      }

      if (result && result.success === false) {
        const warningMsg = result.warnings?.[0]?.message || "Inscription impossible";
        throw new Error(warningMsg);
      }

      throw new Error(result?.error || result?.message || "Failed to create user");
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
