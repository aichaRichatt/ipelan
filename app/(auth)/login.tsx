import { View, Text, Button } from "react-native";
import React from "react";
import { useRouter } from "expo-router";

export default function Login() {
  const router = useRouter();
  return (
    <View className="bg-red-600  text-center  justify-center items-center text-white flex-1">
      <Text className="text-white">login screen hello world from my test </Text>
      <Button
        onPress={() => router.push("/(auth)/splash")}
        title="Splash screen"
      />
    </View>
  );
}
