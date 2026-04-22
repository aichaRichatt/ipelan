import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { Pressable, Text, View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useLogin } from "../../../hooks/useLogin";
import { useSelector } from "react-redux";
import { RootState } from "../../../services/redux/store";
import { getEnrolledCoursesByTimeline, getCourseContents } from "../../../services/api/courseService";
import { getUserBadges } from "../../../services/api/badgeService";
import { getAllCourseProgress, CourseProgressData } from "../../../services/storage/course-progress";
import { getAllScoresForCourse } from "../../../services/storage/activity-progress";

interface UserCourse {
  id: number;
  fullname: string;
  progress: number;
  visible: boolean;
  lessonsCount: number;
  dbProgress?: CourseProgressData;
  totalScore?: string;
}

export default function ProgressScreen() {
  const router = useRouter();
  const { user } = useLogin();
  const token = useSelector((state: RootState) => state.auth.token);
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [badgesCount, setBadgesCount] = useState(0);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const response = await getEnrolledCoursesByTimeline(token);
        if (response?.courses) {
          const visible = response.courses.filter((c: any) => c.visible !== false);
          const allProgress = await getAllCourseProgress();
          const progressMap = new Map(allProgress.map(p => [p.courseId, p]));
          
          const enriched: UserCourse[] = await Promise.all(
            visible.map(async (c: any) => {
              let lessonsCount = 0;
              let dbProgress = progressMap.get(c.id);
              let totalScore: string | undefined;
              
              try {
                const sections = await getCourseContents(token, c.id);
                if (Array.isArray(sections)) {
                  sections.forEach((s: any) => { if (s.modules) lessonsCount += s.modules.length; });
                }
              } catch { }
              
              if (dbProgress) {
                const scores = await getAllScoresForCourse(c.id);
                if (scores.size > 0) {
                  let best = 0, total = 0;
                  scores.forEach(s => { best += s.bestScore; total += s.totalScore; });
                  if (total > 0) totalScore = `${best}/${total}`;
                }
              }
              
              return { 
                id: c.id, 
                fullname: c.fullname, 
                progress: dbProgress && dbProgress.totalActivities > 0 
                  ? Math.round((dbProgress.completedActivities / dbProgress.totalActivities) * 100)
                  : c.progress || 0, 
                visible: c.visible ?? true, 
                lessonsCount,
                dbProgress,
                totalScore
              };
            })
          );
          console.log('[Progress] Loaded', enriched.length, 'courses with progress from DB');
          setCourses(enriched);
        }
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, [token]);

  useEffect(() => {
    if (!user?.id || !token) return;
    getUserBadges(token, user.id)
      .then(b => setBadgesCount(b.length))
      .catch(() => setBadgesCount(0));
  }, [user?.id, token]);

  const totalLessons = courses.reduce((sum, c) => sum + c.lessonsCount, 0);
  const completedLessons = courses.reduce((sum, c) => sum + Math.floor((c.progress / 100) * c.lessonsCount), 0);
  const completedCourses = courses.filter(c => c.progress === 100).length;
  const inProgressCourses = courses.filter(c => c.progress > 0 && c.progress < 100).length;

  const userXP = user?.ipelan_xp || 0;
  const userStreak = user?.streak || 0;
  const userCoins = user?.coins || 0;

  const getLevelFromXP = (xp: number): { level: number; title: string } => {
    if (xp < 100) return { level: 1, title: "Débutant" };
    if (xp < 300) return { level: 2, title: "Apprenant" };
    if (xp < 600) return { level: 3, title: "Intermédiaire" };
    if (xp < 1000) return { level: 4, title: "Avancé" };
    return { level: 5, title: "Expert" };
  };

  const { level, title } = getLevelFromXP(userXP);

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <View className="px-5 py-4 flex-row justify-between items-center">
        <Text className="text-lg font-black tracking-wider uppercase text-gray-800">PROGRESSION</Text>
        <Pressable className="p-2" onPress={() => router.push("/(settings)/index")}>
          <Feather name="settings" size={22} color="#374151" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        
        <View className="px-5 mb-6">
          <View className="bg-white rounded-3xl p-6 border border-gray-200" style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}>
            <View className="flex-row items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-[#002366] items-center justify-center mr-4">
                <Text className="text-white text-2xl font-bold">
                  {user?.firstname?.charAt(0) || user?.username?.charAt(0) || 'U'}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-gray-900">
                  {user?.fullname || user?.username || "Utilisateur"}
                </Text>
                <Text className="text-gray-500 text-sm">Niveau {level} - {title}</Text>
              </View>
            </View>

            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-yellow-100 items-center justify-center mb-2">
                  <Feather name="star" size={24} color="#F59E0B" />
                </View>
                <Text className="text-xl font-bold text-gray-900">{userXP}</Text>
                <Text className="text-xs text-gray-500">XP Total</Text>
              </View>
              
              <View className="w-px bg-gray-200" />
              
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-green-100 items-center justify-center mb-2">
                  <AntDesign name="trophy" size={24} color="#10B981" />
                </View>
                <Text className="text-xl font-bold text-gray-900">{level}</Text>
                <Text className="text-xs text-gray-500">Niveau</Text>
              </View>
              
              <View className="w-px bg-gray-200" />
              
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-orange-100 items-center justify-center mb-2">
                  <Text className="text-xl">🔥</Text>
                </View>
                <Text className="text-xl font-bold text-gray-900">{userStreak}</Text>
                <Text className="text-xs text-gray-500">Jours</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">Statistiques des Cours</Text>
          
          <View className="bg-white rounded-3xl p-4 border border-gray-200">
            {isLoading ? (
              <View className="items-center py-4">
                <ActivityIndicator size="small" color="#002366" />
              </View>
            ) : (
              <>
                <View className="flex-row justify-center items-end mb-4 pb-2">
                  <View className="items-center mx-2">
                    <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center mb-2">
                      <Feather name="book" size={20} color="#6B7280" />
                    </View>
                    <Text className="text-xs font-bold text-gray-700">Total</Text>
                    <Text className="text-lg font-bold text-gray-900">{courses.length}</Text>
                    <Text className="text-xs text-gray-500">cours</Text>
                    <View className="w-12 h-8 bg-gray-300 rounded-t-md" />
                  </View>
                  
                  <View className="items-center mx-2 z-10">
                    <Text className="text-lg mb-1">✨</Text>
                    <View className="w-14 h-14 rounded-full bg-green-100 items-center justify-center mb-2">
                      <AntDesign name="check" size={24} color="#10B981" />
                    </View>
                    <Text className="text-xs font-bold text-gray-900">Terminé</Text>
                    <Text className="text-lg font-bold text-green-600">{completedCourses}</Text>
                    <View className="w-14 h-10 bg-green-300 rounded-t-md" />
                  </View>
                  
                  <View className="items-center mx-2">
                    <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mb-2">
                      <Ionicons name="play" size={20} color="#4a90e2" />
                    </View>
                    <Text className="text-xs font-bold text-gray-700">En cours</Text>
                    <Text className="text-lg font-bold text-blue-600">{inProgressCourses}</Text>
                    <View className="w-12 h-6 bg-blue-200 rounded-t-md" />
                  </View>
                </View>

                <View className="border-t border-gray-100 pt-4 mt-2">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-sm font-medium text-gray-700">Progression globale</Text>
                    <Text className="text-sm font-bold text-gray-900">
                      {courses.length > 0 
                        ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length)
                        : 0}%
                    </Text>
                  </View>
                  <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <View 
                      className="h-full bg-[#4a90e2] rounded-full" 
                      style={{ 
                        width: `${courses.length > 0 
                          ? courses.reduce((sum, c) => sum + c.progress, 0) / courses.length
                          : 0}%` 
                      }} 
                    />
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">Badges & Récompenses</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row">
              {[
                { id: '1', emoji: '🎯', name: 'Premier cours', earned: courses.length > 0 },
                { id: '2', emoji: '📖', name: 'Lecteur assidu', earned: completedLessons >= 5 },
                { id: '3', emoji: '🔥', name: 'Série de 7 jours', earned: userStreak >= 7 },
                { id: '4', emoji: '⭐', name: '100 XP', earned: userXP >= 100 },
                { id: '5', emoji: '🏆', name: 'Cours terminé', earned: completedCourses >= 1 },
                { id: '6', emoji: '🎓', name: 'Expert', earned: userXP >= 500 },
              ].map(badge => (
                <View 
                  key={badge.id}
                  className={`rounded-2xl p-4 mr-3 items-center w-24 ${
                    badge.earned ? 'bg-white border border-gray-200' : 'bg-gray-100 opacity-50'
                  }`}
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                >
                  <Text className="text-3xl mb-2">{badge.emoji}</Text>
                  <Text className="text-xs font-bold text-gray-900 text-center" numberOfLines={2}>
                    {badge.name}
                  </Text>
                  {badge.earned ? (
                    <View className="mt-1">
                      <Feather name="check-circle" size={12} color="#10B981" />
                    </View>
                  ) : (
                    <Feather name="lock" size={12} color="#9CA3AF" className="mt-1" />
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">Aperçu</Text>
          
          <View className="bg-white rounded-2xl p-4 border border-gray-200 mb-3">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-medium text-gray-700">Leçons complétées</Text>
              <Text className="text-sm font-bold text-gray-900">{completedLessons}/{totalLessons}</Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View 
                className="h-full bg-[#4a90e2] rounded-full" 
                style={{ width: `${totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0}%` }} 
              />
            </View>
          </View>

          <View className="bg-white rounded-2xl p-4 border border-gray-200 mb-3">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-medium text-gray-700">Cours terminés</Text>
              <Text className="text-sm font-bold text-gray-900">{completedCourses}/{courses.length || 1}</Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View 
                className="h-full bg-[#10B981] rounded-full" 
                style={{ width: `${courses.length > 0 ? (completedCourses / courses.length) * 100 : 0}%` }} 
              />
            </View>
          </View>

          <View className="bg-white rounded-2xl p-4 border border-gray-200">
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-center">
                <Text className="text-sm font-medium text-gray-700">Pièces d&apos;or</Text>
                <Text className="ml-1">🪙</Text>
              </View>
              <Text className="text-sm font-bold text-yellow-600">{userCoins}</Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.min((userCoins / 500) * 100, 100)}%` }} />
            </View>
          </View>

          <View className="bg-white rounded-2xl p-4 border border-gray-200 mt-3">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-medium text-gray-700">Score total activités</Text>
              {(() => {
                let totalBest = 0, totalMax = 0;
                courses.forEach(c => {
                  if (c.totalScore) {
                    const [best, max] = c.totalScore.split('/').map(Number);
                    totalBest += best;
                    totalMax += max;
                  }
                });
                return (
                  <Text className="text-sm font-bold text-green-600">
                    {totalMax > 0 ? `${totalBest}/${totalMax}` : '-'}
                  </Text>
                );
              })()}
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              {(() => {
                let totalBest = 0, totalMax = 0;
                courses.forEach(c => {
                  if (c.totalScore) {
                    const [best, max] = c.totalScore.split('/').map(Number);
                    totalBest += best;
                    totalMax += max;
                  }
                });
                return (
                  <View 
                    className="h-full bg-green-500 rounded-full" 
                    style={{ width: `${totalMax > 0 ? (totalBest / totalMax) * 100 : 0}%` }} 
                  />
                );
              })()}
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}