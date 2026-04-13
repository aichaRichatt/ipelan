import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function AboutScreen() {
  const router = useRouter();

  const appVersion = "1.0.0";
  
  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">À propos d&apos;IPELAN</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        
        <View className="items-center py-8 mb-4">
          <View className="w-24 h-24 rounded-3xl bg-[#002366] items-center justify-center mb-4">
            <Text className="text-white text-3xl font-black">IP</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900 mb-1">IPELAN</Text>
          <Text className="text-gray-500 mb-2">م.ت.ن.ل.و</Text>
          <View className="bg-gray-100 px-3 py-1 rounded-full">
            <Text className="text-sm text-gray-600">Version {appVersion}</Text>
          </View>
        </View>

        <View className="bg-white rounded-3xl p-6 mb-4 border border-gray-200">
          <Text className="text-lg font-bold text-gray-900 mb-3">Qu&apos;est-ce qu&apos;IPELAN ?</Text>
          <Text className="text-gray-600 leading-relaxed mb-4">
            IPELAN est une application éducative mobile conçue pour enseigner les langues nationales de Mauritanie : le Pulaar, le Soninké et le Wolof.
          </Text>
          <Text className="text-gray-600 leading-relaxed mb-4">
            Destinée aux élèves du cycle fondamental, l&apos;application propose des activités interactives, des quiz et des exercices adaptés aux enfants.
          </Text>
          <Text className="text-gray-600 leading-relaxed">
            L&apos;application fonctionne hors-ligne, permettant aux élèves d&apos;apprendre même sans connexion internet.
          </Text>
        </View>

        {/* Features */}
        <View className="bg-white rounded-3xl p-6 mb-4 border border-gray-200">
          <Text className="text-lg font-bold text-gray-900 mb-4">Fonctionnalités</Text>
          
          <FeatureItem 
            icon="book-open"
            title="Leçons interactives"
            description="Apprenez le vocabulaire et la grammaire à travers des activités ludiques"
          />
          <FeatureItem 
            icon="headphones"
            title="Compréhension orale"
            description="Écoutez des locuteurs natifs et améliorez votre prononciation"
          />
          <FeatureItem 
            icon="edit-2"
            title="Quiz et exercices"
            description="Testez vos connaissances avec des quiz et des exercices variés"
          />
          <FeatureItem 
            icon="wifi-off"
            title="Mode hors-ligne"
            description="Accédez à tous les contenus sans connexion internet"
          />
        </View>

        {/* Languages */}
        <View className="bg-white rounded-3xl p-6 mb-4 border border-gray-200">
          <Text className="text-lg font-bold text-gray-900 mb-4">Langues disponibles</Text>
          
          <View className="flex-row flex-wrap">
            <LanguageTag label="Pulaar" color="#FF9500" />
            <LanguageTag label="Soninké" color="#4CD964" />
            <LanguageTag label="Wolof" color="#007AFF" />
          </View>
        </View>

        {/* Credits */}
        <View className="bg-white rounded-3xl p-6 mb-4 border border-gray-200">
          <Text className="text-lg font-bold text-gray-900 mb-3">Crédits</Text>
          <Text className="text-gray-600 text-sm leading-relaxed">
            Application développée pour l&apos;éducation en Mauritanie.
          </Text>
          <Text className="text-gray-600 text-sm leading-relaxed mt-2">
            © 2026 IPELAN. Tous droits réservés.
          </Text>
        </View>

        {/* Contact */}
        <View className="bg-white rounded-3xl p-6 mb-4 border border-gray-200">
          <Text className="text-lg font-bold text-gray-900 mb-3">Contact</Text>
          <Pressable 
            onPress={() => handleOpenLink("mailto:contact@ipelan.com")}
            className="flex-row items-center py-2"
          >
            <Feather name="mail" size={18} color="#4a90e2" />
            <Text className="text-[#4a90e2] ml-3">contact@ipelan.com</Text>
          </Pressable>
        </View>

        {/* Legal */}
        <View className="mb-8">
          <Pressable className="py-3">
            <Text className="text-gray-600">Conditions d&apos;utilisation</Text>
          </Pressable>
          <Pressable className="py-3">
            <Text className="text-gray-600">Politique de confidentialité</Text>
          </Pressable>
          <Pressable className="py-3">
            <Text className="text-gray-600">Licences open source</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <View className="flex-row items-start mb-4">
      <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
        <Feather name={icon as any} size={18} color="#4a90e2" />
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-gray-900 mb-1">{title}</Text>
        <Text className="text-sm text-gray-500">{description}</Text>
      </View>
    </View>
  );
}

function LanguageTag({ label, color }: { label: string; color: string }) {
  return (
    <View 
      className="px-4 py-2 rounded-full mr-2 mb-2"
      style={{ backgroundColor: `${color}20` }}
    >
      <Text className="font-medium text-sm" style={{ color }}>{label}</Text>
    </View>
  );
}
