import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

interface ResultScreenProps {
  score: number;
  total: number;
  xpEarned: number;
  coinsEarned?: number;
  badgeUnlocked?: { name: string; emoji: string };
  activityName?: string;
}

const MOCK_RESULT: ResultScreenProps = {
  score: 8,
  total: 10,
  xpEarned: 80,
  coinsEarned: 15,
  badgeUnlocked: { name: "Quiz Master", emoji: "🏆" },
  activityName: "Quiz - Salutations",
};

export default function ResultScreen() {
  const router = useRouter();
  const result = MOCK_RESULT;
  
  const percentage = Math.round((result.score / result.total) * 100);
  
  const getGrade = () => {
    if (percentage >= 90) return { text: "Excellent !", color: "#10B981" };
    if (percentage >= 70) return { text: "Bien joué !", color: "#4a90e2" };
    if (percentage >= 50) return { text: "Continue !", color: "#F59E0B" };
    return { text: "Persévère !", color: "#EF4444" };
  };
  
  const grade = getGrade();

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
        <View className="flex-1 items-center justify-center px-5 py-10">
          <View className="bg-white rounded-3xl p-8 items-center shadow-lg w-full max-w-sm">
            <View 
              className="w-40 h-40 rounded-full items-center justify-center mb-6"
              style={{ 
                borderWidth: 8,
                borderColor: grade.color,
                backgroundColor: grade.color + '10'
              }}
            >
              <Text className="text-5xl font-black" style={{ color: grade.color }}>
                {percentage}%
              </Text>
            </View>

            <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
              {grade.text}
            </Text>
            
            <Text className="text-gray-500 text-center mb-6">
              {result.score} bonnes réponses sur {result.total}
            </Text>

            <View className="flex-row w-full justify-center mb-6">
              <View className="bg-purple-100 rounded-2xl px-6 py-3 mr-3 flex-row items-center">
                <Text className="text-2xl mr-2">⭐</Text>
                <Text className="text-purple-700 font-bold text-lg">+{result.xpEarned} XP</Text>
              </View>
              <View className="bg-yellow-100 rounded-2xl px-6 py-3 flex-row items-center">
                <Text className="text-2xl mr-2">🪙</Text>
                <Text className="text-yellow-700 font-bold text-lg">+{result.coinsEarned}</Text>
              </View>
            </View>

            {result.badgeUnlocked && (
              <View className="bg-gradient-to-r from-[#002366] to-[#4a90e2] rounded-2xl p-6 w-full mb-6 items-center">
                <Text className="text-white text-sm font-medium mb-2">Nouveau badge débloqué !</Text>
                <Text className="text-5xl mb-2">{result.badgeUnlocked.emoji}</Text>
                <Text className="text-white font-bold text-lg">{result.badgeUnlocked.name}</Text>
              </View>
            )}

            <View className="bg-gray-50 rounded-2xl p-4 w-full mb-6">
              <View className="flex-row items-center mb-2">
                <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                  <Feather name="smartphone" size={20} color="#4a90e2" />
                </View>
                <Text className="text-gray-900 font-bold">Feedback IA</Text>
              </View>
              <Text className="text-gray-600 text-sm leading-relaxed">
                {percentage >= 80 
                  ? "Excellent travail ! Tu maîtrises bien les salutations en Pulaar. Continue à pratiquer régulièrement pour progresser encore plus !"
                  : percentage >= 50
                    ? "Bon début ! Révise les mots de salutation et réessaie l'exercice pour améliorer ton score."
                    : "Ne te décourage pas ! Lis attentivement les leçons précédentes et réessaie. Tu vas progresser !"
                }
              </Text>
            </View>

            <View className="flex-row w-full">
              <Pressable
                onPress={() => router.back()}
                className="flex-1 bg-gray-200 py-4 rounded-xl mr-2"
              >
                <Text className="text-gray-700 font-bold text-center">Rejouer</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/(tabs)/(progress)")}
                className="flex-1 bg-[#002366] py-4 rounded-xl ml-2"
              >
                <Text className="text-white font-bold text-center">Continuer</Text>
              </Pressable>
            </View>
            
            <Pressable
              onPress={() => router.push("/(tabs)/(home)")}
              className="mt-4 py-2"
            >
              <Text className="text-gray-500 text-center">Retour au parcours</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
