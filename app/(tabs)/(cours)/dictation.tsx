import { AntDesign, Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

interface DictationWord {
  id: number;
  word: string;
  hint: string;
}

const DICTATION_WORDS: DictationWord[] = [
  { id: 1, word: "Jaarama", hint: "Salutation (bonjour)" },
  { id: 2, word: "Baadi", hint: "Au revoir" },
  { id: 3, word: "Ndeyni", hint: "Merci" },
  { id: 4, word: "Min yaha", hint: "Comment vas-tu ?" },
  { id: 5, word: "Alhamdulilah", hint: "Praise to God" },
];

export default function DictationScreen() {
  const router = useRouter();
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<{ word: string; correct: boolean }[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<boolean | null>(null);

  const currentWord = DICTATION_WORDS[currentWordIndex];
  const progress = ((currentWordIndex + 1) / DICTATION_WORDS.length) * 100;

  const handlePlayAudio = () => {
    setIsPlaying(true);
    setTimeout(() => setIsPlaying(false), 2000);
  };

  const checkAnswer = () => {
    const isCorrect = userInput.toLowerCase().trim() === currentWord.word.toLowerCase();
    setCurrentAnswer(isCorrect);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setAnswers(prev => [...prev, { word: currentWord.word, correct: isCorrect }]);

    setTimeout(() => {
      if (currentWordIndex < DICTATION_WORDS.length - 1) {
        setCurrentWordIndex(prev => prev + 1);
        setUserInput("");
        setCurrentAnswer(null);
      } else {
        setShowResult(true);
      }
    }, 1500);
  };

  const getScoreEmoji = () => {
    const percentage = (score / DICTATION_WORDS.length) * 100;
    if (percentage === 100) return "🏆";
    if (percentage >= 80) return "🌟";
    if (percentage >= 60) return "👏";
    if (percentage >= 40) return "💪";
    return "📚";
  };

  if (showResult) {
    const percentage = Math.round((score / DICTATION_WORDS.length) * 100);
    
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
          <View className="flex-1 items-center justify-center px-5 py-10">
            <View className="bg-white rounded-3xl p-8 items-center shadow-lg w-full max-w-sm">
              <Text className="text-6xl mb-4">{getScoreEmoji()}</Text>
              <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
                {percentage >= 60 ? "Bravo !" : "Continue tes efforts !"}
              </Text>
              <Text className="text-gray-500 text-center mb-6">
                Tu as obtenu {score} bonnes réponses sur {DICTATION_WORDS.length}
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

              <View className="w-full mb-4">
                <Text className="font-bold text-gray-700 mb-3">Tes réponses :</Text>
                {answers.map((answer, index) => (
                  <View key={index} className="flex-row items-center py-2">
                    <View className={`w-6 h-6 rounded-full items-center justify-center mr-3 ${
                      answer.correct ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      <Feather 
                        name={answer.correct ? "check" : "x"} 
                        size={14} 
                        color={answer.correct ? "#10B981" : "#EF4444"} 
                      />
                    </View>
                    <Text className="text-gray-600 text-sm">{answer.word}</Text>
                  </View>
                ))}
              </View>

              <View className="flex-row w-full">
                <Pressable
                  onPress={() => router.back()}
                  className="flex-1 bg-gray-200 py-4 rounded-xl mr-2"
                >
                  <Text className="text-gray-700 font-bold text-center">Retour</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setCurrentWordIndex(0);
                    setScore(0);
                    setAnswers([]);
                    setUserInput("");
                    setShowResult(false);
                    setCurrentAnswer(null);
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
          <Text className="text-lg font-bold text-gray-900">Dictée audio</Text>
          <Text className="text-gray-500 text-xs">
            Mot {currentWordIndex + 1}/{DICTATION_WORDS.length}
          </Text>
        </View>
        <View className="bg-[#F59E0B] px-3 py-1 rounded-full">
          <Text className="text-white font-bold text-sm">{score} pts</Text>
        </View>
      </View>

      <View className="px-5 mb-4">
        <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <View 
            className="h-full bg-[#F59E0B] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        
        <View 
          className="bg-white rounded-3xl p-6 mb-6 border border-gray-200"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text className="text-gray-500 text-center mb-4">Écoute le mot et écris-le</Text>
          
          <View className="flex-row items-center justify-center h-16 mb-4">
            {[...Array(18)].map((_, i) => (
              <View 
                key={i}
                className={`w-1 mx-[2px] rounded-full ${isPlaying ? 'bg-[#F59E0B]' : 'bg-gray-300'}`}
                style={{ height: isPlaying ? Math.floor(Math.random() * 32 + 12) : 12 }}
              />
            ))}
          </View>

          <Pressable 
            onPress={handlePlayAudio}
            className="w-16 h-16 rounded-full bg-[#F59E0B] items-center justify-center mx-auto"
          >
            <Feather name={isPlaying ? "pause" : "volume-2"} size={24} color="white" />
          </Pressable>
          
          <Text className="text-center text-gray-600 text-sm mt-4 italic">
            Indice : {currentWord.hint}
          </Text>
        </View>

        <Text className="text-lg font-bold text-gray-900 mb-4 text-center">
          Écris le mot que tu as entendu
        </Text>

        <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-200">
          <TextInput
            value={userInput}
            onChangeText={setUserInput}
            placeholder="Écris ici..."
            placeholderTextColor="#9CA3AF"
            className="text-gray-900 text-lg font-medium text-center"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {currentAnswer !== null && (
          <View className={`rounded-xl p-4 mb-4 ${
            currentAnswer ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <View className="flex-row items-center">
              <Feather 
                name={currentAnswer ? "check-circle" : "x-circle"} 
                size={24} 
                color={currentAnswer ? "#10B981" : "#EF4444"} 
              />
              <Text className={`ml-3 font-bold ${
                currentAnswer ? 'text-green-700' : 'text-red-700'
              }`}>
                {currentAnswer ? "Correct !" : `La bonne réponse était : ${currentWord.word}`}
              </Text>
            </View>
          </View>
        )}

        <Pressable
          onPress={checkAnswer}
          disabled={!userInput.trim() || currentAnswer !== null}
          className={`rounded-2xl py-4 items-center ${
            userInput.trim() && currentAnswer === null 
              ? 'bg-[#002366]' 
              : 'bg-gray-300'
          }`}
        >
          <Text className="text-white font-bold text-lg">Vérifier</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
