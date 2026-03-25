import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignup } from "../../hooks/useSignup";

export default function SignUp() {
  const router = useRouter();
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  
  const { signup, isLoading } = useSignup();

  const handleSignup = async () => {
    if (!firstname || !lastname || !email || !password || !city) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Erreur", "Veuillez entrer une adresse email valide");
      return;
    }

    const generatedUsername = firstname.toLowerCase().replace(/[^a-z0-9]/g, '');

    try {
      const result = await signup(generatedUsername, email, password, firstname, lastname, city);
      if (result) {
        Alert.alert("Succès", "Compte créé avec succès ! Connectez-vous maintenant.");
        router.push("/(auth)/login");
      }
    } catch (err: any) {
      let errorMessage = err.message || "Erreur lors de la création du compte";
      if (errorMessage.toLowerCase().includes("exist")  ) {
        errorMessage = "Ce compte ou cette adresse email existe déjà. Veuillez vous connecter ou utiliser un autre email.";
      }
      Alert.alert("Erreur d'inscription", errorMessage);
    }
  };

  const goToLogin = () => {
    router.push("/(auth)/login");
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{flexGrow: 1}} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <View className="mb-8 items-center">
              <Text className="text-3xl font-bold text-primary">Inscription</Text>
              <Text className="text-gray-500 mt-2">Rejoignez la communauté Ipelan</Text>
            </View>

            <View style={styles.sectionStyle}>
              <TextInput
                value={lastname}
                className="flex-1 h-full"
                placeholder="Nom"
                onChangeText={setLastname}
              />
            </View>

            <View style={styles.sectionStyle}>
              <TextInput
                value={firstname}
                className="flex-1 h-full"
                placeholder="Prénom"
                onChangeText={setFirstname}
              />
            </View>

            <View style={styles.sectionStyle}>
              <TextInput
                value={email}
                keyboardType="email-address"
                autoCapitalize="none"
                className="flex-1 h-full"
                placeholder="Email"
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.sectionStyle}>
              <TextInput
                value={city}
                className="flex-1 h-full"
                placeholder="Ville"
                onChangeText={setCity}
              />
            </View>

            <View style={styles.sectionStyle}>
              <TextInput
                value={password}
                placeholder="Mot de passe"
                secureTextEntry
                className="flex-1 h-full"
                onChangeText={setPassword}
              />
            </View>

            <View className="w-full mt-4">
              {isLoading ? (
                <ActivityIndicator size="large" color="#0000ff" />
              ) : (
                <Pressable 
                  onPress={handleSignup}
                  className="bg-blue-600 p-4 rounded-xl items-center"
                >
                  <Text className="text-white font-bold text-lg">S'inscrire</Text>
                </Pressable>
              )}
            </View>

            <Pressable onPress={goToLogin} className="mt-6 pb-10">
              <Text className="text-blue-600">Vous avez déjà un compte ? Se connecter</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginVertical: 8,
    paddingHorizontal: 15,
    width: '100%',
  },
});
