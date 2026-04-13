import React, { useEffect, useState } from "react";
import { View, Text, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import Animated, { 
  FadeIn, 
  FadeInUp,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useSelector } from "react-redux";
import { RootState } from "../services/redux/store";
import { hasValidToken, getToken, getUserData } from "../services/storage/tokenStorage";
import { useDispatch } from "react-redux";
import { loginSuccess } from "../services/redux/slices/authSlice";

const LOGO = require("../assets/images/logo_ipelan.png"); 
const MASCOT = require("../assets/images/mascot_parrot.png");

export default function Index() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [isReady, setIsReady] = useState(false);
  const [authRestored, setAuthRestored] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await SplashScreen.preventAutoHideAsync();
        
        const hasToken = await hasValidToken();
        console.log("[Index] hasValidToken:", hasToken);
        
        if (hasToken) {
          const token = await getToken();
          const userData = await getUserData();
          
          if (token && userData) {
            console.log("[Index] Restoring auth from storage...");
            dispatch(loginSuccess({ user: userData, token }));
            setAuthRestored(true);
          } else {
            console.log("[Index] No user data found, going to onboarding");
            setAuthRestored(true);
          }
        } else {
          console.log("[Index] No token found, going to onboarding");
          setAuthRestored(true);
        }
      } catch (error) {
        console.log("[Index] Error:", error);
        setAuthRestored(true);
      }
    };

    init();
  }, [dispatch]);

  useEffect(() => {
    const navigate = async () => {
      if (!authRestored) return;
      
      const hasToken = await hasValidToken();
      console.log("[Index] authRestored:", authRestored, "hasToken:", hasToken, "isAuthenticated:", isAuthenticated);
      
      if (hasToken && isAuthenticated) {
        console.log("[Index] ✅ Valid token and authenticated, going to home");
        router.replace("/(tabs)/(home)");
      } else {
        console.log("[Index] ❌ Not authenticated, going to onboarding");
        router.replace("/(auth)/onboarding");
      }
      
      setIsReady(true);
      await SplashScreen.hideAsync();
    };

    navigate();
  }, [authRestored, isAuthenticated, router]);

  if (!isReady) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#002366" />
      </SafeAreaView>
    );
  }

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
