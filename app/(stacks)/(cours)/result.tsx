import { useProgressSync } from "@/hooks/useProgressSync";
import { getCourseContents } from "@/services/api/courseService";
import { processActivityResults } from "@/services/gamification/gamificationService";
import { updateUser } from "@/services/redux/slices/authSlice";
import { RootState } from "@/services/redux/store";
import { getBestScore } from "@/services/storage/activity-progress";
import { ActivityType, STREAK_BONUS_CAP, XP_CONFIG } from "@/utils/xpCalculator";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

const IS_DEV = process.env.NODE_ENV === "development";

const activityTypeMap: Record<string, ActivityType> = {
  'Quiz': 'quiz',
  'Dictée audio': 'dictation',
  'Écoute': 'listening',
  'Association': 'association',
  'Ordre des mots': 'wordOrder',
};

const styles = StyleSheet.create({
  bggradienttor_from002366_to4a9: {
    alignItems: 'center',
    borderRadius: 16,
    marginBottom: 24,
    padding: 24,
    width: '100%'
  },
  bgpurple100_rounded2xl_px4_py3: {
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 16,
    flexDirection: 'row',
    marginBottom: 8,
    marginRight: 8,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  bgred100_rounded2xl_px4_py3_mb: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  bgwhite_rounded3xl_p8_itemscen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: '100%'
  },
  bgyellow100_rounded2xl_px4_py3: {
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    borderRadius: 16,
    flexDirection: 'row',
    marginBottom: 8,
    marginRight: 8,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  flex1_bgFAF9F6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  flex1_itemscenter_justifycente: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  flex1_py4_roundedxl_ml2_bg0023: {
    backgroundColor: '#002366',
    borderRadius: 12,
    flex: 1,
    marginLeft: 8,
    paddingVertical: 16
  },
  flex1_py4_roundedxl_mr2_bggray: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
    paddingVertical: 16
  },
  flex1_textxs_fontmedium_textor: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500'
  },
  flexrow_wfull: {
    flexDirection: 'row',
    width: '100%'
  },
  flexrow_wfull_justifycenter_mb: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    width: '100%'
  },
  fontbold_textcenter_textgray70: {
    color: '#374151',
    fontWeight: '700',
    textAlign: 'center'
  },
  mr4_p2_ml2: {
    marginLeft: -8,
    marginRight: 16,
    padding: 8
  },
  mt4_py2: {
    marginTop: 16,
    paddingVertical: 8
  },
  px5_py4_flexrow_itemscenter_bg: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  rewardIcon: {
    fontSize: 20,
    marginRight: 8
  },
  text2xl_fontbold_textgray900_m: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  text5xl_fontblack: {
    fontWeight: '900'
  },
  text5xl_mb2: {
    marginBottom: 8
  },
  textgray500_textcenter: {
    color: '#6B7280',
    textAlign: 'center'
  },
  textgray500_textcenter_mb2: {
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center'
  },
  textgray500_textcenter_mb6: {
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center'
  },
  textlg_fontbold_textgray900: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700'
  },
  textpurple700_fontbold_textlg: {
    fontSize: 18,
    fontWeight: '700'
  },
  textred700_fontbold_textlg: {
    color: '#B91C1C',
    fontSize: 18,
    fontWeight: '700'
  },
  textwhite_fontbold_textcenter: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center'
  },
  textwhite_fontbold_textlg: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700'
  },
  textwhite_textsm_fontmedium_mb: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8
  },
  textwhite_textxs_textcenter_op: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
    textAlign: 'center'
  },
  textxl_mr2: {
    fontSize: 20,
    marginRight: 8
  },
  textyellow700_fontbold_textlg: {
    color: '#A16207',
    fontSize: 18,
    fontWeight: '700'
  },
  w40_h40_roundedfull_itemscente: {
    alignItems: 'center',
    borderRadius: 9999,
    height: 160,
    justifyContent: 'center',
    marginBottom: 24,
    width: 160
  },
  wfull_rounded2xl_p3_mb6_bgoran: {
    alignItems: 'center',
    backgroundColor: '#FFEDD5',
    borderRadius: 16,
    flexDirection: 'row',
    marginBottom: 24,
    padding: 12,
    width: '100%'
  },
});

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
  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);
  const activityType = activityTypeMap[params.activity || ''] || 'quiz';

  const rawXp = parseInt(params.xp || "0", 10);
  const xpConfig = XP_CONFIG[activityType];
  const maxXP = xpConfig.baseXP + xpConfig.perfectBonus + xpConfig.timeBonus + xpConfig.streakBonus * STREAK_BONUS_CAP;
  const xp = Math.min(Math.max(0, rawXp), maxXP);
  
  const percentage = Math.round((score / Math.max(total, 1)) * 100);
  const isCompleted = percentage >= 60;

  const [earnedCoins, setEarnedCoins] = useState(0);
  const [lostLives, setLostLives] = useState(0);
  const [newBadge, setNewBadge] = useState<any | null>(null);
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const { state: syncState, saveProgressLocally, syncActivityToMoodle } = useProgressSync(token);
  const syncStatus = syncState.status === 'idle' ? 'pending' : syncState.status;
  const syncMessage = syncState.message;

  // Guard : évite la double soumission si les refs du hook changent entre deux renders
  const hasSavedRef = React.useRef(false);

  useEffect(() => {
    let isCancelled = false;

    const saveProgress = async () => {
      if (hasSavedRef.current) return;   // déjà soumis
      if (!moduleId || !courseId) {
        if (IS_DEV) console.log('[Result] Missing moduleId or courseId');
        return;
      }
      if (isCancelled) return;
      hasSavedRef.current = true;

      let activityCount = 0;
      try {
        const { isMoodleOnline } = await import('@/services/api/moodleClient');
        const online = await isMoodleOnline();
        if (online) {
          const fetchedSections = await getCourseContents(token || '', courseId);
          if (Array.isArray(fetchedSections) && fetchedSections.length > 0) {
            const { getCompletableModules } = await import('@/services/storage/course-progress');
            const completable = getCompletableModules(fetchedSections);
            activityCount = completable.length > 0
              ? completable.length
              : fetchedSections.reduce((sum: number, s: any) => sum + (s.modules?.length || 0), 0);
          }
        }
        if (activityCount === 0) {
          const { getCourseProgress } = await import('@/services/storage/course-progress');
          const existingProg = await getCourseProgress(courseId, userId ?? undefined);
          activityCount = existingProg?.totalActivities ?? 0;
        }
      } catch (err) {
        if (IS_DEV) console.warn('[Result] Failed to get course contents:', err);
        try {
          const { getCourseProgress } = await import('@/services/storage/course-progress');
          const existingProg = await getCourseProgress(courseId, userId ?? undefined);
          activityCount = existingProg?.totalActivities ?? 0;
        } catch { activityCount = 0; }
      }

      // Déduire la vie / attribuer coins AVANT tout check isCancelled —
      // c'est une opération SQLite locale qui doit s'exécuter même si l'écran
      // a été quitté pendant la requête réseau précédente (getCourseContents).
      let cEarned = 0;
      let lLost = 0;
      if (userId) {
        try {
          const skipLife = activityType === 'association';
          const { coinsEarned, livesLost } = await processActivityResults(userId, score, total, { skipLifeDeduction: skipLife });
          cEarned = coinsEarned;
          lLost = livesLost;
          if (!isCancelled) {
            setEarnedCoins(coinsEarned);
            setLostLives(livesLost);
          }
        } catch (lifeErr) {
          if (IS_DEV) console.warn('[Result] processActivityResults failed:', lifeErr);
        }
      }

      try {
        //  Sauvegarde locale via le hook (fonctionne hors-ligne)
        await saveProgressLocally({
          moduleId,
          courseId,
          activityType,
          score,
          total,
          xpEarned: xp,
          userId: userId ?? undefined,
          coinsEarned: cEarned,
          totalActivities: activityCount,
        });

        if (isCancelled) return;

        if (userId) {
          const { getGlobalGamificationStats } = await import('@/services/gamification/gamificationService');
          const { calculateNewBadges, saveBadge, getUserBadges } = await import('@/services/storage/badge-storage');

          const currentStats = await getGlobalGamificationStats(userId);

          dispatch(updateUser({
            coins: currentStats.coins,
            lives: currentStats.lives,
            xp: currentStats.totalXp,
            streak: currentStats.streak,
          }));

          const existingBadges = await getUserBadges(userId);
          const existingIds = existingBadges.map(b => b.badgeId);

          // Compter le nombre réel de quiz réussis depuis SQLite
          let quizCompletedCount = 0;
          try {
            const { getDBConnection } = await import('@/services/storage/db-service');
            const db = await getDBConnection();
            const quizRow = await db.getFirstAsync<{ count: number }>(
              `SELECT COUNT(*) as count FROM activity_progress WHERE user_id = ? AND type = 'quiz' AND is_completed = 1`,
              [userId]
            );
            quizCompletedCount = quizRow?.count || 0;
          } catch { /* utiliser 0 comme fallback */ }

          const newEarned = calculateNewBadges({
            completedLessons: currentStats.totalCompletedActivities,
            currentStreak: currentStats.streak,
            totalXP: currentStats.totalXp,
            quizPassed: quizCompletedCount,
            perfectScores: currentStats.perfectScores,
            daysActive: currentStats.streak
          }, existingIds);

          // Sauvegarder les badges en SQLite même si l'utilisateur a quitté l'écran
          // (opération DB locale, pas de setState → safe même après unmount)
          if (newEarned.length > 0) {
            for (const b of newEarned) {
              await saveBadge(userId, b.id);
            }
            // Afficher le badge uniquement si l'écran est encore monté
            if (!isCancelled) {
              setNewBadge(newEarned[newEarned.length - 1]);
            }
          }

          const { triggerGamificationSync } = await import('@/services/gamification/gamificationService');
          await triggerGamificationSync(userId, token || undefined);
        }

        if (IS_DEV) console.log('[Result]  Local save successful');

        const savedProgress = await getBestScore(moduleId, courseId, userId ?? undefined);
        if (IS_DEV) {
          console.log('[Result] Best score saved:', {
            bestScore: savedProgress?.bestScore,
            totalScore: savedProgress?.totalScore,
            xpEarned: savedProgress?.xpEarned,
          });
        }

        //  Sync Moodle via le hook (offline-first: met en queue si hors-ligne)
        if (!isCancelled) {
          syncActivityToMoodle({
            moduleId,
            courseId,
            score,
            maxScore: total,
            userId: userId ?? undefined,
            instanceId,
          });
        }

        // Vérifier si le cours est terminé à 100 % pour proposer le cours suivant
        if (isCompleted && courseId && userId) {
          try {
            const { getCourseProgressForCompletion } = await import('@/services/storage/course-progress');
            const courseProgress = await getCourseProgressForCompletion(courseId, userId);

            if (courseProgress && courseProgress.progress >= 100 && token) {
              if (IS_DEV) console.log('[Result] Course completed! Looking for next course...');

              const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
              const PREFERENCES_KEY = '@ipelan_preferences';
              const prefsStr = await AsyncStorage.getItem(PREFERENCES_KEY);

              if (prefsStr) {
                const preferences = JSON.parse(prefsStr);
                const { getCoursesForLanguageAndGrade, getCoursesByCategoryFromEnrollments } = await import('@/services/api/courseService');

                // Tentative 1 : arbre de catégories (si core_course_get_categories est dans le service)
                let allCourses = await getCoursesForLanguageAndGrade(token, preferences.language, preferences.grade);

                // Tentative 2 : fallback via cours inscrits
                if (allCourses.length === 0) {
                  allCourses = await getCoursesByCategoryFromEnrollments(token, userId);
                }

                const currentIndex = allCourses.findIndex((c: any) => c.id === courseId);

                if (currentIndex >= 0 && currentIndex < allCourses.length - 1) {
                  const nextCourse = allCourses[currentIndex + 1];
                  if (IS_DEV) console.log('[Result] Next course:', nextCourse.id, nextCourse.fullname);
                  // Utiliser replace : pas de retour en arrière vers result depuis le cours suivant
                  setTimeout(() => {
                    if (!isCancelled) router.replace(`/(stacks)/(cours)/${nextCourse.id}` as any);
                  }, 2000);
                  return;
                }
              }
            }
          } catch (err) {
            if (IS_DEV) console.warn('[Result] Failed to check course completion:', err);
          }
        }
      } catch (err) {
        if (IS_DEV) console.error('[Result] Failed to save activity progress:', err);
      }
    };
    saveProgress();
    return () => { isCancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, courseId, activityType, score, total, xp, instanceId, token, userId]);
  
  const getGrade = () => {
    if (percentage >= 90) return { text: "Excellent !", color: "#10B981" };
    if (percentage >= 75) return { text: "Bien joué !", color: "#4a90e2" };
    if (percentage >= 60) return { text: "Continue !", color: "#F59E0B" };
    return { text: "Persévère !", color: "#EF4444" };
  };
  
  const grade = getGrade();
  
  const handleReplay = () => {
    const routeMap: Record<string, string> = {
      quiz:        '/(stacks)/(cours)/quiz-native',
      dictation:   '/(stacks)/(cours)/dictation',
      listening:   '/(stacks)/(cours)/listening',
      association: '/(stacks)/(cours)/association',
      wordOrder:   '/(stacks)/(cours)/game',
    };
    const target = routeMap[activityType] ?? routeMap.quiz;
    const replayParams = activityType === 'quiz'
      ? { cmid: String(moduleId), instanceId: String(instanceId), courseId: String(courseId), moduleTitle: params.moduleTitle ?? '' }
      : { moduleId: String(moduleId), cmid: String(moduleId), instanceId: String(instanceId), courseId: String(courseId), moduleTitle: params.moduleTitle ?? '' };
    router.replace({ pathname: target, params: replayParams } as any);
  };

  const handleContinue = () => {
    // Priorité 1 : courseId passé en paramètre → retour direct au cours
    if (courseId && courseId > 0) {
      router.replace(`/(stacks)/(cours)/${courseId}` as any);
      return;
    }
    // Priorité 2 : returnRoute décodé (passé par l'activité)
    if (params.returnRoute) {
      const decoded = decodeURIComponent(params.returnRoute);
      if (decoded.startsWith('/(stacks)/(cours)/') && decoded.length > 18) {
        router.replace(decoded as any);
        return;
      }
    }
    // Fallback : onglet cours
    router.replace('/(tabs)/(cours)' as any);
  };

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>
      {/* <View style={styles.px5_py4_flexrow_itemscenter_bg}>
        <Pressable onPress={() => router.back()} style={styles.mr4_p2_ml2}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text style={styles.textlg_fontbold_textgray900}>Résultats</Text>
      </View> */}
      
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
        <View style={styles.flex1_itemscenter_justifycente}>
          <View style={styles.bgwhite_rounded3xl_p8_itemscen}>
            <View 
              style={[styles.w40_h40_roundedfull_itemscente,{ 
                borderWidth: 8,
                borderColor: grade.color,
                backgroundColor: grade.color + '10'
              }]}
             >
              <Text style={[styles.text5xl_fontblack,{ color: grade.color }]} >
                {percentage}%
              </Text>
            </View>

            <Text style={styles.text2xl_fontbold_textgray900_m}>
              {grade.text}
            </Text>
            
            <Text style={styles.textgray500_textcenter_mb2}>
              {params.activity || "Activité"}
            </Text>
            <Text style={styles.textgray500_textcenter_mb6}>
              {score} bonnes réponses sur {total}
            </Text>

            <View style={styles.flexrow_wfull_justifycenter_mb}>
              <View style={styles.bgpurple100_rounded2xl_px4_py3}>
                <Text style={styles.rewardIcon}>⭐</Text>
                <Text style={styles.textpurple700_fontbold_textlg}>+{xp} XP</Text>
              </View>
              {earnedCoins > 0 && (
                <View style={styles.bgyellow100_rounded2xl_px4_py3}>
                  <Text style={styles.rewardIcon}>🪙</Text>
                  <Text style={styles.textyellow700_fontbold_textlg}>+{earnedCoins}</Text>
                </View>
              )}
              {lostLives > 0 && (
                <View style={styles.bgred100_rounded2xl_px4_py3_mb}>
                  <Text style={styles.textxl_mr2}>💔</Text>
                  <Text style={styles.textred700_fontbold_textlg}>-{lostLives}</Text>
                </View>
              )}
            </View>

            {/* Sync Moodle en arrière-plan - non bloquant */}
            {syncMessage && syncStatus === 'error' && (
              <View style={styles.wfull_rounded2xl_p3_mb6_bgoran}>
                <Feather name="alert-circle" size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={styles.flex1_textxs_fontmedium_textor}>{syncMessage}</Text>
              </View>
            )}

            {newBadge && (
              <View style={styles.bggradienttor_from002366_to4a9}>
                <Text style={styles.textwhite_textsm_fontmedium_mb}>Nouveau badge débloqué !</Text>
                <Text style={styles.text5xl_mb2}>{newBadge.icon}</Text>
                <Text style={styles.textwhite_fontbold_textlg}>{newBadge.name}</Text>
                <Text style={styles.textwhite_textxs_textcenter_op}>{newBadge.description}</Text>
              </View>
            )}

            <View style={styles.flexrow_wfull}>
              <Pressable
                onPress={handleReplay}
                style={styles.flex1_py4_roundedxl_mr2_bggray}
              >
                <Text style={styles.fontbold_textcenter_textgray70}>Rejouer</Text>
              </Pressable>
              <Pressable
                onPress={handleContinue}
                style={styles.flex1_py4_roundedxl_ml2_bg0023}
              >
                <Text style={styles.textwhite_fontbold_textcenter}>Continuer</Text>
              </Pressable>
            </View>
            
            {/* {courseId > 0 && (
              <Pressable
                onPress={() => router.replace(`/(stacks)/(cours)/${courseId}` as any)}
                style={styles.mt4_py2}
              >
                <Text style={styles.textgray500_textcenter}>Retour au module</Text>
              </Pressable>
            )} */}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
