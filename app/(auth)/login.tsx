import { View, Text,  TextInput, Image, StyleSheet, Alert, ActivityIndicator, Pressable } from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLoginValidation } from "../../hooks/useLoginValidation";
import { useLogin } from "../../hooks/useLogin";
import { useSelector } from "react-redux";
import { RootState } from "../../services/redux/store";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const { errors, validateAll } = useLoginValidation();
  const { login } = useLogin();
  const { isLoading, error: reduxError } = useSelector((state: RootState) => state.auth);

  const handleLogin = async () => {
    if (validateAll(username, password)) {
      try {
         await login(username, password, username, "Ip", "User", "Nktt");
      } catch (err: any) {
        Alert.alert("Erreur de connexion", err.message);
      }
    }
  };

  const goToSignup = () => {
    router.push("/(auth)/signup");
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View style={styles.container}>
        <View className="mb-8 items-center">
          <Text className="text-3xl font-bold text-primary">Connexion</Text>
          <Text className="text-gray-500 mt-2">Bienvenue sur Ipelan</Text>
        </View>

        {(reduxError || errors.username || errors.password) && (
          <View className="bg-red-100 p-3 rounded-lg mb-4 w-full">
            <Text className="text-red-600 text-center">
              {reduxError || errors.username || errors.password}
            </Text>
          </View>
        )}

        <View className="flex-row justify-center items-center bg-gray-50 border border-gray-200 h-14 rounded-xl my-2 px-3 w-full">
          <Image
            source={require('../../assets/images/email.png')}
            className="p-3 m-1 h-5 w-5"
            style={{ resizeMode: 'contain' }}
          />
          <TextInput
            value={username}
            autoCapitalize="none"
            keyboardType="email-address"
            className="flex-1 h-full ml-2"
            placeholder="Email"
            underlineColorAndroid="transparent"
            onChangeText={setUsername}
          />
        </View>

        <View className="flex-row justify-center items-center bg-gray-50 border border-gray-200 h-14 rounded-xl my-2 px-3 w-full">
          <Image
            source={require('../../assets/images/lock.png')}
            className="p-3 m-1 h-5 w-5"
            style={{ resizeMode: 'contain' }}
          />
          <TextInput
            style={{ flex: 1 }}
            className="ml-2 h-full"
            placeholder="Mot de passe"
            secureTextEntry
            underlineColorAndroid="transparent"
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <Pressable onPress={() => router.push("/(auth)/resetpassword")} style={{ width: '100%', marginBottom: 15 }}>
          <Text style={{ color: '#0062FF', textAlign: 'right', fontWeight: '500' }}>Mot de passe oublié ?</Text>
        </Pressable>

        <View className="w-full mt-4">
          {isLoading ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : (
            <Pressable 
              onPress={handleLogin}
              className="bg-blue-600 p-4 rounded-xl items-center"
            >
              <Text className="text-white font-bold text-lg">Se connecter</Text>
            </Pressable>
          )}
        </View>

        <Pressable onPress={goToSignup} className="mt-6">
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
});
