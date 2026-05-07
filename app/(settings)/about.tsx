import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const styles = StyleSheet.create({
  bggray100_px3_py1_roundedfull: {
    backgroundColor: '#F3F4F6',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  bgwhite_rounded3xl_p6_mb4_bord: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    padding: 24
  },
  flex1: {
    flex: 1
  },
  flex1_bgFAF9F6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  flexrow_flexwrap: {
    flexDirection: 'row'
  },
  flexrow_itemscenter_py2: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8
  },
  flexrow_itemsstart_mb4: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginBottom: 16
  },
  fontmedium_textsm: {
    fontSize: 14,
    fontWeight: '500'
  },
  fontsemibold_textgray900_mb1: {
    color: '#111827',
    fontWeight: '600',
    marginBottom: 4
  },
  itemscenter_py8_mb4: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 32
  },
  mb8: {
    marginBottom: 32
  },
  mr4_p2_ml2: {
    marginLeft: -8,
    marginRight: 16,
    padding: 8
  },
  px4_py2_roundedfull_mr2_mb2: {
    borderRadius: 9999,
    marginBottom: 8,
    marginRight: 8,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  px5_py4_flexrow_itemscenter_bg: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  py3: {
    paddingVertical: 12
  },
  style_1: {
    color: '#4B5563'
  },
  style_10: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16
  },
  style_11: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    padding: 24
  },
  style_12: {
    color: '#4B5563',
    marginBottom: 16
  },
  style_13: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12
  },
  style_14: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    padding: 24
  },
  style_2: {
    paddingVertical: 12
  },
  style_3: {
    color: '#4B5563'
  },
  style_4: {
    paddingVertical: 12
  },
  style_5: {
    color: '#4B5563',
    fontSize: 14
  },
  style_6: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12
  },
  style_7: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    padding: 24
  },
  style_8: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16
  },
  style_9: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    padding: 24
  },
  text2xl_fontbold_textgray900_m: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4
  },
  text4a90e2_ml3: {
    color: '#4a90e2',
    marginLeft: 12
  },
  textgray500_mb2: {
    color: '#6B7280',
    marginBottom: 8
  },
  textgray600: {
    color: '#4B5563'
  },
  textgray600_leadingrelaxed: {
    color: '#4B5563'
  },
  textgray600_leadingrelaxed_mb4: {
    color: '#4B5563',
    marginBottom: 16
  },
  textgray600_textsm_leadingrela: {
    color: '#4B5563',
    fontSize: 14,
    marginTop: 8
  },
  textlg_fontbold_textgray900: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700'
  },
  textlg_fontbold_textgray900_mb: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12
  },
  textsm_textgray500: {
    color: '#6B7280',
    fontSize: 14
  },
  textsm_textgray600: {
    color: '#4B5563',
    fontSize: 14
  },
  textwhite_text3xl_fontblack: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900'
  },
  w10_h10_roundedfull_bgblue100_: {
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 9999,
    height: 40,
    justifyContent: 'center',
    marginRight: 12,
    width: 40
  },
  w24_h24_rounded3xl_bg002366_it: {
    alignItems: 'center',
    backgroundColor: '#002366',
    borderRadius: 24,
    height: 96,
    justifyContent: 'center',
    marginBottom: 16,
    width: 96
  },
});

export default function AboutScreen() {
  const router = useRouter();

  const appVersion = "1.0.0";
  
  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>
      <View style={styles.px5_py4_flexrow_itemscenter_bg}>
        <Pressable onPress={() => router.back()} style={styles.mr4_p2_ml2}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text style={styles.textlg_fontbold_textgray900}>À propos d&apos;IPELAN</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        
        <View style={styles.itemscenter_py8_mb4}>
          <View style={styles.w24_h24_rounded3xl_bg002366_it}>
            <Text style={styles.textwhite_text3xl_fontblack}>IP</Text>
          </View>
          <Text style={styles.text2xl_fontbold_textgray900_m}>IPELAN</Text>
          <Text style={styles.textgray500_mb2}>م.ت.ن.ل.و</Text>
          <View style={styles.bggray100_px3_py1_roundedfull}>
            <Text style={styles.textsm_textgray600}>Version {appVersion}</Text>
          </View>
        </View>

        <View style={styles.style_14}>
          <Text style={styles.style_13}>Qu&apos;est-ce qu&apos;IPELAN ?</Text>
          <Text style={styles.style_12}>
            IPELAN est une application éducative mobile conçue pour enseigner les langues nationales de Mauritanie : le Pulaar, le Soninké et le Wolof.
          </Text>
          <Text style={styles.textgray600_leadingrelaxed_mb4}>
            Destinée aux élèves du cycle fondamental, l&apos;application propose des activités interactives, des quiz et des exercices adaptés aux enfants.
          </Text>
          <Text style={styles.textgray600_leadingrelaxed}>
            L&apos;application fonctionne hors-ligne, permettant aux élèves d&apos;apprendre même sans connexion internet.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.style_11}>
          <Text style={styles.style_10}>Fonctionnalités</Text>
          
          <FeatureItem 
            icon="book-open"
            title="Leçons interactives"
            description="Apprenez le vocabulaire et la grammaire à travers des activités ludiques"
          />
          <FeatureItem 
            icon="headphones"
            title="Compréhension orale"
            description="Écoutez des locuteurs natifs et améliorez votre prononciation"
          />
          <FeatureItem 
            icon="edit-2"
            title="Quiz et exercices"
            description="Testez vos connaissances avec des quiz et des exercices variés"
          />
          <FeatureItem 
            icon="wifi-off"
            title="Mode hors-ligne"
            description="Accédez à tous les contenus sans connexion internet"
          />
        </View>

        {/* Languages */}
        <View style={styles.style_9}>
          <Text style={styles.style_8}>Langues disponibles</Text>
          
          <View style={styles.flexrow_flexwrap}>
            <LanguageTag label="Pulaar" color="#FF9500" />
            <LanguageTag label="Soninké" color="#4CD964" />
            <LanguageTag label="Wolof" color="#007AFF" />
          </View>
        </View>

        {/* Credits */}
        <View style={styles.style_7}>
          <Text style={styles.style_6}>Crédits</Text>
          <Text style={styles.style_5}>
            Application développée pour l&apos;éducation en Mauritanie.
          </Text>
          <Text style={styles.textgray600_textsm_leadingrela}>
            © 2026 IPELAN. Tous droits réservés.
          </Text>
        </View>

        {/* Contact */}
        <View style={styles.bgwhite_rounded3xl_p6_mb4_bord}>
          <Text style={styles.textlg_fontbold_textgray900_mb}>Contact</Text>
          <Pressable 
            onPress={() => handleOpenLink("mailto:contact@ipelan.com")}
            style={styles.flexrow_itemscenter_py2}
          >
            <Feather name="mail" size={18} color="#4a90e2" />
            <Text style={styles.text4a90e2_ml3}>contact@ipelan.com</Text>
          </Pressable>
        </View>

        {/* Legal */}
        <View style={styles.mb8}>
          <Pressable style={styles.style_4} onPress={() => handleOpenLink("https://moodle.richatt.com/mod/page/view.php?id=terms")}>
            <Text style={styles.style_3}>Conditions d&apos;utilisation</Text>
          </Pressable>
          <Pressable style={styles.style_2} onPress={() => handleOpenLink("https://moodle.richatt.com/mod/page/view.php?id=privacy")}>
            <Text style={styles.style_1}>Politique de confidentialité</Text>
          </Pressable>
          <Pressable style={styles.py3} onPress={() => handleOpenLink("https://moodle.richatt.com/mod/page/view.php?id=licenses")}>
            <Text style={styles.textgray600}>Licences open source</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <View style={styles.flexrow_itemsstart_mb4}>
      <View style={styles.w10_h10_roundedfull_bgblue100_}>
        <Feather name={icon as any} size={18} color="#4a90e2" />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.fontsemibold_textgray900_mb1}>{title}</Text>
        <Text style={styles.textsm_textgray500}>{description}</Text>
      </View>
    </View>
  );
}

function LanguageTag({ label, color }: { label: string; color: string }) {
  return (
    <View 
      style={[styles.px4_py2_roundedfull_mr2_mb2,{ backgroundColor: `${color}20` }]}
     >
      <Text style={[styles.fontmedium_textsm,{ color }]} >{label}</Text>
    </View>
  );
}
