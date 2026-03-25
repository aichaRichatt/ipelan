import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Animated, { 
  FadeInDown, 
  FadeInUp,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";

export default function LanguageSelection() {
  const router = useRouter();

  const handleLanguageSelect = (lang: string) => {
    router.push("/(auth)/login");
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 py-10 justify-center">
        
        <Animated.View 
          entering={FadeInUp.duration(800)}
          className="items-center mb-12"
        >
          <View className="bg-[#f0f7ff] p-4 rounded-2xl mb-4">
            <FontAwesome5 name="globe" size={40} color="#002366" solid />
          </View>
          <Text className="text-3xl font-bold text-[#002366] text-center">
            Choisissez votre langue
          </Text>
          <Text className="text-lg text-gray-400 mt-2 text-center font-medium">
            Sélectionnez la langue pour continuer
          </Text>
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(200).duration(800)}
          className="space-y-4"
        >
          <LanguageOption 
            label="Pulaar" 
            icon="paw" 
            color="#ff9500" 
            onPress={() => handleLanguageSelect("pulaar")} 
          />
          <LanguageOption 
            label="Soninké" 
            icon="cat" 
            color="#4cd964" 
            onPress={() => handleLanguageSelect("soninke")} 
          />
          <LanguageOption 
            label="Wolof" 
            icon="fish" 
            color="#007aff" 
            onPress={() => handleLanguageSelect("wolof")} 
          />
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}

interface LanguageOptionProps {
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
}

function LanguageOption({ label, icon, color, onPress }: LanguageOptionProps) {
  return (
    <Pressable 
      onPress={onPress}
      className="flex-row items-center p-6 rounded-3xl bg-white border-2 mb-4"
      style={{ 
        borderColor: `${color}40`,
        elevation: 4
      }}
    >
      <View style={{ backgroundColor: `${color}15` }} className="p-4 rounded-2xl mr-6">
        <FontAwesome5 name={icon} size={28} color={color} solid />
      </View>
      <View className="flex-1">
        <Text className="font-bold text-xl" style={{ color: "#002366" }}>{label}</Text>
        <Text className="text-gray-400 text-sm">Apprendre en {label}</Text>
      </View>
      <FontAwesome5 name="chevron-right" size={16} color="#cbd5e1" solid />
    </Pressable>
  );
}
