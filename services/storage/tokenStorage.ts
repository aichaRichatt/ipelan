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
