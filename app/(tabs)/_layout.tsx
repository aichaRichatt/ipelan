import { Tabs, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { AntDesign, Feather } from "@expo/vector-icons";
import { useLogin } from "../../hooks/useLogin";

export default function TabsLayout() {
  const { token, user } = useLogin();
  const router = useRouter();
  
  useEffect(() => {
    if (!token) {
      router.push('/(auth)/login');
    }
  }, [token, router]);
  
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#FF6B00', 
      tabBarStyle: { 
        paddingBottom: 8, 
        paddingTop: 8, 
        height: 65, 
        margin: 15, 
        borderRadius: 20, 
        position: 'absolute', 
        bottom: 0,
        backgroundColor: 'white',
        borderTopWidth: 0,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      tabBarShowLabel: true,
      tabBarHideOnKeyboard: true,
      headerShown: false,
    }}>
      <Tabs.Screen 
        name="(home)" 
        options={{ 
          headerShown: false, 
          tabBarLabel: "Accueil",
          title: "Accueil",
          tabBarIcon: ({ color }) => <AntDesign name="home" size={24} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="(cours)" 
        options={{ 
          headerShown: false, 
          tabBarLabel: "Cours",
          title: "Cours",
          tabBarIcon: ({ color }) => <Feather name="book-open" size={24} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="(progress)" 
        options={{ 
          headerShown: false, 
          tabBarLabel: "Progrès",
          title: "Progrès",
          tabBarIcon: ({ color }) => <AntDesign name="bar-chart" size={24} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="(profile)" 
        options={{ 
          headerShown: false, 
          tabBarLabel: "Profil",
          title: "Profil",
          tabBarIcon: ({ color }) => <AntDesign name="user" size={24} color={color} />
        }} 
      />
    </Tabs>
  );
}
