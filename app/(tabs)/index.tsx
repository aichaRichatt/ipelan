 import { getUserData } from "../../services/storage/tokenStorage";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {  Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const user = getUserData();
  return (
    <SafeAreaView>
      <View className="flex justify-between align-middle items-center">
        <Text>Bienvenue {user}</Text>
        <view>
          <Text>1000 🪙</Text>
          <Ionicons  icon/>
        </view>
      </View>
    </SafeAreaView>
  );
}
