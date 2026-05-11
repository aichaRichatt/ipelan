import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
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
  color: string;
  level: string;
}

const GRADES: GradeOption[] = [
  { value: 1, label: "1ère", description: "Découverte", icon: "book-open", color: '#10B981', level: 'debutant' },
  { value: 2, label: "2ème", description: "Fondations", icon: "book-open", color: '#10B981', level: 'debutant' },
  { value: 3, label: "3ème", description: "Progression", icon: "star", color: '#F59E0B', level: 'intermediaire' },
  { value: 4, label: "4ème", description: "Approfondissement", icon: "star", color: '#F59E0B', level: 'intermediaire' },
  { value: 5, label: "5ème", description: "Maîtrise", icon: "award", color: '#002366', level: 'avance' },
  { value: 6, label: "6ème", description: "Excellence", icon: "award", color: '#002366', level: 'avance' },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  progressStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressDotActive: {
    backgroundColor: '#002366',
  },
  progressDotInactive: {
    backgroundColor: '#E5E7EB',
  },
  progressLine: {
    width: 24,
    height: 2,
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: '#002366',
  },
  progressLineInactive: {
    backgroundColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginRight: 32,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  titleSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  gridContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 16,
  },
  buttonSection: {
    marginBottom: 24,
  },
  selectionContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  selectionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  selectionHighlight: {
    fontWeight: '600',
    color: '#002366',
  },
  continueButton: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 16,
  },
  continueButtonActive: {
    backgroundColor: '#002366',
  },
  continueButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  // Grade Card styles
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  cardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#002366',
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  levelBadgeDebutant: {
    backgroundColor: '#D1FAE5',
  },
  levelBadgeIntermediaire: {
    backgroundColor: '#FEF3C7',
  },
  levelBadgeAvance: {
    backgroundColor: '#DBEAFE',
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  levelBadgeTextDebutant: {
    color: '#047857',
  },
  levelBadgeTextIntermediaire: {
    color: '#B45309',
  },
  levelBadgeTextAvance: {
    color: '#1D4ED8',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  iconContainerDefault: {
    backgroundColor: '#F3F4F6',
  },
  iconContainerSelected: {
    backgroundColor: '#002366',
  },
  gradeLabel: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  gradeLabelDefault: {
    color: '#111827',
  },
  gradeLabelSelected: {
    color: '#002366',
  },
  gradeDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    backgroundColor: '#002366',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View key={index} style={styles.progressStepContainer}>
          <View
            style={[
              styles.progressDot,
              index < currentStep ? styles.progressDotActive : styles.progressDotInactive,
            ]}
          />
          {index < totalSteps - 1 && (
            <View
              style={[
                styles.progressLine,
                index < currentStep - 1 ? styles.progressLineActive : styles.progressLineInactive,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );
}

function LevelBadge({ level }: { level: GradeOption['level'] }) {
  const config: Record<string, { style: object; textStyle: object; label: string }> = {
    debutant: { style: styles.levelBadgeDebutant, textStyle: styles.levelBadgeTextDebutant, label: 'Débutant' },
    intermediaire: { style: styles.levelBadgeIntermediaire, textStyle: styles.levelBadgeTextIntermediaire, label: 'Intermédiaire' },
    avance: { style: styles.levelBadgeAvance, textStyle: styles.levelBadgeTextAvance, label: 'Avancé' },
  };
  const { style, textStyle, label } = config[level];
  return (
    <View style={[styles.levelBadge, style]}>
      <Text style={[styles.levelBadgeText, textStyle]}>{label}</Text>
    </View>
  );
}

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
      
      router.replace("/(tabs)/(home)" as any);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      router.replace("/(tabs)/(home)" as any);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push("/(auth)/language-selection" as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Progress Indicator */}
        <Animated.View entering={FadeInUp.duration(500)}>
          <ProgressIndicator currentStep={2} totalSteps={3} />
        </Animated.View>

        {/* Header */}
        <Animated.View 
          entering={FadeInUp.delay(100).duration(600)}
          style={styles.header}
        >
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#1F2937" />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Ton niveau</Text>
          </View>
        </Animated.View>

        {/* Title Section */}
        <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.titleSection}>
          <Text style={styles.title}>
            Quelle est ta classe ?
          </Text>
          <Text style={styles.subtitle}>
            Choisis ton année pour des contenus adaptés
          </Text>
        </Animated.View>

        {/* Grade Cards Grid */}
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            {GRADES.map((grade, index) => (
              <Animated.View
                key={grade.value}
                entering={FadeInDown.delay(300 + index * 80).duration(500)}
                style={styles.gridItem}
              >
                <GradeCard
                  grade={grade}
                  isSelected={selectedGrade === grade.value}
                  onPress={() => handleSelectGrade(grade.value)}
                />
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Continue Button */}
        <View style={styles.buttonSection}>
          <Animated.View entering={FadeInUp.delay(800).duration(600)}>
            {selectedGrade && (
              <View style={styles.selectionContainer}>
                <Text style={styles.selectionText}>
                  Tu as choisi : <Text style={styles.selectionHighlight}>
                    {GRADES.find(g => g.value === selectedGrade)?.label} année
                  </Text>
                </Text>
              </View>
            )}
            
            <Pressable
              onPress={handleContinue}
              disabled={!selectedGrade || isLoading}
              style={[
                styles.continueButton,
                (selectedGrade && !isLoading) ? styles.continueButtonActive : styles.continueButtonDisabled
              ]}
            >
              <Text style={styles.continueButtonText}>
                {isLoading ? 'Chargement...' : 'Continuer'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

interface GradeCardProps {
  grade: GradeOption;
  isSelected: boolean;
  onPress: () => void;
}

function GradeCard({ grade, isSelected, onPress }: GradeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isSelected ? 0.15 : 0.05,
          shadowRadius: isSelected ? 8 : 4,
          elevation: isSelected ? 6 : 2,
        },
      ]}
    >
      {/* Level Badge */}
      <LevelBadge level={grade.level} />
      
      {/* Icon Container */}
      <View 
        style={[
          styles.iconContainer,
          isSelected ? styles.iconContainerSelected : styles.iconContainerDefault
        ]}
      >
        <Feather
          name={grade.icon as any}
          size={26}
          color={isSelected ? '#FFFFFF' : grade.color}
        />
      </View>
      
      {/* Grade Label */}
      <Text 
        style={[
          styles.gradeLabel,
          isSelected ? styles.gradeLabelSelected : styles.gradeLabelDefault
        ]}
      >
        {grade.label} année
      </Text>
      
      {/* Description */}
      <Text style={styles.gradeDescription}>
        {grade.description}
      </Text>
      
      {/* Checkmark for selected */}
      {isSelected && (
        <View style={styles.checkmarkContainer}>
          <Feather name="check" size={14} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}
