import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAllBadgesWithStatus } from "../../../constants/badges";
import { useLives } from "../../../hooks/useLives";
import { useLogin } from "../../../hooks/useLogin";
import { useUserStats } from "../../../hooks/useUserStats";
import { getQuizStats, QuizStats } from "../../../services/storage/activity-progress";
import { CourseProgressData, getAllCourseProgress } from "../../../services/storage/course-progress";
import { useStreak } from "../../../services/storage/streak";
import { getLevelFromXP } from "../../../utils/levelCalculator";

function formatHeartCountdown(nextHeartTime: string | null): string | null {
  if (!nextHeartTime) return null;
  const diffMs = new Date(nextHeartTime).getTime() - Date.now();
  if (diffMs <= 0) return null;
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ProgressScreen() {
  const router = useRouter();
  const { user } = useLogin();
  const { stats: userStats, refetch: refetchUserStats } = useUserStats();
  const { lives, coins, maxLives, canBuyLife, isBuying, lifeCost, error, buyLife } = useLives(refetchUserStats);
  const [courseProgress, setCourseProgress] = useState<CourseProgressData[]>([]);
  const [quizStats, setQuizStats] = useState<QuizStats>({ quizPassed: 0, perfectScores: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const { streak } = useStreak(user?.id ?? null);

  // Refresh countdown every minute when lives < max
  const [, forceRender] = useState(0);
  useEffect(() => {
    if ((userStats.lives ?? lives) >= maxLives) return;
    const id = setInterval(() => forceRender(n => n + 1), 60000);
    return () => clearInterval(id);
  }, [userStats.lives, lives, maxLives]);

  const loadCourseProgress = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [data, qs] = await Promise.all([
        getAllCourseProgress(user.id),
        getQuizStats(user.id),
      ]);
      setCourseProgress(data);
      setQuizStats(qs);
    } catch (err) {
      console.warn('[Progress] Failed to load course progress:', err);
    } finally {
      setIsLoadingProgress(false);
    }
  }, [user?.id]);

  useEffect(() => { loadCourseProgress(); }, [loadCourseProgress]);

  const reload = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchUserStats(), loadCourseProgress()]);
    setIsRefreshing(false);
  }, [refetchUserStats, loadCourseProgress]);

  // Reload à chaque focus et après changement XP
  useFocusEffect(
    useCallback(() => {
      refetchUserStats();
      loadCourseProgress();
    }, [refetchUserStats, loadCourseProgress])
  );

  useEffect(() => {
    if (userStats.xp > 0) loadCourseProgress();
  }, [userStats.xp, loadCourseProgress]);

  // Stats calculées depuis SQLite (source de vérité locale)
  const displayXP = userStats.xp;
  const displayCoins = userStats.coins ?? coins;
  const displayLives = userStats.lives ?? lives;
  const displayStreak = userStats.streak;
  const heartCountdown = formatHeartCountdown(userStats.nextHeartTime);

  const completedCourses = courseProgress.filter(c =>
    c.totalActivities > 0 && c.completedActivities >= c.totalActivities
  ).length;

  const inProgressCourses = courseProgress.filter(c =>
    c.completedActivities > 0 && c.completedActivities < c.totalActivities
  ).length;

  const totalCompleted = courseProgress.reduce((sum, c) => sum + (c.completedActivities || 0), 0);

  const badgesWithStatus = getAllBadgesWithStatus({
    completedLessons: totalCompleted,
    currentStreak: streak?.currentStreak ?? displayStreak,
    totalXP: displayXP,
    quizPassed: quizStats.quizPassed,
    perfectScores: quizStats.perfectScores,
    daysActive: streak?.totalDaysActive ?? displayStreak,
  });

  const globalProgress = courseProgress.length > 0
    ? Math.round(
        courseProgress.reduce((sum, c) => {
          const pct = c.totalActivities > 0 ? (c.completedActivities / c.totalActivities) * 100 : 0;
          return sum + pct;
        }, 0) / courseProgress.length
      )
    : 0;

  const { level, title } = getLevelFromXP(displayXP);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROGRESSION</Text>
        <Pressable style={styles.settingsButton} onPress={() => router.push("/(settings)/index")}>
          <Feather name="settings" size={22} color="#374151" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={reload} />
        }
      >
        {/* Profile card */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <View style={styles.profileLeft}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {user?.firstname?.charAt(0) || user?.username?.charAt(0) || 'U'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.profileName}>{user?.fullname || user?.username || "Utilisateur"}</Text>
                  <Text style={styles.profileLevel}>Niveau {level} - {title}</Text>
                  <View style={styles.livesRow}>
                    <Text style={styles.heartIconSmall}>❤️</Text>
                    <Text style={styles.livesTextSmall}>{displayLives}/{maxLives}</Text>
                    {heartCountdown && (
                      <>
                        <Text style={styles.dotSeparator}>•</Text>
                        <Feather name="clock" size={10} color="#EF4444" />
                        <Text style={styles.countdownTextSmall}>+1 dans {heartCountdown}</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.profileRight}>
                <View style={styles.coinsTag}>
                  <Text style={styles.coinsText}>{displayCoins}</Text>
                  <Text style={styles.coinEmoji}>🪙</Text>
                </View>
              </View>
            </View>

            {canBuyLife && (
              <Pressable
                onPress={buyLife}
                disabled={isBuying}
                style={[styles.buyLifeButton, isBuying && styles.buyLifeButtonDisabled]}
              >
                <Text style={styles.buyLifeButtonText}>Acheter 1 vie ({lifeCost} 🪙)</Text>
                <Text>❤️</Text>
              </Pressable>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={styles.statIconYellow}>
                  <Feather name="star" size={24} color="#F59E0B" />
                </View>
                <Text style={styles.statValue}>{displayXP}</Text>
                <Text style={styles.statLabel}>XP Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={styles.statIconGreen}>
                  <AntDesign name="trophy" size={24} color="#10B981" />
                </View>
                <Text style={styles.statValue}>{level}</Text>
                <Text style={styles.statLabel}>Niveau</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={styles.statIconOrange}>
                  <Text style={styles.fireEmoji}>🔥</Text>
                </View>
                <Text style={styles.statValue}>{displayStreak}</Text>
                <Text style={styles.statLabel}>Jours</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Course stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiques des Cours</Text>
          <View style={styles.card}>
            {(isLoadingProgress || isRefreshing) && courseProgress.length === 0 ? (
              <View style={styles.loadingContainer}><ActivityIndicator size="small" color="#002366" /></View>
            ) : (
              <>
                <View style={styles.barsRow}>
                  <View style={styles.barItem}>
                    <View style={styles.barIconGray}>
                      <Feather name="book" size={20} color="#6B7280" />
                    </View>
                    <Text style={styles.barLabel}>Total</Text>
                    <Text style={styles.barValue}>{courseProgress.length}</Text>
                    <Text style={styles.barSubLabel}>cours</Text>
                    <View style={styles.barGray} />
                  </View>
                  <View style={[styles.barItem, { zIndex: 10 }]}>
                    <Text style={styles.sparkle}>✨</Text>
                    <View style={styles.barIconGreen}>
                      <AntDesign name="check" size={24} color="#10B981" />
                    </View>
                    <Text style={[styles.barLabel, { fontWeight: 'bold', color: '#111827' }]}>Terminé</Text>
                    <Text style={[styles.barValue, { color: '#10B981' }]}>{completedCourses}</Text>
                    <View style={styles.barGreen} />
                  </View>
                  <View style={styles.barItem}>
                    <View style={styles.barIconBlue}>
                      <Ionicons name="play" size={20} color="#4a90e2" />
                    </View>
                    <Text style={styles.barLabel}>En cours</Text>
                    <Text style={[styles.barValue, { color: '#4a90e2' }]}>{inProgressCourses}</Text>
                    <View style={styles.barBlue} />
                  </View>
                </View>
                <View style={styles.progressSection}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabel}>Progression globale</Text>
                    <Text style={styles.progressValue}>{globalProgress}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${globalProgress}%` }]} />
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges & Récompenses</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.badgesRow}>
              {badgesWithStatus.map(badge => (
                <View key={badge.id} style={[styles.badgeCard, !badge.earned && styles.badgeCardLocked]}>
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  <Text style={styles.badgeName} numberOfLines={2}>{badge.name}</Text>
                  {badge.earned
                    ? <View style={styles.badgeCheck}><Feather name="check-circle" size={12} color="#10B981" /></View>
                    : <Feather name="lock" size={12} color="#9CA3AF" style={styles.badgeCheck} />
                  }
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aperçu</Text>
          <View style={styles.overviewCard}>
            {(() => {
              const lessonsTarget = Math.max(25, Math.ceil((totalCompleted + 1) / 25) * 25);
              return (
                <>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabel}>Leçons complétées</Text>
                    <Text style={styles.progressValue}>{totalCompleted}</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${Math.min((totalCompleted / lessonsTarget) * 100, 100)}%` }]} />
                  </View>
                  <Text style={styles.overviewHint}>Prochain objectif : {lessonsTarget} leçons</Text>
                </>
              );
            })()}
          </View>
          <View style={styles.overviewCard}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Cours terminés</Text>
              <Text style={styles.progressValue}>{completedCourses}/{courseProgress.length || 0}</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarGreen, { width: `${courseProgress.length > 0 ? (completedCourses / courseProgress.length) * 100 : 0}%` }]} />
            </View>
          </View>
          <View style={styles.overviewCard}>
            {(() => {
              const coinsTarget = Math.max(100, Math.ceil((displayCoins + 1) / 100) * 100);
              return (
                <>
                  <View style={styles.progressLabelRow}>
                    <View style={styles.coinsLabelRow}>
                      <Text style={styles.progressLabel}>Pièces d&apos;or</Text>
                      <Text style={styles.coinEmojiSmall}>🪙</Text>
                    </View>
                    <Text style={styles.coinsValueText}>{displayCoins}</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarYellow, { width: `${Math.min((displayCoins / coinsTarget) * 100, 100)}%` }]} />
                  </View>
                  <Text style={styles.overviewHint}>Prochain objectif : {coinsTarget} pièces</Text>
                </>
              );
            })()}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#1f2937',
  },
  settingsButton: {
    padding: 8,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#002366',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  profileLevel: {
    color: '#6b7280',
    fontSize: 14,
  },
  livesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  heartIconSmall: {
    fontSize: 12,
    marginRight: 4,
  },
  livesTextSmall: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 12,
  },
  dotSeparator: {
    color: '#d1d5db',
    marginHorizontal: 4,
    fontSize: 10,
  },
  countdownTextSmall: {
    color: '#ef4444',
    fontSize: 11,
    marginLeft: 2,
  },
  profileRight: {
    alignItems: 'flex-end',
  },
  livesTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  livesText: {
    color: '#ef4444',
    fontWeight: 'bold',
    marginRight: 4,
  },
  heartEmoji: {
    fontSize: 18,
  },
  countdownTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  countdownText: {
    color: '#f87171',
    fontWeight: '600',
    fontSize: 10,
    marginLeft: 4,
  },
  coinsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fefce8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  coinsText: {
    color: '#ca8a04',
    fontWeight: 'bold',
    marginRight: 4,
  },
  coinEmoji: {
    fontSize: 18,
  },
  buyLifeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#002366',
  },
  buyLifeButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  buyLifeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginRight: 8,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconYellow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statIconGreen: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statIconOrange: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fireEmoji: {
    fontSize: 20,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 16,
    paddingBottom: 8,
  },
  barItem: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  barIconGray: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  barIconGreen: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  barIconBlue: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sparkle: {
    fontSize: 18,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
  },
  barValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  barSubLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  barGray: {
    width: 48,
    height: 32,
    backgroundColor: '#d1d5db',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barGreen: {
    width: 56,
    height: 40,
    backgroundColor: '#6ee7b7',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barBlue: {
    width: 48,
    height: 24,
    backgroundColor: '#bfdbfe',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  progressSection: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 16,
    marginTop: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4a90e2',
    borderRadius: 4,
  },
  progressBarGreen: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressBarYellow: {
    height: '100%',
    backgroundColor: '#facc15',
    borderRadius: 4,
  },
  badgesRow: {
    flexDirection: 'row',
  },
  badgeCard: {
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    width: 96,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  badgeCardLocked: {
    backgroundColor: '#f3f4f6',
    opacity: 0.5,
  },
  badgeIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  badgeCheck: {
    marginTop: 4,
  },
  overviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  overviewHint: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
  },
  coinsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinEmojiSmall: {
    marginLeft: 4,
  },
  coinsValueText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ca8a04',
  },
});
