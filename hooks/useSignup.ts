import { useState } from 'react';
import { getAllCourses } from '../services/api/courseService';
import { enrolUsersInCourses, getMoodleProfile, signUp as moodleSignUp } from '../services/api/moodleAuth';
import { SignupForm } from '../types';

const IS_DEV = process.env.NODE_ENV === "development";

export function useSignup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const signup = async (formData: SignupForm) => {
    const { username, email, password, firstname, lastname } = formData;
    if (!username) throw new Error("Username is required");

    const adminToken = process.env.EXPO_PUBLIC_MOODLE_ADMIN_TOKEN;
    if (!adminToken) {
      throw new Error("Erreur de configuration: le service d'inscription n'est pas disponible. Veuillez contacter l'administrateur.");
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await moodleSignUp({ username, email, password, firstname, lastname });

      if (IS_DEV) console.log("Signup API response:", JSON.stringify(result));

      if (result && result.success === true) {
        let userId = 0;

        try {
          const userData = await getMoodleProfile(adminToken, username, 'username');
          if (userData?.users && userData.users.length > 0) {
            userId = userData.users[0].id;
            if (IS_DEV) console.log("[Signup] Found user ID:", userId);
          }
        } catch (lookupErr) {
          if (IS_DEV) console.warn("[Signup] Could not lookup user ID:", lookupErr);
        }

        if (userId) {
          try {
            const allCourses = await getAllCourses(adminToken);
            const courseIds = allCourses.slice(0, 50).map((c: any) => c.id).filter(Boolean);
            if (IS_DEV) console.log(`[Signup] Enrolling user in ${courseIds.length} courses`);
            await enrolUsersInCourses(userId, courseIds);
            if (IS_DEV) console.log(`[Signup] Bulk enrollment complete`);
          } catch (coursesErr: any) {
            if (IS_DEV) console.warn('[Signup] Enrollment failed:', coursesErr.message);
          }
        }

        setSuccess(true);
        return { id: userId, username, email, success: true };
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
