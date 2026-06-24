import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResetPassword } from '../../hooks/useResetPassword';

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
    <View style={styles.step1Container}>
      <View style={styles.step1TitleContainer}>
        <Text style={styles.step1Title}>Réinitialiser Mot De Passe</Text>
      </View>
      <View style={styles.flex1}>
        <View style={styles.inputRow}>
          <Ionicons name="mail-outline" size={20} color="#666" style={{ marginRight: 10 }} />
          <TextInput
            value={email}
            placeholder="Email"
            placeholderTextColor="#999"
            style={styles.inputText}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.step2Container}>
      <View style={styles.step2Card}>
        <Ionicons name="mail-open-outline" size={60} color="#4a90e2" style={{ marginBottom: 20 }} />
        <Text style={styles.step2Title}>Email Envoyé</Text>
        <Text style={styles.step2Body}>
          Un lien de réinitialisation a été envoyé à votre adresse email. Veuillez vérifier votre boîte de réception et suivre les instructions pour réinitialiser votre mot de passe.
        </Text>
        <Text style={styles.step2Hint}>
          Si vous ne recevez pas l&apos;email dans les prochaines minutes, vérifiez votre dossier spam.
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#002366" />
        </Pressable>
      </View>
      <View style={styles.container}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}

        {step !== 2 && (
          <View style={styles.bottomContainer}>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: (!email && step === 1) ? '#CCC' : '#002366', elevation: 5 },
                (!email && step === 1) && styles.buttonDisabled,
              ]}
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
          <View style={styles.bottomContainer}>
            <Pressable
              style={[styles.button, { backgroundColor: '#002366', elevation: 5 }]}
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
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  flex1: {
    flex: 1,
  },
  step1Container: {
    flex: 1,
    paddingTop: 40,
  },
  step1TitleContainer: {
    marginBottom: 40,
  },
  step1Title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#002366',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    height: 60,
    borderRadius: 12,
    marginVertical: 10,
    paddingHorizontal: 16,
    elevation: 2,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  step2Container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step2Card: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    elevation: 5,
  },
  step2Title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#002366',
    marginBottom: 16,
    textAlign: 'center',
  },
  step2Body: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  step2Hint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  bottomContainer: {
    paddingBottom: 40,
  },
  button: {
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: 10,
  },
});
