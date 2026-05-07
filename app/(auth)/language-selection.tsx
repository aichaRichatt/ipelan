import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const LANGUAGE_STORAGE_KEY = '@ipelan_language';

const styles = StyleSheet.create({
  bgf0f7ff_p4_rounded2xl_mb4: {
    borderRadius: 16,
    marginBottom: 16,
    padding: 16
  },
  flex1: {
    flex: 1
  },
  flex1_bgwhite: {
    backgroundColor: '#FFFFFF',
    flex: 1
  },
  flex1_px6_py10_justifycenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  flexrow_itemscenter_p6_rounded: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    flexDirection: 'row',
    marginBottom: 16,
    padding: 24
  },
  fontbold_textxl: {
    fontSize: 20,
    fontWeight: '700'
  },
  itemscenter_mb12: {
    alignItems: 'center'
  },
  p4_rounded2xl_mr6: {
    borderRadius: 16,
    padding: 16
  },
  text3xl_fontbold_text002366_te: {
    color: '#002366',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center'
  },
  textgray400_textsm: {
    color: '#9CA3AF',
    fontSize: 14
  },
  textlg_textgray400_mt2_textcen: {
    color: '#9CA3AF',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center'
  },
});

export default function LanguageSelection() {
  const router = useRouter();

  const handleLanguageSelect = async (lang: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      console.log("Langue sauvegardée:", lang);
    } catch (e) {
      console.warn("Erreur sauvegarde langue:", e);
    }
    router.replace("/(auth)/grade-selection");
  };

  return (
    <SafeAreaView style={styles.flex1_bgwhite}>
      <View style={styles.flex1_px6_py10_justifycenter}>
        
        <Animated.View 
          entering={FadeInUp.duration(800)}
          style={styles.itemscenter_mb12}
        >
          <View style={styles.bgf0f7ff_p4_rounded2xl_mb4}>
            <FontAwesome5 name="globe" size={40} color="#002366" solid />
          </View>
          <Text style={styles.text3xl_fontbold_text002366_te}>
            Choisissez votre langue
          </Text>
          <Text style={styles.textlg_textgray400_mt2_textcen}>
            Sélectionnez la langue pour continuer
          </Text>
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(200).duration(800)}
          style={{ gap: 16 } }
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
      style={styles.flexrow_itemscenter_p6_rounded}
    
    >
      <View style={[{ backgroundColor: `${color}15`+styles.p4_rounded2xl_mr6 }]}  >
        <FontAwesome5 name={icon} size={28} color={color} solid />
      </View>
      <View style={styles.flex1}>
        <Text style={[styles.fontbold_textxl, {color: "#002366"}] } >{label}</Text>
        <Text style={styles.textgray400_textsm}>Apprendre en {label}</Text>
      </View>
      <FontAwesome5 name="chevron-right" size={16} color="#cbd5e1" solid />
    </Pressable>
  );
}
