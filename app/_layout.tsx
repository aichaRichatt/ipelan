import { FontAwesome5 } from "@expo/vector-icons";
import { setAudioModeAsync } from "expo-audio";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Provider, useSelector } from "react-redux";
import { useAuthRestore } from "../hooks/useAuthRestore";
import { registerBackgroundSync } from "../services/api/backgroundSync";
import { getCurrentLocale } from "../services/i18n/localeConfig";
import { RootState, store } from "../services/redux/store";
import { createTables, getDBConnection } from "../services/storage/db-service";
import { registerQueueProcessor, unregisterQueueProcessor } from "../services/sync/queueProcessor";
import { syncQueue } from "../services/sync/syncQueue";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Initialize French locale at startup
getCurrentLocale();

function AuthRestoreWrapper() {
  useAuthRestore();
  return null;
}

function AudioSessionInitializer() {
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      allowsRecording: false,
      interruptionMode: 'duckOthers',
    }).catch(() => {});
  }, []);
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
       syncQueue.restorePersistedJobs(user.id, token).catch((err) => {
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

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Provider store={store}>
      <AudioSessionInitializer />
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
