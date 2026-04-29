import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { Provider, useSelector } from "react-redux";
import { store, RootState } from "../services/redux/store";
import "../global.css";

import { useFonts } from "expo-font";
import { FontAwesome5 } from "@expo/vector-icons";
import { useAuthRestore } from "../hooks/useAuthRestore";
import { getDBConnection, createTables } from "../services/storage/db-service";
import { registerBackgroundSync } from "../services/api/backgroundSync";
import { registerQueueProcessor, unregisterQueueProcessor } from "../services/sync/queueProcessor";

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

function BackgroundSyncInitializer() {
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  
  useEffect(() => {
    if (user?.id && token) {
      registerBackgroundSync().catch((err) => {
        console.warn('[BackgroundSync] Registration failed:', err);
      });
      // ✅ Register the offline queue processor
      registerQueueProcessor();
      
      return () => {
        unregisterQueueProcessor();
      };
    }
  }, [user?.id, token]);
  
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
      <BackgroundSyncInitializer />
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
