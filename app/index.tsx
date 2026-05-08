import { useRootNavigationState, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Alert, Image, StyleSheet, View } from "react-native";
import { useDispatch } from "react-redux";
import ICON from "../assets/images/icon.png";
import { loginSuccess } from "../services/redux/slices/authSlice";
import { getToken, getUserData, hasValidToken } from "../services/storage/tokenStorage";

const IS_DEV = process.env.NODE_ENV === "development";

export default function Index() {
  const router = useRouter();
  const dispatch = useDispatch();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) {
      Alert.alert("Debug", "Navigation not ready yet");
      return;
    }

    Alert.alert("Debug", "Navigation ready, starting...");
    let isMounted = true;

    const run = async () => {
      let destination: string = "/(auth)/login";

      let hasToken = false;
      try { hasToken = await hasValidToken(); } catch (e) {
        Alert.alert("Debug", "Token check failed: " + String(e));
      }

      Alert.alert("Debug", "Has token: " + hasToken);

      if (hasToken) {
        let token: string | null = null;
        let userData: any = null;
        try { token = await getToken(); } catch (e) {
          Alert.alert("Debug", "Get token error: " + String(e));
        }
        try { userData = await getUserData(); } catch (e) {
          Alert.alert("Debug", "Get user error: " + String(e));
        }
        if (token && userData && isMounted) {
          try { dispatch(loginSuccess({ user: userData, token })); } catch (e) {
            Alert.alert("Debug", "Dispatch error: " + String(e));
          }
          destination = "/(tabs)/(home)";
        }
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 3000));

      if (!isMounted) return;
      Alert.alert("Debug", "Navigating to: " + destination);
      try {
        router.replace(destination as any);
        Alert.alert("Debug", "Navigation called successfully");
      } catch (e) {
        Alert.alert("Debug", "Navigation failed: " + String(e));
      }
    };

    run();

    return () => { isMounted = false };
  }, [dispatch, router, navigationState?.key]);

  return (
    <View style={styles.container}>
      <Image
        source={ICON}
        style={styles.icon}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 208,
    height: 208,
  },
});
