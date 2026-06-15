import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";

const IS_DEV = process.env.NODE_ENV === 'development';
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const LANGUAGE_STORAGE_KEY = '@ipelan_language';

const LANGUAGES = [
  { 
    id: 'pulaar', 
    label: 'Pulaar', 
    subtitle: 'Apprendre en Pulaar',
    icon: 'book-open',
    color: '#F59E0B',
  },
  { 
    id: 'soninke', 
    label: 'Soninké', 
    subtitle: 'Apprendre en Soninké',
    icon: 'language',
    color: '#10B981',
  },
  { 
    id: 'wolof', 
    label: 'Wolof', 
    subtitle: 'Apprendre en Wolof',
    icon: 'comments',
    color: '#3B82F6',
  },
];

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAF9F6',
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: '#002366',
    borderRadius: 24,
    height: 80,
    justifyContent: 'center',
    marginBottom: 24,
    width: 80,
  },
  title: {
    color: '#002366',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    borderColor: '#002366',
    shadowOpacity: 0.1,
    elevation: 4,
  },
  cardIconContainer: {
    alignItems: 'center',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    marginRight: 16,
    width: 56,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 8,
  },
});

export default function LanguageSelection() {
  const router = useRouter();
  const [pressedId, setPressedId] = useState<string | null>(null);

  const handleLanguageSelect = async (langId: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, langId);
      if (IS_DEV) console.log("Langue sauvegardée:", langId);
    } catch (e) {
      if (IS_DEV) console.warn("Erreur sauvegarde langue:", e);
    }
    router.replace("/(auth)/grade-selection");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        <Animated.View 
          entering={FadeInUp.duration(800)}
          style={styles.header}
        >
          <View style={styles.iconContainer}>
            <FontAwesome5 name="globe" size={40} color="#FFFFFF" solid />
          </View>
          <Text style={styles.title}>
            Choisissez votre langue
          </Text>
          <Text style={styles.subtitle}>
            Sélectionnez la langue pour continuer
          </Text>
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(200).duration(800)}
          style={styles.cardsContainer}
        >
          {LANGUAGES.map((lang) => (
            <Pressable 
              key={lang.id}
              onPress={() => handleLanguageSelect(lang.id)}
              onPressIn={() => setPressedId(lang.id)}
              onPressOut={() => setPressedId(null)}
              style={[
                styles.card,
                pressedId === lang.id && styles.cardPressed
              ]}
            >
              <View style={[styles.cardIconContainer, { backgroundColor: `${lang.color}15` }]}>
                <FontAwesome5 name={lang.icon} size={28} color={lang.color} solid />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{lang.label}</Text>
                <Text style={styles.cardSubtitle}>{lang.subtitle}</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={16} color="#CBD5E1" style={styles.chevron} solid />
            </Pressable>
          ))}
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}
