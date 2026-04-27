import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, Text, View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "@/services/redux/store";
import { useActivityContent, WordOrderData } from "@/hooks/useActivityContent";
import { shuffle } from "@/utils/shuffle";

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moduleId?: string; moduleTitle?: string; courseId?: string; cmid?: string; instanceId?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const cmid = parseInt(params.cmid || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);
  
  const { wordOrder: wordOrderData, isLoading, error } = useActivityContent(
    token || '',
    moduleId,
    instanceId,
    'lesson',
    cmid || instanceId,
    courseId,
    params.moduleTitle
  );
  
  const sentences = wordOrderData?.sentences?.length ? wordOrderData.sentences : [];
  
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [placedWords, setPlacedWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const sentence = sentences[currentSentenceIndex] || { words: [], translation: "" };

  const handleContinue = () => {
    const instanceId = params.instanceId || params.moduleId || '0';
    const resultParams = `?activity=Ordre+des+mots&score=${score}&total=${sentences.length}&xp=${score * 25}&moduleId=${params.moduleId || ''}&instanceId=${instanceId}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Exercice')}&courseId=${params.courseId || ''}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ''}`)}`;
    router.push(`/(stacks)/(cours)/result${resultParams}` as any);
  };

  React.useEffect(() => {
    initSentence();
  }, [currentSentenceIndex]);

  const initSentence = () => {
    const shuffled = shuffle(sentence.words);
    setAvailableWords(shuffled);
    setPlacedWords([]);
    setWrongAttempts(0);
    setShowAnswer(false);
  };

  const handlePlaceWord = (word: string) => {
    if (placedWords.length >= sentence.words.length) return;
    setPlacedWords([...placedWords, word]);
    setAvailableWords(availableWords.filter(w => w !== word));
  };

  const handleRemoveWord = (index: number) => {
    const word = placedWords[index];
    setPlacedWords(placedWords.filter((_, i) => i !== index));
    setAvailableWords([...availableWords, word]);
  };

  const checkOrder = () => {
    const correct = placedWords.join(' ') === sentence.words.join(' ');
    
    if (correct) {
      setScore(score + 1);
      setTimeout(() => {
        if (currentSentenceIndex < sentences.length - 1) {
          setCurrentSentenceIndex(currentSentenceIndex + 1);
          initSentence();
        } else {
          setShowResult(true);
        }
      }, 1500);
    } else {
      const newAttempts = wrongAttempts + 1;
      setWrongAttempts(newAttempts);
      if (newAttempts >= 3) {
        setShowAnswer(true);
      }
      setTimeout(() => {
        setPlacedWords([]);
        setAvailableWords(shuffle([...availableWords, ...placedWords]));
      }, 1000);
    }
  };

  const getScoreEmoji = () => {
    const percentage = (score / sentences.length) * 100;
    if (percentage === 100) return "🏆";
    if (percentage >= 66) return "🌟";
    return "👏";
  };

  if (showResult) {
    const percentage = Math.round((score / sentences.length) * 100);
    
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
          <View className="flex-1 items-center justify-center px-5 py-10">
            <View className="bg-white rounded-3xl p-8 items-center shadow-lg w-full max-w-sm">
              <Text className="text-6xl mb-4">{getScoreEmoji()}</Text>
              <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
                {percentage >= 66 ? "Bravo !" : "Continue tes efforts !"}
              </Text>
              <Text className="text-gray-500 text-center mb-6">
                Tu as complété {score} phrases sur {sentences.length}
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
                <Text className="text-yellow-700 font-bold text-lg">+{score * 25} XP gagnés</Text>
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
                    setCurrentSentenceIndex(0);
                    setScore(0);
                    setShowResult(false);
                    initSentence();
                  }}
                  className="flex-1 bg-[#4a90e2] py-4 rounded-xl ml-2"
                >
                  <Text className="text-white font-bold text-center">Rejouer</Text>
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
          <Text className="text-lg font-bold text-gray-900">Ordre des mots</Text>
          <Text className="text-gray-500 text-xs">
            Phrase {currentSentenceIndex + 1}/{sentences.length}
          </Text>
        </View>
        <View className="bg-[#A78BFA] px-3 py-1 rounded-full">
          <Text className="text-white font-bold text-sm">{score} pts</Text>
        </View>
      </View>

      <View className="px-5 mb-4">
        <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <View 
            className="h-full bg-[#A78BFA] rounded-full"
            style={{ width: `${((currentSentenceIndex + 1) / sentences.length) * 100}%` }}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        
        <View className="bg-white rounded-2xl p-4 mb-6 border border-gray-200">
          <Text className="text-gray-500 text-sm mb-2">Remets les mots dans le bon ordre :</Text>
          <Text className="text-gray-700 font-medium italic">{sentence.translation}</Text>
        </View>

        <View className="mb-6">
          <Text className="text-sm font-bold text-gray-900 mb-3">Zone de réponse</Text>
          <View className="bg-[#A78BFA]/10 border-2 border-dashed border-[#A78BFA] rounded-2xl p-4 min-h-[120px]">
            {placedWords.length === 0 ? (
              <View className="flex-1 items-center justify-center py-8">
                <Text className="text-gray-400 text-sm">Place les mots ici</Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap">
                {placedWords.map((word, index) => (
                  <Pressable
                    key={`placed-${index}`}
                    onPress={() => handleRemoveWord(index)}
                    className={`px-4 py-3 rounded-xl mr-2 mb-2 ${
                      showAnswer && word === sentence.words[index] 
                        ? 'bg-green-500' 
                        : showAnswer && word !== sentence.words[index]
                          ? 'bg-red-500'
                          : 'bg-[#A78BFA]'
                    }`}
                  >
                    <Text className="text-white font-bold">{word}</Text>
                  </Pressable>
                ))}
                {Array.from({ length: sentence.words.length - placedWords.length }).map((_, index) => (
                  <View 
                    key={`slot-${index}`}
                    className="w-16 h-12 border-2 border-dashed border-gray-300 rounded-xl mr-2 mb-2 items-center justify-center"
                  >
                    <Text className="text-gray-300 text-xs">{placedWords.length + index + 1}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View className="mb-6">
          <Text className="text-sm font-bold text-gray-900 mb-3">Mots disponibles</Text>
          <View className="flex-row flex-wrap">
            {availableWords.map((word, index) => (
              <Pressable
                key={`avail-${index}`}
                onPress={() => handlePlaceWord(word)}
                className="bg-white border-2 border-gray-200 rounded-xl px-4 py-3 mr-2 mb-2"
              >
                <Text className="text-gray-900 font-bold">{word}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {showAnswer && (
          <View className="bg-green-50 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center mb-2">
              <Feather name="check-circle" size={20} color="#10B981" />
              <Text className="text-green-700 font-bold ml-2">La bonne réponse :</Text>
            </View>
            <Text className="text-green-800 font-medium">{sentence.words.join(' ')}</Text>
          </View>
        )}

        <View className="mt-4">
          {wrongAttempts >= 3 && !showAnswer ? (
            <Pressable
              onPress={() => setShowAnswer(true)}
              className="bg-gray-500 rounded-2xl py-4 items-center"
            >
              <Text className="text-white font-bold text-lg">Voir la réponse</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={checkOrder}
              disabled={placedWords.length !== sentence.words.length}
              className={`rounded-2xl py-4 items-center ${
                placedWords.length === sentence.words.length 
                  ? 'bg-[#A78BFA]' 
                  : 'bg-gray-300'
              }`}
            >
              <Text className="text-white font-bold text-lg">Valider</Text>
            </Pressable>
          )}
        </View>

        <View className="mt-4 bg-yellow-50 rounded-2xl p-4">
          <View className="flex-row items-center justify-center">
            <Feather name="info" size={18} color="#F59E0B" />
            <Text className="text-yellow-700 ml-2 text-center">
              Clique sur un mot pour le placer. Clique sur un mot placé pour le retirer.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
