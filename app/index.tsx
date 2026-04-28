import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Image, Text, View } from "react-native";
import Animated, {
    FadeIn,
    FadeInUp,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { loginSuccess } from "../services/redux/slices/authSlice";
import { RootState } from "../services/redux/store";
import { getToken, getUserData, hasValidToken } from "../services/storage/tokenStorage";

const IS_DEV = process.env.NODE_ENV === "development";

const LOGO = require("../assets/images/logo_ipelan.png"); 
const MASCOT = require("../assets/images/mascot_parrot.png");

// Prevent native splash screen from hiding automatically
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Index() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const isAuthenticatedRef = useRef(isAuthenticated);

  // Keep ref up to date with Redux state
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    let isMounted = true;

    // Async block to attempt auth restoration and hide native splash
    const prepareApp = async () => {
      try {
        const hasToken = await hasValidToken();
        if (hasToken) {
          const token = await getToken();
          const userData = await getUserData();
          if (token && userData && isMounted) {
            dispatch(loginSuccess({ user: userData, token }));
          }
        }
      } catch (error) {
        if (IS_DEV) console.error("[Index] Auth check error:", error);
      } finally {
        // IMPORTANT: Hide the native splash screen immediately!
        // This allows the user to see the animated JS splash screen below.
        try {
          // Add a small 500ms delay before hiding native splash 
          // just to avoid any immediate JS blocking flashes
          setTimeout(async () => {
            if (isMounted) await SplashScreen.hideAsync();
          }, 500);
        } catch {
          // Ignore
        }
      }
    };

    prepareApp();

    // Trigger navigation exactly after 5 seconds of showing our JS animations
    const timer = setTimeout(() => {
      if (!isMounted) return;

      try {
        if (isAuthenticatedRef.current) {
          router.replace("/(tabs)/(home)");
        } else {
          router.replace("/(auth)/onboarding");
        }
      } catch (navigationError) {
        if (IS_DEV) console.error("[Index] Navigation failed:", navigationError);
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [dispatch, router]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 items-center justify-center py-10">
        
        <Animated.View 
          entering={FadeInUp.delay(200).duration(800)}
          className="items-center mb-10"
        >
          <Image 
            source={LOGO} 
            className="w-32 h-32" 
            resizeMode="contain" 
          />
          <Text className="text-4xl font-bold text-[#002366] mt-4 tracking-widest">
            IPELAN
          </Text>
          <Text className="text-2xl text-[#4a90e2] mt-1 font-semibold">
            م.ت.ن.ل.و
          </Text>
        </Animated.View>

        <Animated.View 
          entering={FadeIn.delay(500).duration(1000)}
          className="items-center"
        >
          <View className="bg-[#f0f7ff] rounded-full p-10">
            <Animated.Image 
              source={MASCOT} 
              className="w-64 h-64" 
              resizeMode="contain"
            />
          </View>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}
