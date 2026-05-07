import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { clearError } from "../../services/redux/slices/authSlice";
import { useLogin } from "../../hooks/useLogin";
import { useLoginValidation } from "../../hooks/useLoginValidation";
import { RootState } from "../../services/redux/store";

export default function Login() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { errors, validateAll } = useLoginValidation();
  const { login } = useLogin();
  const { isLoading, error: reduxError } = useSelector(
    (state: RootState) => state.auth
  );

  const handleLogin = async () => {
    if (validateAll(username, password)) {
      try {
        await login(username, password);
      } catch (err: any) {
        const errMsg = err.message || "";
        const errMsgLower = errMsg.toLowerCase();
        const isInvalidLogin =
          errMsg === "invalidlogin" ||
          errMsgLower.includes("identifiants incorrects") ||
          errMsgLower.includes("aucun compte trouvé") ||
          errMsg.includes("اسم المستخدم") ||
          errMsg.includes("كلمة المرور");

        if (isInvalidLogin) {
          Alert.alert(
            "Identifiants incorrects",
            "Email ou mot de passe incorrect. Veuillez réessayer.",
            [
              { text: "S'inscrire", onPress: () => router.replace("/(auth)/signup") },
              { text: "Réessayer", style: "cancel" },
            ]
          );
        } else {
          Alert.alert("Erreur de connexion", err.message);
        }
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* En-tête */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>Bienvenue sur Ipelan</Text>
        </View>

        {/* Message d'erreur */}
        {(reduxError || errors.username || errors.password) && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {reduxError || errors.username || errors.password}
            </Text>
          </View>
        )}

        {/* Champ email */}
        <View style={styles.inputRow}>
          <Image
            source={require("../../assets/images/email.png")}
            style={styles.inputIcon}
            resizeMode="contain"
          />
          <TextInput
            value={username}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.textInput}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            underlineColorAndroid="transparent"
            onChangeText={(text) => {
              setUsername(text);
              dispatch(clearError());
            }}
          />
        </View>

        {/* Champ mot de passe */}
        <View style={styles.inputRow}>
          <Image
            source={require("../../assets/images/lock.png")}
            style={styles.inputIcon}
            resizeMode="contain"
          />
          <TextInput
            style={styles.textInput}
            placeholder="Mot de passe"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            underlineColorAndroid="transparent"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              dispatch(clearError());
            }}
          />
        </View>

        {/* Mot de passe oublié */}
        <Pressable
          onPress={() => router.push("/(auth)/resetpassword" as any)}
          style={styles.forgotPasswordContainer}
        >
          <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
        </Pressable>

        {/* Bouton connexion */}
        <View style={styles.loginButtonContainer}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#0062FF" />
          ) : (
            <Pressable onPress={handleLogin} style={styles.loginButton}>
              <Text style={styles.loginButtonText}>Se connecter</Text>
            </Pressable>
          )}
        </View>

        {/* Lien inscription */}
        <Pressable
          onPress={() => router.replace("/(auth)/signup")}
          style={styles.signupLink}
        >
          <Text style={styles.signupLinkText}>
            {"Vous n'avez pas de compte ? "}
            <Text style={styles.signupLinkBold}>S'inscrire</Text>
          </Text>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#002366',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#DC2626',
    textAlign: 'center',
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    height: 56,
    marginVertical: 8,
    paddingHorizontal: 12,
    width: '100%',
  },
  inputIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  forgotPasswordContainer: {
    width: '100%',
    marginTop: 4,
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  forgotPasswordText: {
    color: '#0062FF',
    fontWeight: '500',
    fontSize: 14,
  },
  loginButtonContainer: {
    width: '100%',
    marginTop: 8,
  },
  loginButton: {
    backgroundColor: '#0062FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  signupLink: {
    marginTop: 24,
  },
  signupLinkText: {
    color: '#6B7280',
    fontSize: 14,
  },
  signupLinkBold: {
    color: '#0062FF',
    fontWeight: '600',
  },
});
