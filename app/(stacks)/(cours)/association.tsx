import { AntDesign, Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";

interface MatchItem {
  id: number;
  word?: string;
  translation: string;
}

const MATCH_ITEMS: MatchItem[] = [
  { id: 1, word: "Juumo", translation: "Maison" },
  { id: 2, word: "Kombo", translation: "Chat" },
  { id: 3, word: "Bapp", translation: "Père" },
  { id: 4, word: "Nde", translation: "Mère" },
  { id: 5, word: "Bii", translation: "Eau" },
  { id: 6, word: "Lo", translation: "Chien" },
];

export default function AssociationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moduleId?: string; moduleTitle?: string; courseId?: string }>();
  const [selectedWord, setSelectedWord] = useState<MatchItem | null>(null);
  const [selectedTranslation, setSelectedTranslation] = useState<MatchItem | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const handleContinue = () => {
    const resultParams = `?activity=Association&score=${score}&total=${totalPairs}&xp=${score * 20}&moduleId=${params.moduleId || ''}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Exercice')}&courseId=${params.courseId || ''}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ''}`)}`;
    router.push(`/(stacks)/(cours)/result${resultParams}` as any);
  };

  const shuffledTranslations = [...MATCH_ITEMS].sort(() => Math.random() - 0.5);
  const totalPairs = MATCH_ITEMS.length;
  const progress = (matched.length / totalPairs) * 100;

  const handleWordSelect = (item: MatchItem) => {
    if (matched.includes(item.id)) return;
    setSelectedWord(item);
    checkMatch(item);
  };

  const handleTranslationSelect = (item: MatchItem) => {
    if (matched.includes(item.id)) return;
    setSelectedTranslation(item);
    checkMatch(item);
  };

  const checkMatch = (item: MatchItem) => {
    if (!selectedWord && !selectedTranslation) return;

    const word = selectedWord || item;
    const translation = selectedTranslation || item;

    if (word.id === translation.id) {
      setMatched(prev => [...prev, word.id]);
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
          {MATCH_ITEMS.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleWordSelect(item)}
              disabled={matched.includes(item.id)}
              className={`w-[48%] rounded-2xl p-4 mb-3 border-2 ${
                matched.includes(item.id) 
                  ? 'bg-green-100 border-green-500' 
                  : selectedWord?.id === item.id 
                    ? 'bg-blue-100 border-[#4a90e2]' 
                    : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-center font-bold text-lg ${
                matched.includes(item.id) ? 'text-green-700' : 'text-gray-900'
              }`}>
                {item.word}
              </Text>
              {matched.includes(item.id) && (
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
          {shuffledTranslations.map((item) => (
            <Pressable
              key={`trans-${item.id}`}
              onPress={() => handleTranslationSelect(item)}
              disabled={matched.includes(item.id)}
              className={`w-[48%] rounded-2xl p-4 mb-3 border-2 ${
                matched.includes(item.id) 
                  ? 'bg-green-100 border-green-500' 
                  : selectedTranslation?.id === item.id 
                    ? 'bg-blue-100 border-[#4a90e2]' 
                    : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-center font-medium ${
                matched.includes(item.id) ? 'text-green-700' : 'text-gray-700'
              }`}>
                {item.translation}
              </Text>
            </Pressable>
          ))}
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
