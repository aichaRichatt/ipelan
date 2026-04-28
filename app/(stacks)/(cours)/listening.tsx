import { useListeningContent } from "@/hooks/useListening";
import { audioService } from "@/services/audio/audioService";
import { RootState } from "@/services/redux/store";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

const IS_DEV = process.env.NODE_ENV === "development";

export default function ListeningScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    moduleId?: string; 
    moduleTitle?: string; 
    courseId?: string; 
    cmid?: string; 
    instanceId?: string 
  }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const cmid = parseInt(params.cmid || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);
  
  const { exercises, isLoading, error, refetch } = useListeningContent(
    token || '',
    moduleId,
    instanceId,
    courseId,
    cmid
  );
  
  const [currentExercise, setCurrentExercise] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    return () => {
      audioService.stop();
    };
  }, []);

  const exercise = exercises[currentExercise];
  const progress = exercises.length > 0 ? ((currentExercise + 1) / exercises.length) * 100 : 0;

  const handlePlayAudio = async () => {
    if (exercise?.audioUrl) {
      setIsPlaying(true);
      try {
        await audioService.playRemoteUrl(exercise.audioUrl, token || '');
        setIsPlaying(false);
      } catch (err) {
        if (IS_DEV) console.error('[Listening] Audio play failed:', err);
        setIsPlaying(false);
      }
    } else {
      // Simulate audio playback with visual feedback
      setIsPlaying(true);
      setTimeout(() => setIsPlaying(false), 2000);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (showFeedback) return;
    
    setSelectedAnswer(optionIndex);
    setShowFeedback(true);
    
    const isCorrect = optionIndex === exercise?.correctIndex;
    const newAnswers = [...answers, isCorrect];
    setAnswers(newAnswers);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
  };

  const handleContinue = () => {
    if (currentExercise < exercises.length - 1) {
      setTimeout(() => {
        setCurrentExercise(prev => prev + 1);
        setSelectedAnswer(null);
        setShowFeedback(false);
      }, 1500);
    } else {
      setShowResult(true);
    }
  };

  const handleFinish = () => {
    const instanceId = params.instanceId || params.moduleId || '0';
    const resultParams = `?activity=Listening&score=${score}&total=${exercises.length}&xp=${score * 15}&moduleId=${params.moduleId || ''}&instanceId=${instanceId}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Compréhension Orale')}&courseId=${params.courseId || ''}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ''}`)}`;
    router.push(`/(stacks)/(cours)/result${resultParams}` as any);
  };

  const handleRetry = () => {
    setCurrentExercise(0);
    setScore(0);
    setAnswers([]);
    setShowResult(false);
    setSelectedAnswer(null);
    setShowFeedback(false);
    refetch();
  };

  const getScoreEmoji = () => {
    const percentage = (score / (exercises.length || 1)) * 100;
    if (percentage === 100) return "🏆";
    if (percentage >= 80) return "🌟";
    if (percentage >= 60) return "👏";
    if (percentage >= 40) return "💪";
    return "📚";
  };

  const getOptionStyle = (optionIndex: number) => {
    if (!showFeedback) {
      return selectedAnswer === optionIndex 
        ? "border-[#002366] bg-[#002366]/10" 
        : "border-gray-200 bg-white";
    }
    
    if (optionIndex === exercise?.correctIndex) {
      return "border-green-500 bg-green-50";
    }
    if (optionIndex === selectedAnswer && optionIndex !== exercise?.correctIndex) {
      return "border-red-500 bg-red-50";
    }
    return "border-gray-200 bg-white opacity-50";
  };

  const getOptionTextStyle = (optionIndex: number) => {
    if (!showFeedback) {
      return selectedAnswer === optionIndex ? "text-[#002366]" : "text-gray-900";
    }
    
    if (optionIndex === exercise?.correctIndex) {
      return "text-green-700";
    }
    if (optionIndex === selectedAnswer && optionIndex !== exercise?.correctIndex) {
      return "text-red-700";
    }
    return "text-gray-500";
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
          <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900">Compréhension Orale</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#002366" />
          <Text className="text-gray-500 mt-4">Chargement des exercices...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
          <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900">Compréhension Orale</Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <View className="bg-red-50 rounded-3xl p-8 items-center border border-red-200">
            <Feather name="alert-circle" size={64} color="#EF4444" />
            <Text className="text-xl font-bold text-red-900 mt-4 text-center">
              Impossible de charger les exercices
            </Text>
            <Text className="text-red-700 text-center mt-2 text-sm">
              {error}
            </Text>
            <Pressable
              onPress={() => router.back()}
              className="bg-red-500 rounded-full px-6 py-3 mt-6"
            >
              <Text className="text-white font-bold">Retour</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (showResult) {
    const percentage = exercises.length > 0 ? Math.round((score / exercises.length) * 100) : 0;
    
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
                Tu as obtenu {score} bonnes réponses sur {exercises.length}
              </Text>
              
              <View 
                className="w-32 h-32 rounded-full border-8 mb-6 items-center justify-center"
                style={{ 
                  borderColor: percentage >= 60 ? '#10B981' : '#EF4444',
                  backgroundColor: `${percentage >= 60 ? '#10B981' : '#EF4444'}10`
                }}
              >
                <Text 
                  className="text-4xl font-black" 
                  style={{ color: percentage >= 60 ? '#10B981' : '#EF4444' }}
                >
                  {percentage}%
                </Text>
              </View>

              <View className="bg-yellow-50 rounded-xl px-6 py-3 mb-6 flex-row items-center">
                <Text className="text-xl mr-2">⭐</Text>
                <Text className="text-yellow-700 font-bold text-lg">+{score * 15} XP gagnés</Text>
              </View>

              <View className="flex-row w-full">
                <Pressable
                  onPress={handleFinish}
                  className="flex-1 bg-gray-200 py-4 rounded-xl mr-2"
                >
                  <Text className="text-gray-700 font-bold text-center">Continuer</Text>
                </Pressable>
                <Pressable
                  onPress={handleRetry}
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

  if (!exercise) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
          <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900">Compréhension Orale</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Feather name="music" size={64} color="#D1D5DB" />
          <Text className="text-gray-500 mt-4">Aucun exercice disponible</Text>
          <Pressable 
            onPress={() => router.back()} 
            className="mt-6 bg-[#002366] px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold">Retour</Text>
          </Pressable>
        </View>
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
          <Text className="text-lg font-bold text-gray-900">
            {params.moduleTitle || 'Compréhension Orale'}
          </Text>
          <Text className="text-gray-500 text-xs">
            Exercice {currentExercise + 1}/{exercises.length}
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

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
      >
        
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
          <Text className="text-gray-500 text-center mb-4">
            Écoute le mot et choisis la bonne traduction
          </Text>
          
          <View className="flex-row items-center justify-center h-16 mb-4">
            {[...Array(18)].map((_, i) => (
              <View 
                key={i}
                className={`w-1 mx-[2px] rounded-full ${isPlaying ? 'bg-[#4a90e2]' : 'bg-gray-300'}`}
                style={{ height: isPlaying ? Math.floor(Math.random() * 32 + 12) : 12 }}
              />
            ))}
          </View>

          <Pressable 
            onPress={handlePlayAudio}
            className="w-16 h-16 rounded-full bg-[#002366] items-center justify-center mx-auto"
          >
            <Feather name={isPlaying ? "pause" : "play"} size={24} color="white" />
          </Pressable>
          
          <Text className="text-center text-gray-600 font-medium text-lg mt-4 mb-2">
            &ldquo;{exercise.word}&rdquo;
          </Text>
          <Text className="text-center text-gray-400 text-sm">{exercise.courseName}</Text>
        </View>

        <Text className="text-lg font-bold text-gray-900 mb-4 text-center">
          Quelle est la bonne traduction en français ?
        </Text>

        <View className="flex-col space-y-3">
          {exercise.options.map((option, index) => (
            <Pressable
              key={index}
              onPress={() => handleAnswer(index)}
              className={`p-4 rounded-2xl border-2 ${getOptionStyle(index)}`}
            >
              <View className="flex-row items-center justify-between">
                <Text className={`text-lg font-medium ${getOptionTextStyle(index)}`}>
                  {option}
                </Text>
                {showFeedback && index === exercise?.correctIndex && (
                  <Feather name="check-circle" size={24} color="#10B981" />
                )}
                {showFeedback && index === selectedAnswer && index !== exercise?.correctIndex && (
                  <Feather name="x-circle" size={24} color="#EF4444" />
                )}
              </View>
            </Pressable>
          ))}
        </View>

        {showFeedback && (
          <View className={`mt-4 p-4 rounded-xl ${selectedAnswer === exercise?.correctIndex ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <View className="flex-row items-center">
              <Feather 
                name={selectedAnswer === exercise?.correctIndex ? "check-circle" : "x-circle"} 
                size={20} 
                color={selectedAnswer === exercise?.correctIndex ? '#10B981' : '#EF4444'} 
              />
              <Text className={`ml-2 font-medium ${selectedAnswer === exercise?.correctIndex ? 'text-green-700' : 'text-red-700'}`}>
                {selectedAnswer === exercise?.correctIndex ? 'Correct !' : 'Incorrect'}
              </Text>
            </View>
            {selectedAnswer !== exercise?.correctIndex && (
              <Text className="text-gray-600 text-sm mt-2">
                La bonne réponse était : {exercise.options[exercise.correctIndex]}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <View className="px-5 py-4 border-t border-gray-200 bg-white">
        <Pressable
          onPress={handleContinue}
          disabled={!showFeedback}
          className={`rounded-2xl py-4 items-center ${
            showFeedback ? "bg-[#002366]" : "bg-gray-300"
          }`}
        >
          <Text className="text-white font-bold text-lg">
            {currentExercise < exercises.length - 1 ? "Continuer" : "Voir les résultats"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}