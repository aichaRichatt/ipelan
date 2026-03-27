
import { Tabs } from "expo-router";
import { AntDesign } from "@expo/vector-icons";
import React from "react";

export default function TabsLayout() {
  return (
    <Tabs>
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