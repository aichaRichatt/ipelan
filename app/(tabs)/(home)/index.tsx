import { BuyHeartsModal } from "@/components/BuyHeartsModal";
import { useLives } from "@/hooks/useLives";
import { AntDesign, Feather, FontAwesome5, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { useSyncStatus } from "../../../hooks/useSyncStatus";
import { useUserStats } from "../../../hooks/useUserStats";
import { getFirstCourseFromLanguageAndGrade } from "../../../services/api/courseService";
import { RootState } from "../../../services/redux/store";
import { getAllScoresForCourse } from "../../../services/storage/activity-progress";
import { calculateCourseProgress, getAllCourseProgress, saveCourseProgress } from "../../../services/storage/course-progress";
const IS_DEV = process.env.NODE_ENV === 'development';
const PREFERENCES_KEY = '@ipelan_preferences';

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

// eslint-disable-next-line @typescript-eslint/no-require-imports
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

      let loadedFromCache = false;

      try {
        setIsLoading(true);
        setError(null);

        const moodleCall = (await import('../../../services/api/moodleClient')).moodleCall;

        if (IS_DEV) console.log('[useActiveCourse] Fetching enrolled courses');
        const result = await moodleCall(
          'core_course_get_enrolled_courses_by_timeline_classification',
          { classification: 'inprogress', limit: 10 },
          activeToken
        );

        if (IS_DEV) console.log('[useActiveCourse] API result:', result?.courses?.length || 0, 'courses');

        if (result && result.courses && result.courses.length > 0) {
          setCourses(result.courses);
          try {
            const { getDBConnection, saveCourses } = await import('../../../services/storage/db-service');
            const db = await getDBConnection();
            const coursesToSave = result.courses.map((c: any) => ({
              id: c.id,
              shortname: c.shortname || '',
              fullname: c.fullname || '',
              displayname: c.fullname || '',
              idnumber: c.idnumber || '',
              categoryid: c.categoryid || 0,
              visible: c.visible ? 1 : 0,
              summary: c.summary || '',
              summaryformat: c.summaryformat || 0,
              format: c.format || '',
              showgrades: c.showgrades ? 1 : 0,
              lang: c.lang || '',
              enablecompletion: c.enablecompletion ? 1 : 0,
              completionhasrules: c.completionhasrules ? 1 : 0,
            }));
            await saveCourses(db, coursesToSave);
          } catch (e) {
            if (IS_DEV) console.warn('[useActiveCourse] Failed to cache courses:', e);
          }
          setIsLoading(false);
          return;
        }
      } catch (err: any) {
        if (IS_DEV) console.warn('[useActiveCourse] API failed:', err.message);
      }

      try {
        const { getDBConnection, getCourses } = await import('../../../services/storage/db-service');
        const db = await getDBConnection();
        const cachedCourses = await getCourses(db);

        if (cachedCourses && cachedCourses.length > 0) {
          if (IS_DEV) console.log('[useActiveCourse] Loaded from cache:', cachedCourses.length, 'courses');
          setCourses(cachedCourses.map(c => ({
            id: c.id,
            shortname: c.shortname,
            fullname: c.fullname,
            displayname: c.displayname,
            categoryid: c.categoryid,
            visible: c.visible === 1,
            summary: c.summary,
            progress: 0,
          })));
          loadedFromCache = true;
        } else {
          setCourses([]);
        }
      } catch (cacheErr: any) {
        if (IS_DEV) console.error('[useActiveCourse] Cache failed:', cacheErr.message);
      }

      // Fallback 3: use language+grade preferences from registration
      if (!loadedFromCache) {
        try {
          const prefsJson = await AsyncStorage.getItem(PREFERENCES_KEY);
          if (prefsJson) {
            const { language, grade } = JSON.parse(prefsJson);
            if (IS_DEV) console.log('[useActiveCourse] Trying preferences fallback:', language, grade);
            const firstCourse = await getFirstCourseFromLanguageAndGrade(activeToken, language, grade);
            if (firstCourse) {
              if (IS_DEV) console.log('[useActiveCourse] Found course via preferences:', firstCourse.fullname);
              setCourses([firstCourse]);
              loadedFromCache = true;
            }
          }
        } catch (e) {
          if (IS_DEV) console.warn('[useActiveCourse] Preferences fallback failed:', e);
        }
      }

      if (!loadedFromCache && courses.length === 0) {
        setError('Hors ligne - Aucun cours en cache');
      }

      setIsLoading(false);
    };

    fetchCourses();
  }, [activeToken]);

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
  const [avatarError, setAvatarError] = useState(false);

  const { course, allCourses, isLoading, error } = useActiveCourse(activeToken);
  const { stats, isLoading: statsLoading, isSyncing, refetch: refetchUserStats } = useUserStats();
  const { icon, color, opacity, isSyncing: isAutoSyncing } = useSyncStatus();
  const { lives, maxLives, canBuyLife, isBuying, lifeCost, buyLife } = useLives(refetchUserStats);

  const [courseProgressMap, setCourseProgressMap] = useState<any>({});
  const [courseScoreMap, setCourseScoreMap] = useState<any>({});
  const [showBuyModal, setShowBuyModal] = useState(false);

  // Redirect to language selection if no preferences
  useEffect(() => {
    if (!activeToken) return;
    const checkPreferences = async () => {
      try {
        const prefsJson = await AsyncStorage.getItem(PREFERENCES_KEY);
        if (!prefsJson) {
          console.log('[HomeScreen] No preferences, redirecting to language-selection');
          router.replace("/(auth)/language-selection" as any);
        }
      } catch (e) {
        console.warn('[HomeScreen] Failed to check preferences:', e);
      }
    };
    checkPreferences();
  }, [activeToken, router]);

  const [, forceRender] = useState(0);
  useEffect(() => {
    if ((stats.lives ?? lives) >= maxLives) return;
    const id = setInterval(() => forceRender(n => n + 1), 60000);
    return () => clearInterval(id);
  }, [stats.lives, lives, maxLives]);

  useFocusEffect(
    useCallback(() => {
      refetchUserStats();
      // Reload course progress from SQLite so progress bars update immediately on focus
      if (reduxUser?.id) {
        getAllCourseProgress(reduxUser.id).then(allCP => {
          const map: any = {};
          for (const cp of allCP) {
            map[cp.courseId] = {
              completed: cp.completedActivities,
              total: cp.totalActivities,
              xp: cp.totalXP,
              bestScore: cp.bestScore,
            };
          }
          setCourseProgressMap(map);
        }).catch(() => {});
      }
    }, [refetchUserStats, reduxUser?.id])
  );

  useEffect(() => {
    const loadProgress = async () => {
      if (!course) {
        setCourseProgressMap({});
        setCourseScoreMap({});
        return;
      }

      try {
        const allCourseProgress = await getAllCourseProgress(reduxUser?.id);
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
          const scores = await getAllScoresForCourse(course.id, reduxUser?.id);
          setCourseScoreMap({ [course.id]: scores });
        }

        setCourseProgressMap(progressMap);

        if (!activeToken || allCourses.length === 0) return;

        const coursesToSeed = allCourses.filter(
          (c: any) => c.id > 0 && (!progressMap[c.id] || progressMap[c.id].total === 0)
        );

        if (coursesToSeed.length === 0) return;

        (async () => {
          try {
            const { moodleCall } = await import('../../../services/api/moodleClient');

            for (const c of coursesToSeed) {
              try {
                const [sections, completionResult] = await Promise.all([
                  moodleCall('core_course_get_contents', { courseid: String(c.id) }, activeToken),
                  moodleCall('core_completion_get_activities_completion_status', { courseid: String(c.id), userid: String(reduxUser?.id ?? 0) }, activeToken).catch(() => null),
                ]);

                const sectionsArr = Array.isArray(sections) ? sections : [];
                const completionStatuses = (completionResult?.statuses ?? []).map((s: any) => ({
                  cmid: s.cmid,
                  completionstate: s.state ?? 0,
                }));

                const { completed, total } = await calculateCourseProgress(c.id, sectionsArr, completionStatuses, reduxUser?.id ?? undefined);

                if (total > 0) {
                  await saveCourseProgress(c.id, completed, total, 0, 0, reduxUser?.id ?? 0);
                  setCourseProgressMap((prev: any) => ({
                    ...prev,
                    [c.id]: { completed, total, xp: 0, bestScore: 0 },
                  }));
                } else if (c.progress && c.progress > 0) {
                  const estimatedTotal = 10;
                  const estimatedCompleted = Math.round((c.progress / 100) * estimatedTotal);
                  setCourseProgressMap((prev: any) => ({
                    ...prev,
                    [c.id]: { completed: estimatedCompleted, total: estimatedTotal, xp: 0, bestScore: 0 },
                  }));
                }
              } catch (e) {
                if (IS_DEV) console.warn('[Home] Failed to seed progress for course', c.id, e);
              }
            }
          } catch (e) {
            if (IS_DEV) console.warn('[Home] Progress seeding aborted:', e);
          }
        })();

      } catch (err) {
        console.warn('[Home] Failed to load progress:', err);
        setCourseProgressMap({});
        setCourseScoreMap({});
      }
    };
    loadProgress();
  }, [course, activeToken, stats.xp]);

  const handleSettingsPress = () => {
    router.push("/(settings)/index" as any);
  };

  const handleCoursePress = (courseId: number) => {
    router.push(`/(stacks)/(cours)/${courseId}` as any);
  };

  const getCourseProgress = (c: any) => {
    const dbProgress = courseProgressMap[c?.id];
    if (dbProgress && dbProgress.total > 0) {
      return Math.min(100, Math.round((dbProgress.completed / dbProgress.total) * 100));
    }
    return Math.min(100, c?.progress || 0);
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

  const getCourseLessonsCount = (c: any): number => {
    const dbProgress = courseProgressMap[c?.id];
    if (dbProgress && dbProgress.total > 0) {
      return dbProgress.total;
    }
    const moodleProgress = c?.progress || 0;
    if (moodleProgress > 0 && dbProgress?.completed > 0) {
      return Math.round(dbProgress.completed / (moodleProgress / 100));
    }
    return c?.lessonsCount || 0;
  };

  const getCompletedLessons = (c: any): number => {
    const dbProgress = courseProgressMap[c?.id];
    if (dbProgress && dbProgress.total > 0) {
      return dbProgress.completed;
    }
    return 0;
  };

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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.mainPadding}>

          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <Pressable onPress={() => router.push("/(tabs)/(profile)")}>
                <View style={styles.avatarWrapper}>
                  <Image
                    source={(!avatarError && loggedUser?.avatar) ? { uri: loggedUser.avatar } : DefaultProfileImage}
                    defaultSource={DefaultProfileImage}
                    style={styles.avatarImage}
                    onError={() => setAvatarError(true)}
                  />
                </View>
              </Pressable>
              <View style={styles.greetingContainer}>
                <Text style={styles.greetingLabel}>Àndu,</Text>
                <Text style={styles.greetingName}>
                  {loggedUser?.firstname || loggedUser?.username || "Ahmadou"}
                </Text>
              </View>
            </View>

            <View style={styles.topBarRight}>
              <View>
                <TouchableOpacity
                  onPress={() => stats.lives < maxLives && setShowBuyModal(true)}
                  style={styles.statPill}
                >
                  <Text style={styles.statPillEmoji}>❤️</Text>
                  <Text style={styles.livesText}>{stats.lives}/{maxLives}</Text>
                </TouchableOpacity>
                {stats.lives < maxLives && (
                  <View style={styles.countdownRow}>
                    <Feather name="clock" size={9} color="#EF4444" />
                    <Text style={styles.countdownText}>
                      {formatHeartCountdown(stats.nextHeartTime)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillEmoji}>🪙</Text>
                <Text style={styles.coinsText}>{stats.coins}</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillEmoji}>🔥</Text>
                <Text style={styles.streakText}>{stats.streak}</Text>
              </View>
              <Pressable onPress={handleSettingsPress} style={styles.settingsPill}>
                <Feather name="settings" size={18} color="#374151" />
              </Pressable>
              {isAutoSyncing && (
                <View style={styles.syncDot} />
              )}
            </View>
          </View>

          {/* Stats cards */}
          <View style={styles.statsGrid}>
            <StatsCard
              label="XP Total"
              value={`${stats.xp}`}
              icon={<AntDesign name="star" size={16} color="#F59E0B" />}
              bgColor="#fff7ed"
              textColor="#ea580c"
            />
            <StatsCard
              label="Pièces"
              value={`${stats.coins}`}
              icon={<FontAwesome5 name="coins" size={14} color="#F59E0B" />}
              bgColor="#fefce8"
              textColor="#ca8a04"
            />
            <StatsCard
              label="Vies"
              value={`${stats.lives}/6`}
              icon={<AntDesign name="heart" size={16} color="#EF4444" />}
              bgColor="#fef2f2"
              textColor="#dc2626"
            />
            <StatsCard
              label="Série"
              value={`${stats.streak} j`}
              icon={<Ionicons name="flame" size={16} color="#EF4444" />}
              bgColor="#fff7ed"
              textColor="#ea580c"
            />
          </View>

          {/* Active course card */}
          {currentCourse && (
            <Pressable
              onPress={() => handleCoursePress(currentCourse.id)}
              style={styles.activeCourseWrapper}
            >
              <View style={styles.activeCourseCard}>
                <View style={styles.activeCourseTop}>
                  <View style={styles.activeCourseInfo}>
                    <Text style={styles.activeCourseLabel}>
                      Reprendre l&apos;activité
                    </Text>
                    <Text style={styles.activeCourseName}>
                      {currentCourse.fullname}
                    </Text>
                    <View style={styles.activeCourseTagsRow}>
                      <View style={styles.lessonsTag}>
                        <Ionicons name="book-outline" size={11} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.lessonsTagText}>
                          {getCompletedLessons(currentCourse)}/{getCourseLessonsCount(currentCourse)} leçons
                        </Text>
                      </View>
                      {getXpAllFromCourse(currentCourse.id) > 0 && (
                        <View style={styles.xpTag}>
                          <Text style={styles.xpTagText}>
                            ⭐ {getXpAllFromCourse(currentCourse.id)} XP
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.playIconWrapper}>
                    <Ionicons name="play" size={24} color="white" />
                  </View>
                </View>

                <View style={styles.activeCourseProgressSection}>
                  <View style={styles.activeCourseProgressLabelRow}>
                    <Text style={styles.activeCourseProgressLabel}>Progression globale</Text>
                    <Text style={styles.activeCourseProgressValue}>{getCourseProgress(currentCourse)}%</Text>
                  </View>
                  <View style={styles.activeCourseProgressBg}>
                    <View style={[styles.activeCourseProgressFill, { width: `${getCourseProgress(currentCourse)}%` as any }]} />
                  </View>
                </View>

                <View style={styles.activeCourseBottom}>
                  {getCourseScore(currentCourse.id) && (
                    <View style={styles.scoreTag}>
                      <Text style={styles.scoreTagText}>★ {getCourseScore(currentCourse.id)}</Text>
                    </View>
                  )}
                  <View style={styles.continueButton}>
                    <Text style={styles.continueButtonText}>Continuer</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}

          {/* Courses list */}
          <View style={styles.coursesSection}>
            <View style={styles.coursesSectionHeader}>
              <Text style={styles.coursesSectionTitle}>Mes Cours</Text>
              <Pressable onPress={() => router.push("/(tabs)/(cours)" as any)}>
                <Text style={styles.seeAllText}>Voir tout</Text>
              </Pressable>
            </View>

            <View>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#002366" />
                  <Text style={styles.loadingText}>Chargement des cours...</Text>
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
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
                      iconBg: "#dbeafe",
                      levelId: getCourseLevel(c.fullname),
                      progress: getCourseProgress(c)
                    }}
                    onPress={() => handleCoursePress(c.id)}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Feather name="book-open" size={32} color="#D1D5DB" />
                  <Text style={styles.emptyStateText}>Aucun cours trouvé</Text>
                </View>
              )}
            </View>
          </View>

        </View>
      </ScrollView>

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
    <View style={[statsCardStyles.card, { backgroundColor: bgColor }]}>
      <View style={statsCardStyles.row}>
        <View style={statsCardStyles.iconWrapper}>
          {icon}
        </View>
        <Text style={[statsCardStyles.value, { color: textColor }]}>{value}</Text>
      </View>
      <Text style={statsCardStyles.label}>{label}</Text>
    </View>
  );
}

const statsCardStyles = StyleSheet.create({
  card: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconWrapper: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  label: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

function HomeModuleCard({ module, onPress }: {
  module: ModuleData;
  onPress: () => void;
}) {
  const completedLessons = module.completedLessons ?? 0;
  const lessonsCount = module.lessonsCount ?? 0;
  const progress = lessonsCount > 0 ? Math.min(100, Math.round((completedLessons / lessonsCount) * 100)) : 0;
  const isCompleted = progress === 100;

  return (
    <Pressable
      onPress={onPress}
      style={[moduleCardStyles.card, module.isLocked && moduleCardStyles.cardLocked]}
    >
      <View style={moduleCardStyles.topRow}>
        <View style={[moduleCardStyles.iconWrapper, { backgroundColor: module.isLocked ? '#f3f4f6' : module.iconBg }]}>
          {module.isLocked ? (
            <Feather name="lock" size={18} color="#9CA3AF" />
          ) : (
            getIconComponent(module.icon, 20, module.iconColor)
          )}
        </View>
        <View style={moduleCardStyles.infoContainer}>
          <View style={moduleCardStyles.titleRow}>
            <Text style={moduleCardStyles.title} numberOfLines={1}>{module.title}</Text>
            <Text style={moduleCardStyles.xpText}>+{module.xp} XP</Text>
          </View>
          <Text style={moduleCardStyles.description} numberOfLines={1}>{module.description}</Text>
        </View>
      </View>

      {!module.isLocked && (
        <View>
          <View style={moduleCardStyles.progressLabelRow}>
            <Text style={moduleCardStyles.progressLabel}>{completedLessons}/{lessonsCount} leçons</Text>
            <Text style={moduleCardStyles.progressValue}>{progress}%</Text>
          </View>
          <View style={moduleCardStyles.progressBg}>
            <View style={[moduleCardStyles.progressFill, isCompleted ? moduleCardStyles.progressFillGreen : moduleCardStyles.progressFillBlue, { width: `${progress}%` as any }]} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const moduleCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLocked: {
    opacity: 0.6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 14,
    flex: 1,
  },
  completedBadge: {
    backgroundColor: '#dcfce7',
    padding: 4,
    borderRadius: 20,
  },
  xpText: {
    color: '#f97316',
    fontWeight: 'bold',
    fontSize: 10,
  },
  description: {
    color: '#6b7280',
    fontSize: 10,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '500',
  },
  progressValue: {
    color: '#4b5563',
    fontSize: 9,
    fontWeight: 'bold',
  },
  progressBg: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressFillGreen: {
    backgroundColor: '#22c55e',
  },
  progressFillBlue: {
    backgroundColor: '#3b82f6',
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  mainPadding: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#002366',
    padding: 2,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  greetingContainer: {
    marginLeft: 12,
  },
  greetingLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  greetingName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statPillEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  livesText: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#EF4444',
  },
  coinsText: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#F59E0B',
  },
  streakText: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#f97316',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  countdownText: {
    color: '#f87171',
    fontSize: 10,
    marginLeft: 4,
  },
  settingsPill: {
    padding: 8,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  syncDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#60a5fa',
    opacity: 0.6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  activeCourseWrapper: {
    marginBottom: 32,
  },
  activeCourseCard: {
    backgroundColor: '#002366',
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#002366',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  activeCourseTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  activeCourseInfo: {
    flex: 1,
    marginRight: 12,
  },
  activeCourseLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  activeCourseName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  activeCourseTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  lessonsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
    marginBottom: 4,
  },
  lessonsTagText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginLeft: 4,
  },
  xpTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251,146,60,0.3)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  xpTagText: {
    color: '#fdba74',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playIconWrapper: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 12,
  },
  activeCourseProgressSection: {
    marginBottom: 16,
  },
  activeCourseProgressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeCourseProgressLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  activeCourseProgressValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  activeCourseProgressBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  activeCourseProgressFill: {
    height: '100%',
    backgroundColor: '#fb923c',
    borderRadius: 4,
  },
  activeCourseBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreTag: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  scoreTagText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  continueButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  continueButtonText: {
    color: '#002366',
    fontWeight: 'bold',
    fontSize: 12,
  },
  coursesSection: {
    marginBottom: 24,
  },
  coursesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  coursesSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  seeAllText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    color: '#6b7280',
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 16,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
});
