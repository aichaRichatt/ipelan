import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { useLogin } from "../../../hooks/useLogin";
import { useMoodleCourses, CourseInput } from "../../../hooks/useMoodleCourses";
import { useLives } from "../../../hooks/useLives";
import { getEnrolledCoursesByTimeline } from "../../../services/api/courseService";
import { RootState } from "../../../services/redux/store";

const getLevelFromXP = (xp: number): { level: number; title: string } => {
  if (xp < 100) return { level: 1, title: "Débutant" };
  if (xp < 300) return { level: 2, title: "Apprenant" };
  if (xp < 600) return { level: 3, title: "Intermédiaire" };
  if (xp < 1000) return { level: 4, title: "Avancé" };
  return { level: 5, title: "Expert" };
};

export default function ProgressScreen() {
  const router = useRouter();
  const { user } = useLogin();
  const token = useSelector((state: RootState) => state.auth.token);
  const [courseInputs, setCourseInputs] = useState<CourseInput[]>([]);
  const { lives, coins, maxLives, canBuyLife, isBuying, lifeCost, error, buyLife } = useLives();

  useEffect(() => {
    const fetchCourses = async () => {
      if (!token) return;
      try {
        const response = await getEnrolledCoursesByTimeline(token);
        if (response?.courses) {
          const visible = response.courses.filter((c: any) => c.visible !== false);
          setCourseInputs(visible.map((c: any) => ({ id: c.id, name: c.fullname || c.shortname })));
        }
      } catch (err) {
        console.warn('[Progress] Failed to fetch courses:', err);
      }
    };
    fetchCourses();
  }, [token]);

  const { 
    progressList, 
    loading, 
    totalXP, 
    totalCompleted, 
    currentStreak, 
    badgesWithStatus,
    reload
  } = useMoodleCourses(courseInputs, user?.id || null);

  const completedCourses = progressList.filter(c => c.completionPercent === 100).length;
  const inProgressCourses = progressList.filter(c => c.completionPercent > 0 && c.completionPercent < 100).length;

  const { level, title } = getLevelFromXP(totalXP);

  const globalProgress = progressList.length > 0
    ? Math.round(progressList.reduce((sum, c) => sum + c.completionPercent, 0) / progressList.length)
    : 0;

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <View className="px-5 py-4 flex-row justify-between items-center">
        <Text className="text-lg font-black tracking-wider uppercase text-gray-800">PROGRESSION</Text>
        <Pressable className="p-2" onPress={() => router.push("/(settings)/index")}>
          <Feather name="settings" size={22} color="#374151" />
        </Pressable>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading && progressList.length > 0} onRefresh={reload} />
        }
      >
        <View className="px-5 mb-6">
          <View className="bg-white rounded-3xl p-6 border border-gray-200" style={{
            shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
          }}>
            <View className="flex-row items-center mb-6 justify-between">
              <View className="flex-row items-center">
                <View className="w-16 h-16 rounded-full bg-[#002366] items-center justify-center mr-4">
                  <Text className="text-white text-2xl font-bold">
                    {user?.firstname?.charAt(0) || user?.username?.charAt(0) || 'U'}
                  </Text>
                </View>
                <View>
                  <Text className="text-xl font-bold text-gray-900">{user?.fullname || user?.username || "Utilisateur"}</Text>
                  <Text className="text-gray-500 text-sm">Niveau {level} - {title}</Text>
                </View>
              </View>
              
              <View className="items-end">
                <View className="flex-row items-center mb-1 bg-red-50 px-3 py-1 rounded-full">
                  <Text className="text-red-500 font-bold mr-1">{lives}/{maxLives}</Text>
                  <Text className="text-lg">❤️</Text>
                </View>
                <View className="flex-row items-center bg-yellow-50 px-3 py-1 rounded-full">
                  <Text className="text-yellow-600 font-bold mr-1">{coins}</Text>
                  <Text className="text-lg">🪙</Text>
                </View>
              </View>
            </View>

            {canBuyLife && (
              <Pressable 
                onPress={buyLife}
                disabled={isBuying}
                className={`flex-row items-center justify-center py-2 rounded-xl mb-4 ${isBuying ? 'bg-gray-300' : 'bg-[#002366]'}`}
              >
                <Text className="text-white font-bold mr-2">Acheter 1 vie ({lifeCost} 🪙)</Text>
                <Text>❤️</Text>
              </Pressable>
            )}
            
            {error && <Text className="text-red-500 text-center mb-4 text-sm font-bold">{error}</Text>}

            <View className="flex-row justify-between pt-2 border-t border-gray-100">
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-yellow-100 items-center justify-center mb-2">
                  <Feather name="star" size={24} color="#F59E0B" />
                </View>
                <Text className="text-xl font-bold text-gray-900">{totalXP}</Text>
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
                <Text className="text-xl font-bold text-gray-900">{currentStreak}</Text>
                <Text className="text-xs text-gray-500">Jours</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">Statistiques des Cours</Text>
          <View className="bg-white rounded-3xl p-4 border border-gray-200">
            {loading && progressList.length === 0 ? (
              <View className="items-center py-4"><ActivityIndicator size="small" color="#002366" /></View>
            ) : (
              <>
                <View className="flex-row justify-center items-end mb-4 pb-2">
                  <View className="items-center mx-2">
                    <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center mb-2"><Feather name="book" size={20} color="#6B7280" /></View>
                    <Text className="text-xs font-bold text-gray-700">Total</Text>
                    <Text className="text-lg font-bold text-gray-900">{progressList.length}</Text>
                    <Text className="text-xs text-gray-500">cours</Text>
                    <View className="w-12 h-8 bg-gray-300 rounded-t-md" />
                  </View>
                  <View className="items-center mx-2 z-10">
                    <Text className="text-lg mb-1">✨</Text>
                    <View className="w-14 h-14 rounded-full bg-green-100 items-center justify-center mb-2"><AntDesign name="check" size={24} color="#10B981" /></View>
                    <Text className="text-xs font-bold text-gray-900">Terminé</Text>
                    <Text className="text-lg font-bold text-green-600">{completedCourses}</Text>
                    <View className="w-14 h-10 bg-green-300 rounded-t-md" />
                  </View>
                  <View className="items-center mx-2">
                    <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mb-2"><Ionicons name="play" size={20} color="#4a90e2" /></View>
                    <Text className="text-xs font-bold text-gray-700">En cours</Text>
                    <Text className="text-lg font-bold text-blue-600">{inProgressCourses}</Text>
                    <View className="w-12 h-6 bg-blue-200 rounded-t-md" />
                  </View>
                </View>
                <View className="border-t border-gray-100 pt-4 mt-2">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-sm font-medium text-gray-700">Progression globale</Text>
                    <Text className="text-sm font-bold text-gray-900">{globalProgress}%</Text>
                  </View>
                  <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <View className="h-full bg-[#4a90e2] rounded-full" style={{ width: `${globalProgress}%` }} />
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
              {badgesWithStatus.map(badge => (
                <View key={badge.id} className={`rounded-2xl p-4 mr-3 items-center w-24 ${badge.earned ? 'bg-white border border-gray-200' : 'bg-gray-100 opacity-50'}`} style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                  <Text className="text-3xl mb-2">{badge.icon}</Text>
                  <Text className="text-xs font-bold text-gray-900 text-center" numberOfLines={2}>{badge.name}</Text>
                  {badge.earned ? <View className="mt-1"><Feather name="check-circle" size={12} color="#10B981" /></View> : <Feather name="lock" size={12} color="#9CA3AF" className="mt-1" />}
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
              <Text className="text-sm font-bold text-gray-900">{totalCompleted}</Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View className="h-full bg-[#4a90e2] rounded-full" style={{ width: `${Math.min((totalCompleted / 50) * 100, 100)}%` }} />
            </View>
            <Text className="text-[10px] text-gray-400 mt-1">Objectif: 50 leçons</Text>
          </View>
          <View className="bg-white rounded-2xl p-4 border border-gray-200 mb-3">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-medium text-gray-700">Cours terminés</Text>
              <Text className="text-sm font-bold text-gray-900">{completedCourses}/{progressList.length || 0}</Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View className="h-full bg-[#10B981] rounded-full" style={{ width: `${progressList.length > 0 ? (completedCourses / progressList.length) * 100 : 0}%` }} />
            </View>
          </View>
          <View className="bg-white rounded-2xl p-4 border border-gray-200">
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-center">
                <Text className="text-sm font-medium text-gray-700">Pièces d&apos;or</Text>
                <Text className="ml-1">🪙</Text>
              </View>
              <Text className="text-sm font-bold text-yellow-600">{user?.coins || 0}</Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.min(((user?.coins || 0) / 500) * 100, 100)}%` }} />
            </View>
            <Text className="text-[10px] text-gray-400 mt-1">Objectif: 500 pièces</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}