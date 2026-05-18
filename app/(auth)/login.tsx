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

const LOGO = require("../../assets/images/icon.png");

export default function Login() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
      {/* Navy header */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.headerTagline}>Apprentissage des langues nationales</Text>
      </View>

      {/* White card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connexion</Text>
        <Text style={styles.cardSubtitle}>Bienvenue ! Entrez vos identifiants.</Text>

        {(reduxError || errors.username || errors.password) && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              {reduxError || errors.username || errors.password}
            </Text>
          </View>
        )}

        <View style={styles.inputWrapper}>
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
            placeholder="Email ou identifiant"
            placeholderTextColor="#9CA3AF"
            underlineColorAndroid="transparent"
            onChangeText={(text) => {
              setUsername(text);
              dispatch(clearError());
            }}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Image
            source={require("../../assets/images/lock.png")}
            style={styles.inputIcon}
            resizeMode="contain"
          />
          <TextInput
            style={styles.textInput}
            placeholder="Mot de passe"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!showPassword}
            underlineColorAndroid="transparent"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              dispatch(clearError());
            }}
          />
          <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeButton}>
            <Text style={styles.eyeText}>{showPassword ? "Cacher" : "Voir"}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push("/(auth)/resetpassword" as any)}
          style={styles.forgotContainer}
        >
          <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
        </Pressable>

        <View style={styles.buttonContainer}>
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#002366" />
            </View>
          ) : (
            <Pressable
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginButtonPressed,
              ]}
            >
              <Text style={styles.loginButtonText}>Se connecter</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={() => router.replace("/(auth)/signup")}
          style={styles.signupLink}
        >
          <Text style={styles.signupLinkText}>
            {"Pas encore de compte ? "}
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
    backgroundColor: '#002366',
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    width: 96,
    height: 80,
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
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 28,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 18,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
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
  inputIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
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
  forgotContainer: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -4,
  },
  forgotText: {
    color: '#002366',
    fontWeight: '500',
    fontSize: 13,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  loadingBox: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButton: {
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
  loginButtonPressed: {
    backgroundColor: '#001a4d',
    elevation: 2,
  },
  loginButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  signupLink: {
    alignItems: 'center',
    marginTop: 4,
  },
  signupLinkText: {
    color: '#6B7280',
    fontSize: 14,
  },
  signupLinkBold: {
    color: '#002366',
    fontWeight: '700',
  },
});
