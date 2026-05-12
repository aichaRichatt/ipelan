import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PREFERENCES_KEY = '@ipelan_preferences';
const LANGUAGE_KEY = '@ipelan_language';

const LANGUAGES = [
  { id: 'pulaar', label: 'Pulaar', emoji: '🇸🇳' },
  { id: 'soninke', label: 'Soninké', emoji: '🌍' },
  { id: 'wolof', label: 'Wolof', emoji: '🌟' },
];

const GRADES = [1, 2, 3, 4, 5, 6];

const styles = StyleSheet.create({
  flex1_bgFAF9F6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  flex1: {
    flex: 1
  },
  px5_py4_flexrow_itemscenter_bg: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  textlg_fontmedium_trackingwide: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '500',
    textTransform: 'uppercase'
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
    padding: 24
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 16
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700'
  },
  sectionHint: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 16
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  langCard: {
    alignItems: 'center',
    borderColor: '#E5E7EB',
    borderRadius: 16,
    borderWidth: 2,
    flex: 1,
    paddingVertical: 14
  },
  langCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5'
  },
  langEmoji: {
    fontSize: 24,
    marginBottom: 4
  },
  langLabel: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600'
  },
  langLabelSelected: {
    color: '#065F46'
  },
  gradeLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  gradeCard: {
    alignItems: 'center',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 10,
    width: '30%'
  },
  gradeCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5'
  },
  gradeText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600'
  },
  gradeTextSelected: {
    color: '#065F46'
  },
  saveBtn: {
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 13
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700'
  },
  divider: {
    backgroundColor: '#E5E7EB',
    marginBottom: 16
  },
  settingOption: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  settingOptionText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700'
  },
  mr2: { marginRight: 8 },
  mr3: { marginRight: 12 },
});

export default function SettingsScreen() {
  const router = useRouter();

  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const saveColorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
        const prefs = raw ? JSON.parse(raw) : {};
        if (prefs.language) setSelectedLang(prefs.language);
        if (prefs.grade) setSelectedGrade(prefs.grade);
      } catch {}
    };
    loadPrefs();
  }, []);

  const handleSaveLearning = async () => {
    if (!selectedLang || !selectedGrade) {
      Alert.alert('Sélection incomplète', 'Veuillez choisir une langue et une année.');
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
      const existing = raw ? JSON.parse(raw) : {};
      const updated = { ...existing, language: selectedLang, grade: selectedGrade };
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      await AsyncStorage.setItem(LANGUAGE_KEY, selectedLang);

      setSaved(true);
      Animated.sequence([
        Animated.timing(saveColorAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.delay(2000),
        Animated.timing(saveColorAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]).start(() => setSaved(false));
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder les préférences.');
    }
  };

  const saveBgColor = saveColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#111827', '#10B981'],
  });

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>

      {/* Header */}
      <View style={styles.px5_py4_flexrow_itemscenter_bg}>
        <Pressable style={{ marginRight: 6 }} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text style={styles.textlg_fontmedium_trackingwide}>PARAMÈTRES</Text>
      </View>

      <ScrollView
        style={styles.flex1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 10 }}
      >

        {/* Apprentissage Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="book-open" size={20} color="black" style={styles.mr2} />
            <Text style={styles.sectionTitle}>Apprentissage</Text>
          </View>

          <Text style={styles.sectionHint}>
            Choisissez votre langue et votre année pour afficher les cours correspondants.
          </Text>

          {/* Language selection */}
          <Text style={styles.gradeLabel}>Langue</Text>
          <View style={styles.langRow}>
            {LANGUAGES.map(lang => {
              const isSelected = selectedLang === lang.id;
              return (
                <Pressable
                  key={lang.id}
                  style={[styles.langCard, isSelected && styles.langCardSelected]}
                  onPress={() => setSelectedLang(lang.id)}
                >
                  <Text style={styles.langEmoji}>{lang.emoji}</Text>
                  <Text style={[styles.langLabel, isSelected && styles.langLabelSelected]}>
                    {lang.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Grade selection */}
          <Text style={styles.gradeLabel}>Année</Text>
          <View style={styles.gradeGrid}>
            {GRADES.map(g => {
              const isSelected = selectedGrade === g;
              return (
                <Pressable
                  key={g}
                  style={[styles.gradeCard, isSelected && styles.gradeCardSelected]}
                  onPress={() => setSelectedGrade(g)}
                >
                  <Text style={[styles.gradeText, isSelected && styles.gradeTextSelected]}>
                    {g === 1 ? '1ère' : `${g}ème`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Save button */}
          <Animated.View style={[styles.saveBtn, { backgroundColor: saveBgColor }]}>
            <Pressable
              style={{ width: '100%', alignItems: 'center', paddingVertical: 13 }}
              onPress={handleSaveLearning}
            >
              <Text style={[styles.saveBtnText, { color: '#FFFFFF' }]}>
                {saved ? '✓ Sauvegardé' : 'Enregistrer'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Account Menu List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="user" size={20} color="black" style={styles.mr2} />
            <Text style={styles.sectionTitle}>Compte</Text>
          </View>

          <SettingOption
            title="Modifier Le Profil"
            onPress={() => router.push("/(settings)/edit-profile")}
          />
          <View style={styles.divider} />

          <SettingOption
            title="Changer Le Mot De Passe"
            onPress={() => router.push("/(auth)/resetpassword" as any)}
          />
          <View style={styles.divider} />

          <SettingOption
            title="Politique De Confidentialité"
            onPress={() => Alert.alert(
              "Politique de confidentialité",
              "Vos données personnelles sont utilisées uniquement pour le fonctionnement de l'application IPELAN et ne sont jamais partagées avec des tiers.",
              [{ text: "Fermer" }]
            )}
          />
          <View style={styles.divider} />

          <SettingOption
            title="À Propos D'IPELAN"
            onPress={() => router.push("/(settings)/about" as any)}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function SettingOption({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.settingOption}>
      <Text style={styles.settingOptionText}>{title}</Text>
      <Feather name="arrow-right" size={20} color="black" />
    </Pressable>
  );
}
