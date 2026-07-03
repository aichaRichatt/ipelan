import { useUserStats } from "@/hooks/useUserStats";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import ENV from "../../../constants/env";
import { useLives } from "../../../hooks/useLives";
import { filterByPreferences, getAllCoursesFromLanguageCategory, getCourseContents, getCoursesForLanguageAndGrade, getCoursesByCategoryFromEnrollments, getEnrolledCoursesByTimeline, getUserCourses, LANG_KEYWORDS } from "../../../services/api/courseService";
import { runCatalogSync } from "../../../services/sync/catalogSyncService";
// LANG_KEYWORDS used in Attempt 4 language fallback filter
import { isMoodleOnline } from "../../../services/api/moodleClient";
import { RootState } from "../../../services/redux/store";
import { getAllScoresForCourse } from "../../../services/storage/activity-progress";
import { CourseProgressData, getCourseProgress } from "../../../services/storage/course-progress";

const IS_DEV = process.env.NODE_ENV === "development";

const PREFERENCES_KEY = '@ipelan_preferences';
const COURSES_CACHE_KEY = '@ipelan_courses_cache';

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
  if (lowerName.includes('salut')) return { icon: "message-circle", color: "#10B981", bg: "#dcfce7" };
  if (lowerName.includes('famille')) return { icon: "users", color: "#6366F1", bg: "#e0e7ff" };
  if (lowerName.includes('nombre')) return { icon: "hash", color: "#F59E0B", bg: "#fef3c7" };
  if (lowerName.includes('couleur')) return { icon: "droplet", color: "#EC4899", bg: "#fce7f3" };
  if (lowerName.includes('aliment')) return { icon: "coffee", color: "#8B5CF6", bg: "#ede9fe" };
  if (lowerName.includes('animal')) return { icon: "star", color: "#14B8A6", bg: "#ccfbf1" };
  return { icon: "book", color: "#002366", bg: "#dbeafe" };
};

const getLevelFromCourse = (course: any): number => {
  // Priorité 1 : catégorie Moodle ("1ère année", "2 ème", etc.)
  const cat = (course.coursecategory ?? course.categoryname ?? '').toLowerCase();
  if (/1/.test(cat) || cat.includes('fond')) return 1;
  if (/2/.test(cat)) return 2;
  if (/3/.test(cat)) return 3;
  if (/4/.test(cat)) return 4;
  if (/5/.test(cat)) return 5;
  if (/6/.test(cat)) return 6;
  // Priorité 2 : nom du cours
  const name = (course.fullname ?? '').toLowerCase();
  if (/\b1\b|année 1|fondamental/.test(name)) return 1;
  if (/\b2\b|intermédiaire/.test(name)) return 2;
  if (/\b3\b|avancé/.test(name)) return 3;
  return 1;
};


export default function CoursScreen() {
  const router = useRouter();
  const token = useSelector((state: RootState) => state.auth.token);
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { canPlay } = useLives();
  const { stats, refetch: refetchUserStats } = useUserStats();
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightCourses, setHighlightCourses] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);
  const PAGE_SIZE = 3;
  const [visibleCounts, setVisibleCounts] = useState<Record<number, number>>({ 1: PAGE_SIZE, 2: PAGE_SIZE, 3: PAGE_SIZE });
  const prevPrefsRef = useRef<{ language: string; grade: number }>({ language: '', grade: 0 });

  const scrollViewRef = React.useRef<any>(null);
  const coursesYRef = React.useRef(0);

  // Track courses in a ref to read latest value inside useFocusEffect without adding it as dep
  const coursesRef = React.useRef<CourseData[]>([]);
  React.useEffect(() => { coursesRef.current = courses; }, [courses]);

  useFocusEffect(
    useCallback(() => {
      refetchUserStats();

      // Détecter un changement de langue/grade depuis les paramètres → relancer fetchCourses
      AsyncStorage.getItem(PREFERENCES_KEY).then(raw => {
        if (!raw) return;
        const { language = '', grade = 0 } = JSON.parse(raw);
        const prev = prevPrefsRef.current;
        if (prev.language !== language || prev.grade !== grade) {
          prevPrefsRef.current = { language, grade };
          setFetchKey(k => k + 1);
        }
      }).catch(() => {});

      // Reload per-course progress from SQLite on every tab focus
      // This makes progress bar update immediately after viewing content in [courseId].tsx
      const reloadOnFocus = async () => {
        const current = coursesRef.current;
        if (current.length === 0 || !userId) return;
        const updates: Record<number, number> = {};
        for (const c of current) {
          try {
            const prog = await getCourseProgress(c.id, userId);
            if (prog && prog.totalActivities > 0) {
              updates[c.id] = Math.min(100, Math.round((prog.completedActivities / prog.totalActivities) * 100));
            }
          } catch { /* non-fatal */ }
        }
        if (Object.keys(updates).length > 0) {
          setCourses(prev => prev.map(c =>
            updates[c.id] !== undefined ? { ...c, progress: updates[c.id] } : c
          ));
        }
      };
      reloadOnFocus();
    }, [refetchUserStats, userId])
  );

  const guardActivity = (_path: string) => {
    if (!canPlay) {
      Alert.alert(
        "Plus de vies",
        "Tu n'as plus de vies. Achète-en une avec tes pièces ou attends 6 h.",
        [{ text: "OK" }]
      );
      return;
    }
    // Scroll to courses list and flash highlight so user knows to pick a course
    scrollViewRef.current?.scrollTo({ y: coursesYRef.current, animated: true });
    setHighlightCourses(true);
    setTimeout(() => setHighlightCourses(false), 1500);
  };

  useEffect(() => {
    const fetchCourses = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        // ── Phase 0 : cache offline ───────────────────────────────────────────
        const prefsStr = await AsyncStorage.getItem(PREFERENCES_KEY).catch(() => null);
        const prefs: UserPreferences | null = prefsStr ? JSON.parse(prefsStr) : null;
        let fetchedCourses: any[] = [];
        // true si les cours proviennent d'une fetch par catégorie Moodle
        // → le grade est garanti par la structure, pas besoin du filtre texte strict
        let fetchedViaCategory = false;

        const online = await isMoodleOnline();
        if (!online) {
          if (IS_DEV) console.log("[Cours] Offline — loading from cache");
          // Niveau 1 : AsyncStorage (plus rapide)
          const cached = await AsyncStorage.getItem(COURSES_CACHE_KEY).catch(() => null);
          if (cached) {
            fetchedCourses = JSON.parse(cached);
            if (IS_DEV) console.log("[Cours] AsyncStorage cache:", fetchedCourses.length, "cours");
          }
          // Niveau 2 : SQLite (fallback si AsyncStorage vidé)
          if (fetchedCourses.length === 0) {
            try {
              const { getDBConnection, getCourses } = await import('../../../services/storage/db-service');
              const db = await getDBConnection();
              const sqliteCourses = await getCourses(db);
              if (sqliteCourses.length > 0) {
                fetchedCourses = sqliteCourses.map(c => ({
                  id: c.id, shortname: c.shortname, fullname: c.fullname,
                  displayname: c.displayname || c.fullname, visible: c.visible === 1,
                  progress: 0, courseimage: '', coursecategory: '', viewurl: '', lessonsCount: 0,
                }));
                if (IS_DEV) console.log("[Cours] SQLite fallback:", fetchedCourses.length, "cours");
              }
            } catch {}
          }
          if (fetchedCourses.length === 0) {
            setError("Hors ligne — aucun cours en cache");
            setIsLoading(false);
            return;
          }
          // Build quick courses from cache then return
          const quickCourses: CourseData[] = await Promise.all(
            fetchedCourses.map(async (c: any) => {
              let dbProgress = null;
              let totalScore: string | undefined;
              try {
                dbProgress = await getCourseProgress(c.id, userId);
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
                ? Math.min(100, Math.round((dbProgress.completedActivities / dbProgress.totalActivities) * 100))
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
                lessonsCount: c.lessonsCount || 0,
                dbProgress: dbProgress || undefined,
                totalScore,
              };
            })
          );
          setCourses(quickCourses);
          setError(null);
          setIsLoading(false);
          return;
        }

        // ── Phase 1 : préférences + fetch Moodle ─────────────────────────────

        // ── Tentative 1 : arbre de catégories Moodle ─────────────────────────
        // Fonctionne si core_course_get_categories est ajouté au service ipelan_full
        if (prefs) {
          if (IS_DEV) console.log("[Cours] Attempt 1 – category tree for:", prefs.language, "grade", prefs.grade);
          const langCourses = await getCoursesForLanguageAndGrade(token, prefs.language, prefs.grade);
          if (langCourses.length > 0) {
            if (IS_DEV) console.log("[Cours] Attempt 1 found", langCourses.length, "courses");
            fetchedCourses = langCourses;
            fetchedViaCategory = true;
          }
        }

        // ── Tentative 2 : catégories grade déduites des cours inscrits ────────
        // N'utilise PAS core_course_get_categories — fiable avec ipelan_full
        // Logique : cours inscrit → category ID (grade) → TOUS les cours du grade
        // ⚠️ Ne pas filtrer par langue ici : les IDs de catégorie proviennent des cours
        // inscrits de l'utilisateur → la langue est garantie par la structure Moodle.
        // Un filtre texte exclurait des cours dont le nom ne contient pas le mot de
        // langue (ex : "Salutations" dans Pulaar > 1ère année).
        if (fetchedCourses.length === 0 && userId) {
          if (IS_DEV) console.log("[Cours] Attempt 2 – courses from enrolled category IDs");
          const catCourses = await getCoursesByCategoryFromEnrollments(token, userId);
          if (catCourses.length > 0) {
            fetchedCourses = catCourses;
            fetchedViaCategory = true;
            if (IS_DEV) console.log("[Cours] Attempt 2 found", catCourses.length, "courses");
          }
        }

        // ── Tentative 3 : catégorie racine langue (ID 18) ────────────────────
        if (fetchedCourses.length === 0) {
          if (IS_DEV) console.log("[Cours] Attempt 3 – root language category", ENV.API.LANGUAGE_CATEGORY_ID);
          const allLangCourses = await getAllCoursesFromLanguageCategory(token, ENV.API.LANGUAGE_CATEGORY_ID);
          if (allLangCourses.length > 0 && prefs) {
            const filtered = filterByPreferences(allLangCourses, prefs.language, prefs.grade);
            fetchedCourses = filtered.length > 0 ? filtered : allLangCourses;
            if (IS_DEV) console.log("[Cours] Attempt 3 filtered", filtered.length, "/", allLangCourses.length);
          } else {
            fetchedCourses = allLangCourses;
          }
        }

        // ── Tentative 4 : cours inscrits (timeline) + filtre texte ───────────
        if (fetchedCourses.length === 0) {
          if (IS_DEV) console.log("[Cours] Attempt 4 – enrolled courses timeline");
          const [userCoursesList, enrolledResponse] = await Promise.all([
            userId ? getUserCourses(token, userId).catch(() => [] as any[]) : Promise.resolve([] as any[]),
            getEnrolledCoursesByTimeline(token).catch(() => null),
          ]);
          const allEnrolled: any[] = userCoursesList?.length > 0
            ? userCoursesList
            : ((enrolledResponse?.courses as any[]) ?? []).filter((c: any) => c.visible !== false);

          if (prefs && allEnrolled.length > 0) {
            // Essai langue + année
            let filtered = filterByPreferences(allEnrolled, prefs.language, prefs.grade);
            // Essai langue seule
            if (filtered.length === 0) {
              const langKeys = LANG_KEYWORDS[prefs.language.toLowerCase()] ?? [prefs.language.toLowerCase()];
              filtered = allEnrolled.filter(c => {
                const text = [c.coursecategory ?? '', c.fullname ?? '', c.shortname ?? '', c.categoryname ?? '']
                  .join(' ').toLowerCase();
                return langKeys.some(k => text.includes(k));
              });
            }
            fetchedCourses = filtered.length > 0 ? filtered : allEnrolled;
            if (IS_DEV) console.log("[Cours] Attempt 4 enrolled:", fetchedCourses.length, "courses");
          } else {
            fetchedCourses = allEnrolled;
          }
        }

        // Filtre final strict : UNIQUEMENT pour les résultats non-catégorie (tentatives 3 & 4).
        // Pour les résultats catégorie (1 & 2), la structure Moodle garantit déjà le grade —
        // appliquer ce filtre exclurait des cours dont le nom ne contient pas le mot de grade.
        if (!fetchedViaCategory && prefs && fetchedCourses.length > 0) {
          const strictFiltered = filterByPreferences(fetchedCourses, prefs.language, prefs.grade);
          if (strictFiltered.length > 0) fetchedCourses = strictFiltered;
        }

        if (IS_DEV) console.log("[Cours] Total courses to display:", fetchedCourses.length);

        if (fetchedCourses.length === 0) {
          setError("Aucun cours trouvé dans les catégories de langues");
          setIsLoading(false);
          return;
        }

        // ── Phase 2 : afficher immédiatement avec données locales (SQLite) ────
        // getCourseContents (réseau) est différé à la phase 3
        const quickCourses: CourseData[] = await Promise.all(
          fetchedCourses.map(async (c: any) => {
            let dbProgress: CourseProgressData | null = null;
            let totalScore: string | undefined;

            try {
              dbProgress = await getCourseProgress(c.id, userId);
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
              ? Math.min(100, Math.round((dbProgress.completedActivities / dbProgress.totalActivities) * 100))
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
              lessonsCount: 0,  // rempli en phase 3
              dbProgress: dbProgress || undefined,
              totalScore,
            };
          })
        );

        // Afficher les cours sans attendre le nombre de leçons
        setCourses(quickCourses);
        setError(null);
        setIsLoading(false);

        // Sauvegarder les cours pour utilisation offline
        AsyncStorage.setItem(COURSES_CACHE_KEY, JSON.stringify(fetchedCourses)).catch(() => {});

        // Persister aussi en SQLite — redondance avec AsyncStorage (Niveau 1).
        // Le fallback offline ci-dessus (Niveau 2) lit cette même table `courses` ;
        // sans cette écriture elle ne serait jamais peuplée si l'utilisateur ouvre
        // l'onglet Cours avant l'onglet Accueil (qui, lui, l'alimente déjà).
        try {
          const { getDBConnection, saveCourses } = await import('../../../services/storage/db-service');
          const db = await getDBConnection();
          await saveCourses(db, fetchedCourses.map((c: any) => ({
            id: c.id, shortname: c.shortname || '', fullname: c.fullname || '',
            displayname: c.fullname || '', idnumber: c.idnumber || '',
            categoryid: c.categoryid || c.category || 0, visible: c.visible ? 1 : 0,
            summary: c.summary || '', summaryformat: c.summaryformat || 0,
            format: c.format || '', showgrades: c.showgrades ? 1 : 0,
            lang: c.lang || '', enablecompletion: c.enablecompletion ? 1 : 0,
            completionhasrules: c.completionhasrules ? 1 : 0,
          })));
        } catch (e) {
          if (IS_DEV) console.warn('[Cours] saveCourses (SQLite) failed:', e);
        }

        // ── Phase 3 : enrichir lessonsCount en arrière-plan ──────────────────
        const enrichedCache = [...fetchedCourses];
        const courseContentsMap = new Map<number, any[]>();
        for (const c of fetchedCourses) {
          try {
            const sections = await getCourseContents(token, c.id);
            if (Array.isArray(sections) && sections.length > 0) {
              courseContentsMap.set(c.id, sections);
            }
            let lessonsCount = 0;
            if (Array.isArray(sections)) {
              sections.forEach(sec => { if (sec.modules) lessonsCount += sec.modules.length; });
            }
            setCourses(prev => prev.map(course =>
              course.id === c.id ? { ...course, lessonsCount } : course
            ));
            const idx = enrichedCache.findIndex(x => x.id === c.id);
            if (idx >= 0) enrichedCache[idx] = { ...enrichedCache[idx], lessonsCount };
          } catch { }
        }
        // Mettre à jour le cache avec lessonsCount enrichi
        AsyncStorage.setItem(COURSES_CACHE_KEY, JSON.stringify(enrichedCache)).catch(() => {});

        // Sync arrière-plan : réutilise les contenus déjà fetchés, évite les doubles appels API
        runCatalogSync(enrichedCache, token!, courseContentsMap).catch(() => {});

      } catch (err: any) {
        if (IS_DEV) console.error("Failed to fetch courses:", err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, [token, fetchKey]);

  useEffect(() => {
    const reloadProgress = async () => {
      if (!token || courses.length === 0) return;

      try {
        const progressMap: Record<number, CourseProgressData> = {};
        for (const course of courses) {
          const dbProgress = await getCourseProgress(course.id, userId);
          if (dbProgress) {
            progressMap[course.id] = dbProgress;
          }
        }

        setCourses(prev => prev.map(c => ({
          ...c,
          dbProgress: progressMap[c.id] || c.dbProgress,
        })));
      } catch (err) {
        if (IS_DEV) console.warn('[Cours] Failed to reload progress:', err);
      }
    };

    reloadProgress();
  }, [stats.xp, token]);

  const groupedCourses = courses.reduce((acc, course) => {
    const level = getLevelFromCourse(course);
    if (!acc[level]) acc[level] = [];
    acc[level].push(course);
    return acc;
  }, {} as Record<number, CourseData[]>);

  const renderProgressBar = (progress: number, totalLessons: number) => {
    const completedLessons = Math.round((progress / 100) * totalLessons);
    return (
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarLabelRow}>
          <Text style={styles.progressBarLabel}>{progress}% complété</Text>
          <Text style={styles.progressBarSubLabel}>{completedLessons}/{totalLessons} leçons</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[styles.progressBarFill, { width: `${progress}%` as any, backgroundColor: progress === 100 ? '#10B981' : '#4a90e2' }]}
          />
        </View>
      </View>
    );
  };

  const renderModuleCard = (course: CourseData) => {
    const totalLessons = course.lessonsCount;
    const iconData = getIconForCourse(course.fullname);

    return (
      <Pressable
        key={course.id}
        onPress={() => router.push(`/(stacks)/(cours)/${course.id}` as any)}
        style={styles.moduleCard}
      >
        <View style={styles.moduleCardRow}>
          <View style={[styles.moduleIconWrapper, { backgroundColor: iconData.bg }]}>
            <Feather name={iconData.icon as any} size={24} color={iconData.color} />
          </View>

          <View style={styles.moduleInfo}>
            <View style={styles.moduleTitleRow}>
              <Text style={styles.moduleTitle}>
                {course.fullname}
              </Text>
              {course.totalScore && (
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreBadgeText}>★ {course.totalScore}</Text>
                </View>
              )}
            </View>

            <Text style={styles.moduleCategory} numberOfLines={2}>
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
      1: { title: "1ère Année", subtitle: "Fondamental" },
      2: { title: "2ème Année", subtitle: "Élémentaire" },
      3: { title: "3ème Année", subtitle: "Intermédiaire" },
      4: { title: "4ème Année", subtitle: "Intermédiaire+" },
      5: { title: "5ème Année", subtitle: "Avancé" },
      6: { title: "6ème Année", subtitle: "Avancé+" },
    };

    const completedModules = levelCourses.filter(c => c.progress === 100).length;
    const { title, subtitle } = levelTitles[level] || { title: `Niveau ${level}`, subtitle: "" };
    const visible = visibleCounts[level] ?? PAGE_SIZE;
    const visibleCourses = levelCourses.slice(0, visible);
    const hasMore = levelCourses.length > visible;

    return (
      <View key={level} style={styles.levelSection}>
        <View style={styles.levelHeader}>
          <View style={styles.levelHeaderLeft}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{level}</Text>
            </View>
            <View>
              <Text style={styles.levelTitle}>{title}</Text>
              <Text style={styles.levelSubtitle}>{subtitle}</Text>
            </View>
          </View>
          <View style={styles.levelCount}>
            <Text style={styles.levelCountText}>
              {completedModules}/{levelCourses.length}
            </Text>
          </View>
        </View>

        <View style={styles.levelCourses}>
          {visibleCourses.map(renderModuleCard)}
        </View>

        {hasMore && (
          <Pressable
            onPress={() => setVisibleCounts(prev => ({ ...prev, [level]: (prev[level] ?? PAGE_SIZE) + PAGE_SIZE }))}
            style={styles.showMoreButton}
          >
            <Text style={styles.showMoreText}>Voir plus ({levelCourses.length - visible} restants)</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Cours</Text>
          <Text style={styles.pageSubtitle}>
            Continue ton apprentissage des langues
          </Text>
        </View>

        <View style={styles.quickQuizSection}>
          <Pressable
            onPress={() => guardActivity("/quiz")}
            style={styles.quickQuizCard}
          >
            <View style={styles.quickQuizContent}>
              <Text style={styles.quickQuizTitle}>Quiz Rapide</Text>
              <Text style={styles.quickQuizSubtitle}>Évalue tes connaissances du jour</Text>
            </View>
            <View style={styles.quickQuizIcon}>
              <Ionicons name="flash" size={24} color="white" />
            </View>
          </Pressable>
        </View>

        <View style={styles.activitiesSection}>
          <Text style={styles.activitiesSectionTitle}>Accès Rapide</Text>
          <View style={styles.activitiesGrid}>
            <ActivityIconCard
              title="Oral"
              icon="headphones"
              color="#10B981"
              bgColor="#f0fdf4"
              onPress={() => guardActivity("/(stacks)/(cours)/listening")}
            />
            <ActivityIconCard
              title="Dictée"
              icon="edit-3"
              color="#F59E0B"
              bgColor="#fffbeb"
              onPress={() => guardActivity("/(stacks)/(cours)/dictation")}
            />
            <ActivityIconCard
              title="Association"
              icon="link"
              color="#9333EA"
              bgColor="#faf5ff"
              onPress={() => guardActivity("/(stacks)/(cours)/association")}
            />
            <ActivityIconCard
              title="Ordre"
              icon="layers"
              color="#4a90e2"
              bgColor="#eff6ff"
              onPress={() => guardActivity("/(stacks)/(cours)/game")}
            />
          </View>
        </View>

        <View
          style={[styles.learningPathSection, highlightCourses && styles.learningPathHighlight]}
          onLayout={(e) => { coursesYRef.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.learningPathTitle}>Parcours d&apos;Apprentissage</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#002366" />
              <Text style={styles.loadingText}>Chargement des cours...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : courses.length > 0 ? (
            [1, 2, 3, 4, 5, 6].map(level =>
              groupedCourses[level]?.length > 0
                ? renderLevelSection(level, groupedCourses[level])
                : null
            )
          ) : (
            <View style={styles.emptyState}>
              <Feather name="book-open" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>Aucun cours inscrit</Text>
              <Text style={styles.emptyStateSubtitle}>Inscris-toi à un cours pour commencer</Text>
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
      style={[activityCardStyles.card, { backgroundColor: bgColor }]}
    >
      <View style={activityCardStyles.iconWrapper}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <Text style={activityCardStyles.title}>{title}</Text>
    </Pressable>
  );
}

const activityCardStyles = StyleSheet.create({
  card: {
    width: '23%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  iconWrapper: {
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  title: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  pageTitle: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 24,
    marginBottom: 4,
  },
  pageSubtitle: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 24,
  },
  quickQuizSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  quickQuizCard: {
    backgroundColor: '#002366',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#002366',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  quickQuizContent: {
    flex: 1,
  },
  quickQuizTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  quickQuizSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  quickQuizIcon: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 16,
  },
  activitiesSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  activitiesSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  activitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  learningPathSection: {
    paddingHorizontal: 20,
  },
  learningPathHighlight: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#BFDBFE',
    paddingTop: 12,
    marginHorizontal: 4,
  },
  learningPathTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
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
  emptyStateTitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
  emptyStateSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  levelSection: {
    marginBottom: 24,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  levelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#002366',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  levelBadgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  levelTitle: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 18,
  },
  levelSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
  },
  levelCount: {
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  levelCountText: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '500',
  },
  levelCourses: {
    paddingLeft: 4,
  },
  showMoreButton: {
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 10,
  },
  showMoreText: {
    color: '#002366',
    fontSize: 14,
    fontWeight: '600',
  },
  moduleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  moduleCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  moduleIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  moduleInfo: {
    flex: 1,
  },
  moduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  moduleTitle: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
  },
  completedBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  completedBadgeText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  xpBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  xpBadgeText: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '500',
  },
  scoreBadge: {
    marginLeft: 8,
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scoreBadgeText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '500',
  },
  moduleCategory: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 4,
  },
  progressBarContainer: {
    marginTop: 12,
  },
  progressBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressBarLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressBarSubLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
