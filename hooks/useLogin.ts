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
      
      let token: string;
      let siteInfo: any = null;
      let moodleUser: any = null;
      
      const tokenData = await moodleLogin(username, password);
      token = tokenData.token;

      if (!token) {
        throw new Error("Impossible de récupérer le jeton Moodle");
      }

      const getMoodleUserProfileByAdmin = async (moodleUserId: number) => {
        const adminProfileData = await getMoodleProfile(process.env.EXPO_PUBLIC_MOODLE_TOKEN!, moodleUserId, "id");
        return adminProfileData?.[0] || (adminProfileData?.users && adminProfileData.users[0]);
      };

      try {
        siteInfo = await getMoodleSiteInfo(token);
      } catch (siteErr: any) {
        if (IS_DEV) console.warn("[useLogin] Site info fetch failed:", siteErr.message);
      }

      if (siteInfo?.userid) {
        try {
          const profileData = await getMoodleProfile(token, siteInfo.userid, "id");
          moodleUser = profileData[0] || (profileData.users && profileData.users[0]);
        } catch (e: any) {
          if (IS_DEV) console.warn("[useLogin] Student profile fetch failed");
        }
      }

      if (!moodleUser && siteInfo?.userid && process.env.EXPO_PUBLIC_MOODLE_TOKEN) {
        try {
          moodleUser = await getMoodleUserProfileByAdmin(siteInfo.userid);
        } catch (adminErr: any) {
          if (IS_DEV) console.warn("[useLogin] Admin fallback for profile failed");
        }
      }

      const moodleId = siteInfo?.userid || moodleUser?.id || 0;
        
      if (moodleId > 0) {
        const needProfileUpdate = !moodleUser?.firstname || !moodleUser?.lastname || moodleUser?.auth === 'none';
        const needPolicyAccept = siteInfo?.policyagreed === 0;
        
        if (needProfileUpdate || needPolicyAccept) {
          try {
            const currentProfile = await getMoodleUserProfileByAdmin(Number(moodleId));
            const current = currentProfile?.[0] || currentProfile?.users?.[0] || {};
            
            const nameFromEmail = siteInfo?.username?.split('@')[0] || "User";
            const newFirstName = current?.firstname || firstName || siteInfo?.firstname || nameFromEmail;
            const newLastName = current?.lastname || lastName || siteInfo?.lastname || "";
            
            await updateUserProfile(Number(moodleId), newFirstName, newLastName);
            
            await sleep(1500);
            siteInfo = await getMoodleSiteInfo(token);
          } catch (repairErr: any) {
            if (IS_DEV) console.warn("[useLogin] Profile update failed");
          }
        }
      }
        
      if (siteInfo && siteInfo.policyagreed === 0) {
        try {
          await agreeToSitePolicy(token, Number(moodleId));
          await sleep(1000);
          siteInfo = await getMoodleSiteInfo(token);
        } catch (agreeErr: any) {
          if (IS_DEV) console.warn("[useLogin] Policy agree failed");
        }
      }
       
      try {
        await enrolUserInCourse(Number(moodleId), 81);
      } catch (enrolErr: any) {
        if (IS_DEV) console.warn("[useLogin] Course enrollment failed");
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

      await saveToken(token);
      await saveUserData(user);

      try {
        const db = await getDBConnection();
        if (db) {
          await createTables(db);
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
        }
      } catch (sqliteError: any) {
        if (IS_DEV) console.warn("[useLogin] SQLite error:", sqliteError.message);
      }

      dispatch(loginSuccess({ user, token }));
      await sleep(500);
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
      if (IS_DEV) console.error("Erreur lors de la déconnexion", error);
    }
  };

  return { login, logoutUser, user, token };
}
