import { useUserStats } from "@/hooks/useUserStats";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import ENV from "../../../constants/env";
import { useLives } from "../../../hooks/useLives";
import { getAllCoursesFromLanguageCategory, getCourseContents, getCoursesForLanguageAndGrade, getEnrolledCoursesByTimeline } from "../../../services/api/courseService";
import { RootState } from "../../../services/redux/store";
import { getAllScoresForCourse } from "../../../services/storage/activity-progress";
import { CourseProgressData, getCourseProgress } from "../../../services/storage/course-progress";

const IS_DEV = process.env.NODE_ENV === "development";

const PREFERENCES_KEY = '@ipelan_preferences';

interface UserPreferences {
  language: string;
  grade: number;
}

interface CourseData {
  id: number;
  fullname: string;
  shortname: string;
  progress: number;
  visible: boolean;
  courseimage: string;
  coursecategory: string;
  viewurl: string;
  lessonsCount: number;
  dbProgress?: CourseProgressData;
  totalScore?: string;
}

const getIconForCourse = (name: string): { icon: string; color: string; bg: string } => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('salut')) return { icon: "handshake", color: "#10B981", bg: "bg-green-100" };
  if (lowerName.includes('famille')) return { icon: "users", color: "#6366F1", bg: "bg-indigo-100" };
  if (lowerName.includes('nombre')) return { icon: "hash", color: "#F59E0B", bg: "bg-amber-100" };
  if (lowerName.includes('couleur')) return { icon: "droplet", color: "#EC4899", bg: "bg-pink-100" };
  if (lowerName.includes('aliment')) return { icon: "coffee", color: "#8B5CF6", bg: "bg-violet-100" };
  if (lowerName.includes('animal')) return { icon: "star", color: "#14B8A6", bg: "bg-teal-100" };
  return { icon: "book", color: "#002366", bg: "bg-blue-100" };
};

const getLevelFromCourse = (name: string): number => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('1') || lowerName.includes('fondamental')) return 1;
  if (lowerName.includes('2') || lowerName.includes('inter')) return 2;
  if (lowerName.includes('3') || lowerName.includes('avan')) return 3;
  return 1;
};


export default function CoursScreen() {
  const router = useRouter();
  const token = useSelector((state: RootState) => state.auth.token);
  const { canPlay } = useLives();
  const { stats, refetch: refetchUserStats } = useUserStats(); // ✅ Pour détecter les changements après activité
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [courseProgressMap, setCourseProgressMap] = useState<Record<number, CourseProgressData>>({});

  // ✅ #2 useFocusEffect - Refresh auto quand on revient sur l'app
  useFocusEffect(
    useCallback(() => {
      refetchUserStats();
    }, [refetchUserStats])
  );

  // Garde commun pour les raccourcis d'activité (sans cmid spécifique)
  const guardActivity = (_path: string) => {
    if (!canPlay) {
      Alert.alert(
        "Plus de vies",
        "Tu n'as plus de vies. Achète-en une avec tes pièces ou attends 6 h.",
        [{ text: "OK" }]
      );
      return;
    }
    Alert.alert(
      "Sélectionne un cours",
      "Ouvre un cours depuis la liste ci-dessous pour accéder à cette activité.",
      [{ text: "OK" }]
    );
  };

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await AsyncStorage.getItem(PREFERENCES_KEY);
        if (prefs) {
          setPreferences(JSON.parse(prefs));
        }
      } catch (e) {
        console.warn("Failed to load preferences:", e);
      }
    };
    loadPreferences();
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        let fetchedCourses: any[] = [];
        
        // 1. Try to get courses for user's preferred language and grade
        if (preferences) {
          console.log("[Cours] Fetching courses for language:", preferences.language, "grade:", preferences.grade);
          const langCourses = await getCoursesForLanguageAndGrade(token, preferences.language, preferences.grade);
          if (langCourses.length > 0) {
            if (IS_DEV) console.log("[Cours] Found", langCourses.length, "courses for", preferences.language, "grade", preferences.grade);
            fetchedCourses = langCourses;
          }
        }
        
        // 2. Fallback: get all courses from Langues Nationales iplan
        if (fetchedCourses.length === 0) {
          console.log("[Cours] No grade-specific courses, fetching all from Langues Nationales iplan...");
          const allLangCourses = await getAllCoursesFromLanguageCategory(token, ENV.API.LANGUAGE_CATEGORY_ID);
          if (allLangCourses.length > 0) {
            if (IS_DEV) console.log("[Cours] Found", allLangCourses.length, "courses in language category");
            fetchedCourses = allLangCourses;
          }
        }
        
        // 3. Last resort: get enrolled courses
        if (fetchedCourses.length === 0) {
          console.log("[Cours] No filtered courses, trying enrolled courses...");
          const response = await getEnrolledCoursesByTimeline(token);
          if (response?.courses && Array.isArray(response.courses)) {
            fetchedCourses = response.courses.filter((c: any) => c.visible !== false);
          }
        }
        
        console.log("[Cours] Total courses to display:", fetchedCourses.length);

        const enrichedCourses: CourseData[] = await Promise.all(
          fetchedCourses.map(async (c: any) => {
            let lessonsCount = 0;
            let dbProgress: CourseProgressData | null = null;
            let totalScore: string | undefined;
            
            try {
              const sections = await getCourseContents(token, c.id);
              if (Array.isArray(sections)) {
                sections.forEach(sec => { if (sec.modules) lessonsCount += sec.modules.length; });
              }
            } catch { }
            
            try {
              dbProgress = await getCourseProgress(c.id);
              if (dbProgress) {
                const scores = await getAllScoresForCourse(c.id);
                if (scores.size > 0) {
                  let best = 0, max = 0;
                  scores.forEach(s => { best += s.bestScore; max += s.totalScore; });
                  if (max > 0) totalScore = `${best}/${max}`;
                }
              }
            } catch { }
            
            const finalProgress = dbProgress && dbProgress.totalActivities > 0
              ? Math.round((dbProgress.completedActivities / dbProgress.totalActivities) * 100)
              : c.progress || 0;
            
            return {
              id: c.id,
              fullname: c.fullname || c.shortname || "Cours",
              shortname: c.shortname || "",
              progress: finalProgress,
              visible: c.visible ?? true,
              courseimage: c.courseimage || "",
              coursecategory: c.coursecategory || c.category || "",
              viewurl: c.viewurl || "",
              lessonsCount,
              dbProgress: dbProgress || undefined,
              totalScore,
            };
          })
        );

        console.log('[Courses] Loaded', enrichedCourses.length, 'courses with DB progress');
        setCourses(enrichedCourses);
        
        if (enrichedCourses.length === 0) {
          setError("Aucun cours trouvé dans les catégories de langues");
        } else {
          setError(null);
        }
      } catch (err: any) {
        console.error("Failed to fetch courses:", err);
        setError(err.message);
        
        try {
          const response = await getEnrolledCoursesByTimeline(token);
          if (response?.courses) {
            setCourses(Array.isArray(response.courses) ? response.courses : []);
          }
        } catch (fallbackErr) {
          console.warn("Fallback also failed:", fallbackErr);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, [token, preferences]);

  // ✅ Recharger la progression quand XP change (après une activité)
  useEffect(() => {
    const reloadProgress = async () => {
      if (!token || courses.length === 0) return;
      
      try {
        const progressMap: Record<number, CourseProgressData> = {};
        for (const course of courses) {
          const dbProgress = await getCourseProgress(course.id);
          if (dbProgress) {
            progressMap[course.id] = dbProgress;
          }
        }
        setCourseProgressMap(progressMap);
        
        // Mettre à jour les cours avec la nouvelle progression
        setCourses(prev => prev.map(c => ({
          ...c,
          dbProgress: progressMap[c.id] || c.dbProgress,
        })));
      } catch (err) {
        console.warn('[Cours] Failed to reload progress:', err);
      }
    };
    
    reloadProgress();
  }, [stats.xp, token]); // Dépend de XP pour recharger après activité

  const groupedCourses = courses.reduce((acc, course) => {
    const level = getLevelFromCourse(course.fullname);
    if (!acc[level]) acc[level] = [];
    acc[level].push(course);
    return acc;
  }, {} as Record<number, CourseData[]>);

  const renderProgressBar = (progress: number, totalLessons: number) => {
    const completedLessons = Math.round((progress / 100) * totalLessons);
    return (
      <View className="mt-3">
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-xs text-gray-500">{progress}% complété</Text>
          <Text className="text-xs text-gray-400">
            {completedLessons}/{totalLessons} leçons
          </Text>
        </View>
        <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              backgroundColor: progress === 100 ? '#10B981' : '#4a90e2',
            }}
          />
        </View>
      </View>
    );
  };

  const renderModuleCard = (course: CourseData) => {
    const isCompleted = course.progress === 100;
    const totalLessons = course.lessonsCount;
    const iconData = getIconForCourse(course.fullname);

    return (
      <Pressable
        key={course.id}
        onPress={() => router.push(`/(stacks)/(cours)/${course.id}` as any)}
        className="bg-white rounded-2xl p-4 mb-3 border border-gray-100"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <View className="flex-row items-start">
          <View className={`${iconData.bg} w-14 h-14 rounded-2xl items-center justify-center mr-4`}>
            <Feather name={iconData.icon as any} size={24} color={iconData.color} />
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-gray-900 font-bold text-base flex-1">
                {course.fullname}
              </Text>
              {isCompleted ? (
                <View className="bg-green-100 rounded-full px-2 py-1 flex-row items-center">
                  <AntDesign name="check" size={12} color="#10B981" />
                  <Text className="text-green-600 text-xs font-medium ml-1">Terminé</Text>
                </View>
              ) : (
                <View className="bg-amber-100 rounded-full px-2 py-1">
                  <Text className="text-amber-600 text-xs font-medium">+50 XP</Text>
                </View>
              )}
              {course.totalScore && (
                <View className="ml-2 bg-green-100 rounded-full px-2 py-1">
                  <Text className="text-green-600 text-xs font-medium">★ {course.totalScore}</Text>
                </View>
              )}
            </View>

            <Text className="text-gray-500 text-sm mb-1" numberOfLines={2}>
              {course.coursecategory || "Cours IPELAN"}
            </Text>

            {renderProgressBar(course.progress, totalLessons)}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderLevelSection = (level: number, levelCourses: CourseData[]) => {
    const levelTitles: Record<number, { title: string; subtitle: string }> = {
      1: { title: "Niveau 1", subtitle: "Fondamental" },
      2: { title: "Niveau 2", subtitle: "Intermédiaire" },
      3: { title: "Niveau 3", subtitle: "Avancé" },
    };

    const completedModules = levelCourses.filter(c => c.progress === 100).length;
    const { title, subtitle } = levelTitles[level] || { title: `Niveau ${level}`, subtitle: "" };

    return (
      <View key={level} className="mb-6">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-xl bg-[#002366] items-center justify-center mr-3">
              <Text className="text-white font-bold text-sm">{level}</Text>
            </View>
            <View>
              <Text className="text-gray-900 font-bold text-lg">{title}</Text>
              <Text className="text-gray-400 text-xs">{subtitle}</Text>
            </View>
          </View>
          <View className="bg-gray-100 rounded-full px-3 py-1">
            <Text className="text-gray-600 text-xs font-medium">
              {completedModules}/{levelCourses.length}
            </Text>
          </View>
        </View>

        <View className="pl-1">
          {levelCourses.map(renderModuleCard)}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={["top", "bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="px-5 pt-4">
          <Text className="text-gray-900 font-bold text-2xl mb-1">Cours</Text>
          <Text className="text-gray-500 text-sm mb-6">
            Continue ton apprentissage des langues
          </Text>
        </View>

        <View className="px-5 mb-8">
          <Pressable
            onPress={() => guardActivity("/quiz")}
            className="bg-[#002366] rounded-3xl p-5 flex-row items-center justify-between"
            style={{
              shadowColor: "#002366",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <View className="flex-1">
              <Text className="text-white text-lg font-bold mb-1">Quiz Rapide</Text>
              <Text className="text-white/70 text-xs">Évalue tes connaissances du jour</Text>
            </View>
            <View className="bg-white/20 p-3 rounded-2xl">
              <Ionicons name="flash" size={24} color="white" />
            </View>
          </Pressable>
        </View>

        <View className="px-5 mb-8">
          <Text className="text-lg font-bold text-gray-900 mb-4">Activités Récentes</Text>
          <View className="flex-row flex-wrap justify-between">
            <ActivityIconCard
              title="Oral"
              icon="headphones"
              color="#10B981"
              bgColor="bg-green-50"
              onPress={() => guardActivity("/(stacks)/(cours)/listening")}
            />
            <ActivityIconCard
              title="Dictée"
              icon="edit-3"
              color="#F59E0B"
              bgColor="bg-amber-50"
              onPress={() => guardActivity("/(stacks)/(cours)/dictation")}
            />
            <ActivityIconCard
              title="Association"
              icon="link"
              color="#9333EA"
              bgColor="bg-purple-50"
              onPress={() => guardActivity("/(stacks)/(cours)/association")}
            />
            <ActivityIconCard
              title="Ordre"
              icon="layers"
              color="#4a90e2"
              bgColor="bg-blue-50"
              onPress={() => guardActivity("/(stacks)/(cours)/game")}
            />
          </View>
        </View>

        <View className="px-5">
          <Text className="text-lg font-bold text-gray-900 mb-4">Parcours d&apos;Apprentissage</Text>
          
          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#002366" />
              <Text className="text-gray-500 mt-2">Chargement des cours...</Text>
            </View>
          ) : error ? (
            <View className="bg-red-50 p-4 rounded-2xl">
              <Text className="text-red-600 text-center">{error}</Text>
            </View>
          ) : courses.length > 0 ? (
            [1, 2, 3].map(level => 
              groupedCourses[level]?.length > 0 
                ? renderLevelSection(level, groupedCourses[level])
                : null
            )
          ) : (
            <View className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 items-center">
              <Feather name="book-open" size={48} color="#D1D5DB" />
              <Text className="text-gray-400 text-sm mt-2 font-medium">Aucun cours inscrit</Text>
              <Text className="text-gray-400 text-xs mt-1">Inscris-toi à un cours pour commencer</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
function ActivityIconCard({ title, icon, color, bgColor, onPress }: {
  title: string;
  icon: string;
  color: string;
  bgColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable 
      onPress={onPress}
      className={`w-[23%] ${bgColor} items-center p-3 rounded-2xl mb-2`}
    >
      <View className="bg-white p-2 rounded-xl mb-2 shadow-sm">
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <Text className="text-[10px] font-bold text-gray-700">{title}</Text>
    </Pressable>
  );
}
