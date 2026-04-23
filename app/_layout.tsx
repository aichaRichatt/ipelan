import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "../services/redux/store";
import "../global.css";

import { useFonts } from "expo-font";
import { FontAwesome5 } from "@expo/vector-icons";
import { useAuthRestore } from "../hooks/useAuthRestore";
import { getDBConnection, createTables } from "../services/storage/db-service";

function AuthRestoreWrapper() {
  useAuthRestore();
  return null;
}

function DatabaseInitializer() {
  useEffect(() => {
    const initDB = async () => {
      try {
        const db = await getDBConnection();
        await createTables(db);
      } catch (err) {
        console.warn("Failed to initialize database:", err);
      }
    };
    initDB();
  }, []);
  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome5.font,
  });

  if (!loaded && !error) {
    return null;
  }

  return (
    <Provider store={store}>
      <DatabaseInitializer />
      <AuthRestoreWrapper />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(stacks)" options={{ headerShown: false }} />
        <Stack.Screen name="quiz" options={{ headerShown: false }} />
        <Stack.Screen name="(settings)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </Provider>
  );
}
