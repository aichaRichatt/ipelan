import { getCourseContents } from "@/services/api/courseService";
import { RootState } from "@/services/redux/store";
import { getBestScore, saveActivityScore } from "@/services/storage/activity-progress";
import { updateCourseProgressFromActivities } from "@/services/storage/course-progress";
import { syncAfterActivityWithRetry } from "@/services/sync/progressSync";
import { ActivityType } from "@/utils/xpCalculator";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

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
  const coins = Math.round(xp / 5);
  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);
  const activityType = activityTypeMap[params.activity || ''] || 'quiz';
  
  const percentage = Math.round((score / Math.max(total, 1)) * 100);
  const isCompleted = percentage >= 50;

 
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

        await saveActivityScore(moduleId, courseId, activityType, score, total, xp);

        await updateCourseProgressFromActivities(courseId, activityCount);

        if (IS_DEV) {
          console.log('[Result] ✅ Local save successful');
        }

         if (token) {
          setSyncStatus('syncing');
          setSyncMessage('Synchronisation avec Moodle...');

          if (IS_DEV) {
            console.log('[Result] Starting Moodle sync:', {
              instanceId,
              moduleId,
              token: '***',
            });
          }

          syncAfterActivityWithRetry(moduleId, courseId, activityType, score, total, xp, instanceId, 3, token || undefined, userId)
            .then((syncResult) => {
              if (syncResult.success) {
                setSyncStatus('success');
                setSyncMessage('✅ Synchronisé avec Moodle');

                if (IS_DEV) {
                  console.log('[Result] ✅ Moodle sync successful:', syncResult);

                  setTimeout(() => {
                    setSyncMessage(null);
                  }, 2000);
                }
              } else {
                setSyncStatus('error');
                setSyncMessage('⚠️ Sync Moodle en attente (vous êtes hors ligne ?)');

                if (IS_DEV) {
                  console.warn('[Result] Moodle sync failed:', syncResult);
                }
              }
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
      } catch (err) {
        setSyncStatus('error');
        setSyncMessage(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);

        if (IS_DEV) {
          console.error('[Result] Failed to save activity progress:', err);
        }
      }
    };
    saveProgress();
  }, [moduleId, courseId, activityType, score, total, isCompleted, xp, instanceId, token]);
  
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

            <View className="flex-row w-full justify-center mb-6">
              <View className="bg-purple-100 rounded-2xl px-6 py-3 mr-3 flex-row items-center">
                <Text className="text-2xl mr-2">⭐</Text>
                <Text className="text-purple-700 font-bold text-lg">+{xp} XP</Text>
              </View>
              <View className="bg-yellow-100 rounded-2xl px-6 py-3 flex-row items-center">
                <Text className="text-2xl mr-2">🪙</Text>
                <Text className="text-yellow-700 font-bold text-lg">+{coins}</Text>
              </View>
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

            {percentage >= 70 && (
              <View className="bg-gradient-to-r from-[#002366] to-[#4a90e2] rounded-2xl p-6 w-full mb-6 items-center">
                <Text className="text-white text-sm font-medium mb-2">Nouveau badge débloqué !</Text>
                <Text className="text-5xl mb-2">🏆</Text>
                <Text className="text-white font-bold text-lg">Quiz Master</Text>
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
