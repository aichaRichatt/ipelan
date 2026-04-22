import { AntDesign, Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, Text, View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "@/services/redux/store";
import { useActivityContent, AssociationData, AssociationPair } from "@/hooks/useActivityContent";

export default function AssociationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moduleId?: string; moduleTitle?: string; courseId?: string; cmid?: string; instanceId?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const cmid = parseInt(params.cmid || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);
  
  const { association: associationData, isLoading, error } = useActivityContent(
    token || '',
    moduleId,
    instanceId,
    'lesson',
    cmid || instanceId,
    courseId
  );
  
  const [selectedWord, setSelectedWord] = useState<AssociationPair | null>(null);
  const [selectedTranslation, setSelectedTranslation] = useState<AssociationPair | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const matchItems = associationData?.pairs?.length ? associationData.pairs : [];
  const shuffledTranslations = [...matchItems].sort(() => Math.random() - 0.5);
  const totalPairs = matchItems.length;
  const progress = totalPairs > 0 ? (matched.length / totalPairs) * 100 : 0;

  const handleContinue = () => {
    const instanceId = params.instanceId || params.moduleId || '0';
    const resultParams = `?activity=Association&score=${score}&total=${totalPairs}&xp=${score * 20}&moduleId=${params.moduleId || ''}&instanceId=${instanceId}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Exercice')}&courseId=${params.courseId || ''}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ''}`)}`;
    router.push(`/(stacks)/(cours)/result${resultParams}` as any);
  };

  const handleWordSelect = (item: AssociationPair, index: number) => {
    if (matched.includes(index)) return;
    setSelectedWord(item);
    checkMatch(item, index);
  };

  const handleTranslationSelect = (item: AssociationPair, index: number) => {
    if (matched.includes(index)) return;
    setSelectedTranslation(item);
    checkMatch(item, index);
  };

  const checkMatch = (item: AssociationPair, index: number) => {
    if (!selectedWord && !selectedTranslation) return;

    const word = selectedWord || item;
    const translation = selectedTranslation || item;

    if (word.word === translation.translation || word.translation === translation.word) {
      setMatched(prev => [...prev, index]);
      setScore(prev => prev + 1);
      
      if (matched.length + 1 === totalPairs) {
        setTimeout(() => setShowResult(true), 500);
      }
    } else {
      setAttempts(prev => prev + 1);
    }

    setSelectedWord(null);
    setSelectedTranslation(null);
  };

  const getScoreEmoji = () => {
    const percentage = (score / totalPairs) * 100;
    if (percentage === 100) return "🏆";
    if (percentage >= 80) return "🌟";
    if (percentage >= 60) return "👏";
    if (percentage >= 40) return "💪";
    return "📚";
  };

  if (showResult) {
    const percentage = Math.round((score / totalPairs) * 100);
    
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
          <View className="flex-1 items-center justify-center px-5 py-10">
            <View className="bg-white rounded-3xl p-8 items-center shadow-lg w-full max-w-sm">
              <Text className="text-6xl mb-4">{getScoreEmoji()}</Text>
              <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
                {percentage >= 60 ? "Excellent !" : "Bien joué !"}
              </Text>
              <Text className="text-gray-500 text-center mb-6">
                Tu as associé {score} paires correctement
              </Text>
              
              <View className="w-32 h-32 rounded-full border-8 mb-6 items-center justify-center"
                style={{ 
                  borderColor: percentage >= 60 ? '#10B981' : '#EF4444',
                  backgroundColor: `${percentage >= 60 ? '#10B981' : '#EF4444'}10`
                }}
              >
                <Text className="text-4xl font-black" style={{ color: percentage >= 60 ? '#10B981' : '#EF4444' }}>
                  {percentage}%
                </Text>
              </View>

              <View className="bg-yellow-50 rounded-xl px-6 py-3 mb-6 flex-row items-center">
                <Text className="text-xl mr-2">⭐</Text>
                <Text className="text-yellow-700 font-bold text-lg">+{score * 20} XP gagnés</Text>
              </View>

              <View className="flex-row w-full">
                <Pressable
                  onPress={handleContinue}
                  className="flex-1 bg-gray-200 py-4 rounded-xl mr-2"
                >
                  <Text className="text-gray-700 font-bold text-center">Continuer</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setSelectedWord(null);
                    setSelectedTranslation(null);
                    setMatched([]);
                    setScore(0);
                    setAttempts(0);
                    setShowResult(false);
                  }}
                  className="flex-1 bg-[#4a90e2] py-4 rounded-xl ml-2"
                >
                  <Text className="text-white font-bold text-center">Recommencer</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">Association de mots</Text>
          <Text className="text-gray-500 text-xs">
            Trouve les paires
          </Text>
        </View>
        <View className="bg-[#F59E0B] px-3 py-1 rounded-full">
          <Text className="text-white font-bold text-sm">{matched.length}/{totalPairs}</Text>
        </View>
      </View>

      <View className="px-5 mb-4">
        <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <View 
            className="h-full bg-[#10B981] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        
        <Text className="text-center text-gray-600 mb-6">
          Associe chaque mot Pulaar à sa traduction française
        </Text>

        <View className="flex-row flex-wrap justify-between">
          {matchItems.map((item, idx) => (
            <Pressable
              key={`word-${idx}`}
              onPress={() => handleWordSelect(item, idx)}
              disabled={matched.includes(idx)}
              className={`w-[48%] rounded-2xl p-4 mb-3 border-2 ${
                matched.includes(idx) 
                  ? 'bg-green-100 border-green-500' 
                  : selectedWord?.word === item.word 
                    ? 'bg-blue-100 border-[#4a90e2]' 
                    : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-center font-bold text-lg ${
                matched.includes(idx) ? 'text-green-700' : 'text-gray-900'
              }`}>
                {item.word}
              </Text>
              {matched.includes(idx) && (
                <View className="absolute top-1 right-1">
                  <AntDesign name="check-circle" size={16} color="#10B981" />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        <View className="h-px bg-gray-300 my-6" />

        <Text className="text-center text-gray-600 mb-4">
          Traductions françaises
        </Text>

        <View className="flex-row flex-wrap justify-between">
          {shuffledTranslations.map((item, idx) => {
            const originalIndex = matchItems.findIndex(m => m.translation === item.translation || m.word === item.word);
            return (
            <Pressable
              key={`trans-${idx}`}
              onPress={() => handleTranslationSelect(item, originalIndex)}
              disabled={matched.includes(originalIndex)}
              className={`w-[48%] rounded-2xl p-4 mb-3 border-2 ${
                matched.includes(originalIndex) 
                  ? 'bg-green-100 border-green-500' 
                  : selectedTranslation?.translation === item.translation 
                    ? 'bg-blue-100 border-[#4a90e2]' 
                    : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-center font-medium ${
                matched.includes(originalIndex) ? 'text-green-700' : 'text-gray-700'
              }`}>
                {item.translation}
              </Text>
            </Pressable>
          );})}
        </View>

        <View className="mt-6 bg-yellow-50 rounded-2xl p-4">
          <View className="flex-row items-center justify-center">
            <Feather name="info" size={18} color="#F59E0B" />
            <Text className="text-yellow-700 ml-2 text-center">
              Sélectionne un mot Pulaar, puis sa traduction
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
