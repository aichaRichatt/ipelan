import { Stack, useRouter } from "expo-router";
import React, { useEffect } from "react";

export default function AuthLayout() {
  const isAuth = true;
  const  router=useRouter()
  useEffect(() => {
    if (!isAuth) {
      router.push("/(auth)/login");
    }
  })
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
      <Stack.Screen 
             name="signup"
             options={{ headerShown: false }}
           />
    </Stack>
  );
}