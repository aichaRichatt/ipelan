import React, { useEffect } from "react";
import { View, Text, Image } from "react-native";
import { useRouter } from "expo-router";
import Animated, { 
  FadeIn, 
  FadeInUp,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";

const LOGO = require("../assets/images/logo_ipelan.png"); 
const MASCOT = require("../assets/images/mascot_parrot.png"); 

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    SplashScreen.hideAsync();

    const timer = setTimeout(() => {
      router.push("/(auth)/language-selection");
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

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
