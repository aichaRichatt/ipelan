import { Stack } from "expo-router";
import React from "react";

export default function _layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          headerTitle: "Login",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
