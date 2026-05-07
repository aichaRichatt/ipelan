import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useDispatch } from "react-redux";
import ICON from "../assets/images/icon.png";
import { loginSuccess } from "../services/redux/slices/authSlice";
import { getToken, getUserData, hasValidToken } from "../services/storage/tokenStorage";

const IS_DEV = process.env.NODE_ENV === "development";

export default function Index() {
  const router = useRouter();
  const dispatch = useDispatch();

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      let destination: string = "/(auth)/login";

      // Chaque appel a son propre try-catch — un crash isolé ne bloque pas les suivants
      let hasToken = false;
      try { hasToken = await hasValidToken(); } catch (e) {
        if (IS_DEV) console.warn("[Index] hasValidToken error:", e);
      }

      if (hasToken) {
        let token: string | null = null;
        let userData: any = null;
        try { token = await getToken(); } catch (e) {
          if (IS_DEV) console.warn("[Index] getToken error:", e);
        }
        try { userData = await getUserData(); } catch (e) {
          if (IS_DEV) console.warn("[Index] getUserData error:", e);
        }
        if (token && userData && isMounted) {
          try { dispatch(loginSuccess({ user: userData, token })); } catch (e) {
            if (IS_DEV) console.warn("[Index] dispatch error:", e);
          }
          destination = "/(tabs)/(home)";
        }
      }

      // Affiche le splash au moins 3 secondes
      await new Promise<void>((resolve) => setTimeout(resolve, 3000));

      if (!isMounted) return;
      try {
        router.replace(destination as any);
      } catch (e) {
        if (IS_DEV) console.error("[Index] Navigation failed:", e);
      }
    };

    run();

    return () => { isMounted = false; };
  }, [dispatch, router]);

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
