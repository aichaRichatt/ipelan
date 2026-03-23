import { View, Text, StyleSheet } from "react-native";
import React from "react";

export default function login() {
  return (
    <View className="bg-red-600  text-center  justify-center items-center text-white flex-1">
      <Text className="text-white">
        login screen
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignContent: "center",
    alignItems: "center",
    color: "red",
  },
});
