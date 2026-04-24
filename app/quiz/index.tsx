import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import useQuiz from "@/hooks/useQuiz";
import { RootState } from "@/services/redux/store";

interface QuizQuestion {
  id: number;
  type: "text-mcq" | "audio-mcq";
  question: string;
  audioUrl?: string;
  options: { value: string; label: string; inputName: string }[];
  correctIndex: number;
}

export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moduleId?: string; moduleTitle?: string; courseId?: string; instanceId?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const moduleId = parseInt(params.moduleId || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  
  console.log('[Quiz] Route loaded - moduleId:', moduleId, 'courseId:', courseId, 'instanceId:', instanceId);

  const {
    questions,
    isLoading,
    error,
    currentQuestion,
    currentIndex,
    totalQuestions,
    selectedAnswer,
    setSelectedAnswer,
    nextQuestion,
    prevQuestion,
    submitAnswer,
    isLastQuestion,
    score,
    isComplete,
    resetQuiz,
  } = useQuiz(token || "", moduleId, courseId, instanceId);

  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSelect = (index: number) => {
    if (showFeedback) return;
    setSelectedAnswer(index);
  };

  const handleSubmit = () => {
    if (selectedAnswer === null) return;
    
    const correct = selectedAnswer === currentQuestion?.correctIndex;
    setIsCorrect(correct);
    setShowFeedback(true);
    
    submitAnswer();
  };

  const handleNext = () => {
    setShowFeedback(false);
    setSelectedAnswer(null);
    
    if (isLastQuestion) {
      return;
    }
    nextQuestion();
  };

  const handleFinish = () => {
    router.back();
  };

  const getOptionStyle = (index: number) => {
    if (!showFeedback) {
      return selectedAnswer === index ? "border-[#002366] bg-[#002366]/10" : "border-gray-200";
    }
    
    if (index === currentQuestion?.correctIndex) {
      return "border-green-500 bg-green-50";
    }
    if (index === selectedAnswer && index !== currentQuestion?.correctIndex) {
      return "border-red-500 bg-red-50";
    }
    return "border-gray-200 opacity-50";
  };

  const getOptionTextStyle = (index: number) => {
    if (!showFeedback) {
      return selectedAnswer === index ? "text-[#002366] font-medium" : "text-gray-700";
    }
    
    if (index === currentQuestion?.correctIndex) {
      return "text-green-700 font-medium";
    }
    if (index === selectedAnswer && index !== currentQuestion?.correctIndex) {
      return "text-red-700 font-medium";
    }
    return "text-gray-500";
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#002366" />
          <Text className="mt-4 text-gray-500">Chargement du quiz...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isComplete) {
    const percentage = Math.round((score.correct / score.total) * 100);
    const xpEarned = score.correct * 10;
    
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-6">
            <Feather name="check-circle" size={48} color="#10B981" />
          </View>
          
          <Text className="text-2xl font-bold text-gray-900 mb-2">Quiz Terminé!</Text>
          
          <Text className="text-5xl font-bold text-[#002366] mb-2">
            {score.correct}/{score.total}
          </Text>
          <Text className="text-gray-500 mb-6">Bonnes réponses</Text>
          
          <View className="bg-white rounded-2xl p-6 w-full border border-gray-100 mb-6">
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-500">Score</Text>
              <Text className="text-gray-900 font-medium">{percentage}%</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-500">XP gagné</Text>
              <Text className="text-amber-600 font-medium">+{xpEarned} XP</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Temps</Text>
              <Text className="text-gray-900 font-medium">{score.timeSpent}s</Text>
            </View>
          </View>
          
          <Pressable
            onPress={() => router.back()}
            className="bg-[#002366] rounded-2xl py-4 w-full items-center"
          >
            <Text className="text-white font-bold text-lg">Retour au cours</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]">
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Aucune question disponible</Text>
          <Pressable onPress={() => router.back()} className="mt-4">
            <Text className="text-[#002366]">Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]">
      <View className="px-5 py-4 flex-row items-center border-b border-gray-200">
        <Pressable onPress={() => router.back()} className="mr-4">
          <Feather name="x" size={24} color="#6B7280" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
            {params.moduleTitle || "Quiz"}
          </Text>
        </View>
        <View className="bg-gray-100 px-3 py-1 rounded-full">
          <Text className="text-gray-600 text-sm">
            {currentIndex + 1}/{totalQuestions}
          </Text>
        </View>
      </View>

      <View className="px-5 py-4">
        <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <View
            className="h-full bg-[#002366] rounded-full"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <View className="bg-white rounded-2xl p-5 border border-gray-100">
            <Text className="text-lg text-gray-900 font-medium">
              {currentQuestion.question}
            </Text>
          </View>
        </View>

        <View className="space-y-3 mb-6">
          {currentQuestion.options.map((option, index) => (
            <Pressable
              key={index}
              onPress={() => handleSelect(index)}
              className={`p-4 rounded-xl border-2 ${getOptionStyle(index)}`}
            >
              <View className="flex-row items-center">
                <View className={`w-8 h-8 rounded-full border-2 items-center justify-center mr-3 ${
                  selectedAnswer === index ? "border-[#002366]" : "border-gray-300"
                }`}>
                  <Text className="text-gray-600 font-medium">
                    {String.fromCharCode(65 + index)}
                  </Text>
                </View>
                <Text className={`flex-1 text-base ${getOptionTextStyle(index)}`}>
                  {option.label}
                </Text>
                {showFeedback && index === currentQuestion.correctIndex && (
                  <Feather name="check" size={20} color="#10B981" />
                )}
                {showFeedback && index === selectedAnswer && index !== currentQuestion.correctIndex && (
                  <Feather name="x" size={20} color="#EF4444" />
                )}
              </View>
            </Pressable>
          ))}
        </View>

        {showFeedback && (
          <View className="bg-white rounded-xl p-4 mb-6 border border-gray-100">
            <View className="flex-row items-center mb-2">
              <Feather 
                name={isCorrect ? "check-circle" : "alert-circle"} 
                size={20} 
                color={isCorrect ? "#10B981" : "#EF4444"} 
                className="mr-2"
              />
              <Text className={`font-medium ${isCorrect ? "text-green-700" : "text-red-700"}`}>
                {isCorrect ? "Correct!" : "Incorrect"}
              </Text>
            </View>
            {!isCorrect && currentQuestion.explanation && (
              <Text className="text-gray-600 text-sm">{currentQuestion.explanation}</Text>
            )}
          </View>
        )}
      </ScrollView>

      <View className="px-5 py-4 border-t border-gray-200">
        {!showFeedback ? (
          <Pressable
            onPress={handleSubmit}
            disabled={selectedAnswer === null}
            className={`rounded-2xl py-4 items-center ${
              selectedAnswer !== null ? "bg-[#002366]" : "bg-gray-300"
            }`}
          >
            <Text className="text-white font-bold text-lg">Valider</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleNext}
            className="bg-[#002366] rounded-2xl py-4 items-center"
          >
            <Text className="text-white font-bold text-lg">
              {isLastQuestion ? "Voir les résultats" : "Question suivante"}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}