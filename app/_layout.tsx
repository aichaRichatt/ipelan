import { Stack } from "expo-router";
import React from "react";
import { Provider } from "react-redux";
import { store } from "../services/redux/store";
import "../global.css";

import { useFonts } from "expo-font";
import { FontAwesome5 } from "@expo/vector-icons";

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome5.font,
  });

  if (!loaded && !error) {
    return null; 
  }

  return (
    <Provider store={store}>
      <Stack screenOptions={{ headerShown: false }} >
        <Stack.Screen name="(auth)"  options={{headerShown:false}}/>
        <Stack.Screen name="(tabs)"  options={{headerShown:false}}/>
      </Stack>
    </Provider>
  );
}
