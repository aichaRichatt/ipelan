import { AntDesign, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import { Pressable, Text, TextInput, View, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../services/redux/store";
import { saveUserData } from "../../services/storage/tokenStorage";
import { moodleFetch } from "../../services/api/moodleClient";
import { getAuthToken } from "../../services/contentLoader";

export default function EditProfileScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [numero, setNumero] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setNom(user.lastname || "");
      setPrenom(user.firstname || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!nom.trim() || !prenom.trim()) {
      Alert.alert("Erreur", "Le nom et le prénom sont obligatoires");
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = {
        ...user,
        firstname: prenom.trim(),
        lastname: nom.trim(),
        email: email.trim() || user?.email,
        fullname: `${prenom.trim()} ${nom.trim()}`
      };
      
      await saveUserData(updatedUser);
      dispatch({ type: 'auth/loginSuccess', payload: { user: updatedUser, token: user?.token } });

      if (user?.id && user?.token) {
        try {
          const moodleToken = getAuthToken(user.token);
          await moodleFetch('/webservice/rest/server.php', {
            wstoken: moodleToken,
            wsfunction: 'core_user_update_users',
            moodlewsrestformat: 'json',
            'users[0][id]': user.id,
            'users[0][firstname]': prenom.trim(),
            'users[0][lastname]': nom.trim(),
            'users[0][email]': email.trim() || user.email,
          });
        } catch (moodleErr) {
          console.warn('[EditProfile] Moodle sync failed:', moodleErr);
        }
      }
      
      Alert.alert("Succès", "Profil mis à jour avec succès");
      router.back();
    } catch (error) {
      Alert.alert("Erreur", "Impossible de sauvegarder le profil");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable className="mr-6" onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text className="text-lg font-medium tracking-wider uppercase text-gray-900">MODIFIER LE PROFIL</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 10 }}>
        
        <View className="bg-white rounded-[24px] p-6 mb-8 items-center border border-gray-200 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 }}>
          <View className="relative mb-4">
            <View className="w-20 h-20 rounded-full border-2 border-gray-400 items-center justify-center">
              <AntDesign name="user" size={40} color="gray" />
            </View>
            <View className="absolute bottom-0 right-0 bg-white border border-gray-300 rounded-full p-1 shadow-sm">
              <Feather name="edit-2" size={14} color="black" />
            </View>
          </View>
          <Text className="text-sm font-bold text-gray-900 mb-1">
            {user?.firstname || user?.username || "Utilisateur"}
          </Text>
          <Text className="text-xs text-gray-600 font-medium">{user?.email || ""}</Text>
        </View>

        <View className="space-y-4">
          
          <View className="bg-white rounded-[20px] px-5 py-4 border border-gray-200 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }}>
            <TextInput
              placeholder="Nom"
              placeholderTextColor="#6B7280"
              value={nom}
              onChangeText={setNom}
              className="text-gray-900 font-medium text-[15px] w-full"
            />
          </View>

          <View className="bg-white rounded-[20px] px-5 py-4 border border-gray-200 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }}>
            <TextInput
              placeholder="Prénom"
              placeholderTextColor="#6B7280"
              value={prenom}
              onChangeText={setPrenom}
              className="text-gray-900 font-medium text-[15px] w-full"
            />
          </View>

          <View className="bg-white rounded-[20px] px-5 py-4 border border-gray-200 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }}>
            <TextInput
              placeholder="Email"
              placeholderTextColor="#6B7280"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              className="text-gray-900 font-medium text-[15px] w-full"
            />
          </View>

          <View className="bg-white rounded-[20px] px-5 py-4 border border-gray-200 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }}>
            <TextInput
              placeholder="Numéro (optionnel)"
              placeholderTextColor="#6B7280"
              value={numero}
              onChangeText={setNumero}
              keyboardType="phone-pad"
              className="text-gray-900 font-medium text-[15px] w-full"
            />
          </View>

        </View>

        <View className="mt-6 mb-8">
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            className={`bg-[#002366] rounded-2xl py-4 items-center shadow-lg ${isSaving ? 'opacity-50' : ''}`}
            style={{
              shadowColor: "#002366",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text className="text-white font-bold text-lg">
              {isSaving ? "Sauvegarde..." : "Sauvegarder"}
            </Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
