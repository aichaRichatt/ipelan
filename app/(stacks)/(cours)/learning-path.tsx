import { AntDesign, Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "@/services/redux/store";
import { getCourseContents } from "@/services/api/courseService";

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

const mapModtypeToType = (modname: string): Lesson["type"] => {
  const m = modname?.toLowerCase() || "";
  if (m.includes("lesson")) return "audio";
  if (m.includes("resource")) return "reading";
  if (m.includes("quiz")) return "quiz";
  if (m.includes("assign") || m.includes("exercise")) return "exercise";
  if (m.includes("game")) return "game";
  return "audio";
};

export default function LearningPathScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const [moduleData, setModuleData] = useState<ModuleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchModuleData = async () => {
      if (!token || !id) return;
      
      try {
        const courseId = parseInt(id);
        const contents = await getCourseContents(token, courseId);
        
        if (!contents || contents.length === 0) {
          setIsLoading(false);
          return;
        }

        const allLessons: Lesson[] = [];
        let completedCount = 0;
        
        for (const section of contents) {
          const modules = section.modules || [];
          
          for (let i = 0; i < modules.length; i++) {
            const mod = modules[i];
            const isLocked = i > 0 && allLessons.length === 0;
            const isCompleted = mod.completed?.[0]?.state === 2;
            
            if (isCompleted) completedCount++;
            
            allLessons.push({
              id: mod.id || mod.cmid || Math.random(),
              title: mod.name || mod.title || "Leçon",
              type: mapModtypeToType(mod.modname || ""),
              duration: mod.duration || "10 min",
              xp: mod.xp || 10,
              isCompleted,
              isLocked
            });
          }
        }

        const firstSection = contents[0] || {};
        const courseSummary = firstSection.summary || "";
        const courseName = firstSection.name || "Cours";

        setModuleData({
          id: courseId,
          title: courseName,
          description: courseSummary.replace(/<[^>]*>/g, ""),
          language: "Pulaar",
          level: "Fondamental",
          totalLessons: allLessons.length,
          completedLessons: completedCount,
          lessons: allLessons
        });
      } catch (err) {
        console.error("Error fetching module:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModuleData();
  }, [token, id]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#002366" />
        </View>
      </SafeAreaView>
    );
  }

  if (!moduleData) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
          <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900 flex-1">Parcours</Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Text className="text-gray-500">Aucune donnée disponible</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progressPercent = Math.round((moduleData.completedLessons / Math.max(moduleData.totalLessons, 1)) * 100);
  const currentLessonIndex = moduleData.lessons.findIndex(l => !l.isCompleted && !l.isLocked);
  const currentLesson = moduleData.lessons[currentLessonIndex >= 0 ? currentLessonIndex : 0];

  const getLessonTypeIcon = (type: Lesson["type"]) => {
    switch (type) {
      case "audio": return { icon: "headphones", color: "#60A5FA", label: "Audio" };
      case "reading": return { icon: "book-open", color: "#34D399", label: "Lecture" };
      case "quiz": return { icon: "edit-2", color: "#F87171", label: "Quiz" };
      case "exercise": return { icon: "link", color: "#FBBF24", label: "Exercice" };
      case "game": return { icon: "gamepad-2", color: "#A78BFA", label: "Jeu" };
      default: return { icon: "circle", color: "#9CA3AF", label: "" };
    }
  };

  const handleLessonPress = (lesson: Lesson) => {
    if (lesson.isLocked) return;
    router.push(`/(stacks)/(cours)/lesson/${lesson.id}` as any);
  };

  const handleContinue = () => {
    if (currentLesson) {
      handleLessonPress(currentLesson);
    }
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
          <View className="rounded-3xl p-5" style={{ backgroundColor: '#002366' }}>
            <View className="flex-row items-center mb-3">
              <View className="bg-white/20 px-3 py-1 rounded-full mr-2">
                <Text className="text-white text-xs font-medium">{moduleData.language}</Text>
              </View>
              <View className="bg-white/20 px-3 py-1 rounded-full">
                <Text className="text-white text-xs font-medium">{moduleData.level}</Text>
              </View>
            </View>
            
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

        <View className="px-5">
          <Text className="text-lg font-bold text-gray-900 mb-4">Ton parcours</Text>
          
          {moduleData.lessons.map((lesson, index) => {
            const typeInfo = getLessonTypeIcon(lesson.type);
            const isCurrent = index === currentLessonIndex;
            const isAvailable = !lesson.isLocked && !lesson.isCompleted;
            
            return (
              <View key={lesson.id} className="flex-row">
                <View className="items-center mr-4">
                  <View className={`w-12 h-12 rounded-full items-center justify-center ${
                    lesson.isCompleted 
                      ? 'bg-green-500' 
                      : lesson.isLocked 
                        ? 'bg-gray-200'
                        : isCurrent
                          ? 'bg-[#002366]'
                          : 'bg-white border-2 border-[#002366]'
                  }`}>
                    {lesson.isCompleted ? (
                      <AntDesign name="check" size={24} color="white" />
                    ) : lesson.isLocked ? (
                      <Feather name="lock" size={20} color="#9CA3AF" />
                    ) : (
                      <Text className={`font-bold text-lg ${isCurrent ? 'text-white' : 'text-[#002366]'}`}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  {index < moduleData.lessons.length - 1 && (
                    <View className={`w-0.5 h-12 ${
                      lesson.isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </View>

                <Pressable
                  onPress={() => handleLessonPress(lesson)}
                  disabled={lesson.isLocked}
                  className={`flex-1 bg-white rounded-2xl p-4 mb-4 border ${
                    lesson.isLocked ? 'border-gray-200 opacity-60' : 'border-gray-200'
                  } ${isCurrent ? 'border-2 border-[#F59E0B]' : ''}`}
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className={`font-bold text-sm flex-1 ${lesson.isLocked ? 'text-gray-400' : 'text-gray-900'}`}>
                      {lesson.title}
                    </Text>
                    {isCurrent && (
                      <View className="bg-[#F59E0B] px-2 py-1 rounded-full">
                        <Text className="text-white text-xs font-bold">Continuer</Text>
                      </View>
                    )}
                    {lesson.isCompleted && (
                      <View className="bg-green-100 px-2 py-1 rounded-full">
                        <Text className="text-green-600 text-xs font-medium">Terminé</Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row items-center">
                    <View 
                      className="w-8 h-8 rounded-full items-center justify-center mr-2"
                      style={{ backgroundColor: `${typeInfo.color}20` }}
                    >
                      <Feather name={typeInfo.icon as any} size={14} color={typeInfo.color} />
                    </View>
                    <Text className="text-gray-500 text-xs mr-3">{typeInfo.label}</Text>
                    <Text className="text-gray-400 text-xs mr-3">{lesson.duration}</Text>
                    <Text className="text-[#F59E0B] text-xs font-bold">+{lesson.xp} XP</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View className="absolute bottom-3 left-0 right-0 bg-[transparent]  m-2">
        <Pressable
          onPress={handleContinue}
          className="bg-[#0961F5] rounded-2xl py-4 items-center mt-3 " 
          style={{
            shadowColor: "#F59E0B",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text className="text-white font-bold text-lg ">
            {currentLesson ? `Commencer "${currentLesson.title}"` : "Aucune leçon disponible"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}