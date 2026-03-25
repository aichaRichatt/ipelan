import { View, Text, Button, TextInput, Image, StyleSheet, Alert, ActivityIndicator, Pressable } from "react-native";
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
        await login(username, password);
        // Navigation is handled inside useLogin
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

        <View style={styles.sectionStyle}>
          <Image
            source={require('../../assets/images/email.png')}
            style={styles.imageStyle}
          />
          <TextInput
            value={username}
            autoCapitalize="none"
            className="flex-1 h-full"
            placeholder="Nom d'utilisateur"
            underlineColorAndroid="transparent"
            onChangeText={setUsername}
          />
        </View>

        <View style={styles.sectionStyle}>
          <Image
            source={require('../../assets/images/loock.png')}
            style={styles.imageStyle}
          />
          <TextInput
            style={{ flex: 1 }}
            placeholder="Mot de passe"
            secureTextEntry
            underlineColorAndroid="transparent"
            value={password}
            onChangeText={setPassword}
          />
        </View>

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
          <Text className="text-blue-600">Vous n'avez pas de compte ? S'inscrire</Text>
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
