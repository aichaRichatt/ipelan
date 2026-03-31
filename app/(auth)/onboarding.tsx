import React, { useState } from "react";
import { View, Text, Pressable} from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInRight } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";


interface OnboardingSlide {
  id: number;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 1,
    icon: "globe",
    title: "Apprends les langues nationales",
    subtitle: "Pulaar, Soninké et Wolof adaptés aux enfants du cycle fondamental",
    color: "#002366",
  },
  {
    id: 2,
    icon: "headphones",
    title: "Écoute et pratique",
    subtitle: "Des audios avec des locuteurs natifs pour améliorer ta prononciation",
    color: "#4a90e2",
  },
  {
    id: 3,
    icon: "award",
    title: "Gagne des récompenses",
    subtitle: "Des étoiles, des badges et desXP pour chaque activité réussie !",
    color: "#F59E0B",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    router.push("/(auth)/language-selection");
  };

  const handleSkip = () => {
    router.push("/(auth)/language-selection");
  };

  const slide = SLIDES[currentSlide];

  return (
    <View className="flex-1 bg-white">
      {/* Skip Button */}
      <View className="items-end p-5">
        <Pressable onPress={handleSkip} className="px-4 py-2">
          <Text className="text-gray-500 font-medium">Passer</Text>
        </Pressable>
      </View>

      {/* Slide Content */}
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View
          key={slide.id}
          entering={FadeInRight.duration(500)}
          className="items-center"
        >
          <View 
            className="w-40 h-40 rounded-full items-center justify-center mb-8"
            style={{ backgroundColor: `${slide.color}15` }}
          >
            <Feather name={slide.icon as any} size={80} color={slide.color} />
          </View>
          
          <Text 
            className="text-3xl font-bold text-center mb-4"
            style={{ color: slide.color }}
          >
            {slide.title}
          </Text>
          
          <Text className="text-gray-500 text-center text-lg leading-relaxed px-4">
            {slide.subtitle}
          </Text>
        </Animated.View>
      </View>

      {/* Dots Indicator */}
      <View className="flex-row justify-center mb-8">
        {SLIDES.map((_, index) => (
          <View
            key={index}
            className={`w-3 h-3 rounded-full mx-2 ${
              index === currentSlide ? 'bg-[#002366]' : 'bg-gray-300'
            }`}
          />
        ))}
      </View>

      {/* Navigation Buttons */}
      <View className="px-5 pb-10">
        <Pressable
          onPress={handleNext}
          className="rounded-2xl py-4 items-center"
          style={{ backgroundColor: slide.color }}
        >
          <Text className="text-white font-bold text-lg">
            {currentSlide < SLIDES.length - 1 ? "Suivant" : "Commencer"}
          </Text>
        </Pressable>
        
        {currentSlide < SLIDES.length - 1 && (
          <Pressable onPress={handleFinish} className="mt-4 py-3">
            <Text className="text-gray-400 text-center font-medium">
              Je n'ai pas besoin d'aide
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
