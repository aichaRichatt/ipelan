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

export default function ModuleDetailScreen() {
  const router = useRouter();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
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
        const courseName = title || firstSection.name || "Cours";

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
  }, [token, id, title]);

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
          <Text className="text-lg font-bold text-gray-900 flex-1">Cours</Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Text className="text-gray-500">Aucune donnée disponible</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progressPercent = Math.round((moduleData.completedLessons / Math.max(moduleData.totalLessons, 1)) * 100);

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
      router.push("/(quiz)/index" as any);
    } else if (lesson.type === "exercise") {
      router.push("/(stacks)/(cours)/association" as any);
    } else if (lesson.type === "audio") {
      router.push("/(stacks)/(cours)/listening" as any);
    } else if (lesson.type === "game") {
      router.push("/(stacks)/(cours)/game" as any);
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
            onPress={() => {
              const nextLesson = moduleData.lessons.find(l => !l.isCompleted && !l.isLocked);
              if (nextLesson) handleLessonPress(nextLesson);
            }}
            className="bg-[#0961F5] rounded-2xl py-4 items-center"
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