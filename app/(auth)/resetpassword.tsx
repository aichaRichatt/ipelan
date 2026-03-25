
import { View, Text,  TextInput, Image, StyleSheet, Alert, ActivityIndicator, Pressable } from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLoginValidation } from "../../hooks/useLoginValidation";
import { useLogin } from "../../hooks/useLogin";
import { useSelector } from "react-redux";
import { RootState } from "../../services/redux/store";

export default function ResetPassword() {
  const router = useRouter();
  
  
  const { isLoading, error: reduxError } = useSelector((state: RootState) => state.auth);

  const resetPassword = async () => {
  
  };


  return (
    <SafeAreaView className="flex-1 bg-white">
      <View style={styles.container}>
        <View className="mb-8 items-center">
          <Text className="text-3xl font-bold text-primary">Réinitialiser  mot de passe</Text>
          <Text className="text-gray-500 mt-2"></Text>
        </View>

        {(reduxError  ) && (
          <View className="bg-red-100 p-3 rounded-lg mb-4 w-full">
            <Text className="text-red-600 text-center">
              {reduxError }
            </Text>
          </View>
        )}

        <View className="w-full mt-4">
          {isLoading ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : (
            <Pressable 
              onPress={resetPassword}
              className="bg-blue-600 p-4 rounded-xl items-center"
            >
              <Text className="text-white font-bold text-lg">Se connecter</Text>
            </Pressable>
          )}
        </View>

        <Pressable onPress={()=>router.push("/(auth)/signup" )} className="mt-6">
          <Text className="text-blue-600">Vous n`avez pas de compte ? S`inscrire</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionStyle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#eee',
    height: 55,
    borderRadius: 12,
    marginVertical: 10,
    paddingHorizontal: 10,
    width: '100%',
  },
  imageStyle: {
    padding: 10,
    margin: 5,
    height: 20,
    width: 20,
    resizeMode: 'contain',
    alignItems: 'center',
  },
});