import { Stack } from "expo-router";
import React from "react";
import { Provider } from "react-redux";
import { store } from "../services/redux/store";
import "../global.css";

export default function RootLayout() {
  return (
    <Provider store={store}>
      <Stack screenOptions={{ headerShown: false }} />
    </Provider>
  );
}
