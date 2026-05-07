import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PREFERENCES_KEY = '@ipelan_preferences';

const styles = StyleSheet.create({
  bgwhite_rounded24px_p5_flexrow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20
  },
  bgwhite_rounded24px_p5_mb4_fle: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 20
  },
  bgwhite_rounded3xl_p6_border_b: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
    padding: 24
  },
  flex1: {
    flex: 1
  },
  flex1_bgFAF9F6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  flexrow_itemscenter: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  flexrow_itemscenter_justifybet: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  flexrow_itemscenter_mb6: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 24
  },
  fontbold_textgray900_text15px: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700'
  },
  h1px_bggray200_mb4: {
    backgroundColor: '#E5E7EB',
    marginBottom: 16
  },
  mb6: {
    marginBottom: 24
  },
  mr2: {
    marginRight: 8
  },
  mr3: {
    marginRight: 12
  },
  px5_py4_flexrow_itemscenter_bg: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  style_1: {
    backgroundColor: '#E5E7EB',
    marginBottom: 16
  },
  style_2: {
    backgroundColor: '#E5E7EB',
    marginBottom: 16
  },
  style_3: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700'
  },
  style_4: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700'
  },
  style_5: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700'
  },
  style_6: {
    marginRight: 12
  },
  style_7: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  textlg_fontmedium_trackingwide: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '500',
    textTransform: 'uppercase'
  },
});

export default function SettingsScreen() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundsEnabled, setSoundsEnabled] = useState(true);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
        if (raw) {
          const prefs = JSON.parse(raw);
          if (typeof prefs.notifications === 'boolean') setNotificationsEnabled(prefs.notifications);
          if (typeof prefs.sounds === 'boolean') setSoundsEnabled(prefs.sounds);
        }
      } catch {}
    };
    loadPrefs();
  }, []);

  const savePrefs = async (key: string, value: boolean) => {
    try {
      const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
      const existing = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...existing, [key]: value }));
    } catch {}
  };

  const handleNotificationToggle = (value: boolean) => {
    setNotificationsEnabled(value);
    savePrefs('notifications', value);
  };

  const handleSoundToggle = (value: boolean) => {
    setSoundsEnabled(value);
    savePrefs('sounds', value);
  };

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>

      {/* Header */}
      <View style={styles.px5_py4_flexrow_itemscenter_bg}>
        <Pressable style={{marginRight:6}} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text style={styles.textlg_fontmedium_trackingwide}>PARAMÈTRES</Text>
      </View>

      <ScrollView style={styles.flex1} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 10 }}>

        {/* Toggles Container */}
        <View style={styles.mb6}>
          {/* Notification Toggle */}
          <View style={styles.bgwhite_rounded24px_p5_mb4_fle}>
            <View style={styles.style_7}>
              <Feather name="bell" size={20} color="#F59E0B" style={styles.style_6} />
              <Text style={styles.style_5}>Notification</Text>
            </View>
            <Switch
              trackColor={{ false: "#D1D5DB", true: "#F59E0B" }}
              thumbColor={"#FFFFFF"}
              ios_backgroundColor="#D1D5DB"
              onValueChange={handleNotificationToggle}
              value={notificationsEnabled}
              style={{ transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] }}
            />
          </View>

          {/* Sound Toggle */}
          <View style={styles.bgwhite_rounded24px_p5_flexrow}>
            <View style={styles.flexrow_itemscenter}>
              <Feather name="volume-2" size={20} color="#60A5FA" style={styles.mr3} />
              <Text style={styles.style_4}>Les Sons</Text>
            </View>
            <Switch
              trackColor={{ false: "#D1D5DB", true: "#F59E0B" }}
              thumbColor={"#FFFFFF"}
              ios_backgroundColor="#D1D5DB"
              onValueChange={handleSoundToggle}
              value={soundsEnabled}
              style={{ transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] }}
            />
          </View>
        </View>

        {/* Account Menu List */}
        <View style={styles.bgwhite_rounded3xl_p6_border_b}>
          <View style={styles.flexrow_itemscenter_mb6}>
            <Feather name="user" size={20} color="black" style={styles.mr2} />
            <Text style={styles.style_3}>Compte</Text>
          </View>

          <SettingOption
            title="Modifier Le Profil"
            onPress={() => router.push("/(settings)/edit-profile")}
          />
          <View style={styles.style_2} />

          <SettingOption
            title="Changer Le Mot De Passe"
            onPress={() => router.push("/(auth)/resetpassword" as any)}
          />
          <View style={styles.style_1} />

          <SettingOption
            title="Politique De Confidentialité"
            onPress={() => Alert.alert(
              "Politique de confidentialité",
              "Vos données personnelles sont utilisées uniquement pour le fonctionnement de l'application IPELAN et ne sont jamais partagées avec des tiers.",
              [{ text: "Fermer" }]
            )}
          />
          <View style={styles.h1px_bggray200_mb4} />

          <SettingOption
            title="À Propos D'IPELAN"
            onPress={() => router.push("/(settings)/about" as any)}
          />

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function SettingOption({ title, onPress }: { title: string, onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.flexrow_itemscenter_justifybet}>
      <Text style={styles.fontbold_textgray900_text15px}>{title}</Text>
      <Feather name="arrow-right" size={20} color="black" />
    </Pressable>
  );
}
