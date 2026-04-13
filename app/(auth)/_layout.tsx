import { Stack, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { useLogin } from "../../hooks/useLogin";

export default function AuthLayout() {
  const { user, token } = useLogin();
  const router = useRouter();

 

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