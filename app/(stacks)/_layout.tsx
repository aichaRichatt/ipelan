import { Stack } from "expo-router";
import React from "react";

export default function StacksLayout() {
  return <Stack screenOptions={{ headerShown: false }} >
    <Stack.Screen name="(cours)" options={{ headerShown: false }} />
  </Stack>;
}
