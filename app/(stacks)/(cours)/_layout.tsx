import { Stack } from "expo-router";
import React from "react";

export default function CoursLayout() {
  return <Stack screenOptions={{ headerShown: false }} >
    <Stack.Screen name="[id]" options={{ headerShown: false }} />
    <Stack.Screen name="lesson/[id]" options={{ headerShown: false }} />
    <Stack.Screen name="association" options={{ headerShown: false }} />
    <Stack.Screen name="dictation" options={{ headerShown: false }} />
    <Stack.Screen name="game" options={{ headerShown: false }} />
    <Stack.Screen name="learning-path" options={{ headerShown: false }} />
    <Stack.Screen name="listening" options={{ headerShown: false }} />
    <Stack.Screen name="result" options={{ headerShown: false }} />
  </Stack>;
}
