import { BuyHeartsModal } from "@/components/BuyHeartsModal";
import { useLives } from "@/hooks/useLives";
import { AntDesign, Feather, FontAwesome5, Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { useSyncStatus } from "../../../hooks/useSyncStatus";
import { useUserStats } from "../../../hooks/useUserStats";
import { RootState } from "../../../services/redux/store";
import { getAllScoresForCourse } from "../../../services/storage/activity-progress";
import { getAllCourseProgress } from "../../../services/storage/course-progress";

interface ModuleData {
  id: string;
  title: string;
  description: string;
  xp: number;
  isLocked: boolean;
  lessonsCount: number;
  completedLessons: number;
  icon: string;
  iconColor: string;
  iconBg: string;
  levelId: number; 
  progress?: number;
}

interface QuickActionData {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  bgColor: string;
  iconColor: string;
  route: string;
}

const getIconComponent = (iconName: string, size: number, color: string) => {
  switch (iconName) {
    case "smile": return <Feather name="smile" size={size} color={color} />;
    case "users": return <Feather name="users" size={size} color={color} />;
    case "hash": return <Feather name="hash" size={size} color={color} />;
    case "droplet": return <Feather name="droplet" size={size} color={color} />;
    case "edit-2": return <Feather name="edit-2" size={size} color={color} />;
    case "headphones": return <Feather name="headphones" size={size} color={color} />;
    case "edit-3": return <Feather name="edit-3" size={size} color={color} />;
    case "link": return <Feather name="link" size={size} color={color} />;
    default: return <Feather name="book" size={size} color={color} />;
  }
};
const DefaultProfileImage = require('../../../assets/images/defaultprofile.png');

function formatHeartCountdown(nextHeartTime: string | null): string | null {
  if (!nextHeartTime) return null;
  const diffMs = new Date(nextHeartTime).getTime() - Date.now();
  if (diffMs <= 0) return null;
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}


function useActiveCourse(activeToken: string) {
  const [courses, setCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!activeToken) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        // Récupérer les cours depuis Moodle
        const moodleCall = (await import('../../../services/api/moodleClient')).moodleCall;
        
        const result = await moodleCall(
          'core_course_get_enrolled_courses_by_timeline_classification',
          { classification: 'inprogress', limit: 10 },
          activeToken
        );
        
        if (result && result.courses) {
          setCourses(result.courses);
        } else {
          setCourses([]);
        }
      } catch (err: any) {
        console.error('[useActiveCourse] Error:', err);
        setError(err.message || 'Failed to load courses');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCourses();
  }, [activeToken]);

  // Le premier cours est le cours actif
  const course = courses.length > 0 ? courses[0] : null;
  const allCourses = courses;

  return { course, allCourses, isLoading, error };
}

export default function HomeScreen() {
  const reduxUser = useSelector((state: RootState) => state.auth.user);
  const reduxToken = useSelector((state: RootState) => state.auth.token);
  const router = useRouter();
  
  const loggedUser = reduxUser;
  const activeToken = reduxToken || "";
  
  const { course, allCourses, isLoading, error } = useActiveCourse(activeToken);
  const { stats, isLoading: statsLoading, isSyncing, refetch: refetchUserStats } = useUserStats();
  const { icon, color, opacity, isSyncing: isAutoSyncing } = useSyncStatus();
  const { lives, maxLives, canBuyLife, isBuying, lifeCost, buyLife } = useLives(refetchUserStats);
  
  const [courseProgressMap, setCourseProgressMap] = useState<any>({});
  const [courseScoreMap, setCourseScoreMap] = useState<any>({});
  const [showBuyModal, setShowBuyModal] = useState(false);
  
  // Refresh countdown every minute when lives < max
  const [, forceRender] = useState(0);
  useEffect(() => {
    if ((stats.lives ?? lives) >= maxLives) return;
    const id = setInterval(() => forceRender(n => n + 1), 60000);
    return () => clearInterval(id);
  }, [stats.lives, lives, maxLives]);
  
  // ✅ #2 useFocusEffect - Refresh auto quand on revient sur l'app
  useFocusEffect(
    useCallback(() => {
      refetchUserStats();
    }, [refetchUserStats])
  );

  useEffect(() => {
    const loadProgress = async () => {
      if (!course) {
        setCourseProgressMap({});
        setCourseScoreMap({});
        return;
      }
      
      try {
        const allCourseProgress = await getAllCourseProgress();
        const progressMap: any = {};
        
        for (const cp of allCourseProgress) {
          progressMap[cp.courseId] = {
            completed: cp.completedActivities,
            total: cp.totalActivities,
            xp: cp.totalXP,
            bestScore: cp.bestScore,
          };
        }
        
        if (course.id) {
          const scores = await getAllScoresForCourse(course.id);
          setCourseScoreMap({ [course.id]: scores });
        }
        
        setCourseProgressMap(progressMap);
      } catch (err) {
        console.warn('[Home] Failed to load progress:', err);
        setCourseProgressMap({});
        setCourseScoreMap({});
      }
    };
    loadProgress();
  }, [course, activeToken, stats.xp]); // ✅ Recharger quand XP change (après activité)

  const handleSettingsPress = () => {
    router.push("/(settings)/index" as any);
  };

  const handleCoursePress = (courseId: number) => {
    router.push(`/(stacks)/(cours)/${courseId}` as any);
  };

  const getCourseProgress = (course: any) => {
    // SQLite est la source de vérité — prioritaire sur course.progress de l'API Moodle
    const dbProgress = courseProgressMap[course?.id];
    if (dbProgress && dbProgress.total > 0) {
      return Math.round((dbProgress.completed / dbProgress.total) * 100);
    }
    // Fallback : valeur Moodle (0 si jamais aucune activité complétée localement)
    return course?.progress || 0;
  };
  
  const getCourseScore = (courseId: number) => {
    const scores = courseScoreMap[courseId];
    if (!scores) return null;
    
    let totalBest = 0;
    let totalMax = 0;
    if (scores.forEach) {
      scores.forEach((score: any) => {
        totalBest += score.bestScore;
        totalMax += score.totalScore;
      });
    }
    
    if (totalMax > 0) {
      return `${totalBest}/${totalMax}`;
    }
    return null;
  };

  // Nombre total de leçons/activités dans le cours (depuis la DB)
  const getCourseLessonsCount = (course: any): number => {
    const dbProgress = courseProgressMap[course?.id];
    if (dbProgress && dbProgress.total > 0) {
      return dbProgress.total;
    }
    return course?.lessonsCount || 0;
  };

  // Nombre de leçons complétées (depuis la DB)
  const getCompletedLessons = (course: any): number => {
    const dbProgress = courseProgressMap[course?.id];
    if (dbProgress && dbProgress.total > 0) {
      return dbProgress.completed; // peut être 0 — c'est correct si rien fait
    }
    return 0;
  };

  // XP total gagné dans ce cours (depuis la DB)
  const getXpAllFromCourse = (courseId: number): number => {
    const dbProgress = courseProgressMap[courseId];
    if (dbProgress && dbProgress.xp > 0) {
      return dbProgress.xp;
    }
    return 0;
  };

  const getCourseLevel = (courseName: string): number => {
    if (!courseName) return 1;
    const match = courseName.match(/niveau\s*(\d+)/i) || courseName.match(/(\d+)\s*[èe]me/i);
    return match ? parseInt(match[1], 10) : 1;
  };

   const currentCourse = course;

  return (  
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className="px-5 pt-4">
          
          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-row items-center">
              <Pressable onPress={() => router.push("/(tabs)/(profile)")}>
                <View className="w-12 h-12 rounded-full border-2 border-[#002366] p-0.5 overflow-hidden">
                  <Image 
                    source={loggedUser?.avatar ? { uri: loggedUser?.avatar } : DefaultProfileImage} 
                    className="w-full h-full rounded-full"
                  />
                </View>
              </Pressable>
              <View className="ml-3">
                <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  Àndu,
                </Text>
                <Text className="text-lg font-bold text-gray-900">
                  {loggedUser?.firstname || loggedUser?.username || "Ahmadou"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center space-x-2">
              <View>
                <TouchableOpacity 
                  onPress={() => stats.lives < maxLives && setShowBuyModal(true)}
                  className="flex-row items-center bg-white px-2 py-1 rounded-full border border-gray-100 shadow-sm"
                >
                  <Text className="text-sm mr-1">❤️</Text>
                  <Text className="font-bold text-xs text-[#EF4444]">{stats.lives}/{maxLives}</Text>
                </TouchableOpacity>
                {/* ✅ Timer pour prochaine vie */}
                {stats.lives < maxLives && (
                  <View className="flex-row items-center justify-center mt-1">
                    <Feather name="clock" size={9} color="#EF4444" />
                    <Text className="text-red-400 text-[10px] ml-1">
                      {formatHeartCountdown(stats.nextHeartTime)}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center bg-white px-2 py-1 rounded-full border border-gray-100 shadow-sm">
                <Text className="text-sm mr-1">🪙</Text>
                <Text className="font-bold text-xs text-[#F59E0B]">{stats.coins}</Text>
              </View>
              <View className="flex-row items-center bg-white px-2 py-1 rounded-full border border-gray-100 shadow-sm">
                <Text className="text-sm mr-1">🔥</Text>
                <Text className="font-bold text-xs text-orange-500">{stats.streak}</Text>
              </View>
              <Pressable onPress={handleSettingsPress} className="p-2 bg-white rounded-full border border-gray-100 shadow-sm">
                <Feather name="settings" size={18} color="#374151" />
              </Pressable>
              {isAutoSyncing && (
                <View className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-blue-400" style={{ opacity: 0.6 }} />
              )}
            </View>
          </View>

          <View className="flex-row flex-wrap justify-between mb-8">
            <StatsCard 
              label="XP Total" 
              value={`${stats.xp}`} 
              icon={<AntDesign name="star" size={16} color="#F59E0B" />}
              bgColor="bg-orange-50"
              textColor="text-orange-600"
            />
            <StatsCard 
              label="Pièces" 
              value={`${stats.coins}`} 
              icon={<FontAwesome5 name="coins" size={14} color="#F59E0B" />}
              bgColor="bg-yellow-50"
              textColor="text-yellow-600"
            />
            <StatsCard 
              label="Vies" 
              value={`${stats.lives}/6`} 
              icon={<AntDesign name="heart" size={16} color="#EF4444" />}
              bgColor="bg-red-50"
              textColor="text-red-600"
            />
            <StatsCard 
              label="Série" 
              value={`${stats.streak} j`} 
              icon={<Ionicons name="flame" size={16} color="#EF4444" />}
              bgColor="bg-orange-50"
              textColor="text-orange-600"
            />
          </View>

          {currentCourse && (
            <Pressable 
              onPress={() => handleCoursePress(currentCourse.id)}
              className="mb-8"
            >
              <View 
                className="bg-[#002366] rounded-3xl p-5 overflow-hidden"
                style={{
                  shadowColor: "#002366",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.2,
                  shadowRadius: 15,
                  elevation: 8,
                }}
              >
                <View className="flex-row justify-between items-start mb-4">
                  <View className="flex-1 mr-3">
                    <Text className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">
                      Reprendre l&apos;activité
                    </Text>
                    <Text className="text-white text-xl font-bold mb-1">
                      {currentCourse.fullname}
                    </Text>
                    <View className="flex-row items-center flex-wrap">
                      <View className="flex-row items-center bg-white/10 rounded-full px-2 py-0.5 mr-2 mb-1">
                        <Ionicons name="book-outline" size={11} color="rgba(255,255,255,0.8)" />
                        <Text className="text-white/80 text-xs ml-1">
                          {getCompletedLessons(currentCourse)}/{getCourseLessonsCount(currentCourse)} leçons
                        </Text>
                      </View>
                      {getXpAllFromCourse(currentCourse.id) > 0 && (
                        <View className="flex-row items-center bg-orange-400/30 rounded-full px-2 py-0.5 mb-1">
                          <Text className="text-orange-300 text-xs font-bold">
                            ⭐ {getXpAllFromCourse(currentCourse.id)} XP
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View className="bg-white/20 p-2 rounded-xl">
                    <Ionicons name="play" size={24} color="white" />
                  </View>
                </View>

                <View className="mb-4">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-white/80 text-xs">Progression globale</Text>
                    <Text className="text-white text-xs font-bold">{getCourseProgress(currentCourse)}%</Text>
                  </View>
                  <View className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <View className="h-full bg-orange-400 rounded-full" style={{ width: `${getCourseProgress(currentCourse)}%` }} />
                  </View>
                </View>

                <View className="flex-row justify-between items-center">
                  {getCourseScore(currentCourse.id) && (
                    <View className="bg-green-500 px-3 py-1 rounded-full">
                      <Text className="text-white font-bold text-xs">★ {getCourseScore(currentCourse.id)}</Text>
                    </View>
                  )}
                  <View className="flex-row -space-x-2">
                  </View>
                  <View className="bg-white px-4 py-2 rounded-full">
                    <Text className="text-[#002366] font-bold text-xs">Continuer</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}

          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-900">Mes Cours</Text>
              <Pressable onPress={() => router.push("/(tabs)/(cours)" as any)}>
                <Text className="text-blue-600 font-semibold text-xs">Voir tout</Text>
              </Pressable>
            </View>

            <View>
              {isLoading ? (
                <View className="items-center py-8">
                  <ActivityIndicator size="large" color="#002366" />
                  <Text className="text-gray-500 mt-2">Chargement des cours...</Text>
                </View>
              ) : error ? (
                <View className="bg-red-50 p-4 rounded-2xl">
                  <Text className="text-red-600 text-center">{error}</Text>
                </View>
              ) : allCourses.length > 0 ? (
                allCourses.map(c => (
                  <HomeModuleCard
                    key={c.id}
                    module={{
                      id: String(c.id),
                      title: c.fullname,
                      description: c.coursecategory || "",
                      xp: getXpAllFromCourse(c.id),
                      isLocked: false,
                      lessonsCount: getCourseLessonsCount(c),
                      completedLessons: getCompletedLessons(c),
                      icon: "book",
                      iconColor: "#002366",
                      iconBg: "bg-blue-100",
                      levelId: getCourseLevel(c.fullname),
                      progress: getCourseProgress(c)
                    }}
                    onPress={() => handleCoursePress(c.id)}
                  />
                ))
              ) : (
                <View className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 items-center">
                  <Feather name="book-open" size={32} color="#D1D5DB" />
                  <Text className="text-gray-400 text-sm mt-2 font-medium">Aucun cours trouvé</Text>
                </View>
              )}
            </View>
          </View>

        </View>
      </ScrollView>
      
      {/* ✅ #5 Modal d'achat de vies */}
      <BuyHeartsModal
        isVisible={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        lives={lives}
        coins={stats.coins}
        nextHeartTime={stats.nextHeartTime}
        cost={lifeCost}
        onBuy={async () => {
          const result = await buyLife();
          if (result.success) {
            setShowBuyModal(false);
          }
          return result;
        }}
      />
    </SafeAreaView>
  );
}

function StatsCard({ label, value, icon, bgColor, textColor }: { 
  label: string;
  value: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
}) {
  return (
    <View className={`w-[48%] ${bgColor} p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm`}>
      <View className="flex-row justify-between items-center mb-1">
        <View className="p-1.5 rounded-lg bg-white shadow-sm">
          {icon}
        </View>
        <Text className={`text-base font-bold ${textColor}`}>{value}</Text>
      </View>
      <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-tight">{label}</Text>
    </View>
  );
}

function HomeModuleCard({ module, onPress }: { 
  module: ModuleData;
  onPress: () => void;
}) {
  // Safely calculate progress with fallbacks for undefined values
  const completedLessons = module.completedLessons ?? 0;
  const lessonsCount = module.lessonsCount ?? 0;
  const progress = lessonsCount > 0 ? Math.round((completedLessons / lessonsCount) * 100) : 0;
  const isCompleted = progress === 100;

  return (
    <Pressable 
      onPress={onPress}
      className={`bg-white p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm ${module.isLocked ? 'opacity-60' : ''}`}
    >
      <View className="flex-row items-center mb-3">
        <View className={`${module.isLocked ? 'bg-gray-100' : module.iconBg} w-10 h-10 rounded-xl items-center justify-center mr-3`}>
          {module.isLocked ? (
            <Feather name="lock" size={18} color="#9CA3AF" />
          ) : (
            getIconComponent(module.icon, 20, module.iconColor)
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-900 font-bold text-sm" numberOfLines={1}>{module.title}</Text>
            {isCompleted ? (
              <View className="bg-green-100 p-1 rounded-full">
                <Ionicons name="checkmark" size={12} color="#059669" />
              </View>
            ) : (
              <Text className="text-orange-500 font-bold text-[10px]">+{module.xp} XP</Text>
            )}
          </View>
          <Text className="text-gray-500 text-[10px]" numberOfLines={1}>{module.description}</Text>
        </View>
      </View>

      {!module.isLocked && (
        <View>
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-gray-400 text-[9px] font-medium">{completedLessons}/{lessonsCount} leçons</Text>
            <Text className="text-gray-600 text-[9px] font-bold">{progress}%</Text>
          </View>
          <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <View 
              className={`h-full rounded-full ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`} 
              style={{ width: `${progress}%` }} 
            />
          </View>
        </View>
      )}
    </Pressable>
  );
}

 

