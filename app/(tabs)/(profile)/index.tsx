import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLogin } from "../../../hooks/useLogin";
import { getUserBadges } from "../../../services/api/badgeService";
import { getLevelNumber } from "../../../utils/levelCalculator";

const styles = StyleSheet.create({
  bgwhite_w48_rounded2xl_p4_item: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  bgwhite_wfull_maxw300px_rounde: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
    marginTop: 32,
    padding: 24,
    width: '100%'
  },
  flex1: {
    flex: 1
  },
  flex1_bgFAF9F6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  flexrow_itemscenter: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  fontbold_textFF1C1C_text15px: {
    color: '#FF1C1C',
    fontSize: 15,
    fontWeight: '700'
  },
  fontbold_textgray700_text15px: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700'
  },
  fontbold_textgray800_textlg: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700'
  },
  mb2: {
    marginBottom: 8
  },
  mr2: {
    marginRight: 8
  },
  px5_py4_flexrow_justifybetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  style_1: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  style_10: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700'
  },
  style_11: {
    marginBottom: 8
  },
  style_12: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16
  },
  style_13: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  style_2: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700'
  },
  style_3: {
    marginBottom: 8
  },
  style_4: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  style_5: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  style_6: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700'
  },
  style_7: {
    marginBottom: 8
  },
  style_8: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16
  },
  style_9: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  textgray500_textxs_textcenter_: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center'
  },
  textlg_fontblack_trackingwider: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  textlg_fontbold_textgray800_ca: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize'
  },
  textxs_textgray500_fontbold_up: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  w20_h20_roundedfull_border2_bo: {
    alignItems: 'center',
    borderColor: '#9CA3AF',
    borderRadius: 9999,
    borderWidth: 2,
    height: 80,
    justifyContent: 'center',
    marginBottom: 16,
    width: 80
  },
  wfull_bgFF1C1C10_border_border: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 28, 28, 0.1)',
    borderColor: 'rgba(255, 28, 28, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 16,
    width: '100%'
  },
  wfull_bgwhite_border_bordergra: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    paddingVertical: 16,
    width: '100%'
  },
  wfull_flexrow_flexwrap_justify: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    width: '100%'
  },
});

export default function ProfileScreen() {
  const { user, logoutUser, token } = useLogin();
  const router = useRouter();
  const [badgesCount, setBadgesCount] = useState(0);

  const userLevel = getLevelNumber(user?.ipelan_xp || 0);

  useEffect(() => {
    if (!user?.id || !token) return;
    getUserBadges(token, user.id)
      .then(b => setBadgesCount(b.length))
      .catch(() => setBadgesCount(0));
  }, [user?.id, token]);

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Se déconnecter", 
          style: "destructive",
          onPress: () => logoutUser() 
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>
      
      {/* Header */}
      <View style={styles.px5_py4_flexrow_justifybetween}>
        <View style={styles.style_13}>
          <Text style={styles.textlg_fontblack_trackingwider}>MON PROFIL</Text>
        </View>
        <View style={styles.flexrow_itemscenter}>
       
          <Pressable
            onPress={() => router.push("/(settings)" as any)}
          >
            <Feather name="settings" size={20} color="black" />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.flex1} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, alignItems: 'center' }}>
        
        {/* Profile Card */}
        <View style={[styles.bgwhite_wfull_maxw300px_rounde,{ shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 }]}>
          <View style={styles.w20_h20_roundedfull_border2_bo}>
             <AntDesign name="user" size={40} color="gray" />
          </View>
          <Text style={styles.textlg_fontbold_textgray800_ca}>{user?.firstname || user?.username || "Amadou"}</Text>
          <Text style={styles.textgray500_textxs_textcenter_}>{user?.email || "amadou.dialo@exemple.com"}</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.wfull_flexrow_flexwrap_justify}>
          
          <View style={[styles.style_12,{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }]} >
            <Feather name="star" size={28} color="#F59E0B" style={styles.style_11} />
            <Text style={styles.style_10}>{user?.ipelan_xp || 0}</Text>
            <Text style={styles.style_9}>XP TOTAL</Text>
          </View>
          
          <View style={[styles.style_8,{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }]} >
            <Feather name="award" size={28} color="#10B981" style={styles.style_7} />
            <Text style={styles.style_6}>{userLevel}</Text>
            <Text style={styles.style_5}>NIVEAU</Text>
          </View>

          <View style={[styles.style_4,{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }]} >
            <Ionicons name="flame" size={28} color="#EF4444" style={styles.style_3} />
            <Text style={styles.style_2}>{user?.streak || 0}</Text>
            <Text style={styles.style_1}>SÉRIE</Text>
          </View>
          
          <View style={[styles.bgwhite_w48_rounded2xl_p4_item,{ shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 }]}>
            <Ionicons name="medal" size={28} color="#8B5CF6" style={styles.mb2} />
            <Text style={styles.fontbold_textgray800_textlg}>{badgesCount}</Text>
            <Text style={styles.textxs_textgray500_fontbold_up}>BADGES</Text>
          </View>

        </View>

        <Pressable 
          style={styles.wfull_bgwhite_border_bordergra}
          onPress={() => router.push("/(settings)")}
        >
          <Feather name="settings" size={18} color="#374151" style={styles.mr2} />
          <Text style={styles.fontbold_textgray700_text15px}>Paramètres</Text>
        </Pressable>

        <Pressable 
          onPress={handleLogout}
          style={styles.wfull_bgFF1C1C10_border_border}
        >
          <Text style={styles.fontbold_textFF1C1C_text15px}>Se déconnecter</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}
