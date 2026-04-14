import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { Pressable, Text, View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { audioService } from "../../services/audio/audioService";
import { useSelector } from "react-redux";
import { RootState } from "../../services/redux/store";
import { getEnrolledCoursesByTimeline, getCourseSections } from "../../services/api/courseService";

interface QuizQuestion {
  id: number;
  type: "text-mcq" | "audio-mcq";
  question: string;
  audioUrl?: string;
  options: string[];
  correctIndex: number;
}

export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moduleId?: string; moduleTitle?: string; courseId?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const fetchQuizData = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const coursesResponse = await getEnrolledCoursesByTimeline(token);
        const courses = coursesResponse?.courses || [];
        
        const allModules: any[] = [];
        
        for (const course of courses.slice(0, 3)) {
          try {
            const sectionsResponse = await getCourseSections(token, course.id);
            if (Array.isArray(sectionsResponse)) {
              for (const section of sectionsResponse) {
                if (section.modules) {
                  allModules.push(...section.modules);
                }
              }
            }
          } catch (e) {
            console.log("Error fetching sections for course", course.id);
          }
        }

        const quizQuestions: QuizQuestion[] = generateQuizQuestions(allModules, courses);
        setQuestions(quizQuestions);
      } catch (error) {
        console.error("Failed to fetch quiz data:", error);
        setQuestions(generateDefaultQuestions());
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuizData();
  }, [token]);

  const generateQuizQuestions = (modules: any[], courses: any[]): QuizQuestion[] => {
    const questionTemplates = [
      { template: (c: string) => ({ question: `Quel est le contenu principal du cours "${c}"?`, options: ["Chapitre 1", "Chapitre 2", "Chapitre 3", "Chapitre 4"], correct: 0 }), type: "text-mcq" as const },
      { template: (c: string) => ({ question: `As-tu terminé le cours "${c}"?`, options: ["Oui", "Non", "En cours", "Pas commencé"], correct: 2 }), type: "text-mcq" as const },
      { template: (c: string) => ({ question: `Quelle activité dans "${c}"?`, options: ["Lecture", "Quiz", "Exercice", "Vidéo"], correct: 0 }), type: "text-mcq" as const },
      { template: (c: string) => ({ question: `Le cours "${c}" est-il difficile?`, options: ["Très facile", "Facile", "Moyen", "Difficile"], correct: 1 }), type: "text-mcq" as const },
    ];

    const questions: QuizQuestion[] = [];
    const usedCourses = new Set<string>();

    courses.forEach((course, idx) => {
      if (questions.length >= 5) return;
      if (usedCourses.has(course.fullname)) return;
      
      usedCourses.add(course.fullname);
      const template = questionTemplates[idx % questionTemplates.length];
      const q = template.template(course.fullname);
      const { options, newCorrectIndex } = shuffleOptions(q.options, q.correct);
      
      questions.push({
        id: questions.length + 1,
        type: template.type,
        question: q.question,
        options,
        correctIndex: newCorrectIndex,
      });
    });

    return questions.length > 0 ? questions : generateDefaultQuestions();
  };

  const generateDefaultQuestions = (): QuizQuestion[] => {
    const defaultQ = [
      { id: 1, question: "Quel niveau as-tu choisi?", options: ["Fondamental", "Intermédiaire", "Avancé", "Tous"], correct: 0 },
      { id: 2, question: "Quelle langue souhaites-tu apprendre?", options: ["Pulaar", "Soninké", "Wolof", "Toutes"], correct: 0 },
      { id: 3, question: "Comment évalues-tu ton niveau?", options: ["Débutant", "Intermédiaire", "Avancé", "Expert"], correct: 0 },
      { id: 4, question: "Quelle activité préfères-tu?", options: ["Lecture", "Quiz", "Audio", "Exercices"], correct: 0 },
      { id: 5, question: "Quel est ton objectif?", options: ["Vocabulaire", "Grammaire", "Conversation", "Tous"], correct: 3 },
    ];
    
    return defaultQ.map(q => {
      const { options, newCorrectIndex } = shuffleOptions(q.options, q.correct);
      return { id: q.id, type: "text-mcq" as const, question: q.question, options, correctIndex: newCorrectIndex };
    });
  };

  const shuffleOptions = (options: string[], correctIdx: number): { options: string[]; newCorrectIndex: number } => {
    const correctAnswer = options[correctIdx];
    const shuffled = [...options].sort(() => Math.random() - 0.5);
    const newCorrectIndex = shuffled.indexOf(correctAnswer);
    return { options: shuffled, newCorrectIndex };
  };

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

  const handleSelectAnswer = (index: number) => {
    if (selectedAnswer !== null || questions.length === 0) return;
    setSelectedAnswer(index);
    setAnswers(prev => [...prev, index]);
    
    const isCorrect = index === questions[currentQuestion].correctIndex;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
    } else {
      setShowResult(true);
    }
  };

  const getScoreEmoji = () => {
    const percentage = (score / (questions.length || 1)) * 100;
    if (percentage === 100) return "🏆";
    if (percentage >= 80) return "🌟";
    if (percentage >= 60) return "👏";
    if (percentage >= 40) return "💪";
    return "📚";
  };

  const getScoreMessage = () => {
    const percentage = (score / (questions.length || 1)) * 100;
    if (percentage === 100) return "Parfait ! Tu es un champion !";
    if (percentage >= 80) return "Excellent travail !";
    if (percentage >= 60) return "Bien joué, continue comme ça !";
    if (percentage >= 40) return "Pas mal, persévère !";
    return "Ne lâche pas, tu vas progresser !";
  };

  if (questions.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="flex-1 items-center justify-center px-5">
          {isLoading ? (
            <>
              <ActivityIndicator size="large" color="#002366" />
              <Text className="text-gray-500 mt-4">Chargement du quiz...</Text>
            </>
          ) : (
            <>
              <Feather name="alert-circle" size={64} color="#D1D5DB" />
              <Text className="text-gray-500 mt-4 text-center">Aucun cours disponible pour le quiz</Text>
              <Pressable 
                onPress={() => router.back()}
                className="mt-6 bg-[#002366] px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-bold">Retour</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  if (showResult) {
    const percentage = Math.round((score / questions.length) * 100);
    
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
                Tu as obtenu {score} bonnes réponses sur {questions.length}
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
                  onPress={() => {
                    const resultParams = `?activity=Quiz&score=${score}&total=${questions.length}&xp=${score * 20}&moduleId=${params.moduleId || ''}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Quiz')}&courseId=${params.courseId || ''}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ''}`)}`;
                    router.push(`/(stacks)/(cours)/result${resultParams}` as any);
                  }}
                  className="flex-1 bg-gray-200 py-4 rounded-xl mr-2"
                >
                  <Text className="text-gray-700 font-bold text-center">Continuer</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setCurrentQuestion(0);
                    setSelectedAnswer(null);
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

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">Quiz Rapide</Text>
          <Text className="text-gray-500 text-xs">
            Question {currentQuestion + 1}/{questions.length}
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
        
        {question.type === "audio-mcq" && (
          <View className="bg-white rounded-3xl p-6 mb-6 border border-gray-200">
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
            </View>
            <Text className="text-center text-gray-400 text-xs mt-3">Appuie pour écouter</Text>
          </View>
        )}

        <View className="bg-white rounded-3xl p-6 border border-gray-200">
          <Text className="text-lg font-bold text-gray-900 text-center mb-6">
            {question.question}
          </Text>

          <View className="flex-row flex-wrap justify-between">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = index === question.correctIndex;

              let bgColor = "bg-white";
              let borderColor = "border-gray-200";
              let textColor = "text-gray-900";

              if (isCorrect && selectedAnswer !== null) {
                bgColor = "bg-green-50";
                borderColor = "border-green-500";
                textColor = "text-green-700";
              } else if (isSelected && !isCorrect) {
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
                >
                  <View className="flex-row items-center">
                    <View 
                      className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                        isCorrect && selectedAnswer !== null ? 'bg-green-500' : isSelected && !isCorrect ? 'bg-red-500' : isSelected ? 'bg-[#4a90e2]' : 'bg-gray-100'
                      }`}
                    >
                      <Text className={`font-bold ${isSelected || (isCorrect && selectedAnswer !== null) ? 'text-white' : 'text-gray-600'}`}>
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
        </View>
      </ScrollView>

      <Pressable
        onPress={handleNext}
        disabled={selectedAnswer === null}
        className={`absolute bottom-9 left-4 right-4 rounded-full py-3 ${
          selectedAnswer === null ? 'bg-gray-300' : 'bg-[#4a90e2]'
        }`}
      >
        <Text className={`font-bold text-center ${selectedAnswer === null ? 'text-gray-500' : 'text-white'}`}>
          {currentQuestion === questions.length - 1 ? 'Terminer' : 'Suivant'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}