import { Feather } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { Pressable, Text, View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { audioService } from "../../../services/audio/audioService";
import { useSelector } from "react-redux";
import { RootState } from "@/services/redux/store";
import { getEnrolledCoursesByTimeline, getCourseSections } from "@/services/api/courseService";

interface ListeningExercise {
  id: number;
  word: string;
  translation: string;
  audioUrl?: string;
  courseName: string;
}

export default function ListeningScreen() {
  const router = useRouter();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const [exercises, setExercises] = useState<ListeningExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentExercise, setCurrentExercise] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const fetchListeningData = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const coursesResponse = await getEnrolledCoursesByTimeline(token);
        const courses = coursesResponse?.courses || [];
        
        const generatedExercises: ListeningExercise[] = [];
        
        for (const course of courses.slice(0, 2)) {
          try {
            const sectionsResponse = await getCourseSections(token, course.id);
            if (Array.isArray(sectionsResponse)) {
              const modules = sectionsResponse.flatMap((s: any) => s.modules || []);
              
              modules.slice(0, 3).forEach((mod: any, idx: number) => {
                generatedExercises.push({
                  id: generatedExercises.length + 1,
                  word: `${mod.name || `Leçon ${idx + 1}`}`,
                  translation: course.fullname,
                  courseName: course.fullname,
                });
              });
            }
          } catch (e) {
            console.log("Error fetching sections", e);
          }
        }

        if (generatedExercises.length === 0) {
          setExercises(generateDefaultExercises());
        } else {
          setExercises(generatedExercises.slice(0, 5));
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setExercises(generateDefaultExercises());
      } finally {
        setIsLoading(false);
      }
    };

    fetchListeningData();
  }, [token]);

  const generateDefaultExercises = (): ListeningExercise[] => [
    { id: 1, word: "Mbour", translation: "Ville", courseName: "Pulaar" },
    { id: 2, word: "Ndma", translation: "Jour", courseName: "Pulaar" },
    { id: 3, word: "Baba", translation: "Père", courseName: "Pulaar" },
    { id: 4, word: "Yalla", translation: "Dieu", courseName: "Pulaar" },
    { id: 5, word: "Jamm", translation: "Paix", courseName: "Pulaar" },
  ];

  const exercise = exercises[currentExercise];
  const progress = exercises.length > 0 ? ((currentExercise + 1) / exercises.length) * 100 : 0;

  const getWrongTranslation = () => {
    const alternatives = ["Maison", "Eau", "Pain", "Ami", " Ecole", "Livre", "Main", "Pied"];
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  };

  const wrongOption = exercise ? getWrongTranslation() : "";

  useEffect(() => {
    return () => {
      audioService.stop();
    };
  }, []);

  const handlePlayAudio = async () => {
    setIsPlaying(true);
    try {
      await audioService.playAndAutoStop(2000);
      setIsPlaying(false);
    } catch (error) {
      setIsPlaying(false);
    }
  };

  const handleAnswer = (isCorrect: boolean) => {
    const newAnswers = [...answers, isCorrect];
    setAnswers(newAnswers);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    if (currentExercise < exercises.length - 1) {
      setTimeout(() => {
        setCurrentExercise(prev => prev + 1);
      }, 1000);
    } else {
      setShowResult(true);
    }
  };

  const getScoreEmoji = () => {
    const percentage = (score / (exercises.length || 1)) * 100;
    if (percentage === 100) return "🏆";
    if (percentage >= 80) return "🌟";
    if (percentage >= 60) return "👏";
    if (percentage >= 40) return "💪";
    return "📚";
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#002366" />
          <Text className="text-gray-500 mt-4">Chargement...</Text>
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
                <Text className="text-yellow-700 font-bold text-lg">+{score * 15} XP gagnés</Text>
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
                    setCurrentExercise(0);
                    setScore(0);
                    setAnswers([]);
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

  if (!exercise) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <Feather name="music" size={64} color="#D1D5DB" />
          <Text className="text-gray-500 mt-4">Aucun exercice disponible</Text>
          <Pressable onPress={() => router.back()} className="mt-6 bg-[#002366] px-6 py-3 rounded-xl">
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
          <Text className="text-lg font-bold text-gray-900">Compréhension orale</Text>
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
          <Text className="text-gray-500 text-center mb-4">Écoute le mot et choisis la bonne traduction</Text>
          
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
          Quelle est la bonne traduction ?
        </Text>

        <View className="flex-row flex-wrap justify-between">
          <Pressable
            onPress={() => handleAnswer(true)}
            className="bg-white border-2 border-gray-200 rounded-2xl p-4 mb-3 w-[48%]"
          >
            <Text className="text-center font-bold text-gray-900 text-lg">
              {exercise.translation}
            </Text>
            <Text className="text-center text-green-500 text-xs mt-1">✓ Correct</Text>
          </Pressable>
          
          <Pressable
            onPress={() => handleAnswer(false)}
            className="bg-white border-2 border-gray-200 rounded-2xl p-4 mb-3 w-[48%]"
          >
            <Text className="text-center font-bold text-gray-900">
              {wrongOption}
            </Text>
            <Text className="text-center text-gray-400 text-xs mt-1">Incorrect</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}