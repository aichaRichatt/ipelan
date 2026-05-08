import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";

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
    subtitle: "Des étoiles, des badges et des XP pour chaque activité réussie !",
    color: "#F59E0B",
  },
];

const styles = StyleSheet.create({
  flex1_bgwhite: {
    backgroundColor: '#FFFFFF',
    flex: 1
  },
  flex1_itemscenter_justifycente: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32
  },
  flexrow_justifycenter_mb8: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32
  },
  itemscenter: {
    alignItems: 'center'
  },
  itemsend_p5: {
    alignItems: 'flex-end',
    padding: 20
  },
  mt4_py3: {
    marginTop: 16,
    paddingVertical: 12
  },
  px4_py2: {
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  px5_pb10: {
    paddingHorizontal: 20
  },
  rounded2xl_py4_itemscenter: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 16
  },
  text3xl_fontbold_textcenter_mb: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center'
  },
  textgray400_textcenter_fontmed: {
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center'
  },
  textgray500_fontmedium: {
    color: '#6B7280',
    fontWeight: '500'
  },
  textgray500_textcenter_textlg_: {
    color: '#6B7280',
    fontSize: 18,
    paddingHorizontal: 16,
    textAlign: 'center'
  },
  textwhite_fontbold_textlg: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700'
  },
  w40_h40_roundedfull_itemscente: {
    alignItems: 'center',
    borderRadius: 9999,
    height: 160,
    justifyContent: 'center',
    marginBottom: 32,
    width: 160
  },
});

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
    router.replace("/(auth)/signup");
  };

  const handleSkip = () => {
    router.replace("/(auth)/signup");
  };

  const slide = SLIDES[currentSlide];

  return (
    <View style={styles.flex1_bgwhite}>
      {/* Skip Button */}
      <View style={styles.itemsend_p5}>
        <Pressable onPress={handleSkip} style={styles.px4_py2}>
          <Text style={styles.textgray500_fontmedium}>Passer</Text>
        </Pressable>
      </View>

      {/* Slide Content */}
      <View style={styles.flex1_itemscenter_justifycente}>
        <Animated.View
          key={slide.id}
          entering={FadeInRight.duration(500)}
          style={styles.itemscenter}
        >
          <View 
            style={[styles.w40_h40_roundedfull_itemscente, { backgroundColor: `${slide.color}15` }]}
          >
            <Feather name={slide.icon as any} size={80} color={slide.color} />
          </View>
          
          <Text 
            style={[styles.text3xl_fontbold_textcenter_mb, { color: slide.color }]}
          >
            {slide.title}
          </Text>
          
          <Text style={styles.textgray500_textcenter_textlg_}>
            {slide.subtitle}
          </Text>
        </Animated.View>
      </View>

      {/* Dots Indicator */}
      <View style={styles.flexrow_justifycenter_mb8}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={{
              width: 12,
              height: 12,
              borderRadius: 9999,
              marginHorizontal: 8,
              backgroundColor: index === currentSlide ? '#002366' : '#D1D5DB'
            }}
          />
        ))}
      </View>

      {/* Navigation Buttons */}
      <View style={styles.px5_pb10}>
        <Pressable
          onPress={handleNext}
          style={[styles.rounded2xl_py4_itemscenter, { backgroundColor: slide.color }]}
        >
          <Text style={styles.textwhite_fontbold_textlg}>
            {currentSlide < SLIDES.length - 1 ? "Suivant" : "Commencer"}
          </Text>
        </Pressable>
        
        {currentSlide < SLIDES.length - 1 && (
          <Pressable onPress={handleFinish} style={styles.mt4_py3}>
            <Text style={styles.textgray400_textcenter_fontmed}>
              Je n&apos;ai pas besoin d&apos;aide
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
