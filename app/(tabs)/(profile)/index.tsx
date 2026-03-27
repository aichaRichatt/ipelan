import { View, Text, Pressable, ScrollView, Image, Alert } from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLogin } from "../../../hooks/useLogin";
import { AntDesign, Feather } from "@expo/vector-icons";

export default function ProfileScreen() {
  const { user, logoutUser } = useLogin();

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

  if (!user) return null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Header - Profile Info */}
        <View className="items-center mt-8 mb-6">
          <View className="w-24 h-24 bg-blue-100 rounded-full items-center justify-center mb-4 border-4 border-white shadow-sm">
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} className="w-full h-full rounded-full" />
            ) : (
              <Text className="text-blue-600 text-3xl font-bold">
                {user.firstname?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase()}
              </Text>
            )}
          </View>
          <Text className="text-2xl font-bold text-gray-800">{user.firstname || user.username}</Text>
          <Text className="text-gray-500 mt-1">{user.email}</Text>
        </View>

        {/* Stats row */}
        <View className="flex-row justify-between bg-white p-4 rounded-2xl shadow-sm mb-6 border border-gray-100">
          <View className="items-center flex-1 border-r border-gray-100">
            <View className="bg-yellow-100 p-2 rounded-full mb-2">
              <Text className="text-lg">🪙</Text>
            </View>
            <Text className="text-gray-500 text-xs">Pièces</Text>
            <Text className="font-bold text-lg text-gray-800">{user.coins || 0}</Text>
          </View>
          
          <View className="items-center flex-1 border-r border-gray-100">
            <View className="bg-orange-100 p-2 rounded-full mb-2">
              <Text className="text-lg">🔥</Text>
            </View>
            <Text className="text-gray-500 text-xs">Série</Text>
            <Text className="font-bold text-lg text-gray-800">{user.streak || 0} jrs</Text>
          </View>

          <View className="items-center flex-1">
            <View className="bg-blue-100 p-2 rounded-full mb-2">
              <Text className="text-lg">⭐</Text>
            </View>
            <Text className="text-gray-500 text-xs">XP</Text>
            <Text className="font-bold text-lg text-gray-800">{user.ipelan_xp || 0}</Text>
          </View>
        </View>

        {/* Menu Options */}
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <MenuOption icon="user" title="Modifier le profil" color="#3b82f6" />
          <View className="h-[1px] bg-gray-100 ml-12" />
          <MenuOption icon="settings" title="Paramètres" color="#64748b" />
          <View className="h-[1px] bg-gray-100 ml-12" />
          <MenuOption icon="help-circle" title="Aide et support" color="#10b981" />
        </View>

        {/* Logout Button */}
        <Pressable 
          onPress={handleLogout}
          className="flex-row items-center justify-center bg-red-50 p-4 rounded-2xl border border-red-100 mb-8"
        >
          <Feather name="log-out" size={20} color="#ef4444" />
          <Text className="text-red-500 font-bold ml-2 text-lg">Se déconnecter</Text>
        </Pressable>
        
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuOption({ icon, title, color }: { icon: any, title: string, color: string }) {
  return (
    <Pressable className="flex-row items-center p-4 active:bg-gray-50">
      <View style={{ backgroundColor: `${color}15` }} className="p-2 rounded-xl mr-3">
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text className="flex-1 text-gray-800 font-medium text-base">{title}</Text>
      <Feather name="chevron-right" size={20} color="#cbd5e1" />
    </Pressable>
  );
}
