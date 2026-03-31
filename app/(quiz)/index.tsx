import { AntDesign, Feather } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

interface QuizQuestion {
  id: number;
  type: "text-mcq" | "audio-mcq";
  question: string;
  audioUrl?: string;
  options: string[];
  correctIndex: number;
}

const QUIZ_DATA: QuizQuestion[] = [
  {
    id: 1,
    type: "text-mcq",
    question: "Comment dit-on 'Bonjour' en Pulaar ?",
    options: ["Jaarama", "Baadi", "Min yaha", "Hol ko"],
    correctIndex: 0,
  },
  {
    id: 2,
    type: "audio-mcq",
    question: "Écoute et choisis la bonne réponse :",
    audioUrl: "salutation_1.mp3",
    options: ["Merci", "Au revoir", "Comment va tu ?", "Je m'appelle"],
    correctIndex: 0,
  },
  {
    id: 3,
    type: "text-mcq",
    question: "Que signifie 'Baadi' ?",
    options: ["Bonjour", "Au revoir", "Merci", "Comment ça va"],
    correctIndex: 1,
  },
  {
    id: 4,
    type: "text-mcq",
    question: "Comment dit-on 'Merci' en Pulaar ?",
    options: ["Jaarama", "Baadi", "Min yaha", "Ndeyni"],
    correctIndex: 2,
  },
  {
    id: 5,
    type: "audio-mcq",
    question: "Quelle est la bonne traduction ?",
    audioUrl: "salutation_2.mp3",
    options: ["Je vais bien", "Au revoir", "Merci beaucoup", "Comment vas-tu"],
    correctIndex: 1,
  },
];

export default function QuizScreen() {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const question = QUIZ_DATA[currentQuestion];
  const progress = ((currentQuestion + 1) / QUIZ_DATA.length) * 100;

  const handlePlayAudio = () => {
    setIsPlaying(true);
    setTimeout(() => setIsPlaying(false), 2000);
  };

  const handleSelectAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    setAnswers(prev => [...prev, index]);
    
    const isCorrect = index === question.correctIndex;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    
    setShowFeedback(true);
  };

  const handleNext = () => {
    if (currentQuestion < QUIZ_DATA.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      setShowResult(true);
    }
  };

  const getScoreEmoji = () => {
    const percentage = (score / QUIZ_DATA.length) * 100;
    if (percentage === 100) return "🏆";
    if (percentage >= 80) return "🌟";
    if (percentage >= 60) return "👏";
    if (percentage >= 40) return "💪";
    return "📚";
  };

  const getScoreMessage = () => {
    const percentage = (score / QUIZ_DATA.length) * 100;
    if (percentage === 100) return "Parfait ! Tu es un champion !";
    if (percentage >= 80) return "Excellent travail !";
    if (percentage >= 60) return "Bien joué, continue comme ça !";
    if (percentage >= 40) return "Pas mal, persevere !";
    return "Ne lâche pas, tu vas progresser !";
  };

  if (showResult) {
    const percentage = Math.round((score / QUIZ_DATA.length) * 100);
    
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
          <View className="flex-1 items-center justify-center px-5 py-10">
            <View className="bg-white rounded-3xl p-8 items-center shadow-lg w-full max-w-sm">
              <Text className="text-6xl mb-4">{getScoreEmoji()}</Text>
              <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
                {getScoreMessage()}
              </Text>
              <Text className="text-gray-500 text-center mb-6">
                Tu as obtenu {score} bonnes réponses sur {QUIZ_DATA.length}
              </Text>
              
              {/* Score Circle */}
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

              {/* XP Earned */}
              <View className="bg-yellow-50 rounded-xl px-6 py-3 mb-6 flex-row items-center">
                <Text className="text-xl mr-2">⭐</Text>
                <Text className="text-yellow-700 font-bold text-lg">+{score * 20} XP gagnés</Text>
              </View>

              {/* Answer Review */}
              <View className="w-full mb-6">
                <Text className="font-bold text-gray-700 mb-3">Tes réponses :</Text>
                {QUIZ_DATA.map((q, i) => {
                  const userAnswer = answers[i];
                  const isCorrect = userAnswer === q.correctIndex;
                  return (
                    <View key={q.id} className="flex-row items-center py-2">
                      <View className={`w-6 h-6 rounded-full items-center justify-center mr-3 ${
                        isCorrect ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        <Feather 
                          name={isCorrect ? "check" : "x"} 
                          size={14} 
                          color={isCorrect ? "#10B981" : "#EF4444"} 
                        />
                      </View>
                      <Text className="text-gray-600 text-sm flex-1" numberOfLines={1}>
                        {q.question.substring(0, 30)}...
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Actions */}
              <View className="flex-row w-full">
                <Pressable
                  onPress={() => router.back()}
                  className="flex-1 bg-gray-200 py-4 rounded-xl mr-2"
                >
                  <Text className="text-gray-700 font-bold text-center">Retour</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setCurrentQuestion(0);
                    setSelectedAnswer(null);
                    setScore(0);
                    setAnswers([]);
                    setShowResult(false);
                    setShowFeedback(false);
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
      {/* Header */}
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">Quiz</Text>
          <Text className="text-gray-500 text-xs">
            Question {currentQuestion + 1}/{QUIZ_DATA.length}
          </Text>
        </View>
        <View className="bg-[#F59E0B] px-3 py-1 rounded-full">
          <Text className="text-white font-bold text-sm">{score} pts</Text>
        </View>
      </View>

      {/* Progress */}
      <View className="px-5 mb-4">
        <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <View 
            className="h-full bg-[#F59E0B] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        
        {/* Audio Player for audio questions */}
        {question.type === "audio-mcq" && (
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
            <View className="flex-row items-center justify-center h-12 mb-4">
              {[...Array(18)].map((_, i) => (
                <View 
                  key={i}
                  className={`w-1 mx-[2px] rounded-full ${isPlaying ? 'bg-[#4a90e2]' : 'bg-gray-300'}`}
                  style={{ height: isPlaying ? Math.floor(Math.random() * 32 + 12) : 12 }}
                />
              ))}
            </View>

            <View className="flex-row items-center justify-center">
              <Pressable 
                onPress={handlePlayAudio}
                className="w-14 h-14 rounded-full bg-white border-2 border-gray-800 items-center justify-center"
              >
                <Feather name={isPlaying ? "pause" : "play"} size={22} color="black" />
              </Pressable>
              <Pressable className="ml-4">
                <Feather name="mic-off" size={22} color="#4B5563" />
              </Pressable>
            </View>
            <Text className="text-center text-gray-400 text-xs mt-3">Appuie pour écouter</Text>
          </View>
        )}

        {/* Question Card */}
        <View 
          className="bg-white rounded-3xl p-6 border border-gray-200"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text className="text-lg font-bold text-gray-900 text-center mb-6">
            {question.question}
          </Text>

          {/* Options Grid */}
          <View className="flex-row flex-wrap justify-between">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = index === question.correctIndex;
              const showCorrect = showFeedback && isCorrect;
              const showWrong = showFeedback && isSelected && !isCorrect;

              let bgColor = "bg-white";
              let borderColor = "border-gray-200";
              let textColor = "text-gray-900";

              if (showCorrect) {
                bgColor = "bg-green-50";
                borderColor = "border-green-500";
                textColor = "text-green-700";
              } else if (showWrong) {
                bgColor = "bg-red-50";
                borderColor = "border-red-500";
                textColor = "text-red-700";
              } else if (isSelected) {
                bgColor = "bg-blue-50";
                borderColor = "border-[#4a90e2]";
              }

              return (
                <Pressable
                  key={index}
                  onPress={() => handleSelectAnswer(index)}
                  disabled={selectedAnswer !== null}
                  className={`${bgColor} border-2 ${borderColor} rounded-2xl p-4 mb-3 w-[48%]`}
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                >
                  <View className="flex-row items-center">
                    <View 
                      className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                        showCorrect ? 'bg-green-500' : showWrong ? 'bg-red-500' : isSelected ? 'bg-[#4a90e2]' : 'bg-gray-100'
                      }`}
                    >
                      <Text className={`font-bold ${isSelected || showCorrect || showWrong ? 'text-white' : 'text-gray-600'}`}>
                        {String.fromCharCode(65 + index)}
                      </Text>
                    </View>
                    <Text className={`font-medium flex-1 ${textColor}`} numberOfLines={2}>
                      {option}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Feedback */}
          {showFeedback && (
            <View className={`mt-4 rounded-xl p-4 ${
              selectedAnswer === question.correctIndex ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <View className="flex-row items-center">
                <Feather 
                  name={selectedAnswer === question.correctIndex ? "check-circle" : "x-circle"} 
                  size={24} 
                  color={selectedAnswer === question.correctIndex ? "#10B981" : "#EF4444"} 
                />
                <Text className={`ml-3 font-bold ${
                  selectedAnswer === question.correctIndex ? 'text-green-700' : 'text-red-700'
                }`}>
                  {selectedAnswer === question.correctIndex ? "Bravo ! C'est correct !" : "Incorrect. La bonne réponse était :"}
                </Text>
              </View>
              {selectedAnswer !== question.correctIndex && (
                <Text className="text-green-700 font-bold mt-1 ml-9">
                  {question.options[question.correctIndex]}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Next Button */}
      {showFeedback && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-5 py-4">
          <Pressable
            onPress={handleNext}
            className="bg-[#F59E0B] rounded-2xl py-4 items-center"
            style={{
              shadowColor: "#F59E0B",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text className="text-white font-bold text-lg">
              {currentQuestion < QUIZ_DATA.length - 1 ? "Question suivante" : "Voir les résultats"}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
