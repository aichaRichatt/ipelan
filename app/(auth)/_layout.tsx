import { Stack } from "expo-router";
import React from "react";


export default function AuthLayout() {
  
  return (
    <Stack>
      <Stack.Screen 
        name="onboarding"
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="language-selection"
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="grade-selection"
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="login"
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="signup"
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="resetpassword"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}