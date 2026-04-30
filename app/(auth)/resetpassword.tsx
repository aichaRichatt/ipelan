import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Alert, Dimensions, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResetPassword } from '../../hooks/useResetPassword';

const { width } = Dimensions.get("window");
const IS_DEV = process.env.NODE_ENV === 'development';

export default function ResetPassword() {
  const router = useRouter();
  const {
    email,
    isLoading,
    error,
    step,
    setEmail,
    submitResetRequest,
    goToLogin,
  } = useResetPassword();

  // Show error alert when error changes
  useEffect(() => {
    if (error) {
      Alert.alert('Erreur', error);
    }
  }, [error]);

  const handleContinue = async () => {
    if (step === 1) {
      const success = await submitResetRequest();
      if (!success && IS_DEV) {
        console.log('[ResetPassword] Request failed');
      }
    } else if (step === 2) {
      goToLogin();
      router.replace("/(auth)/login");
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Réinitialiser Mot De Passe</Text>
      </View>
      <View style={styles.inputContainer}>
         <View style={styles.sectionStyle}>
           <Ionicons name="mail-outline" size={20} color="#666" style={styles.iconStyle} />
           <TextInput
             value={email}
             placeholder="Email"
             placeholderTextColor="#999"
             style={styles.input}
             onChangeText={setEmail}
             keyboardType="email-address"
             autoCapitalize="none"
           />
         </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={[styles.stepContainer, { alignItems: 'center', justifyContent: 'center' }]}>
      <View style={styles.successCard}>
        <Ionicons name="mail-open-outline" size={60} color="#4a90e2" style={{ marginBottom: 20 }} />
        <Text style={styles.successTitle}>Email Envoyé</Text>
        <Text style={styles.successText}>
          Un lien de réinitialisation a été envoyé à votre adresse email. Veuillez vérifier votre boîte de réception et suivre les instructions pour réinitialiser votre mot de passe.
        </Text>
        <Text style={styles.supportText}>
          Si vous ne recevez pas l&apos;email dans les prochaines minutes, vérifiez votre dossier spam.
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.main}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}

        {step !== 2 && (
          <View style={styles.footer}>
            <Pressable
              style={[styles.button, !email && step === 1 ? styles.buttonDisabled : null]}
              onPress={handleContinue}
              disabled={isLoading || !email}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Continuer</Text>
                  <View style={styles.buttonIcon}>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  </View>
                </>
              )}
            </Pressable>
          </View>
        )}

        {step === 2 && (
          <View style={styles.footer}>
            <Pressable 
              style={styles.button}
              onPress={handleContinue}
            >
              <Text style={styles.buttonText}>Retour à la Connexion</Text>
              <View style={styles.buttonIcon}>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF9F6",
  },
  main: {
    flex: 1,
    paddingHorizontal: 25,
  },
  stepContainer: {
    flex: 1,
    paddingTop: 40,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#002366",
  },
  inputContainer: {
    flex: 1,
  },
  sectionStyle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    height: 60,
    borderRadius: 12,
    marginVertical: 10,
    paddingHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  iconStyle: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  footer: {
    paddingBottom: 40,
  },
  button: {
    backgroundColor: "#002366",
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: "#002366",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: "#CCC",
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonIcon: {
    marginLeft: 10,
  },
  successCard: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#002366",
    marginBottom: 15,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: "#555",
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 24,
  },
  supportText: {
    fontSize: 14,
    color: "#999",
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10,
  },
});