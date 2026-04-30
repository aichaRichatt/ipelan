import { useState } from 'react';
import { getAllCourses } from '../services/api/courseService';
import { enrolUserInCourse, getMoodleProfile, signUp as moodleSignUp } from '../services/api/moodleAuth';
import { SignupForm } from '../types';

const IS_DEV = process.env.NODE_ENV === "development";

export function useSignup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const signup = async (formData: SignupForm) => {
    const { username, email, password, firstname, lastname, city } = formData;
    if (!username) throw new Error("Username is required");

    // Check if admin token is configured
    const adminToken = process.env.EXPO_PUBLIC_MOODLE_ADMIN_TOKEN;
    if (!adminToken) {
      throw new Error("Erreur de configuration: le service d'inscription n'est pas disponible. Veuillez contacter l'administrateur.");
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await moodleSignUp({ username, email, password, firstname, lastname, city });

      if (IS_DEV) console.log("Signup API response:", JSON.stringify(result));

      if (result && result.success === true) {
        // Get the user ID to enrol them in courses
        let userId = result.id || 0;

        // If no ID returned, try to get it by looking up the user
        if (!userId && username) {
          try {
            const adminToken = process.env.EXPO_PUBLIC_MOODLE_ADMIN_TOKEN;
            if (adminToken) {
              const userData = await getMoodleProfile(adminToken, username, 'username');
              if (userData?.users && userData.users.length > 0) {
                userId = userData.users[0].id;
                if (IS_DEV) console.log("[Signup] Found user ID:", userId);
              }
            }
          } catch (lookupErr) {
            if (IS_DEV) console.warn("[Signup] Could not lookup user ID:", lookupErr);
          }
        }

        // Enrol user in ALL available courses
        if (userId && adminToken) {
          try {
            // Get all available courses
            const allCourses = await getAllCourses(adminToken);
            if (IS_DEV) console.log(`[Signup] Found ${allCourses.length} courses to enrol user in`);

            // Enrol in each course (limit to first 50 to avoid timeout)
            const coursesToEnrol = allCourses.slice(0, 50);
            let enrolledCount = 0;

            for (const course of coursesToEnrol) {
              if (course.id) {
                try {
                  await enrolUserInCourse(userId, course.id);
                  enrolledCount++;
                  if (IS_DEV) console.log(`[Signup] Enrolled user ${userId} in course ${course.id} (${course.fullname || course.shortname})`);
                } catch (enrolErr: any) {
                  // Don't fail signup if enrolment fails - just log it
                  if (IS_DEV) console.warn(`[Signup] Failed to enrol in course ${course.id}:`, enrolErr.message);
                }
              }
            }

            if (IS_DEV) console.log(`[Signup] Successfully enrolled user in ${enrolledCount}/${coursesToEnrol.length} courses`);
          } catch (coursesErr: any) {
            if (IS_DEV) console.warn('[Signup] Failed to get courses list:', coursesErr.message);
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
