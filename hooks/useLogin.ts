import { useRouter } from 'expo-router';
import { saveToken, saveUserData, removeToken, removeUserData } from '../services/storage/tokenStorage';
import { loginStart, loginSuccess, loginFailure, logout } from '../services/redux/slices/authSlice';
import { login as moodleLogin, getMoodleSiteInfo,
  getMoodleProfile,
  updateUserProfile,
  agreeToSitePolicy,
  enrolUserInCourse
} from "../services/api/moodleAuth";
import { getDBConnection, saveUser, createTables } from '../services/storage/db-service';
import { IPELANUser, LoginForm } from '../types';
import { RootState } from '../services/redux/store';
import { useDispatch, useSelector } from 'react-redux';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function useLogin() {
  const dispatch = useDispatch();
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);

  const login = async (username: string, password: string, email?: string, firstName?: string, lastName?: string, city?: string) => {
    dispatch(loginStart());
    try {
      console.log("[useLogin] Log In Attempt for:", username);
      const tokenData = await moodleLogin(username, password);
      const token = tokenData.token;

      if (!token) {
        throw new Error("Impossible de récupérer le jeton Moodle");
      }

      let siteInfo: any = null;
      let moodleUser: any = null;

      const getMoodleUserProfileByAdmin = async (moodleUserId: number) => {
        const adminProfileData = await getMoodleProfile(process.env.EXPO_PUBLIC_MOODLE_TOKEN!, moodleUserId, "id");
        return adminProfileData?.[0] || (adminProfileData?.users && adminProfileData.users[0]);
      };

       try {
        console.log("[useLogin] Getting site info for token...");
        siteInfo = await getMoodleSiteInfo(token);
        console.log("[useLogin] Site info raw:", JSON.stringify(siteInfo));
      } catch (siteErr: any) {
         console.warn("[useLogin] Site info fetch failed:", siteErr.message);
      }

       if (siteInfo?.userid) {
        try {
          console.log("[useLogin] Attempting to fetch extended profile for userid:", siteInfo.userid);
          const profileData = await getMoodleProfile(token, siteInfo.userid, "id");
          moodleUser = profileData[0] || (profileData.users && profileData.users[0]);
        } catch (e: any) {
          console.log("[useLogin] Student profile fetch failed:", e.message);
        }
      }

       if (!moodleUser && siteInfo?.userid && process.env.EXPO_PUBLIC_MOODLE_TOKEN) {
        try {
          console.log("[useLogin] Retrying profile fetch with Admin token for ID:", siteInfo.userid);
          moodleUser = await getMoodleUserProfileByAdmin(siteInfo.userid);
          console.log("[useLogin] Admin profile recovered:", !!moodleUser);
        } catch (adminErr: any) {
          console.warn("[useLogin] Admin fallback for profile also failed:", adminErr.message);
        }
      }

      const moodleId = siteInfo?.userid || moodleUser?.id || 0;
      
       if (moodleId > 0 && (!moodleUser?.email || moodleUser?.auth === 'none' || siteInfo?.policyagreed === 0)) {
        console.log("[useLogin] Profile incomplete, policy not agreed or missing mail. Attempting AUTO-REPAIR...");
        try {
          const repairEmail = email || moodleUser?.email || (siteInfo?.username?.includes('@') ? siteInfo.username : `${siteInfo?.username || 'user'}@ipelan.com`);
          await updateUserProfile(
            Number(moodleId),
            firstName || moodleUser?.firstname || siteInfo?.firstname || "Ip",
            lastName || moodleUser?.lastname || siteInfo?.lastname || "User",
            repairEmail,
            city || moodleUser?.city || siteInfo?.city || "Nktt"
          );
          console.log("[useLogin] AUTO-REPAIR successful for ID:", moodleId);
          
           try {
            console.log("[useLogin] Forcing enrollment in Course 81 for ID:", moodleId);
            await enrolUserInCourse(Number(moodleId), 81);
          } catch (enrolErr) {
            console.warn("[useLogin] Course enrollment failed (check Admin permissions):", enrolErr);
          }

           console.log("[useLogin] Waiting 1.5s for Moodle sync...");
          await sleep(1500);

           siteInfo = await getMoodleSiteInfo(token);
          moodleUser = await getMoodleUserProfileByAdmin(Number(moodleId));
        } catch (repairErr: any) {
          console.warn("[useLogin] AUTO-REPAIR failed:", repairErr.message);
        }
      }

       if (siteInfo && siteInfo.policyagreed === 0) {
        console.log("[useLogin] Site policy STILL not agreed. Final attempt via student token...");
        try {
          await agreeToSitePolicy(token);
          siteInfo = await getMoodleSiteInfo(token);
        } catch (agreeErr: any) {
          console.warn("[useLogin] Manual AUTO-AGREE fallback ignored:", agreeErr.message);
        }
      }

      const fName = (moodleUser?.firstname || siteInfo?.firstname || "").trim();
      const lName = (moodleUser?.lastname || siteInfo?.lastname || "").trim();
      
      const fallbackName = (siteInfo?.username || username || "").split('@')[0];
      const finalFullName = (siteInfo?.fullname && siteInfo.fullname.trim().length > 1) 
                      ? siteInfo.fullname.trim() 
                      : (fName || lName) ? `${fName} ${lName}`.trim() : fallbackName;

      const user: IPELANUser = {
        id: Number(moodleId),
        username: moodleUser?.username || siteInfo?.username || username,
        firstname: fName || fallbackName,
        lastname: lName,
        email: moodleUser?.email || siteInfo?.email || username,
        fullname: finalFullName,
        ipelan_xp: moodleUser?.ipelan_xp || 0,
        coins: moodleUser?.coins || 0,
        streak: moodleUser?.streak || 0,
        avatar: moodleUser?.profileimageurl || siteInfo?.userpictureurl || "",
        token: token
      };

      console.log("[useLogin] Final user object to save:", JSON.stringify(user));
      await saveToken(token);
      await saveUserData(user);

      console.log("intialiser sqlite");
      let db = null;
      try {
        db = await getDBConnection();
        if (db) {
          await createTables(db);
          console.log("Saving user to SQLite:", JSON.stringify(user));
          const dbUser = {
            id: user.id,
            username: user.username,
            email: user.email,
            fullname: user.fullname,
            ipelan_xp: user.ipelan_xp,
            coins: user.coins,
            streak: user.streak,
            token: user.token || token
          };
          await saveUser(db, dbUser as any);
          console.log("SQLite data saved.");
        }
      } catch (sqliteError: any) {
         console.log("sqlite Error detail:", sqliteError.message || sqliteError);
      }

      dispatch(loginSuccess({ user, token }));
      console.log("Login success dispatched, navigating...");

      router.replace("/(tabs)/(home)" as any);
      return { user, token };

    } catch (error: any) {
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
      console.error("Erreur lors de la déconnexion", error);
    }
  };

  return { login, logoutUser, user, token };
}
