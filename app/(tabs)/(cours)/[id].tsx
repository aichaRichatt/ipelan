import { AntDesign, Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

interface Lesson {
  id: number;
  title: string;
  type: "audio" | "reading" | "quiz" | "exercise" | "game";
  duration: string;
  xp: number;
  isCompleted: boolean;
  isLocked: boolean;
}

interface ModuleData {
  id: number;
  title: string;
  description: string;
  language: string;
  level: string;
  totalLessons: number;
  completedLessons: number;
  lessons: Lesson[];
}

const MOCK_MODULE: Record<string, ModuleData> = {
  "1": {
    id: 1,
    title: "Salutations",
    description: "Dans ce module, tu apprendras les salutations de base en Pulaar. Tu découvriras comment dire bonjour, au revoir, et otras expresiones courantes utilisées quotidiennement.",
    language: "Pulaar",
    level: "Fondamental",
    totalLessons: 5,
    completedLessons: 2,
    lessons: [
      { id: 1, title: "Introduction aux salutations", type: "audio", duration: "5 min", xp: 10, isCompleted: true, isLocked: false },
      { id: 2, title: "Vocabulaire de base", type: "reading", duration: "8 min", xp: 15, isCompleted: true, isLocked: false },
      { id: 3, title: "Exercice d'association", type: "exercise", duration: "10 min", xp: 20, isCompleted: false, isLocked: false },
      { id: 4, title: "Quiz final", type: "quiz", duration: "15 min", xp: 30, isCompleted: false, isLocked: false },
      { id: 5, title: "Dictée interactive", type: "audio", duration: "10 min", xp: 25, isCompleted: false, isLocked: true },
    ]
  },
  "2": {
    id: 2,
    title: "La famille",
    description: "Apprends les mots pour désigner les membres de la famille en Pulaar.",
    language: "Pulaar",
    level: "Fondamental",
    totalLessons: 4,
    completedLessons: 0,
    lessons: [
      { id: 1, title: "Les membres de la famille", type: "audio", duration: "6 min", xp: 12, isCompleted: false, isLocked: false },
      { id: 2, title: "Vocabulaire familial", type: "reading", duration: "7 min", xp: 14, isCompleted: false, isLocked: true },
      { id: 3, title: "Association mots-images", type: "exercise", duration: "8 min", xp: 18, isCompleted: false, isLocked: true },
      { id: 4, title: "Quiz - La famille", type: "quiz", duration: "12 min", xp: 25, isCompleted: false, isLocked: true },
    ]
  }
};

export default function ModuleDetailScreen() {
  const router = useRouter();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [moduleData, setModuleData] = useState<ModuleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      const data = MOCK_MODULE[id || "1"] || MOCK_MODULE["1"];
      setModuleData(data);
      setIsLoading(false);
    }, 300);
  },
    [id]);

  if (isLoading || !moduleData) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#002366" />
        </View>
      </SafeAreaView>
    );
  }

  const progressPercent = Math.round((moduleData.completedLessons / moduleData.totalLessons) * 100);

  const getLessonIcon = (type: Lesson["type"]) => {
    switch (type) {
      case "audio": return { icon: "headphones", color: "#60A5FA" };
      case "reading": return { icon: "book-open", color: "#34D399" };
      case "quiz": return { icon: "edit-2", color: "#F87171" };
      case "exercise": return { icon: "edit", color: "#FBBF24" };
      default: return { icon: "circle", color: "#9CA3AF" };
    }
  };

  const handleLessonPress = (lesson: Lesson) => {
    if (lesson.isLocked) return;
    
    if (lesson.type === "quiz") {
      router.push("/(quiz)/index");
    } else if (lesson.type === "exercise") {
      router.push("/(tabs)/(cours)/association");
    } else if (lesson.type === "audio") {
      router.push("/(tabs)/(cours)/listening");
    } else if (lesson.type === "game") {
      router.push("/(tabs)/(cours)/game");
    } else if (lesson.type === "reading") {
      router.push(`/(tabs)/(cours)/lesson/${lesson.id}`);
    }
  };

  const handleViewPath = () => {
    router.push(`/(tabs)/(cours)/learning-path?id=${id}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900 flex-1" numberOfLines={1}>
          {moduleData.title}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="px-5 mb-6">
          <View 
            className="rounded-3xl p-6"
            style={{ backgroundColor: '#002366' }}
          >
            <Text className="text-white text-2xl font-bold mb-2">{moduleData.title}</Text>
            <View className="flex-row items-center mb-3">
              <View className="bg-white/20 px-3 py-1 rounded-full mr-2">
                <Text className="text-white text-xs font-medium">{moduleData.language}</Text>
              </View>
              <View className="bg-white/20 px-3 py-1 rounded-full">
                <Text className="text-white text-xs font-medium">{moduleData.level}</Text>
              </View>
            </View>
            <Text className="text-white/80 text-sm mb-4 leading-relaxed">
              {moduleData.description}
            </Text>
            
            <View className="bg-white/10 rounded-xl p-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-white text-sm font-medium">Progression</Text>
                <Text className="text-white font-bold">{progressPercent}%</Text>
              </View>
              <View className="h-2 bg-white/20 rounded-full overflow-hidden">
                <View 
                  className="h-full rounded-full"
                  style={{ width: `${progressPercent}%`, backgroundColor: '#F59E0B' }}
                />
              </View>
              <Text className="text-white/60 text-xs mt-2">
                {moduleData.completedLessons}/{moduleData.totalLessons} leçons complétées
              </Text>
            </View>
          </View>
        </View>

        <View className="px-5">
          <Text className="text-lg font-bold text-gray-900 mb-4">Leçons</Text>
          
          {moduleData.lessons.map((lesson, index) => {
            const { icon, color } = getLessonIcon(lesson.type);
            const isAvailable = !lesson.isLocked;
            
            return (
              <Pressable
                key={lesson.id}
                onPress={() => handleLessonPress(lesson)}
                className={`bg-white rounded-2xl p-4 mb-3 border border-gray-200 ${
                  !isAvailable ? 'opacity-60' : ''
                }`}
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full items-center justify-center mr-4">
                    {lesson.isCompleted ? (
                      <View className="w-10 h-10 rounded-full bg-green-500 items-center justify-center">
                        <AntDesign name="check" size={20} color="white" />
                      </View>
                    ) : lesson.isLocked ? (
                      <View className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center">
                        <Feather name="lock" size={18} color="#9CA3AF" />
                      </View>
                    ) : (
                      <View 
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <Text className="font-bold" style={{ color }}>{index + 1}</Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      <Text className="font-bold text-gray-900 text-sm flex-1">
                        {lesson.title}
                      </Text>
                      {lesson.isCompleted && (
                        <View className="bg-green-100 px-2 py-0.5 rounded-full">
                          <Text className="text-green-600 text-xs font-medium">✓ Terminé</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center">
                      <Feather name={icon as any} size={14} color={color} className="mr-1" />
                      <Text className="text-gray-500 text-xs mr-3">{lesson.duration}</Text>
                      <Text className="text-gray-400 text-xs">{lesson.xp} XP</Text>
                    </View>
                  </View>

                  {isAvailable && !lesson.isCompleted && (
                    <Feather name="chevron-right" size={20} color="#9CA3AF" className="ml-2" />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View className="px-5 mt-6 mb-8">
          <Pressable
            onPress={handleViewPath}
            className="bg-[#002366] rounded-2xl py-4 items-center mb-3"
            style={{
              shadowColor: "#F59E0B",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text className="text-white font-bold text-lg">
              Voir le parcours
            </Text>
          </Pressable>
          
          <Pressable
            onPress={() => {
              const nextLesson = moduleData.lessons.find(l => !l.isCompleted && !l.isLocked);
              if (nextLesson) handleLessonPress(nextLesson);
            }}
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
              {moduleData.completedLessons === 0 ? "Commencer" : "Continuer"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
