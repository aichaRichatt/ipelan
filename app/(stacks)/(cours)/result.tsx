import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    activity?: string;
    score?: string;
    total?: string;
    xp?: string;
    moduleId?: string;
    moduleTitle?: string;
    courseId?: string;
    returnRoute?: string;
  }>();
  
  const score = parseInt(params.score || "0", 10);
  const total = parseInt(params.total || "1", 10);
  const xp = parseInt(params.xp || "0", 10);
  const coins = Math.round(xp / 5);
  
  const percentage = Math.round((score / Math.max(total, 1)) * 100);
  
  const getGrade = () => {
    if (percentage >= 90) return { text: "Excellent !", color: "#10B981" };
    if (percentage >= 70) return { text: "Bien joué !", color: "#4a90e2" };
    if (percentage >= 50) return { text: "Continue !", color: "#F59E0B" };
    return { text: "Persévère !", color: "#EF4444" };
  };
  
  const grade = getGrade();
  
  const decodedReturnRoute = params.returnRoute ? decodeURIComponent(params.returnRoute) : `/(stacks)/(cours)/${params.courseId || ''}`;
  const decodedModuleTitle = params.moduleTitle ? decodeURIComponent(params.moduleTitle) : "Exercice";

  const handleContinue = () => {
    if (decodedReturnRoute.startsWith("/(")) {
      router.push(decodedReturnRoute as any);
    } else {
      router.push(`/(stacks)/(cours)/${params.courseId || ''}` as any);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">Résultats</Text>
      </View>
      
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
            
            <Text className="text-gray-500 text-center mb-2">
              {params.activity || "Activité"}
            </Text>
            <Text className="text-gray-500 text-center mb-6">
              {score} bonnes réponses sur {total}
            </Text>

            <View className="flex-row w-full justify-center mb-6">
              <View className="bg-purple-100 rounded-2xl px-6 py-3 mr-3 flex-row items-center">
                <Text className="text-2xl mr-2">⭐</Text>
                <Text className="text-purple-700 font-bold text-lg">+{xp} XP</Text>
              </View>
              <View className="bg-yellow-100 rounded-2xl px-6 py-3 flex-row items-center">
                <Text className="text-2xl mr-2">🪙</Text>
                <Text className="text-yellow-700 font-bold text-lg">+{coins}</Text>
              </View>
            </View>

            {percentage >= 70 && (
              <View className="bg-gradient-to-r from-[#002366] to-[#4a90e2] rounded-2xl p-6 w-full mb-6 items-center">
                <Text className="text-white text-sm font-medium mb-2">Nouveau badge débloqué !</Text>
                <Text className="text-5xl mb-2">🏆</Text>
                <Text className="text-white font-bold text-lg">Quiz Master</Text>
              </View>
            )}

            <View className="flex-row w-full">
              <Pressable
                onPress={() => router.back()}
                className="flex-1 bg-gray-200 py-4 rounded-xl mr-2"
              >
                <Text className="text-gray-700 font-bold text-center">Rejouer</Text>
              </Pressable>
              <Pressable
                onPress={handleContinue}
                className="flex-1 bg-[#002366] py-4 rounded-xl ml-2"
              >
                <Text className="text-white font-bold text-center">Continuer</Text>
              </Pressable>
            </View>
            
            <Pressable
              onPress={() => router.push(`/(stacks)/(cours)/${params.courseId || ''}` as any)}
              className="mt-4 py-2"
            >
              <Text className="text-gray-500 text-center">Retour au module</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
