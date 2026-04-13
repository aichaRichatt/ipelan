import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignup } from "../../hooks/useSignup";
import { useLogin } from "../../hooks/useLogin";
import { getDBConnection, getUser, saveUser } from "../../services/storage/db-service";
import { PolicyModal } from "../../components/PolicyModal";

const IS_DEV = process.env.NODE_ENV === "development";

export default function SignUp() {
  const router = useRouter();
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const { signup } = useSignup();
  const { login } = useLogin();

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return "Le mot de passe doit contenir au moins 8 caractères";
    }
    if (!/[A-Z]/.test(pwd)) {
      return "Le mot de passe doit contenir au moins une majuscule";
    }
    if (!/[a-z]/.test(pwd)) {
      return "Le mot de passe doit contenir au moins une minuscule";
    }
    if (!/[0-9]/.test(pwd)) {
      return "Le mot de passe doit contenir au moins un chiffre";
    }
    return null;
  };

  const sanitizeInput = (input: string): string => {
    return input.trim().replace(/[<>\"\'\\]/g, '');
  };

  const verifyAndLogin = async (usernameToLogin: string): Promise<any> => {
    try {
      const res = await login(usernameToLogin, password, email, firstname, lastname, city);
      return res;
    } catch (loginErr: any) {
      if (IS_DEV) console.warn("verifyAndLogin failed:", loginErr.message);
      return null;
    }
  };

  const handleSignup = async () => {
    setValidationError(null);

    const cleanFirstname = sanitizeInput(firstname);
    const cleanLastname = sanitizeInput(lastname);
    const cleanEmail = sanitizeInput(email).toLowerCase();
    const cleanCity = sanitizeInput(city);

    if (!cleanFirstname || !cleanLastname || !cleanEmail || !password || !cleanCity) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires");
      return;
    }

    if (!policyAccepted) {
      Alert.alert("Politique de confidentialité", "Veuillez accepter les conditions d&apos;utilisation avant de continuer.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert("Erreur", "Veuillez entrer une adresse email valide");
      return;
    }

    const pwdError = validatePassword(password);
    if (pwdError) {
      Alert.alert("Erreur", pwdError);
      return;
    }

    const generatedUsername = `${cleanFirstname.toLowerCase().replace(/[^a-z0-9]/g, '')}_${cleanLastname.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    if (generatedUsername.length < 3) {
      Alert.alert("Erreur", "Le nom d&apos;utilisateur généré est trop court. Veuillez utiliser un nom et prénom plus longs.");
      return;
    }

    setIsProcessing(true);
    let signupRes: any = null;
    try {
      try {
        signupRes = await signup({ username: generatedUsername, email: cleanEmail, password, firstname: cleanFirstname, lastname: cleanLastname, city: cleanCity });
      } catch (signupErr: any) {
        const errMsg = signupErr.message || "";
        if (errMsg.toLowerCase().includes("exist") || errMsg.toLowerCase().includes("already")) {
          Alert.alert(
            "Compte existant",
            "Cette adresse email ou ce nom d&apos;utilisateur est déjà enregistré. Veuillez vous connecter.",
            [
              { text: "Se connecter", onPress: () => router.replace("/(auth)/login") },
              { text: "Annuler", style: "cancel" }
            ]
          );
          return;
        }

        Alert.alert("Erreur", "Impossible de créer le compte. Veuillez réessayer plus tard.");
        return; 
      }

      const userId = signupRes?.[0]?.id || signupRes?.id || 0;
      if (!userId) {
        throw new Error("Moodle returned no User ID after signup");
      }

      const loginRes = await verifyAndLogin(generatedUsername);

      if (!loginRes || !loginRes.user) {
        Alert.alert(
          "Compte créé", 
          "Votre compte a été créé. La connexion automatique a échoué. Veuillez vous connecter manuellement.",
          [
            { text: "Se connecter", onPress: () => router.replace("/(auth)/login") }
          ]
        );
        return;
      }

      router.replace("/(tabs)/(home)" as any);

    } catch (error: any) {
      if (IS_DEV) console.error("Signup error:", error.message);
      Alert.alert("Erreur", "Une erreur inattendue s&apos;est produite. Veuillez réessayer.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{flexGrow: 1}} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <View className="mb-8 items-center">
              <Text className="text-3xl font-bold text-blue-700">Inscription</Text>
              <Text className="text-gray-500 mt-2">Rejoignez la communauté Ipelan</Text>
            </View>

            <View className="flex-row items-center bg-gray-50 border border-gray-200 h-14 rounded-xl my-2 px-4 w-full">
              <TextInput
                value={lastname}
                className="flex-1 h-full"
                placeholder="Nom de famille"
                autoCapitalize="words"
                onChangeText={setLastname}
              />
            </View>

            <View className="flex-row items-center bg-gray-50 border border-gray-200 h-14 rounded-xl my-2 px-4 w-full">
              <TextInput
                value={firstname}
                className="flex-1 h-full"
                placeholder="Prénom"
                autoCapitalize="words"
                onChangeText={setFirstname}
              />
            </View>

            <View className="flex-row items-center bg-gray-50 border border-gray-200 h-14 rounded-xl my-2 px-4 w-full">
              <TextInput
                value={email}
                keyboardType="email-address"
                autoCapitalize="none"
                className="flex-1 h-full"
                placeholder="Email"
                onChangeText={setEmail}
              />
            </View>

            <View className="flex-row items-center bg-gray-50 border border-gray-200 h-14 rounded-xl my-2 px-4 w-full">
              <TextInput
                value={city}
                className="flex-1 h-full"
                placeholder="Ville"
                autoCapitalize="words"
                onChangeText={setCity}
              />
            </View>

            <View className="flex-row items-center bg-gray-50 border border-gray-200 h-14 rounded-xl my-2 px-4 w-full">
              <TextInput
                value={password}
                placeholder="Mot de passe (8 caractères min.)"
                secureTextEntry
                className="flex-1 h-full"
                onChangeText={setPassword}
              />
            </View>

            <Pressable 
              onPress={() => setShowPolicy(true)}
              className="flex-row items-center w-full py-3"
            >
              <View style={[styles.checkbox, policyAccepted && styles.checkboxChecked]}>
                {policyAccepted && <Text style={{color: '#fff', fontSize: 10}}>✓</Text>}
              </View>
              <Text className="text-gray-600 text-sm ml-2">
                J&apos;accepte les <Text className="text-blue-600 font-bold">conditions d&apos;utilisation</Text>
              </Text>
            </Pressable>

            <View className="w-full mt-4">
              {isProcessing ? (
                <View className="items-center py-4">
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text className="text-gray-500 mt-2 text-sm">Création en cours...</Text>
                </View>
              ) : (
                <Pressable 
                  onPress={handleSignup}
                  className="bg-blue-600 p-4 rounded-xl items-center"
                >
                  <Text className="text-white font-bold text-lg">S&apos;inscrire</Text>
                </Pressable>
              )}
            </View>

            <Pressable onPress={() => router.replace("/(auth)/login")} className="mt-6 pb-10">
              <Text className="text-blue-600 text-center">
                Vous avez déjà un compte ? <Text className="font-bold">Se connecter</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PolicyModal 
        visible={showPolicy}
        onAccept={() => {
          setPolicyAccepted(true);
          setShowPolicy(false);
        }}
        onClose={() => setShowPolicy(false)}
      />
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
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
  }
});
