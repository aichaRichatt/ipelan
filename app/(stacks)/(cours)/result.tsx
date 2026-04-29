import { getCourseContents } from "@/services/api/courseService";
import { awardXPForActivity } from "@/services/api/xpService";
import { getAuthToken } from "@/services/contentLoader";
import { processActivityResults, triggerGamificationSync } from "@/services/gamification/gamificationService";
import { updateUser } from "@/services/redux/slices/authSlice";
import { RootState } from "@/services/redux/store";
import { getBestScore, saveActivityScore } from "@/services/storage/activity-progress";
import { updateCourseProgressFromActivities } from "@/services/storage/course-progress";
import { syncAfterActivityWithRetry } from "@/services/sync/progressSync";
import { syncQueue } from "@/services/sync/syncQueue";
import { ActivityType } from "@/utils/xpCalculator";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

const IS_DEV = process.env.NODE_ENV === "development";

const activityTypeMap: Record<string, ActivityType> = {
  'Quiz': 'quiz',
  'Dictée audio': 'dictation',
  'Listening': 'listening',
  'Association': 'association',
  'Ordre des mots': 'wordOrder',
};

export default function ResultScreen() {
  const router = useRouter();
  const token = useSelector((state: RootState) => state.auth.token);
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const params = useLocalSearchParams<{
    activity?: string;
    score?: string;
    total?: string;
    xp?: string;
    moduleId?: string;
    instanceId?: string;
    moduleTitle?: string;
    courseId?: string;
    returnRoute?: string;
    totalActivities?: string;
  }>();
  
  const score = parseInt(params.score || "0", 10);
  const total = parseInt(params.total || "1", 10);
  const xp = parseInt(params.xp || "0", 10);
  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);
  const activityType = activityTypeMap[params.activity || ''] || 'quiz';
  
  const percentage = Math.round((score / Math.max(total, 1)) * 100);
  const isCompleted = percentage >= 50;

  const [earnedCoins, setEarnedCoins] = useState(0);
  const [lostLives, setLostLives] = useState(0);
  const [newBadge, setNewBadge] = useState<any | null>(null);
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

 
  const [syncStatus, setSyncStatus] = useState<'pending' | 'syncing' | 'success' | 'error'>('pending');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const saveProgress = async () => {
      if (!moduleId || !courseId) {
        if (IS_DEV) console.log('[Result] Missing moduleId or courseId');
        return;
      }

      let activityCount = 0;
      try {
        const sections = await getCourseContents(token || '', courseId);
        if (sections && sections.length > 0) {
          activityCount = sections.reduce((sum, s) => sum + (s.modules?.length || 0), 0);
        }
      } catch (err) {
        if (IS_DEV) console.warn('[Result] Failed to get course contents:', err);
        activityCount = 1;
      }

      if (IS_DEV) {
        console.log('[Result] Saving progress:', {
          moduleId,
          courseId,
          activityType,
          score,
          total,
          xp,
          isCompleted,
          totalActivities: activityCount,
        });
      }

      try {
        // ✅ Étape 1 : Sauvegarder localement en SQLite
        setSyncStatus('pending');
        setSyncMessage('Sauvegarde en cours...');

        let cEarned = 0;
        let lLost = 0;

        if (userId) {
          const { coinsEarned, livesLost } = await processActivityResults(userId, score, total);
          cEarned = coinsEarned;
          lLost = livesLost;
          setEarnedCoins(coinsEarned);
          setLostLives(livesLost);

          if (user) {
             dispatch(updateUser({
               coins: (user.coins || 0) + coinsEarned,
               lives: Math.max(0, (user.lives ?? 6) - livesLost)
             }));
          }
        }

        // ✅ Étape 1 : Sauvegarder localement en SQLite
        setSyncStatus('pending');
        setSyncMessage('Sauvegarde en cours...');

        await saveActivityScore(moduleId, courseId, activityType, score, total, xp, userId || undefined, cEarned, token || undefined);
        await updateCourseProgressFromActivities(courseId, activityCount);

        // ✅ Étape 1.5 : Calculer les nouveaux badges (APRES avoir mis à jour les stats globales)
        if (userId) {
          const { getGlobalGamificationStats } = await import('@/services/gamification/gamificationService');
          const { calculateNewBadges, saveBadge, getUserBadges } = await import('@/services/storage/badge-storage');
          
          const currentStats = await getGlobalGamificationStats(userId);
          const existingBadges = await getUserBadges(userId);
          const existingIds = existingBadges.map(b => b.badgeId);
          
          const newEarned = calculateNewBadges({
            completedLessons: currentStats.totalCompletedActivities,
            currentStreak: currentStats.streak,
            totalXP: currentStats.totalXp,
            quizPassed: 0,
            perfectScores: currentStats.perfectScores,
            daysActive: currentStats.streak
          }, existingIds);

          if (newEarned.length > 0) {
            for (const b of newEarned) {
              await saveBadge(userId, b.id);
            }
            // Mettre à jour l'UI avec le dernier badge gagné
            setNewBadge(newEarned[newEarned.length - 1]);
          }

          // ✅ Étape 2 : Déclencher la synchronisation globale (XP, Coins, Lives, Streak, Badges)
          const { triggerGamificationSync } = await import('@/services/gamification/gamificationService');
          await triggerGamificationSync(userId, token || undefined);
        }

        if (IS_DEV) {
          console.log('[Result] ✅ Local save successful');
        }

        if (token) {
          setSyncStatus('syncing');
          setSyncMessage('Synchronisation avec Moodle...');

          // ✅ Étape 3 : Synchroniser la complétion de l'activité (Grade/Completion)
          syncAfterActivityWithRetry(moduleId, courseId, activityType, score, total, xp, instanceId, 3, token || undefined, userId)
            .then(() => {
              setSyncStatus('success');
              setSyncMessage('✅ Synchronisé avec Moodle');

              if (IS_DEV) {
                console.log('[Result] ✅ Moodle progress sync completed');
              }

              setTimeout(() => {
                setSyncMessage(null);
              }, 2000);
            })
            .catch((err) => {
              setSyncStatus('error');
              setSyncMessage(`⚠️ Erreur: ${err.message || 'Sync échouée'}`);

              if (IS_DEV) {
                console.error('[Result] Moodle sync exception:', err);
              }
            });
        } else {
          setSyncStatus('pending');
          setSyncMessage('Mode hors ligne (sync au redémarrage)');

          if (IS_DEV) {
            console.log('[Result] No token, offline mode');
          }
        }

        const savedProgress = await getBestScore(moduleId, courseId);
        if (IS_DEV) {
          console.log('[Result] Best score saved:', {
            bestScore: savedProgress?.bestScore,
            totalScore: savedProgress?.totalScore,
            xpEarned: savedProgress?.xpEarned,
          });
        }

        // Check if course is completed (100%) and move to next course
        if (isCompleted && courseId) {
          try {
            const { getCourseProgressForCompletion } = await import('@/services/storage/course-progress');
            const courseProgress = await getCourseProgressForCompletion(courseId);
            
            if (courseProgress && courseProgress.progress >= 100) {
              console.log('[Result] Course completed! Finding next course...');
              
              // Get all courses for user's language/grade to find next one
              const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
              const PREFERENCES_KEY = '@ipelan_preferences';
              const prefsStr = await AsyncStorage.getItem(PREFERENCES_KEY);
              
              if (prefsStr && token) {
                const preferences = JSON.parse(prefsStr);
                const { getCoursesForLanguageAndGrade } = await import('@/services/api/courseService');
                const allCourses = await getCoursesForLanguageAndGrade(token, preferences.language, preferences.grade);
                
                // Find current course index
                const currentIndex = allCourses.findIndex((c: any) => c.id === courseId);
                
                if (currentIndex >= 0 && currentIndex < allCourses.length - 1) {
                  const nextCourse = allCourses[currentIndex + 1];
                  console.log('[Result] Next course found:', nextCourse.fullname);
                  
                  // Show success message then redirect
                  setSyncMessage('🎉 Cours terminé! Passage au suivant...');
                  
                  setTimeout(() => {
                    router.push(`/(stacks)/(cours)/${nextCourse.id}` as any);
                  }, 2000);
                  return; // Exit early, we're redirecting
                } else {
                  console.log('[Result] All courses completed!');
                  setSyncMessage('🎉 Félicitations! Vous avez terminé tous les cours!');
                }
              }
            }
          } catch (err) {
            console.warn('[Result] Failed to check course completion:', err);
          }
        }
      } catch (err) {
        setSyncStatus('error');
        setSyncMessage(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);

        if (IS_DEV) {
          console.error('[Result] Failed to save activity progress:', err);
        }
      }
    };
    saveProgress();
  }, [moduleId, courseId, activityType, score, total, isCompleted, xp, instanceId, token, userId]);
  
  const getGrade = () => {
    if (percentage >= 90) return { text: "Excellent !", color: "#10B981" };
    if (percentage >= 70) return { text: "Bien joué !", color: "#4a90e2" };
    if (percentage >= 50) return { text: "Continue !", color: "#F59E0B" };
    return { text: "Persévère !", color: "#EF4444" };
  };
  
  const grade = getGrade();
  
  const decodedReturnRoute = params.returnRoute ? decodeURIComponent(params.returnRoute) : `/(stacks)/(cours)/${params.courseId || ''}`;

  const handleContinue = () => {
    if (decodedReturnRoute.startsWith("/(")) {
      router.push(decodedReturnRoute as any);
    } else {
      router.push(`/(stacks)/(cours)/${params.courseId || ''}` as any);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">Résultats</Text>
      </View>
      
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
        <View className="flex-1 items-center justify-center px-5 py-10">
          <View className="bg-white rounded-3xl p-8 items-center shadow-lg w-full max-w-sm">
            <View 
              className="w-40 h-40 rounded-full items-center justify-center mb-6"
              style={{ 
                borderWidth: 8,
                borderColor: grade.color,
                backgroundColor: grade.color + '10'
              }}
            >
              <Text className="text-5xl font-black" style={{ color: grade.color }}>
                {percentage}%
              </Text>
            </View>

            <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
              {grade.text}
            </Text>
            
            <Text className="text-gray-500 text-center mb-2">
              {params.activity || "Activité"}
            </Text>
            <Text className="text-gray-500 text-center mb-6">
              {score} bonnes réponses sur {total}
            </Text>

            <View className="flex-row w-full justify-center mb-6 flex-wrap">
              <View className="bg-purple-100 rounded-2xl px-4 py-3 mr-2 mb-2 flex-row items-center">
                <Text className="text-xl mr-2">⭐</Text>
                <Text className="text-purple-700 font-bold text-lg">+{xp} XP</Text>
              </View>
              {earnedCoins > 0 && (
                <View className="bg-yellow-100 rounded-2xl px-4 py-3 mr-2 mb-2 flex-row items-center">
                  <Text className="text-xl mr-2">🪙</Text>
                  <Text className="text-yellow-700 font-bold text-lg">+{earnedCoins}</Text>
                </View>
              )}
              {lostLives > 0 && (
                <View className="bg-red-100 rounded-2xl px-4 py-3 mb-2 flex-row items-center">
                  <Text className="text-xl mr-2">💔</Text>
                  <Text className="text-red-700 font-bold text-lg">-{lostLives}</Text>
                </View>
              )}
            </View>

            {/* ✅ AFFICHER L'ÉTAT DE SYNCHRONISATION */}
            {syncMessage && (
              <View
                className={`w-full rounded-2xl p-4 mb-6 flex-row items-center ${
                  syncStatus === 'success'
                    ? 'bg-green-100'
                    : syncStatus === 'syncing'
                      ? 'bg-blue-100'
                      : 'bg-orange-100'
                }`}
              >
                {syncStatus === 'syncing' && (
                  <ActivityIndicator size="small" color="#002366" style={{ marginRight: 12 }} />
                )}
                {syncStatus === 'success' && (
                  <Feather name="check-circle" size={20} color="#10B981" style={{ marginRight: 12 }} />
                )}
                {syncStatus === 'error' && (
                  <Feather name="alert-circle" size={20} color="#F59E0B" style={{ marginRight: 12 }} />
                )}
                <Text
                  className={`flex-1 text-sm font-medium ${
                    syncStatus === 'success'
                      ? 'text-green-700'
                      : syncStatus === 'syncing'
                        ? 'text-blue-700'
                        : 'text-orange-700'
                  }`}
                >
                  {syncMessage}
                </Text>
              </View>
            )}

            {newBadge && (
              <View className="bg-gradient-to-r from-[#002366] to-[#4a90e2] rounded-2xl p-6 w-full mb-6 items-center">
                <Text className="text-white text-sm font-medium mb-2">Nouveau badge débloqué !</Text>
                <Text className="text-5xl mb-2">{newBadge.icon}</Text>
                <Text className="text-white font-bold text-lg">{newBadge.name}</Text>
                <Text className="text-white text-xs text-center opacity-80 mt-1">{newBadge.description}</Text>
              </View>
            )}

            <View className="flex-row w-full">
              <Pressable
                onPress={() => router.back()}
                className="flex-1 bg-gray-200 py-4 rounded-xl mr-2"
              >
                <Text className="text-gray-700 font-bold text-center">Rejouer</Text>
              </Pressable>
              <Pressable
                onPress={handleContinue}
                className="flex-1 bg-[#002366] py-4 rounded-xl ml-2"
              >
                <Text className="text-white font-bold text-center">Continuer</Text>
              </Pressable>
            </View>
            
            <Pressable
              onPress={() => router.push(`/(stacks)/(cours)/${params.courseId || ''}` as any)}
              className="mt-4 py-2"
            >
              <Text className="text-gray-500 text-center">Retour au module</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
