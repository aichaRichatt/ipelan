import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { agreeToSitePolicy, enrolUserInCourse, getMoodleProfile, getMoodleSiteInfo, login as moodleLogin, updateUserProfile } from "../services/api/moodleAuth";
import { loginFailure, loginStart, loginSuccess, logout } from '../services/redux/slices/authSlice';
import { RootState } from '../services/redux/store';
import { createTables, getDBConnection, saveUser } from '../services/storage/db-service';
import { removeCredentials, removeToken, removeUserData, saveToken, saveUserData } from '../services/storage/tokenStorage';
import { syncQueue } from '../services/sync/syncQueue';
import { IPELANUser } from '../types';

const IS_DEV = process.env.NODE_ENV === "development";

export function useLogin() {
  const dispatch = useDispatch();
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);

  const login = async (username: string, password: string, email?: string, firstName?: string, lastName?: string) => {
    dispatch(loginStart());

    try {
      if (IS_DEV) console.log("[useLogin] Log In Attempt for:", username);

      const tokenData = await moodleLogin(username, password);
      const authToken = tokenData.token;
      const resolvedUsername = (tokenData as any).resolvedUsername || username;

      if (!authToken) {
        throw new Error("Identifiants incorrects");
      }

      if (IS_DEV) console.log("[useLogin] Token received, fetching site info + profile in parallel...");

      // ✅ OPTIMISATION : siteInfo et profile en parallèle — économise ~500ms
      const [siteInfo, profileData] = await Promise.all([
        getMoodleSiteInfo(authToken),
        getMoodleProfile(authToken, resolvedUsername, "username").catch(() => null),
      ]);

      if (!siteInfo || !siteInfo.userid) {
        throw new Error("Compte utilisateur introuvable");
      }

      const moodleId = siteInfo.userid;
      let moodleUser: any = profileData?.[0] || (profileData as any)?.users?.[0] || null;

      if (IS_DEV) console.log("[useLogin] Site info + profile received. userId:", moodleId, "profile:", moodleUser ? "found" : "not found");

      let finalFirstName = "";
      let finalLastName = "";

      if (moodleUser?.firstname?.trim()) {
        finalFirstName = moodleUser.firstname.trim();
      } else if (siteInfo?.firstname?.trim()) {
        finalFirstName = siteInfo.firstname.trim();
      }

      if (moodleUser?.lastname?.trim()) {
        finalLastName = moodleUser.lastname.trim();
      } else if (siteInfo?.lastname?.trim()) {
        finalLastName = siteInfo.lastname.trim();
      }

      if (firstName && finalFirstName !== firstName.trim()) {
        finalFirstName = firstName.trim();
      }
      if (lastName && finalLastName !== lastName.trim()) {
        finalLastName = lastName.trim();
      }

      if (!finalFirstName || !finalLastName) {
        const nameFromUsername = username.includes("@") ? username.split("@")[0] : username;
        const nameParts = nameFromUsername.split(/[_\-\s]/).filter(Boolean);

        if (!finalFirstName && nameParts[0]) {
          finalFirstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase();
        }
        if (!finalLastName && nameParts[1]) {
          finalLastName = nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1).toLowerCase();
        }
      }

      if (IS_DEV) console.log("[useLogin] Final name:", finalFirstName, finalLastName);

      const needProfileUpdate = !moodleUser?.firstname || !moodleUser?.lastname;

      if (needProfileUpdate && finalFirstName && finalLastName) {
        // ✅ OPTIMISATION : fire-and-forget — pas besoin d'attendre ni de re-fetcher
        updateUserProfile(moodleId, finalFirstName, finalLastName).catch((updateErr) => {
          if (IS_DEV) console.warn("[useLogin] Profile update failed:", updateErr);
        });
      }

      // ✅ OPTIMISATION : fire-and-forget — pas besoin d'attendre l'accord de politique
      if (siteInfo?.policyagreed === 0) {
        agreeToSitePolicy(authToken).catch((policyErr) => {
          if (IS_DEV) console.warn("[useLogin] Policy agree failed:", policyErr);
        });
      }

      // ✅ OPTIMISATION : fire-and-forget — l'enrôlement n'a pas besoin de bloquer la navigation
      (async () => {
        try {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          const prefsStr = await AsyncStorage.getItem('@ipelan_preferences');
          if (prefsStr) {
            const { language, grade } = JSON.parse(prefsStr);
            if (language && grade && authToken) {
              const { getFirstCourseFromLanguageAndGrade } = await import('../services/api/courseService');
              const targetCourse = await getFirstCourseFromLanguageAndGrade(authToken, language, Number(grade));
              if (targetCourse?.id) {
                await enrolUserInCourse(moodleId, targetCourse.id);
              }
            }
          }
        } catch (enrolErr) {
          if (IS_DEV) console.warn("[useLogin] Course enrollment skipped/failed:", enrolErr);
        }
      })();

      const finalEmail = moodleUser?.email || siteInfo?.email || email || username;
      const finalUsername = moodleUser?.username || siteInfo?.username || username;
      const finalFullName = `${finalFirstName} ${finalLastName}`.trim() || finalUsername;
      const finalAvatar = moodleUser?.profileimageurl || siteInfo?.userpictureurl || "";

      const getCustomField = (u: any, shortname: string) => {
        return u?.customfields?.find((f: any) => f.shortname === shortname)?.value;
      };

      const parsedXp = parseInt(getCustomField(moodleUser, 'ipelan_xp') || '0', 10);
      const parsedCoins = parseInt(getCustomField(moodleUser, 'ipelan_coins') || '0', 10);
      const parsedLives = parseInt(getCustomField(moodleUser, 'ipelan_lives') || '6', 10);
      const parsedStreak = parseInt(getCustomField(moodleUser, 'ipelan_streak') || '0', 10);
      const parsedLastActivity = getCustomField(moodleUser, 'ipelan_last_activity') || '';
      const parsedBadge = getCustomField(moodleUser, 'ipelan_badges');

      const userData: IPELANUser = {
        id: moodleId,
        username: finalUsername,
        firstname: finalFirstName,
        lastname: finalLastName,
        email: finalEmail,
        fullname: finalFullName,
        ipelan_xp: parsedXp,
        coins: parsedCoins,
        lives: parsedLives,
        streak: parsedStreak,
        badges: parsedBadge ? [parsedBadge] : [],
        avatar: finalAvatar,
      };

      await saveToken(authToken);
      await saveUserData(userData);

      try {
        const db = await getDBConnection();
        if (db) {
          await createTables(db);
          await saveUser(db, {
            id: userData.id,
            username: userData.username,
            email: userData.email,
            firstname: userData.firstname,
            lastname: userData.lastname,
            fullname: userData.fullname,
            ipelan_xp: userData.ipelan_xp,
            coins: userData.coins,
            lives: userData.lives,
            streak: userData.streak,
            last_activity: parsedLastActivity,
            token: authToken
          });

          if (parsedBadge) {
            const { saveBadge, initBadgeTable } = await import('../services/storage/badge-storage');
            await initBadgeTable();
            const badgeIds = parsedBadge.split(',').map((id: string) => id.trim()).filter((id: string) => id.length > 0);
            for (const badgeId of badgeIds) {
              await saveBadge(userData.id, badgeId);
            }
            if (IS_DEV) console.log(`[useLogin] Saved ${badgeIds.length} badges from Moodle to SQLite`);
          }
          if (IS_DEV) console.log("[useLogin] SQLite: User saved successfully");
        }
      } catch (dbErr) {
        if (IS_DEV) console.warn("[useLogin] SQLite save failed:", dbErr);
      }

      dispatch(loginSuccess({ user: userData, token: authToken }));

      // Always go to language selection to confirm/change preferences
      router.replace("/(auth)/language-selection" as any);

      return { user: userData, token: authToken };

    } catch (error: any) {
      if (IS_DEV) console.error("[useLogin] Login failed:", error.message);
      dispatch(loginFailure(error.message));
      throw error;
    }
  };

  const logoutUser = async () => {
    try {
      if (user?.id) syncQueue.clearJobs(user.id);
      await removeToken();
      await removeUserData();
      await removeCredentials();
      dispatch(logout());
      router.replace("/(auth)/login");
    } catch (error) {
      if (IS_DEV) console.error("Erreur lors de la déconnexion", error);
    }
  };

  return { login, logoutUser, user, token };
}
