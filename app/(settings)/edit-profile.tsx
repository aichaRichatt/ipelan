import { AntDesign, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EditProfileScreen() {
  const router = useRouter();
  
  // Local state for inputs
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [numero, setNumero] = useState("");

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      
      {/* Header */}
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable className="mr-6" onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text className="text-lg font-medium tracking-wider uppercase text-gray-900">MODIFIER LE PROFIL</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 10 }}>
        
        {/* Avatar Card */}
        <View className="bg-white rounded-[24px] p-6 mb-8 items-center border border-gray-200 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 }}>
          <View className="relative mb-4">
            <View className="w-20 h-20 rounded-full border-2 border-gray-400 items-center justify-center">
              <AntDesign name="user" size={40} color="gray" />
            </View>
            <View className="absolute bottom-0 right-0 bg-white border border-gray-300 rounded-full p-1 shadow-sm">
              <Feather name="edit-2" size={14} color="black" />
            </View>
          </View>
          <Text className="text-sm font-bold text-gray-900 mb-1">Amadou</Text>
          <Text className="text-xs text-gray-600 font-medium">amadou.dialo@exemple.com</Text>
        </View>

        {/* Input Fields */}
        <View className="space-y-4">
          
          <View className="bg-white rounded-[20px] px-5 py-4 border border-gray-200 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }}>
            <TextInput
              placeholder="Nom"
              placeholderTextColor="#6B7280"
              value={nom}
              onChangeText={setNom}
              className="text-gray-900 font-medium text-[15px] w-full"
            />
          </View>

          <View className="bg-white rounded-[20px] px-5 py-4 border border-gray-200 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }}>
            <TextInput
              placeholder="Prenom"
              placeholderTextColor="#6B7280"
              value={prenom}
              onChangeText={setPrenom}
              className="text-gray-900 font-medium text-[15px] w-full"
            />
          </View>

          <View className="bg-white rounded-[20px] px-5 py-4 border border-gray-200 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }}>
            <TextInput
              placeholder="email"
              placeholderTextColor="#6B7280"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              className="text-gray-900 font-medium text-[15px] w-full"
            />
          </View>

          <View className="bg-white rounded-[20px] px-5 py-4 border border-gray-200 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }}>
            <TextInput
              placeholder="Numero"
              placeholderTextColor="#6B7280"
              value={numero}
              onChangeText={setNumero}
              keyboardType="phone-pad"
              className="text-gray-900 font-medium text-[15px] w-full"
            />
          </View>

        </View>

        {/* Save Button */}
        <View className="mt-6 mb-8">
          <Pressable
            onPress={() => {
              Alert.alert("Succès", "Profil mis à jour avec succès");
              router.back();
            }}
            className="bg-[#002366] rounded-2xl py-4 items-center shadow-lg"
            style={{
              shadowColor: "#002366",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text className="text-white font-bold text-lg">Sauvegarder</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
