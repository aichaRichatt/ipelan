import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmailVerificationModal } from "../../components/EmailVerificationModal";
import { PolicyModal } from "../../components/PolicyModal";
import { useSignup } from "../../hooks/useSignup";

const LOGO = require("../../assets/images/icon.png");

export default function SignUp() {
  const router = useRouter();
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const { signup } = useSignup();

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return "Le mot de passe doit contenir au moins 8 caractères";
    return null;
  };

  const sanitizeInput = (input: string): string => {
    return input.trim().replace(/[<>"'\\]/g, '');
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
        lastname: cleanLastname,
      });

      setRegisteredEmail(cleanEmail);
      setShowEmailVerification(true);
    } catch (signupErr: any) {
      const errMsg = signupErr.message || "";
      if (errMsg.toLowerCase().includes("exist") || errMsg.toLowerCase().includes("already") || errMsg.toLowerCase().includes("déjà")) {
        Alert.alert(
          "Compte existant",
          "Cette adresse email ou ce nom d'utilisateur est déjà enregistré. Veuillez vous connecter.",
          [
            { text: "Se connecter", onPress: () => router.replace("/(auth)/login") },
            { text: "Annuler", style: "cancel" },
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Navy header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.headerTagline}>Apprentissage des langues nationales</Text>
        </View>

        {/* White card with scroll */}
        <View style={styles.card}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.cardTitle}>Créer un compte</Text>
            <Text style={styles.cardSubtitle}>Rejoignez la communauté IPELAN</Text>

            {/* Nom / Prénom — side by side */}
            <View style={styles.nameRow}>
              <View style={[styles.inputWrapper, styles.halfInput]}>
                <TextInput
                  value={lastname}
                  style={styles.textInput}
                  placeholder="Nom"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  onChangeText={setLastname}
                />
              </View>
              <View style={[styles.inputWrapper, styles.halfInput]}>
                <TextInput
                  value={firstname}
                  style={styles.textInput}
                  placeholder="Prénom"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  onChangeText={setFirstname}
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                value={email}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.textInput}
                placeholder="Adresse email"
                placeholderTextColor="#9CA3AF"
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                value={password}
                placeholder="Mot de passe (min. 8 caractères)"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                style={styles.textInput}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeButton}>
                <Text style={styles.eyeText}>{showPassword ? "Cacher" : "Voir"}</Text>
              </Pressable>
            </View>

            {/* Policy checkbox */}
            <Pressable onPress={() => setShowPolicy(true)} style={styles.policyRow}>
              <View style={[styles.checkbox, policyAccepted && styles.checkboxChecked]}>
                {policyAccepted && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.policyText}>
                {"J'accepte les "}
                <Text style={styles.policyLink}>conditions d'utilisation</Text>
              </Text>
            </Pressable>

            <View style={styles.buttonContainer}>
              {isProcessing ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#002366" />
                  <Text style={styles.loadingText}>Création en cours...</Text>
                </View>
              ) : (
                <Pressable
                  onPress={handleSignup}
                  style={({ pressed }) => [
                    styles.signupButton,
                    pressed && styles.signupButtonPressed,
                  ]}
                >
                  <Text style={styles.signupButtonText}>Créer mon compte</Text>
                </Pressable>
              )}
            </View>

            <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.loginLink}>
              <Text style={styles.loginLinkText}>
                {"Déjà un compte ? "}
                <Text style={styles.loginLinkBold}>Se connecter</Text>
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <PolicyModal
        visible={showPolicy}
        onAccept={() => {
          setPolicyAccepted(true);
          setShowPolicy(false);
        }}
        onClose={() => setShowPolicy(false)}
      />

      <EmailVerificationModal
        visible={showEmailVerification}
        email={registeredEmail}
        onClose={() => {
          setShowEmailVerification(false);
          router.replace("/(auth)/login");
        }}
      />
    </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#002366',
  },
  flex1: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  logoCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    width: 82,
    height: 68,
  },
  headerTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 28,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },
  halfInput: {
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 56,
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    height: '100%',
  },
  eyeButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  eyeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#002366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#002366',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  policyText: {
    color: '#4B5563',
    fontSize: 14,
    flex: 1,
  },
  policyLink: {
    color: '#002366',
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 20,
  },
  loadingBox: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B7280',
    marginTop: 8,
    fontSize: 14,
  },
  signupButton: {
    backgroundColor: '#002366',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#002366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  signupButtonPressed: {
    backgroundColor: '#001a4d',
    elevation: 2,
  },
  signupButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  loginLink: {
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  loginLinkBold: {
    color: '#002366',
    fontWeight: '700',
  },
});
