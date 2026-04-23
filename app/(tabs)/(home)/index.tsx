import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Pressable, ScrollView, Text, View, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMoodleCourses } from "../../../hooks/useMoodleCourses";
import { useSelector } from "react-redux";
import { RootState } from "../../../services/redux/store";
import { getUserBadges } from "../../../services/api/badgeService";
import { getAllCourseProgress } from "../../../services/storage/course-progress";
import { getAllScoresForCourse } from "../../../services/storage/activity-progress";
import React from "react";

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

export default function HomeScreen() {
  const reduxUser = useSelector((state: RootState) => state.auth.user);
  const reduxToken = useSelector((state: RootState) => state.auth.token);
  const router = useRouter();
  
  const loggedUser = reduxUser;
  const activeToken = reduxToken || "";
  
const { courses, isLoading, error } = useMoodleCourses(activeToken);
  const [badgesCount, setBadgesCount] = useState(0);
  const [courseProgressMap, setCourseProgressMap] = useState<any>({});
  const [courseScoreMap, setCourseScoreMap] = useState<any>({});

  useEffect(() => {
    if (!loggedUser?.id || !activeToken) return;
    getUserBadges(activeToken, loggedUser.id)
      .then(b => setBadgesCount(b.length))
      .catch(() => setBadgesCount(0));
  }, [loggedUser?.id, activeToken]);

  useEffect(() => {
    const loadProgress = async () => {
      if (!courses || courses.length === 0) {
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
        
        for (const course of courses) {
          if (course.id) {
            const scores = await getAllScoresForCourse(course.id);
            setCourseScoreMap((prev: any) => ({ ...prev, [course.id]: scores }));
          }
        }
        
        setCourseProgressMap(progressMap);
        console.log('[Home] Loaded progress for', Object.keys(progressMap).length, 'courses');
      } catch (err) {
        console.warn('[Home] Failed to load progress:', err);
        setCourseProgressMap({});
        setCourseScoreMap({});
      }
    };
    loadProgress();
  }, [courses, activeToken]);

  const handleSettingsPress = () => {
    router.push("/(settings)/index" as any);
  };

  const handleCoursePress = (courseId: number) => {
    router.push(`/(stacks)/(cours)/${courseId}` as any);
  };

  const getCourseProgress = (course: any) => {
    const dbProgress = courseProgressMap[course.id];
    if (dbProgress && dbProgress.total > 0) {
      return Math.round((dbProgress.completed / dbProgress.total) * 100);
    }
    return course.progress || 0;
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

  const getCourseLessonsCount = (course: any): number => course.lessonsCount || 0;
  const getCompletedLessons = (course: any) => {
    const progress = getCourseProgress(course);
    const total = getCourseLessonsCount(course);
    return Math.floor((progress / 100) * total);
  };

  const getCourseLevel = (courseName: string): number => {
    if (!courseName) return 1;
    const match = courseName.match(/niveau\s*(\d+)/i) || courseName.match(/(\d+)\s*[èe]me/i);
    return match ? parseInt(match[1], 10) : 1;
  };

  const filteredCourses = courses;

  const currentCourse = courses.find((c: any) => (c.progress || 0) > 0 && (c.progress || 0) < 100) || courses[0];
  const totalXP = loggedUser?.ipelan_xp || 0;
  const streak = loggedUser?.streak || 0;

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

            <View className="flex-row items-center space-x-3">
              <View className="flex-row items-center bg-white px-2 py-1 rounded-full border border-gray-100 shadow-sm">
                <Text className="text-sm mr-1">🔥</Text>
                <Text className="font-bold text-xs text-[#EF4444]">{streak}</Text>
              </View>
              <View className="flex-row items-center bg-white px-2 py-1 rounded-full border border-gray-100 shadow-sm">
                <Ionicons name="medal" size={14} color="#8B5CF6" />
                <Text className="font-bold text-xs text-[#8B5CF6] ml-1">{badgesCount}</Text>
              </View>
              <Pressable onPress={handleSettingsPress} className="p-2 bg-white rounded-full border border-gray-100 shadow-sm">
                <Feather name="settings" size={18} color="#374151" />
              </Pressable>
            </View>
          </View>

          <View className="flex-row flex-wrap justify-between mb-8">
            <StatsCard 
              label="XP Total" 
              value={`${totalXP}`} 
              icon={<AntDesign name="star" size={16} color="#F59E0B" />}
              bgColor="bg-orange-50"
              textColor="text-orange-600"
            />
            <StatsCard 
              label="Jours Série" 
              value={`${streak}`} 
              icon={<Ionicons name="flame" size={16} color="#EF4444" />}
              bgColor="bg-red-50"
              textColor="text-red-600"
            />
            <StatsCard 
              label="Badges" 
              value={`${badgesCount}`} 
              icon={<Ionicons name="medal" size={16} color="#8B5CF6" />}
              bgColor="bg-purple-50"
              textColor="text-purple-600"
            />
            <StatsCard 
              label="Cours" 
              value={`${courses.length}`} 
              icon={<Feather name="book-open" size={16} color="#10B981" />}
              bgColor="bg-green-50"
              textColor="text-green-600"
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
                  <View>
                    <Text className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">
                      Reprendre l&apos;activité
                    </Text>
                    <Text className="text-white text-xl font-bold">
                      {currentCourse.fullname}
                    </Text>
                  </View>
                  <View className="bg-white/20 p-2 rounded-xl">
                    <Ionicons name="play" size={24} color="white" />
                  </View>
                </View>
                
                <View className="mb-4">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-white/80 text-xs">Progression</Text>
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
              ) : filteredCourses.length > 0 ? (
                filteredCourses.map((course) => (
                  <HomeModuleCard 
                    key={course.id}
                    module={{
                      id: String(course.id),
                      title: course.fullname,
                      description: course.coursecategory || "",
                      xp: 50,
                      isLocked: false,
                      lessonsCount: getCourseLessonsCount(course),
                      completedLessons: getCompletedLessons(course),
                      icon: "book",
                      iconColor: "#002366",
                      iconBg: "bg-blue-100",
                      levelId: getCourseLevel(course.fullname)
                    }}
                    onPress={() => handleCoursePress(course.id)}
                  />
                ))
              ) : (
                <View className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 items-center">
                  <Feather name="book-open" size={32} color="#D1D5DB" />
                  <Text className="text-gray-400 text-sm mt-2 font-medium">Aucun cours dans ce niveau</Text>
                </View>
              )}
            </View>
          </View>

        </View>
      </ScrollView>
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
  const progress = Math.round((module.completedLessons / module.lessonsCount) * 100);
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
            <Text className="text-gray-400 text-[9px] font-medium">{module.completedLessons}/{module.lessonsCount} leçons</Text>
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

function QuickActionCard({ action, icon, onPress }: { 
  action: QuickActionData;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable 
      onPress={onPress}
      className={`w-[48%] ${action.bgColor} rounded-3xl p-4 mb-3 border border-gray-100 shadow-sm`}
    >
      <View className="w-10 h-10 rounded-2xl bg-white items-center justify-center mb-3 shadow-sm">
        {icon}
      </View>
      <Text className="font-bold text-gray-900 text-sm">{action.title}</Text>
      <Text className="text-gray-500 text-[10px] mt-0.5" numberOfLines={1}>{action.subtitle}</Text>
    </Pressable>
  );
}
