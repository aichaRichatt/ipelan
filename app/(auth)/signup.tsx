
import { View, Text, Button, TextInput, Image,StyleSheet, Alert, ActivityIndicator } from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { LoginForm } from "@/types";

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const { signIn, loading, error: err } = useAuth();
  
  function handelLogin(): void {
    if (!email || !password) setError("Email ou mot de passe incorrecte")
    if (!email.includes("@"  ) || !email.includes(".")) {
      setError("Invalide Email ");
      Alert.alert("mail invalide");
    } if (password.length <= 3) {
      setError("Le Mot de passe doit contenir plus de 3 caractere ,")
    } 
    const user: LoginForm = {
      email,
      password
    }
   const response = await signIn(user.email,user.password));
    if(response.success) Alert.alert("User Logged In ")
    
      
  } 
  
  return (
    <>
      <SafeAreaView className="flex-1 bg-primary">
        <View style={styles.container}>
          <View className=" mb-6 font-bold text-ellipsis text-2xl font-[prata]">
            <Text className="text-3xl font-bold mb-7">Connextion </Text>
          </View>
          <View className="bg-red-500">
            <Text className="text-red-600 justify-center bg-red-300 text-center m-auto">{ error?  "Erreur Surveunue : "+error : ''}</Text>
          </View>
          <View  style={styles.sectionStyle}>
            <Image
              source={require('../../assets/images/email.png')}
              style={styles.imageStyle}
            />
            <TextInput
              value={email}
              keyboardType="email-address"
              autoComplete="email" 
              className="flex-1"
              placeholder="Email"
              underlineColorAndroid="transparent"
              onChangeText={setEmail}
            />
          </View>
          
          <View style={styles.sectionStyle} >
            <Image
            source={require('../../assets/images/loock.png')}
              style={styles.imageStyle}
            />
            
            <TextInput
              style={{flex: 1}}
              placeholder="Password"
              keyboardType="visible-password"
              autoComplete="password"
              underlineColorAndroid="transparent"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
          
          <View style={styles.sectionStyle} >
            {loading ? <ActivityIndicator /> :<Button title="Connexion" onPress={() => handelLogin} />}
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10,
  },
  sectionStyle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: '#000',
    height: 40,
    borderRadius: 5,
    margin: 10,
    
  },
  imageStyle: {
    padding: 10,
    margin: 5,
    height: 20,
    width: 20,
    resizeMode: 'stretch',
    alignItems: 'center',
  },
});