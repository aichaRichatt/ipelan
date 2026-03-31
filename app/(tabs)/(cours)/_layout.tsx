
import { Stack } from "expo-router";
import React from "react";

export default function CoursLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Cours" ,headerShown: false}} />
      <Stack.Screen name="[id]" options={{ title: "id",headerShown: false }} />
      <Stack.Screen name="learning-path" options={{ title: "learning-path", headerShown: false }} />
      <Stack.Screen name="lesson/[id]" options={{ title: "lesson", headerShown: false }} />
      <Stack.Screen name="listening" options={{ title: "listening", headerShown: false }} />
      <Stack.Screen name="dictation" options={{ title: "dictation", headerShown: false }} />
      <Stack.Screen name="association" options={{ title: "association", headerShown: false }} />
      <Stack.Screen name="game" options={{ title: "game", headerShown: false }} />
      <Stack.Screen name="result" options={{ title: "result", headerShown: false }} />
    </Stack>
    
  );
}