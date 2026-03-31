import { Stack } from "expo-router";
import React from "react";

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false ,contentStyle: { backgroundColor: 'transparent' }}}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}