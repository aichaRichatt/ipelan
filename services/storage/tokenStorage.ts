import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'moodle_token';

export const saveToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (error) {
    console.error('[SecureStorage] Failed to save token:', error);
    throw error;
  }
};

export const getToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('[SecureStorage] Failed to get token:', error);
    return null;
  }
};

export const removeToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('[SecureStorage] Failed to remove token:', error);
  }
};

export const saveUserData = async (userData: any): Promise<void> => {
  try {
    await AsyncStorage.setItem('user_data', JSON.stringify(userData));
  } catch (error) {
    console.error('[TokenStorage] Failed to save user data:', error);
    throw error;
  }
};

export const getUserData = async (): Promise<any> => {
  try {
    const data = await AsyncStorage.getItem('user_data');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[TokenStorage] Failed to get user data:', error);
    return null;
  }
};

export const removeUserData = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('user_data');
  } catch (error) {
    console.error('[TokenStorage] Failed to remove user data:', error);
  }
};

export const hasValidToken = async (): Promise<boolean> => {
  const token = await getToken();
  return token !== null && token.length > 0;
};
