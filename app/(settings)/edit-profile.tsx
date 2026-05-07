import { AntDesign, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { moodleFetch } from "../../services/api/moodleClient";
import { getAuthToken } from "../../services/contentLoader";
import { loginSuccess } from "../../services/redux/slices/authSlice";
import { RootState } from "../../services/redux/store";
import { saveUserData } from "../../services/storage/tokenStorage";
import { IPELANUser } from "../../types";

const styles = StyleSheet.create({
  absolute_bottom0_right0_bgwhit: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
    borderRadius: 9999,
    borderWidth: 1,
    bottom: 0,
    padding: 4,
    position: 'absolute',
    right: 0
  },
  bgwhite_rounded20px_px5_py4_bo: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  bgwhite_rounded24px_p6_mb8_ite: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    marginBottom: 32,
    padding: 24
  },
  flex1: {
    flex: 1
  },
  flex1_bgFAF9F6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  mt6_mb8: {
    marginBottom: 32,
    marginTop: 24
  },
  px5_py4_flexrow_itemscenter_bg: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  relative_mb4: {
    marginBottom: 16,
    position: 'relative'
  },
  style_1: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
    width: '100%'
  },
  style_2: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  style_3: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
    width: '100%'
  },
  style_4: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  style_5: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
    width: '100%'
  },
  style_6: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  textgray900_fontmedium_text15p: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
    width: '100%'
  },
  textlg_fontmedium_trackingwide: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '500',
    textTransform: 'uppercase'
  },
  textsm_fontbold_textgray900_mb: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4
  },
  textwhite_fontbold_textlg: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700'
  },
  textxs_textgray600_fontmedium: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '500'
  },
  w20_h20_roundedfull_border2_bo: {
    alignItems: 'center',
    borderColor: '#9CA3AF',
    borderRadius: 9999,
    borderWidth: 2,
    height: 80,
    justifyContent: 'center',
    width: 80
  },
});

export default function EditProfileScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  
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
      const updatedUser: IPELANUser = {
        ...user,
        id: user?.id ?? 0,
        username: user?.username ?? '',
        ipelan_xp: user?.ipelan_xp ?? 0,
        coins: user?.coins ?? 0,
        lives: user?.lives ?? 6,
        streak: user?.streak ?? 0,
        firstname: prenom.trim(),
        lastname: nom.trim(),
        email: email.trim() || user?.email || '',
        fullname: `${prenom.trim()} ${nom.trim()}`,
      };
      
      await saveUserData(updatedUser);
      dispatch(loginSuccess({ user: updatedUser, token: token || '' }));

      if (user?.id && token) {
        try {
          const moodleToken = getAuthToken(token);
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
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>
      
      <View style={styles.px5_py4_flexrow_itemscenter_bg}>
        <Pressable  style={{marginRight:6}} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text style={styles.textlg_fontmedium_trackingwide}>MODIFIER LE PROFIL</Text>
      </View>

      <ScrollView style={styles.flex1} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 10 }}>
        
        <View style={[styles.bgwhite_rounded24px_p6_mb8_ite,{ shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 }]}>
          <View style={styles.relative_mb4}>
            <View style={styles.w20_h20_roundedfull_border2_bo}>
              <AntDesign name="user" size={40} color="gray" />
            </View>
            <View style={styles.absolute_bottom0_right0_bgwhit}>
              <Feather name="edit-2" size={14} color="black" />
            </View>
          </View>
          <Text style={styles.textsm_fontbold_textgray900_mb}>
            {user?.firstname || user?.username || "Utilisateur"}
          </Text>
          <Text style={styles.textxs_textgray600_fontmedium}>{user?.email || ""}</Text>
        </View>

        <View  
          style={{ gap: 16 } }
        >
          
          <View style={[styles.style_6,{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }]}>
            <TextInput
              placeholder="Nom"
              placeholderTextColor="#6B7280"
              value={nom}
              onChangeText={setNom}
              style={styles.style_5}
            />
          </View>

          <View style={[styles.style_4,{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }]}>
            <TextInput
              placeholder="Prénom"
              placeholderTextColor="#6B7280"
              value={prenom}
              onChangeText={setPrenom}
              style={styles.style_3}
            />
          </View>

          <View style={[styles.style_2,{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }]}>
            <TextInput
              placeholder="Email"
              placeholderTextColor="#6B7280"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.style_1}
            />
          </View>

            <View style={[styles.bgwhite_rounded20px_px5_py4_bo,{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }]}>
            <TextInput
              placeholder="Numéro (optionnel)"
              placeholderTextColor="#6B7280"
              value={numero}
              onChangeText={setNumero}
              keyboardType="phone-pad"
              style={styles.textgray900_fontmedium_text15p}
            />
          </View>

        </View>

        <View style={styles.mt6_mb8}>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={{
              alignItems: 'center',
              backgroundColor: '#002366',
              borderRadius: 16,
              elevation: 4,
              opacity: isSaving ? 0.5 : 1,
              paddingVertical: 16,
              shadowColor: '#002366',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            }}
          >
            <Text style={styles.textwhite_fontbold_textlg}>
              {isSaving ? "Sauvegarde..." : "Sauvegarder"}
            </Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
