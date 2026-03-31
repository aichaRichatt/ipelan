import { Stack } from "expo-router";
import React from "react";

export default function SettingsLayout() {
  return <Stack options={{ headerShown: false }} >
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="about" options={{ headerShown: false }} />
    <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
  </Stack>;
}