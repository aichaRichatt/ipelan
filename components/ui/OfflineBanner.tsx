import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

interface OfflineBannerProps {
  isOffline?: boolean;
}

export default function OfflineBanner({ isOffline = true }: OfflineBannerProps) {
  if (!isOffline) return null;

  return (
    <View className="absolute top-0 left-0 right-0 z-50 bg-[#F97316] px-4 py-2">
      <View className="flex-row items-center justify-center">
        <Feather name="wifi-off" size={16} color="white" />
        <Text className="text-white text-sm font-medium ml-2">
          Mode hors connexion — contenu local uniquement
        </Text>
      </View>
    </View>
  );
}

interface DownloadStateProps {
  state: "not_downloaded" | "downloading" | "downloaded" | "error";
  onPress?: () => void;
}

export function DownloadButton({ state, onPress }: DownloadStateProps) {
  switch (state) {
    case "not_downloaded":
      return (
        <Pressable onPress={onPress} className="flex-row items-center bg-[#4a90e2] px-3 py-2 rounded-full">
          <Feather name="download-cloud" size={16} color="white" />
          <Text className="text-white text-xs font-medium ml-2">Télécharger</Text>
        </Pressable>
      );
    case "downloading":
      return (
        <View className="flex-row items-center bg-blue-100 px-3 py-2 rounded-full">
          <View className="w-4 h-4 border-2 border-[#4a90e2] border-t-transparent rounded-full animate-spin" />
          <Text className="text-[#4a90e2] text-xs font-medium ml-2">45%</Text>
        </View>
      );
    case "downloaded":
      return (
        <View className="flex-row items-center bg-green-100 px-3 py-2 rounded-full">
          <Feather name="check-circle" size={16} color="#10B981" />
          <Text className="text-green-700 text-xs font-medium ml-2">Hors ligne</Text>
        </View>
      );
    case "error":
      return (
        <Pressable onPress={onPress} className="flex-row items-center bg-red-100 px-3 py-2 rounded-full">
          <Feather name="refresh-cw" size={16} color="#EF4444" />
          <Text className="text-red-600 text-xs font-medium ml-2">Réessayer</Text>
        </Pressable>
      );
  }
}

interface OfflineLockProps {
  onDownload?: () => void;
}

export function OfflineLock({ onDownload }: OfflineLockProps) {
  return (
    <View className="absolute inset-0 bg-gray-900/50 items-center justify-center px-8">
      <View className="bg-white rounded-3xl p-6 items-center max-w-xs">
        <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
          <Feather name="lock" size={32} color="#6B7280" />
        </View>
        <Text className="text-gray-900 font-bold text-lg text-center mb-2">
          Contenu non disponible
        </Text>
        <Text className="text-gray-500 text-sm text-center mb-4">
          Télécharge ce module pour y accéder hors ligne
        </Text>
        <Pressable
          onPress={onDownload}
          className="bg-[#002366] px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold">Télécharger</Text>
        </Pressable>
      </View>
    </View>
  );
}
