import { useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginStart, loginSuccess, loginFailure } from '../services/redux/slices/authSlice';
import { getMoodleToken, getMoodleProfile } from '../services/api/moodleAuth';
import { getDBConnection, saveUser, createTables } from '../services/storage/db-service';

export function useLogin() {
  const dispatch = useDispatch();
  const router = useRouter();

  const login = async (username: string, password: string) => {
    dispatch(loginStart());

    try {
      // 1. Get Moodle Token
      const tokenData = await getMoodleToken(username, password);
      const token = tokenData.token;

      if (!token) {
        throw new Error("Impossible de récupérer le jeton Moodle");
      }

      // 2. Get Moodle Profile
      const profileData = await getMoodleProfile(token, username);
      const moodleUser = profileData.users && profileData.users[0];

      if (!moodleUser) {
        throw new Error("Utilisateur non trouvé dans Moodle");
      }

      // 3. Parse user data
      const user = {
        id: moodleUser.id,
        username: moodleUser.username,
        email: moodleUser.email,
        fullname: moodleUser.fullname,
        ipelan_xp: moodleUser.ipelan_xp || 0,
        coins: moodleUser.coins || 0,
        streak: moodleUser.streak || 0,
        avatar: moodleUser.profileimageurl,
        token: token
      };

      // 4. Persist to AsyncStorage
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(user));

      // 5. Save to SQLite
      const db = await getDBConnection();
      await createTables(db);
      await saveUser(db, user);

      // 6. Update Redux State
      dispatch(loginSuccess({ user, token }));

      // 7. Navigate
      router.replace('/(tabs)/(home)' as any);

    } catch (error: any) {
      dispatch(loginFailure(error.message));
      throw error;
    }
  };

  return { login };
}
