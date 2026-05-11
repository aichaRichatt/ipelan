import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useDispatch } from "react-redux";
import { loginSuccess } from "../services/redux/slices/authSlice";
import { getToken, getUserData, hasValidToken } from "../services/storage/tokenStorage";

export default function Index() {
  const dispatch = useDispatch();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const safetyTimer = setTimeout(() => {
      if (!cancelled) setDestination("/(auth)/login");
    }, 3000);

    const init = async () => {
      try {
        if (await hasValidToken()) {
          const [token, userData] = await Promise.all([getToken(), getUserData()]);
          if (!cancelled && token && userData) {
            dispatch(loginSuccess({ user: userData, token }));
            setDestination("/(tabs)/(home)");
            clearTimeout(safetyTimer);
            return;
          }
        }
      } catch {}
      if (!cancelled) {
        setDestination("/(auth)/login");
        clearTimeout(safetyTimer);
      }
    };
    init();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [dispatch]);

  if (destination) {
    return <Redirect href={destination as any} />;
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" }}>
      <ActivityIndicator size="large" color="#002366" />
    </View>
  );
}
