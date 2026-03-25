import { View, Text, TextInput, Image, StyleSheet, Alert, ActivityIndicator, Pressable, ScrollView } from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { signUp } from "../../services/api/moodleAuth";

export default function SignUp() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!username || !email || !password || !firstname || !lastname) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires");
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(username, email, password, firstname, lastname);
      if (result && Array.isArray(result) && result[0]?.id) {
        Alert.alert("Succès", "Compte créé avec succès ! Connectez-vous maintenant.");
        router.push("/(auth)/login");
      } else {
        throw new Error(result.message || "Erreur lors de la création du compte");
      }
    } catch (err: any) {
      Alert.alert("Erreur d'inscription", err.message);
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    router.push("/(auth)/login");
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{flexGrow: 1}}>
        <View style={styles.container}>
          <View className="mb-8 items-center">
            <Text className="text-3xl font-bold text-primary">Inscription</Text>
            <Text className="text-gray-500 mt-2">Rejoignez la communauté Ipelan</Text>
          </View>

          <View style={styles.sectionStyle}>
            <TextInput
              value={username}
              autoCapitalize="none"
              className="flex-1 h-full"
              placeholder="Nom d'utilisateur"
              onChangeText={setUsername}
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
              value={lastname}
              className="flex-1 h-full"
              placeholder="Nom"
              onChangeText={setLastname}
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
              value={password}
              placeholder="Mot de passe"
              secureTextEntry
              className="flex-1 h-full"
              onChangeText={setPassword}
            />
          </View>

          <View className="w-full mt-4">
            {loading ? (
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