import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PolicyModal } from "../../components/PolicyModal";
import { useSignup } from "../../hooks/useSignup";

export default function SignUp() {
  const router = useRouter();
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);

  const { signup } = useSignup();

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return "Le mot de passe doit contenir au moins 8 caractères";
    if (!/[A-Z]/.test(pwd)) return "Au moins une majuscule requise (ex: A, B, C...)";
    if (!/[a-z]/.test(pwd)) return "Au moins une minuscule requise (ex: a, b, c...)";
    if (!/[0-9]/.test(pwd)) return "Au moins un chiffre requis (ex: 1, 2, 3...)";
    if (!/[^A-Za-z0-9]/.test(pwd)) return "Au moins un caractère spécial requis (ex: @, #, !)";
    return null;
  };

  const sanitizeInput = (input: string): string => {
    return input.trim().replace(/[<>\"\'\\]/g, '');
  };

  const handleSignup = async () => {
    const cleanFirstname = sanitizeInput(firstname);
    const cleanLastname = sanitizeInput(lastname);
    const cleanEmail = sanitizeInput(email).toLowerCase();

    if (!cleanFirstname || !cleanLastname || !cleanEmail || !password) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires");
      return;
    }

    if (!policyAccepted) {
      Alert.alert("Politique de confidentialité", "Veuillez accepter les conditions d'utilisation avant de continuer.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert("Erreur", "Veuillez entrer une adresse email valide");
      return;
    }

    const pwdError = validatePassword(password);
    if (pwdError) {
      Alert.alert("Erreur de mot de passe", pwdError);
      return;
    }

    const generatedUsername = `${cleanFirstname.toLowerCase().replace(/[^a-z0-9]/g, '')}_${cleanLastname.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    if (generatedUsername.length < 3) {
      Alert.alert("Erreur", "Le nom d'utilisateur généré est trop court. Veuillez utiliser un nom et prénom plus longs.");
      return;
    }

    setIsProcessing(true);
    try {
      await signup({
        username: generatedUsername,
        email: cleanEmail,
        password,
        firstname: cleanFirstname,
        lastname: cleanLastname
      });

      Alert.alert(
        "Compte créé !",
        `Bienvenue ${cleanFirstname} ! Votre compte a été créé. Vérifiez votre email pour activer votre compte, puis connectez-vous.`,
        [
          {
            text: "Se connecter",
            onPress: () => router.replace("/(auth)/login"),
            style: "default"
          }
        ]
      );
    } catch (signupErr: any) {
      const errMsg = signupErr.message || "";
      if (errMsg.toLowerCase().includes("exist") || errMsg.toLowerCase().includes("already") || errMsg.toLowerCase().includes("déjà")) {
        Alert.alert(
          "Compte existant",
          "Cette adresse email ou ce nom d'utilisateur est déjà enregistré. Veuillez vous connecter.",
          [
            { text: "Se connecter", onPress: () => router.replace("/(auth)/login") },
            { text: "Annuler", style: "cancel" }
          ]
        );
        return;
      }

      Alert.alert("Erreur", signupErr.message || "Impossible de créer le compte. Veuillez réessayer plus tard.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.innerContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Inscription</Text>
              <Text style={styles.subtitle}>Rejoignez la communauté Ipelan</Text>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                value={lastname}
                style={styles.textInput}
                placeholder="Nom"
                autoCapitalize="words"
                onChangeText={setLastname}
              />
            </View>

            <View style={styles.inputRow}>
              <TextInput
                value={firstname}
                style={styles.textInput}
                placeholder="Prénom"
                autoCapitalize="words"
                onChangeText={setFirstname}
              />
            </View>

            <View style={styles.inputRow}>
              <TextInput
                value={email}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.textInput}
                placeholder="Email"
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputRow}>
              <TextInput
                value={password}
                placeholder="Mot de passe (A-z, 0-9, @...)"
                secureTextEntry
                style={styles.textInput}
                onChangeText={setPassword}
              />
            </View>

            <Pressable
              onPress={() => setShowPolicy(true)}
              style={styles.policyRow}
            >
              <View style={[styles.checkbox, policyAccepted && styles.checkboxChecked]}>
                {policyAccepted && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.policyText}>
                J&apos;accepte les <Text style={styles.policyLink}>conditions d&apos;utilisation</Text>
              </Text>
            </Pressable>

            <View style={styles.buttonContainer}>
              {isProcessing ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text style={styles.loadingText}>Création en cours...</Text>
                </View>
              ) : (
                <Pressable
                  onPress={handleSignup}
                  style={styles.signupButton}
                >
                  <Text style={styles.signupButtonText}>S&apos;inscrire</Text>
                </Pressable>
              )}
            </View>

            <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.loginLink}>
              <Text style={styles.loginLinkText}>
                Vous avez déjà un compte ? <Text style={styles.loginLinkBold}>Se connecter</Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1d4ed8',
  },
  subtitle: {
    color: '#6b7280',
    marginTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 56,
    borderRadius: 12,
    marginVertical: 8,
    paddingHorizontal: 16,
    width: '100%',
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#111827',
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
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
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 10,
  },
  policyText: {
    color: '#4b5563',
    fontSize: 14,
    marginLeft: 8,
  },
  policyLink: {
    color: '#2563eb',
    fontWeight: 'bold',
  },
  buttonContainer: {
    width: '100%',
    marginTop: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    color: '#6b7280',
    marginTop: 8,
    fontSize: 14,
  },
  signupButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signupButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  loginLink: {
    marginTop: 24,
    paddingBottom: 40,
  },
  loginLinkText: {
    color: '#2563eb',
    textAlign: 'center',
  },
  loginLinkBold: {
    fontWeight: 'bold',
  },
});
