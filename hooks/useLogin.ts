import { useRouter } from 'expo-router';
import { saveToken, saveUserData, removeToken, removeUserData } from '../services/storage/tokenStorage';
import { loginStart, loginSuccess, loginFailure, logout } from '../services/redux/slices/authSlice';
import { login as moodleLogin, getMoodleSiteInfo, getMoodleProfile, updateUserProfile, agreeToSitePolicy, enrolUserInCourse } from "../services/api/moodleAuth";
import { getDBConnection, saveUser, createTables } from '../services/storage/db-service';
import { IPELANUser } from '../types';
import { RootState } from '../services/redux/store';
import { useDispatch, useSelector } from 'react-redux';

const IS_DEV = process.env.NODE_ENV === "development";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function useLogin() {
  const dispatch = useDispatch();
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);

  const login = async (username: string, password: string, email?: string, firstName?: string, lastName?: string, city?: string) => {
    dispatch(loginStart());
    
    try {
      if (IS_DEV) console.log("[useLogin] Log In Attempt for:", username);
      
      const tokenData = await moodleLogin(username, password);
      const authToken = tokenData.token;

      if (!authToken) {
        throw new Error("Identifiants incorrects");
      }

      if (IS_DEV) console.log("[useLogin] Token received, fetching site info...");

      const siteInfo = await getMoodleSiteInfo(authToken);

      if (!siteInfo || !siteInfo.userid) {
        throw new Error("Compte utilisateur introuvable");
      }

      if (IS_DEV) console.log("[useLogin] Site info received, userid:", siteInfo.userid);

      const moodleId = siteInfo.userid;
      let moodleUser: any = null;

      try {
        const profileData = await getMoodleProfile(authToken, moodleId, "id");
        moodleUser = profileData?.[0] || profileData?.users?.[0] || null;
        if (IS_DEV) console.log("[useLogin] Profile fetched:", moodleUser ? "found" : "not found");
      } catch (profileErr) {
        if (IS_DEV) console.warn("[useLogin] Profile fetch failed:", profileErr);
      }

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

      if (IS_DEV) console.log("[useLogin] Final name:", finalFirstName, finalLastName, "| firstName:", firstName, "| lastName:", lastName);

      const needProfileUpdate = !moodleUser?.firstname || !moodleUser?.lastname;
      
      if (needProfileUpdate && finalFirstName && finalLastName) {
        try {
          if (IS_DEV) console.log("[useLogin] Updating profile...");
          await updateUserProfile(moodleId, finalFirstName, finalLastName);
          await sleep(1000);
          
          const updatedProfile = await getMoodleProfile(authToken, moodleId, "id");
          const updatedUser = updatedProfile?.[0] || updatedProfile?.users?.[0] || null;
          
          if (updatedUser?.firstname) finalFirstName = updatedUser.firstname.trim();
          if (updatedUser?.lastname) finalLastName = updatedUser.lastname.trim();
          
          if (IS_DEV) console.log("[useLogin] Profile updated:", finalFirstName, finalLastName);
        } catch (updateErr) {
          if (IS_DEV) console.warn("[useLogin] Profile update failed:", updateErr);
        }
      }

      if (siteInfo?.policyagreed === 0) {
        try {
          await agreeToSitePolicy(authToken, moodleId);
          await sleep(500);
        } catch (policyErr) {
          if (IS_DEV) console.warn("[useLogin] Policy agree failed:", policyErr);
        }
      }

      try {
        await enrolUserInCourse(moodleId, 81);
      } catch (enrolErr) {
        if (IS_DEV) console.warn("[useLogin] Course enrollment failed:", enrolErr);
      }

      const finalEmail = moodleUser?.email || siteInfo?.email || email || username;
      const finalUsername = moodleUser?.username || siteInfo?.username || username;
      const finalFullName = `${finalFirstName} ${finalLastName}`.trim() || finalUsername;
      const finalAvatar = moodleUser?.profileimageurl || siteInfo?.userpictureurl || "";

      const userData: IPELANUser = {
        id: moodleId,
        username: finalUsername,
        firstname: finalFirstName,
        lastname: finalLastName,
        email: finalEmail,
        fullname: finalFullName,
        ipelan_xp: moodleUser?.ipelan_xp || 0,
        coins: moodleUser?.coins || 0,
        streak: moodleUser?.streak || 0,
        avatar: finalAvatar,
        token: authToken
      };

      if (IS_DEV) console.log("[useLogin] Saving user data:", JSON.stringify(userData));

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
            streak: userData.streak,
            token: authToken
          });
          if (IS_DEV) console.log("[useLogin] SQLite: User saved successfully");
        }
      } catch (dbErr) {
        if (IS_DEV) console.warn("[useLogin] SQLite save failed:", dbErr);
      }

      dispatch(loginSuccess({ user: userData, token: authToken }));
      
      await sleep(300);
      router.replace("/(tabs)/(home)" as any);
      
      return { user: userData, token: authToken };

    } catch (error: any) {
      if (IS_DEV) console.error("[useLogin] Login failed:", error.message);
      dispatch(loginFailure(error.message));
      throw error;
    }
  };

  const logoutUser = async () => {
    try {
      await removeToken();
      await removeUserData();
      dispatch(logout());
      router.replace("/(auth)/login");
    } catch (error) {
      if (IS_DEV) console.error("Erreur lors de la déconnexion", error);
    }
  };

  return { login, logoutUser, user, token };
}
