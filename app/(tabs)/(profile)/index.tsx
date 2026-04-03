import { View, Text, Pressable, ScrollView, Alert, SafeAreaView as RNSafeAreaView } from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLogin } from "../../../hooks/useLogin";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const { user, logoutUser, token } = useLogin();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Se déconnecter", 
          style: "destructive",
          onPress: () => logoutUser() 
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      
      {/* Header */}
      <View className="px-5 py-4 flex-row justify-between items-center">
        <View className="flex-row items-center">
          <Text className="text-lg font-black tracking-wider uppercase text-gray-800">MON PROFIL</Text>
        </View>
        <View className="flex-row items-center">
       
          <Pressable
            onPress={() => router.push("/(settings)" as any)}
          >
            <Feather name="settings" size={20} color="black" />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, alignItems: 'center' }}>
        
        {/* Profile Card */}
        <View className="bg-white w-full max-w-[300px] rounded-3xl p-6 mt-8 mb-6 items-center border border-gray-100 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 }}>
          <View className="w-20 h-20 rounded-full border-2 border-gray-400 items-center justify-center mb-4">
             <AntDesign name="user" size={40} color="gray" />
          </View>
          <Text className="text-lg font-bold text-gray-800 capitalize">{user?.firstname || user?.username || "Amadou"}</Text>
          <Text className="text-gray-500 text-xs text-center mt-1">{user?.email || "amadou.dialo@exemple.com"}</Text>
        </View>

        {/* Stats Grid */}
        <View className="w-full flex-row flex-wrap justify-between mb-8">
          
          <View className="bg-white w-[48%] rounded-2xl p-4 items-center border border-gray-100 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }}>
            <Feather name="star" size={28} color="#F59E0B" className="mb-2" />
            <Text className="font-bold text-gray-800 text-lg">{user?.ipelan_xp || 0}</Text>
            <Text className="text-xs text-gray-500 font-bold uppercase tracking-tighter">XP TOTAL</Text>
          </View>
          
          <View className="bg-white w-[48%] rounded-2xl p-4 items-center border border-gray-100 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }}>
            <Feather name="award" size={28} color="#10B981" className="mb-2" />
            <Text className="font-bold text-gray-800 text-lg">1</Text>
            <Text className="text-xs text-gray-500 font-bold uppercase tracking-tighter">NIVEAU</Text>
          </View>

          <View className="bg-white w-[48%] rounded-2xl p-4 items-center border border-gray-100 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }}>
            <Ionicons name="flame" size={28} color="#EF4444" className="mb-2" />
            <Text className="font-bold text-gray-800 text-lg">{user?.streak || 0}</Text>
            <Text className="text-xs text-gray-500 font-bold uppercase tracking-tighter">SÉRIE</Text>
          </View>
          
          <View className="bg-white w-[48%] rounded-2xl p-4 items-center border border-gray-100 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }}>
            <Ionicons name="medal" size={28} color="#8B5CF6" className="mb-2" />
            <Text className="font-bold text-gray-800 text-lg">3</Text>
            <Text className="text-xs text-gray-500 font-bold uppercase tracking-tighter">BADGES</Text>
          </View>

        </View>

        <Pressable 
          className="w-full bg-white border border-gray-200 py-4 rounded-xl items-center mb-4 flex-row justify-center"
          onPress={() => router.push("/(settings)")}
        >
          <Feather name="settings" size={18} color="#374151" className="mr-2" />
          <Text className="font-bold text-gray-700 text-[15px]">Paramètres</Text>
        </Pressable>

        <Pressable 
          onPress={handleLogout}
          className="w-full bg-[#FF1C1C]/10 border border-[#FF1C1C]/20 py-4 rounded-xl items-center"
        >
          <Text className="font-bold text-[#FF1C1C] text-[15px]">Se déconnecter</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}
