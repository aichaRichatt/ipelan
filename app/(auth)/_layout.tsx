import { Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="login"
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="language-selection"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}