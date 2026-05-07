import { FontAwesome5 } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Provider, useSelector } from "react-redux";
import { useAuthRestore } from "../hooks/useAuthRestore";
import { registerBackgroundSync } from "../services/api/backgroundSync";
import { RootState, store } from "../services/redux/store";
import { createTables, getDBConnection } from "../services/storage/db-service";
import { registerQueueProcessor, unregisterQueueProcessor } from "../services/sync/queueProcessor";
import { syncQueue } from "../services/sync/syncQueue";

// Prevent native splash from auto-hiding before fonts are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

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
       registerQueueProcessor();
       syncQueue.restorePersistedJobs(token).catch((err) => {
        console.warn('[SyncQueue] Restore failed:', err);
      });

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
  const [fontsReady, setFontsReady] = useState(false);

  // Résolution normale : fonts chargées ou erreur
  useEffect(() => {
    if (loaded || error) {
      setFontsReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  // Safety timeout : si useFonts hang (device low-RAM, asset manquant en release),
  // on débloque quand même après 3 secondes max — sinon splash reste indéfiniment
  useEffect(() => {
    const timer = setTimeout(() => {
      setFontsReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!fontsReady) {
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
