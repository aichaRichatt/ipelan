import { Tabs } from "expo-router";
import { AntDesign, Feather } from "@expo/vector-icons";
import React from "react";

export default function TabsLayout() {
  return (
    <Tabs  screenOptions={{ tabBarActiveTintColor: '#FF6B00', tabBarStyle: { paddingBottom: 8, paddingTop: 8, height: 65 ,margin:15,borderRadius:20,position: 'absolute', bottom: 0} }}>
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