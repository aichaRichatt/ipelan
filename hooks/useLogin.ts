import { useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import { saveToken, saveUserData } from '../services/storage/tokenStorage';
import { loginStart, loginSuccess, loginFailure } from '../services/redux/slices/authSlice';
import { login as moodleLogin, getMoodleProfile, getMoodleSiteInfo } from '../services/api/moodleAuth';
import { getDBConnection, saveUser, createTables } from '../services/storage/db-service';

export function useLogin() {
  const dispatch = useDispatch();
  const router = useRouter();

  const login = async (username: string, password: string) => {
    dispatch(loginStart());

    try {
      const tokenData = await moodleLogin(username, password);
      const token = tokenData.token;

      if (!token) {
        throw new Error("Impossible de récupérer le jeton Moodle");
      }

      console.log("[useLogin] Getting site info...");
      const siteInfo = await getMoodleSiteInfo(token);
      console.log("[useLogin] Site info received:", !!siteInfo);
      
      if (!siteInfo || !siteInfo.userid) {
        throw new Error("Impossible de récupérer les informations du site Moodle");
      }

      let moodleUser: any = null;
      try {
        console.log("[useLogin] Attempting to fetch extended profile for userid:", siteInfo.userid);
        const profileData = await getMoodleProfile(token, siteInfo.userid, "id");
        moodleUser = profileData[0] || (profileData.users && profileData.users[0]);
        console.log("[useLogin] Extended profile received:", !!moodleUser);
      } catch (e: any) {
        console.log("[useLogin] Extended profile fetch failed (bypassing):", e.message);
      }

      const user = {
        id: siteInfo.userid,
        username: siteInfo.username,
        email: moodleUser?.email || username,
        fullname: siteInfo.fullname,
        ipelan_xp: moodleUser?.ipelan_xp || 0,
        coins: moodleUser?.coins || 0,
        streak: moodleUser?.streak || 0,
        avatar: siteInfo.userpictureurl,
        token: token
      };

      console.log("Enregister l`utilisateur...");
      await saveToken(token);
      await saveUserData(user);

      console.log("intialiser sqlite");
      try {
        const db = await getDBConnection();
        await createTables(db);
        await saveUser(db, user); 
        console.log("SQLite data saved.");
      } catch (sqliteError: any) {
         console.log("sqlite Error:", sqliteError.message);
      }

      dispatch(loginSuccess({ user, token }));
      console.log("Login success dispatched, navigating...");

      router.replace('/(tabs)');

    } catch (error: any) {
      dispatch(loginFailure(error.message));
      throw error;
    }
  };

  return { login };
}
