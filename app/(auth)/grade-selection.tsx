import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]">
      <View className="flex-1 px-6 pt-4">
        <View className="flex-row items-center mb-8">
          <Pressable onPress={handleBack} className="p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="#1F2937" />
          </Pressable>
          <View className="flex-1 items-center mr-10">
            <Text className="text-xl font-bold text-gray-900">Ton niveau</Text>
          </View>
        </View>

        <Text className="text-3xl font-bold text-gray-900 mb-2 text-center">
          Quelle est ta classe ?
        </Text>
        <Text className="text-gray-500 text-base mb-8 text-center">
          Choisis ton année scolaire pour adapter les contenus
        </Text>

        <View className="flex-1">
          <View className="flex-row flex-wrap justify-between">
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

        <View className="mb-6">
          <Pressable
            onPress={handleContinue}
            disabled={!selectedGrade || isLoading}
            className={`rounded-2xl py-4 items-center ${
              selectedGrade && !isLoading ? 'bg-[#002366]' : 'bg-gray-300'
            }`}
          >
            <Text className="text-white font-bold text-lg">
              {isLoading ? 'Chargement...' : 'Continuer'}
            </Text>
          </Pressable>
          
          {selectedGrade && (
            <Text className="text-center text-gray-500 text-sm mt-3">
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
      className={`w-[48%] rounded-2xl p-5 items-center border-2 ${
        isSelected ? 'border-[#002366] bg-blue-50' : 'border-gray-200 bg-white'
      }`}
      style={[
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
        className={`w-14 h-14 rounded-full items-center justify-center mb-3 ${
          isSelected ? 'bg-[#002366]' : 'bg-gray-100'
        }`}
      >
        <Feather
          name={grade.icon as any}
          size={28}
          color={isSelected ? '#FFFFFF' : '#6B7280'}
        />
      </View>
      <Text
        className={`text-base font-bold mb-1 ${
          isSelected ? 'text-[#002366]' : 'text-gray-900'
        }`}
      >
        {grade.label}
      </Text>
      <Text className="text-xs text-gray-500 text-center">
        {grade.description}
      </Text>
      {isSelected && (
        <View className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#002366] items-center justify-center">
          <Feather name="check" size={14} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}
