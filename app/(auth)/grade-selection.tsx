import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Grade } from "../../types";

const LANGUAGE_STORAGE_KEY = '@ipelan_language';
const PREFERENCES_KEY = '@ipelan_preferences';

interface UserPreferences {
  language: string;
  grade: number;
}

interface GradeOption {
  value: Grade;
  label: string;
  description: string;
  icon: string;
}

const GRADES: GradeOption[] = [
  { value: 1, label: "1ère année", description: "Premiers pas", icon: "star" },
  { value: 2, label: "2ème année", description: "Continuer", icon: "star" },
  { value: 3, label: "3ème année", description: "Progresser", icon: "star" },
  { value: 4, label: "4ème année", description: "Approfondir", icon: "award" },
  { value: 5, label: "5ème année", description: "Maîtriser", icon: "award" },
  { value: 6, label: "6ème année", description: "Expert", icon: "award" },
];

const styles = StyleSheet.create({
  absolute_top2_right2_w6_h6_rou: {
    alignItems: 'center',
    backgroundColor: '#002366',
    borderRadius: 9999,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    width: 24
  },
  flex1: {
    flex: 1
  },
  flex1_bgFAF9F6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  flex1_itemscenter_mr10: {
    alignItems: 'center',
    flex: 1
  },
  flex1_px6_pt4: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16
  },
  flexrow_flexwrap_justifybetwee: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  flexrow_itemscenter_mb8: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 32
  },
  mb6: {
    marginBottom: 24
  },
  p2_ml2: {
    marginLeft: -8,
    padding: 8
  },
  text3xl_fontbold_textgray900_m: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  textcenter_textgray500_textsm_: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center'
  },
  textgray500_textbase_mb8_textc: {
    color: '#6B7280',
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center'
  },
  textwhite_fontbold_textlg: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700'
  },
  textxl_fontbold_textgray900: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700'
  },
  textxs_textgray500_textcenter: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center'
  },
  buttonBase: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 16
  },
  buttonActive: {
    backgroundColor: '#002366'
  },
  buttonDisabled: {
    backgroundColor: '#D1D5DB'
  },
  gradeCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    width: '48%'
  },
  gradeCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#002366'
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 9999,
    height: 56,
    justifyContent: 'center',
    marginBottom: 12,
    width: 56
  },
  iconContainerSelected: {
    backgroundColor: '#002366'
  },
  gradeLabel: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4
  },
  gradeLabelSelected: {
    color: '#002366'
  },
});

export default function GradeSelectionScreen() {
  const router = useRouter();
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectGrade = async (grade: Grade) => {
    setSelectedGrade(grade);
  };

  const handleContinue = async () => {
    if (!selectedGrade) return;
    
    setIsLoading(true);
    try {
      const language = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      
      const preferences: UserPreferences = {
        language: language || 'pulaar',
        grade: selectedGrade
      };
      
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
      
      router.replace("/(auth)/login" as any);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      router.replace("/(auth)/login" as any);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push("/(auth)/language-selection" as any);
  };

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6}>
      <View style={styles.flex1_px6_pt4}>
        <View style={styles.flexrow_itemscenter_mb8}>
          <Pressable onPress={handleBack} style={styles.p2_ml2}>
            <Feather name="arrow-left" size={24} color="#1F2937" />
          </Pressable>
          <View style={styles.flex1_itemscenter_mr10}>
            <Text style={styles.textxl_fontbold_textgray900}>Ton niveau</Text>
          </View>
        </View>

        <Text style={styles.text3xl_fontbold_textgray900_m}>
          Quelle est ta classe ?
        </Text>
        <Text style={styles.textgray500_textbase_mb8_textc}>
          Choisis ton année scolaire pour adapter les contenus
        </Text>

        <View style={styles.flex1}>
          <View style={styles.flexrow_flexwrap_justifybetwee}>
            {GRADES.map((grade, index) => (
              <GradeCard
                key={grade.value}
                grade={grade}
                isSelected={selectedGrade === grade.value}
                onPress={() => handleSelectGrade(grade.value)}
                style={{ marginBottom: 16 }}
              />
            ))}
          </View>
        </View>

        <View style={styles.mb6}>
          <Pressable
            onPress={handleContinue}
            disabled={!selectedGrade || isLoading}
            style={[
              styles.buttonBase,
              (selectedGrade && !isLoading) ? styles.buttonActive : styles.buttonDisabled
            ]}
          >
            <Text style={styles.textwhite_fontbold_textlg}>
              {isLoading ? 'Chargement...' : 'Continuer'}
            </Text>
          </Pressable>
          
          {selectedGrade && (
            <Text style={styles.textcenter_textgray500_textsm_}>
              Tu as choisi : {GRADES.find(g => g.value === selectedGrade)?.label}
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

interface GradeCardProps {
  grade: GradeOption;
  isSelected: boolean;
  onPress: () => void;
  style?: any;
}

function GradeCard({ grade, isSelected, onPress, style }: GradeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.gradeCard,
        isSelected && styles.gradeCardSelected,
        {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isSelected ? 0.1 : 0.05,
          shadowRadius: 4,
          elevation: isSelected ? 4 : 2,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          isSelected && styles.iconContainerSelected
        ]}
      >
        <Feather
          name={grade.icon as any}
          size={28}
          color={isSelected ? '#FFFFFF' : '#6B7280'}
        />
      </View>
      <Text
        style={[
          styles.gradeLabel,
          isSelected && styles.gradeLabelSelected
        ]}
      >
        {grade.label}
      </Text>
      <Text style={styles.textxs_textgray500_textcenter}>
        {grade.description}
      </Text>
      {isSelected && (
        <View style={styles.absolute_top2_right2_w6_h6_rou}>
          <Feather name="check" size={14} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}
