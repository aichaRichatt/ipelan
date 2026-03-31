import { Stack } from "expo-router";
import React from "react";

export default function QuizLayout() {
  return <Stack options={{ headerShown: false }} >
    <Stack.Screen name="index" options={{ headerShown: false }} />
  </Stack>;
}