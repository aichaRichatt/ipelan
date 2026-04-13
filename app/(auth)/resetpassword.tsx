import React, { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, TextInput, Image, Dimensions, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function ResetPassword() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleContinue = async () => {
    if (step === 1) {
      if (!email) return;
      setLoading(true);
      try {
        // TODO: Connect to Moodle API for password reset
        // await requestPasswordReset(email);
        setTimeout(() => {
          setLoading(false);
          setStep(2);
        }, 1000);
      } catch (error) {
        setLoading(false);
        Alert.alert('Erreur', 'Impossible d\'envoyer le lien de réinitialisation'+error);
      }
    } else if (step === 2) {
      if (!password || password !== confirmPassword) return;
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStep(3);
      }, 1500);
    } else if (step === 3) {
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
    <View style={styles.stepContainer}>
      <View style={styles.headerWithBack}>
        <Pressable onPress={() => setStep(1)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.titleSmall}>Créer un mot de passe</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.subtitle}>Créer un nouveau mot de passe</Text>
        
        <View style={styles.sectionStyle}>
          <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.iconStyle} />
          <TextInput
            value={password}
            placeholder="Password"
            placeholderTextColor="#999"
            style={styles.input}
            secureTextEntry={!showPassword}
            onChangeText={setPassword}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#666" />
          </Pressable>
        </View>

        <View style={styles.sectionStyle}>
          <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.iconStyle} />
          <TextInput
            value={confirmPassword}
            placeholder="Confirm Password"
            placeholderTextColor="#999"
            style={styles.input}
            secureTextEntry={!showConfirmPassword}
            onChangeText={setConfirmPassword}
          />
          <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#666" />
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={[styles.stepContainer, { alignItems: 'center', justifyContent: 'center' }]}>
      <View style={styles.successCard}>
        <Image 
          source={require('../../assets/images/success_illustration.png')} 
          style={styles.successImage}
          resizeMode="contain"
        />
        <Text style={styles.successTitle}>Félicitations</Text>
        <Text style={styles.successText}>
          Votre compte est prêt à être utilisé. Vous serez redirigé vers la page d`accueil dans quelques secondes.
        </Text>
        <ActivityIndicator size="small" color="#1A1A1A" style={{ marginTop: 20 }} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.main}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {step !== 3 && (
          <View style={styles.footer}>
            <Pressable 
              style={[styles.button, (!email && step === 1) || (!password && step === 2) ? styles.buttonDisabled : null]}
              onPress={handleContinue}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Continue</Text>
                  <View style={styles.buttonIcon}>
                    <Ionicons name="arrow-forward" size={20} color="#0062FF" />
                  </View>
                </>
              )}
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
    backgroundColor: "white",
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
  headerWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 60,
  },
  backButton: {
      padding: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  titleSmall: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginLeft: 15,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 20,
  },
  content: {
    flex: 1,
  },
  inputContainer: {
    flex: 1,
  },
  sectionStyle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
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
    backgroundColor: "#0062FF",
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: "#0062FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginRight: 10,
  },
  buttonIcon: {
    backgroundColor: "white",
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 5,
  },
  successCard: {
    backgroundColor: '#F9FAFF',
    width: width - 50,
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
  },
  successImage: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 15,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  }
});