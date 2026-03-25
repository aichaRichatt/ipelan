import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveToken = async (token: string) => {
  await AsyncStorage.setItem("moodle_token", token);
}

export const getToken = async () => {
  return await AsyncStorage.getItem("moodle_token");
}

export const removeToken = async () => {
  return await AsyncStorage.removeItem("moodle_token");
}

export const saveUserData = async (userData: any) => {
  await AsyncStorage.setItem("user_data", JSON.stringify(userData));
}

export const getUserData = async () => {
  const data = await AsyncStorage.getItem("user_data");
  return data ? JSON.parse(data) : null;
}

export const removeUserData = async () => {
  return await AsyncStorage.removeItem("user_data");
}
