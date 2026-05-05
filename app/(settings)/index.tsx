import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, Switch, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PREFERENCES_KEY = '@ipelan_preferences';

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
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>

      {/* Header */}
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable className="mr-6" onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text className="text-lg font-medium tracking-wider uppercase text-gray-900">PARAMÈTRES</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 10 }}>

        {/* Toggles Container */}
        <View className="mb-6">
          {/* Notification Toggle */}
          <View className="bg-white rounded-[24px] p-5 mb-4 flex-row justify-between items-center border border-gray-200">
            <View className="flex-row items-center">
              <Feather name="bell" size={20} color="#F59E0B" className="mr-3" />
              <Text className="font-bold text-gray-900 text-[15px]">Notification</Text>
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
          <View className="bg-white rounded-[24px] p-5 flex-row justify-between items-center border border-gray-200">
            <View className="flex-row items-center">
              <Feather name="volume-2" size={20} color="#60A5FA" className="mr-3" />
              <Text className="font-bold text-gray-900 text-[15px]">Les Sons</Text>
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
        <View className="bg-white rounded-3xl p-6 border border-gray-200 mb-6">
          <View className="flex-row items-center mb-6">
            <Feather name="user" size={20} color="black" className="mr-2" />
            <Text className="font-bold text-gray-900 text-[15px]">Compte</Text>
          </View>

          <SettingOption
            title="Modifier Le Profil"
            onPress={() => router.push("/(settings)/edit-profile")}
          />
          <View className="h-[1px] bg-gray-200 mb-4" />

          <SettingOption
            title="Changer Le Mot De Passe"
            onPress={() => router.push("/(auth)/resetpassword" as any)}
          />
          <View className="h-[1px] bg-gray-200 mb-4" />

          <SettingOption
            title="Politique De Confidentialité"
            onPress={() => Alert.alert(
              "Politique de confidentialité",
              "Vos données personnelles sont utilisées uniquement pour le fonctionnement de l'application IPELAN et ne sont jamais partagées avec des tiers.",
              [{ text: "Fermer" }]
            )}
          />
          <View className="h-[1px] bg-gray-200 mb-4" />

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
    <Pressable onPress={onPress} className="flex-row items-center justify-between mb-4">
      <Text className="font-bold text-gray-900 text-[15px]">{title}</Text>
      <Feather name="arrow-right" size={20} color="black" />
    </Pressable>
  );
}
