import React, { useEffect } from "react";
import { View, Text, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";

 const LOGO = require("../assets/images/logo_ipelan.png"); 
const MASCOT = require("../assets/images/mascot_parrot.png"); 

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    SplashScreen.hideAsync();

    const timer = setTimeout(() => {
      router.push("/(auth)/login");
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  const handleLanguageSelect = (lang: string) => {
    router.push("/(auth)/login");
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 items-center justify-between py-10">
        
        <Animated.View 
          entering={FadeInUp.delay(200).duration(800)}
          className="items-center"
        >
          <Image 
            source={LOGO} 
            className="w-24 h-24" 
            resizeMode="contain" 
          />
          <Text className="text-3xl font-bold text-[#002366] mt-2 tracking-widest">
            IPELAN
          </Text>
          <Text className="text-xl text-[#4a90e2] mt-1 font-semibold">
            م.ت.ن.ل.و
          </Text>
        </Animated.View>

        <Animated.View 
          entering={FadeIn.delay(500).duration(1000)}
          className="flex-1 justify-center items-center"
        >
          <View className="bg-[#f0f7ff] rounded-full p-8">
            <Animated.Image 
              source={MASCOT} 
              className="w-56 h-56" 
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(800).duration(800)}
          className="w-full"
        >
          <View className="flex-row justify-center space-x-4 mb-8">
            <LanguageButton 
              label="Pulaar" 
              icon="fox" 
              color="#ff9500" 
            />
            <LanguageButton 
              label="Soninké" 
              icon="lion" 
              color="#4cd964" 
            />
            <LanguageButton 
              label="Wolof" 
              icon="dolphin" 
              color="#007aff" 
            />
          </View>

          <View className="flex-row justify-center space-x-2">
            <View className="w-3 h-3 rounded-full bg-[#002366]" />
            <View className="w-3 h-3 rounded-full bg-[#ff9500] opacity-30" />
            <View className="w-3 h-3 rounded-full bg-[#4cd964] opacity-30" />
          </View>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}

interface LanguageButtonProps {
  label: string;
  icon: any;
  color: string;
}

function LanguageButton({ label, icon, color }: LanguageButtonProps) {
  return (
    <Pressable 
      className="items-center justify-center p-4 rounded-3xl bg-white border"
      style={{ borderColor: color, shadowColor: color, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }}
    >
      <View style={{ backgroundColor: `${color}15` }} className="p-3 rounded-full mb-2">
        <FontAwesome5 name={icon} size={32} color={color} solid />
      </View>
      <Text className="font-bold text-base" style={{ color }}>{label}</Text>
    </Pressable>
  );
}
