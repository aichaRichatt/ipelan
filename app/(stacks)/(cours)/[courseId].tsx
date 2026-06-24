import { ActivityCard } from "@/components/ActivityCard";
import { ActivityTabs } from "@/components/ActivityTabs";
import { BuyHeartsModal } from "@/components/BuyHeartsModal";
import { EmptyState } from "@/components/EmptyState";
import { ActivityWithProgress, FilterTab, PaginationState } from "@/types/activity";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOfflineCachedCmids } from "../../../services/activities/activityOfflineService";
import { downloadCourseActivities, type DownloadableActivity } from "../../../services/activities/courseDownloadService";
import { isMoodleOnline } from "../../../services/api/moodleClient";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useCourseContent } from "../../../hooks/useCourseContent";
import { useUserStats } from "../../../hooks/useUserStats";
import { buyLife, LIFE_COST } from "../../../services/gamification/gamificationService";
import { syncQueue } from "../../../services/sync/syncQueue";
import { isEpubFile } from "../../../services/contentLoader";
import { updateUser } from "../../../services/redux/slices/authSlice";
import { RootState } from "../../../services/redux/store";
import { getAllScoresForCourse, saveActivityScore } from "../../../services/storage/activity-progress";
import { saveCourseProgress } from "../../../services/storage/course-progress";
import { checkInternetConnection, syncAfterActivity, syncCourseProgress } from "../../../services/sync/progressSync";
import { isQuizDownloaded, processPendingQuizDownloads, queuePendingQuizDownload } from "../../../services/quiz/quizOfflineService";
import { getContentTypeColor, getContentTypeIcon, getContentTypeLabel, MappedContent } from "../../../utils/contentMapper";
import { ActivityType, XP_CONFIG } from "../../../utils/xpCalculator";

const ACTIVITY_TYPES: ActivityType[] = ['quiz', 'dictation', 'listening', 'association', 'wordOrder'];
const ITEMS_PER_PAGE = 10;
const IS_DEV = process.env.NODE_ENV === "development";

// Lesson whose name contains "jeu" → word order game ; otherwise → association
function lessonType(name: string): ActivityType {
  return name.toLowerCase().includes('jeu') ? 'wordOrder' : 'association';
}

const styles = StyleSheet.create({
  // Layout
  flex1: { flex: 1 },
  flex1_bgFAF9F6: { flex: 1, backgroundColor: '#FAF9F6' },
  flexRow: { flexDirection: 'row' },
  flexRow_itemsCenter: { flexDirection: 'row', alignItems: 'center' },
  itemsCenter: { alignItems: 'center' },
  justifyCenter: { justifyContent: 'center' },
  justifyBetween: { justifyContent: 'space-between' },
  
  // Padding
  p2: { padding: 8 },
  p3: { padding: 12 },
  p4: { padding: 16 },
  p6: { padding: 24 },
  px2: { paddingHorizontal: 8 },
  px4: { paddingHorizontal: 16 },
  px5: { paddingHorizontal: 20 },
  py3: { paddingVertical: 12 },
  py4: { paddingVertical: 16 },
  pb4: { paddingBottom: 16 },
  
  // Margin
  m2: { margin: 8 },
  mt2: { marginTop: 8 },
  mt4: { marginTop: 16 },
  mb1: { marginBottom: 4 },
  mb2: { marginBottom: 8 },
  mb3: { marginBottom: 12 },
  mb4: { marginBottom: 16 },
  mb6: { marginBottom: 24 },
  mb8: { marginBottom: 32 },
  mr2: { marginRight: 8 },
  mr4: { marginRight: 16 },
  ml2: { marginLeft: 8 },
  ml4: { marginLeft: 16 },
  mlNegative2: { marginLeft: -8 },
  
  // Background colors
  bgFAF9F6: { backgroundColor: '#FAF9F6' },
  bgWhite: { backgroundColor: '#FFFFFF' },
  bgGreen500: { backgroundColor: '#22C55E' },
  bgGreen100: { backgroundColor: '#DCFCE7' },
  bgGray200: { backgroundColor: '#E5E7EB' },
  bgGray100: { backgroundColor: '#F3F4F6' },
  bgPrimary: { backgroundColor: '#002366' },
  bgBlue: { backgroundColor: '#0961F5' },
  bgWhite10: { backgroundColor: 'rgba(255,255,255,0.1)' },
  bgWhite20: { backgroundColor: 'rgba(255,255,255,0.2)' },
  
  // Badge styles
  badgeWhite20: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },
  progressBarContainer: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 9999, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 9999, backgroundColor: '#F59E0B' },
  
  // Module card styles
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  moduleCardLocked: {
    opacity: 0.6,
  },
  moduleIconContainer: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  typeBadge: {
    paddingVertical: 2,
  },
  completedBadge: {
    paddingVertical: 2,
  },
  
  // Text colors
  textWhite: { color: '#FFFFFF' },
  textWhite80: { color: 'rgba(255,255,255,0.8)' },
  textWhite60: { color: 'rgba(255,255,255,0.6)' },
  textGray400: { color: '#9CA3AF' },
  textGray500: { color: '#6B7280' },
  textGray600: { color: '#4B5563' },
  textGray900: { color: '#111827' },
  textGreen600: { color: '#16A34A' },
  textPrimary: { color: '#002366' },
  
  // Text styles
  textXs: { fontSize: 12 },
  textSm: { fontSize: 14 },
  textBase: { fontSize: 16 },
  textLg: { fontSize: 18 },
  textXl: { fontSize: 20 },
  text2xl: { fontSize: 24, fontWeight: '700' },
  fontMedium: { fontWeight: '500' },
  fontBold: { fontWeight: '700' },
  textCenter: { textAlign: 'center' },
  leadingRelaxed: { lineHeight: 24 },
  
  // Borders
  roundedXl: { borderRadius: 12 },
  rounded2xl: { borderRadius: 16 },
  rounded3xl: { borderRadius: 24 },
  roundedFull: { borderRadius: 9999 },
  borderGray200: { borderWidth: 1, borderColor: '#E5E7EB' },
  
  // Shadow
  shadowSm: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05 },
  shadowMd: { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1 },
  
  // Size
  h2: { height: 8 },
  hFull: { height: '100%' },
  w10: { width: 40 },
  h10: { height: 40 },
  wFull: { width: '100%' },
  
  // Overflow
  overflowHidden: { overflow: 'hidden' },
  
  // Z-index
  z10: { zIndex: 10 },
});

interface Lesson {
  id: number;
  title: string;
  type: ActivityType;
  duration: string;
  xp: number;
  isCompleted: boolean;
  isLocked: boolean;
  content?: MappedContent;
  epubUrl?: string;
  pdfUrl?: string;
  audioUrl?: string;
  moduleName?: string;
  modname?: string;
  instanceId?: number;
}

// Interface pour les modules de section
interface ModuleData {
  id: number;
  instance?: number;   // instanceId Moodle (quiz.id, glossary.id, assign.id…) — distinct du cmid (id)
  name: string;
  modname?: string;
  url?: string;
  contents?: Array<{
    type: string;
    filename?: string;
    fileurl?: string;
    mimetype?: string;
  }>;
  completiondata?: {
    completionstate: number;
  };
}

export default function ModuleDetailScreen() {
  const router = useRouter();
  const { courseId: id, title } = useLocalSearchParams<{ courseId: string; title?: string }>();
  const dispatch = useDispatch();
  const { stats } = useUserStats();
  const { user: reduxUser, token } = useSelector((state: RootState) => state.auth);
  const userId = reduxUser?.id;
  const activeToken = token || "";
  const parsedCourseId = parseInt(id || "0", 10);

  if (IS_DEV) {
    console.log('[ModuleDetail] Route loaded - courseId:', id, 'parsed:', parsedCourseId);
  }

  if (!id || isNaN(parsedCourseId) || parsedCourseId === 0) {
    if (IS_DEV) {
      console.log('[ModuleDetail] Invalid course ID:', id, '- this might be another route');
    }
  }

  const courseId = parsedCourseId;

  const {
    sections,
    courseContent,
    isLoading,
    error,
    getModuleContent,
  } = useCourseContent(token || "", isNaN(parsedCourseId) ? 0 : parsedCourseId);

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [progressData, setProgressData] = useState<Map<number, ActivityWithProgress['progress']>>(new Map());
  const [progressError, setProgressError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSections, setFilteredSections] = useState<any[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 0,
    totalPages: 0,
    itemsPerPage: ITEMS_PER_PAGE,
    hasMore: false,
  });

  // Modal de rachat de vies
  const [isBuyModalVisible, setIsBuyModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Offline cache state
  const [offlineCachedCmids, setOfflineCachedCmids] = useState<Set<number>>(new Set());
  const isDownloadingRef = useRef(false);
  const hasAutoDownloadedRef = useRef(false);
  // Reload progress from SQLite every time the screen gains focus (e.g. returning from result.tsx)
  useFocusEffect(
    useCallback(() => {
      if (!courseId || !userId) return;
      getAllScoresForCourse(courseId, userId)
        .then(scores => {
          const map = new Map<number, ActivityWithProgress['progress']>();
          scores.forEach((s, id) => {
            map.set(id, {
              moduleId: s.moduleId,
              courseId: s.courseId,
              type: s.type,
              bestScore: s.bestScore,
              totalScore: s.totalScore,
              attempts: s.attemptsCount,
              isCompleted: s.isCompleted,
              lastAttempt: s.lastAttempt,
              xpEarned: s.xpEarned,
            });
          });
          setProgressData(map);
        })
        .catch(() => {});
    }, [courseId, userId])
  );

  useEffect(() => {
    const loadProgress = async () => {
      if (!courseId || !token) {
        setProgressError("Connectez-vous pour voir votre progression");
        return;
      }
      try {
        const scores = await getAllScoresForCourse(courseId, userId);
        const progressMap = new Map<number, ActivityWithProgress['progress']>();
        
        scores.forEach((scoreData, moduleId) => {
          progressMap.set(moduleId, {
            moduleId: scoreData.moduleId,
            courseId: scoreData.courseId,
            type: scoreData.type,
            bestScore: scoreData.bestScore,
            totalScore: scoreData.totalScore,
            attempts: scoreData.attemptsCount,
            isCompleted: scoreData.isCompleted,
            lastAttempt: scoreData.lastAttempt,
            xpEarned: scoreData.xpEarned,
          });
        });
        
        setProgressData(progressMap);
        
        if (IS_DEV) console.log('[ModuleDetail] Loaded scores for', scores.size, 'activities from SQLite');
        
        const MODNAME_TO_ACTIVITY: Record<string, ActivityType> = {
          quiz: 'quiz',
          assign: 'dictation',
          choice: 'listening',
          lesson: 'wordOrder',  
          glossary: 'association',
        };
        
        const totalActivities = sections?.reduce((sum, s) => sum + (s.modules?.filter(m => {
          const modname = (m.modname || '').toLowerCase();
          return MODNAME_TO_ACTIVITY[modname] !== undefined;
        }).length || 0), 0) || 0;
        
        if (IS_DEV) console.log('[ModuleDetail] Total activities in course:', totalActivities);

        const isConnected = await checkInternetConnection();
        if (isConnected) {
          if (IS_DEV) console.log('[ModuleDetail] Online - syncing with Moodle in background...');
          syncCourseProgress(token, courseId, totalActivities, userId).then(syncResult => {
            if (syncResult.success) {
              if (IS_DEV) console.log('[ModuleDetail] Sync completed, reloading scores...');
              getAllScoresForCourse(courseId, userId).then(updatedScores => {
                const updatedMap = new Map<number, ActivityWithProgress['progress']>();
                updatedScores.forEach((scoreData, modId) => {
                  updatedMap.set(modId, {
                    moduleId: scoreData.moduleId,
                    courseId: scoreData.courseId,
                    type: scoreData.type,
                    bestScore: scoreData.bestScore,
                    totalScore: scoreData.totalScore,
                    attempts: scoreData.attemptsCount,
                    isCompleted: scoreData.isCompleted,
                    lastAttempt: scoreData.lastAttempt,
                    xpEarned: scoreData.xpEarned,
                  });
                });
                setProgressData(updatedMap);
                if (IS_DEV) console.log('[ModuleDetail] Updated scores after sync:', updatedScores.size);
              });
            }
          });
        } else {
          if (IS_DEV) console.log('[ModuleDetail] Offline - skipping Moodle sync');
        }
      } catch (err) {
        if (IS_DEV) console.warn('Failed to load progress:', err);
        setProgressError("Erreur lors du chargement de la progression");
      }
    };
    loadProgress();
  }, [courseId, token, sections]);

   useEffect(() => {
    if (!sections || sections.length === 0) {
      setFilteredSections([]);
      return;
    }

    if (!searchQuery.trim()) {
      setFilteredSections(sections);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = sections.map(section => {
       const filteredModules = section.modules?.filter((mod: any) => {
        const nameMatch = mod.name?.toLowerCase().includes(query);
        const typeMatch = mod.modname?.toLowerCase().includes(query);
        return nameMatch || typeMatch;
      }) || [];

      // Only include section if it has matching modules
      if (filteredModules.length > 0) {
        return { ...section, modules: filteredModules };
      }
      return null;
    }).filter(Boolean);

    setFilteredSections(filtered);
  }, [sections, searchQuery]);

  const activities = useMemo(() => {
    const result: ActivityWithProgress[] = [];
    let order = 0;

    // Use filteredSections when searching, otherwise use all sections
    const sectionsToUse = searchQuery.trim() ? filteredSections : sections;

    if (!sectionsToUse || sectionsToUse.length === 0) {
      return result;
    }

    for (const section of sectionsToUse) {
      const sectionModules = section.modules || [];
      if (IS_DEV && sectionModules.length > 0) {
        console.log('[ModuleDetail] Section', section.id, 'named:', section.title, '- has', sectionModules.length, 'modules');
        for (const mod of sectionModules) {
          console.log('  -', mod.modname, ':', mod.name, '(id:', mod.id, ', instance:', mod.instance, ')');
        }
      }
      for (const mod of sectionModules) {
        const modname = mod.modname?.toLowerCase() || '';
        let type: ActivityType | null = null;
        
        if (modname === 'quiz') {
          type = 'quiz';
        } else if (modname === 'assign' || modname === 'assignment') {
          type = 'dictation';
        } else if (modname === 'choice') {
          type = 'listening';
        } else if (modname === 'lesson') {
          type = lessonType(mod.name || '');
        } else if (modname === 'glossary') {
          type = 'association';
        }
        
        if (type && ACTIVITY_TYPES.includes(type)) {
          const xp = XP_CONFIG[type]?.baseXP || 10;
          const progress = progressData.get(mod.id);
          
          result.push({
            id: mod.id,
            instanceId: mod.instance || mod.id,
            title: mod.name || `Activité ${mod.id}`,
            type,
            xp,
            order: order++,
            sectionId: section.id,
            sectionName: section.title,
            progress: progress || undefined,
          });
        }
      }
    }

    if (activeTab !== 'all') {
      return result.filter(a => a.type === activeTab);
    }
    return result;
  }, [sections, filteredSections, searchQuery, activeTab, progressData]);

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: activities.length,
      quiz: 0,
      dictation: 0,
      listening: 0,
      association: 0,
      wordOrder: 0,
      lesson: 0,
      html: 0,
      resource: 0,
      folder: 0,
      book: 0,
      label: 0
    };
    
    activities.forEach(a => {
      if (a.type in counts) {
        counts[a.type] = (counts[a.type] || 0) + 1;
      }
    });
    
    return counts;
  }, [activities]);

  const paginatedActivities = useMemo(() => {
    const start = pagination.page * pagination.itemsPerPage;
    return activities.slice(start, start + pagination.itemsPerPage);
  }, [activities, pagination.page]);

  const totalPages = Math.ceil(activities.length / pagination.itemsPerPage);

  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      page: 0, // Reset to first page when activities change (search/filter)
      totalPages,
      hasMore: (0 + 1) * prev.itemsPerPage < activities.length,
    }));
  }, [activities.length]);

  const loadMore = () => {
    if (pagination.hasMore) {
      setPagination(prev => ({
        ...prev,
        page: prev.page + 1,
      }));
    }
  };

  // Rafraîchir les badges hors-ligne quand la liste d'activités change ou que l'écran prend le focus
  useEffect(() => {
    if (!activities.length) return;
    const cmids = activities.map(a => a.id);
    getOfflineCachedCmids(cmids).then(setOfflineCachedCmids).catch(() => {});
  }, [activities]);

  // Auto-download silencieux — déclenché dès que les sections sont prêtes.
  // Si la première tentative tombe hors-ligne, elle est automatiquement
  // retentée au retour réseau (listener NetInfo ci-dessous) sans que
  // l'utilisateur ait besoin de quitter/rouvrir l'écran du cours.
  useEffect(() => {
    if (!sections?.length || !activeToken) return;

    const MODNAME_TO_DL_TYPE: Record<string, DownloadableActivity['type']> = {
      assign  : 'dictation',
      choice  : 'listening',
      glossary: 'association',
      lesson  : 'word_order',
      quiz    : 'quiz',
    };
    const downloadable: DownloadableActivity[] = [];
    for (const section of sections) {
      for (const mod of section.modules || []) {
        const modnameLow = (mod.modname || '').toLowerCase();
        let dlType = MODNAME_TO_DL_TYPE[modnameLow];
        if (modnameLow === 'lesson') {
          dlType = lessonType(mod.name || '') === 'wordOrder' ? 'word_order' : 'association';
        }
        if (dlType) {
          downloadable.push({
            cmid      : mod.id,
            instanceId: mod.instance || mod.id,
            type      : dlType,
            title     : mod.name || '',
            courseId,
            modname   : modnameLow,
          });
        }
      }
    }
    if (!downloadable.length) return;

    const attemptAutoDownload = async () => {
      if (hasAutoDownloadedRef.current || isDownloadingRef.current) return;
      isDownloadingRef.current = true;
      try {
        const online = await isMoodleOnline();
        if (!online) return; // sera retenté par le listener NetInfo au retour réseau

        hasAutoDownloadedRef.current = true;

        // Télécharger dictée, écoute, association, word-order
        await downloadCourseActivities(courseId, activeToken, downloadable);

        // Quiz non encore mis en cache : enregistrer l'intention en local D'ABORD
        // (offline-first — survit à une coupure réseau pendant cet appel), puis
        // pousser le vrai appel mod_quiz_start_attempt. En cas d'échec réseau,
        // la ligne reste 'pending' et sera réessayée par queueProcessor.ts
        // au prochain démarrage / retour au premier plan / reconnexion.
        const quizList = downloadable.filter(d => d.type === 'quiz');
        for (const quiz of quizList) {
          const cached = await isQuizDownloaded(quiz.cmid);
          if (!cached) {
            await queuePendingQuizDownload(quiz.cmid, quiz.instanceId, courseId);
          }
        }
        await processPendingQuizDownloads(activeToken);

        const cmids = downloadable.map(d => d.cmid);
        getOfflineCachedCmids(cmids).then(setOfflineCachedCmids).catch(() => {});
      } finally {
        isDownloadingRef.current = false;
      }
    };

    attemptAutoDownload();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && !hasAutoDownloadedRef.current) {
        attemptAutoDownload();
      }
    });

    return () => unsubscribe();
  }, [sections, activeToken]);

  const checkLivesAndProceed = async (onProceed: () => void) => {
    if (stats.lives <= 0) {
      setPendingAction(() => onProceed);
      setIsBuyModalVisible(true);
      return false;
    }
    onProceed();
    return true;
  };

  const handleBuyLife = async () => {
    try {
      const result = await buyLife(reduxUser?.id || 0);

      if (result.success) {
        dispatch(updateUser({
          lives: result.newLives,
          coins: result.newCoins,
        }));
        if (activeToken) syncQueue.syncGamification(reduxUser?.id || 0, activeToken);
        Alert.alert("Succès", "Vous avez récupéré un cœur ! Bonne chance !");
        setIsBuyModalVisible(false);
        if (pendingAction) {
          pendingAction();
          setPendingAction(null);
        }
      } else {
        Alert.alert("Erreur", result.message);
      }
    } catch (error) {
      if (IS_DEV) console.error("[handleBuyLife] Error:", error);
    }
  };

  const handleActivityPress = async (activity: ActivityWithProgress) => {
    await checkLivesAndProceed(() => {
      const baseParams = {
        moduleId: String(activity.id),
        moduleTitle: activity.title,
        courseId: String(courseId),
        instanceId: String(activity.instanceId || activity.id),
        cmid: String(activity.id),
      };

      switch (activity.type) {
        case 'quiz':
           router.push({
            pathname: '/(stacks)/(cours)/quiz-native',
            params: {
              cmid: String(activity.id),
              instanceId: String(activity.instanceId || activity.id),
              courseId: String(courseId),
              moduleTitle: activity.title,
            },
          } as any);
          break;
        case 'dictation':
          router.push({ pathname: '/(stacks)/(cours)/dictation', params: baseParams } as any);
          break;
        case 'listening':
          router.push({ pathname: '/(stacks)/(cours)/listening', params: baseParams } as any);
          break;
        case 'association':
          router.push({ pathname: '/(stacks)/(cours)/association', params: baseParams } as any);
          break;
        case 'wordOrder':
          router.push({ pathname: '/(stacks)/(cours)/game', params: baseParams } as any);
          break;
        default:
          if (IS_DEV) console.warn('[handleActivityPress] Unknown activity type:', activity.type);
      }
    });
  };

   const { allLessons, completedCount, completableCompleted, completableTotal } = useMemo(() => {
    const lessons: Lesson[] = [];
    let completed = 0;
    let compCompleted = 0;
    let compTotal = 0;
    for (const section of sections || []) {
      for (const mod of section.modules || []) {
        const content = getModuleContent(mod.id);
        const type = content?.type || 'html';
        const isLocked = section.status === 'locked';
        const progressInfo = progressData.get(mod.id);
        const isCompleted = progressInfo?.isCompleted === true || (mod.completiondata?.completionstate ?? 0) >= 1;

        // Mirror getCompletableModules filter: only modules with completion tracking
        const isCompletable = (mod.completion ?? 0) > 0
          && mod.visible !== 0
          && !['label', 'section'].includes(mod.modname ?? '')
          && mod.instance && mod.instance !== 0;
        if (isCompletable) {
          compTotal++;
          if (isCompleted) compCompleted++;
        }

        let epubUrl: string | undefined;
        let pdfUrl: string | undefined;
        let audioUrl: string | undefined;
        for (const file of mod.contents || []) {
          const filename = file.filename?.toLowerCase() || '';
          if (isEpubFile(filename)) {
            epubUrl = file.fileurl;
          } else if (filename.endsWith('.pdf')) {
            pdfUrl = file.fileurl;
          } else if (filename.match(/\.(mp3|wav|ogg|m4a)$/)) {
            audioUrl = file.fileurl;
          }
          if (IS_DEV && filename) {
            console.log(`[Module ${mod.id}] file="${filename}" type=${epubUrl ? 'epub' : pdfUrl ? 'pdf' : audioUrl ? 'audio' : 'other'}`);
          }
        }

        if (isCompleted) completed++;
        lessons.push({
          id: mod.id,
          title: mod.name || `Module ${mod.id}`,
          type,
          duration: "10 min",
          xp: 10,
          isCompleted,
          isLocked,
          content: content || undefined,
          epubUrl,
          pdfUrl,
          audioUrl,
          instanceId: mod.instance,
        });
      }
    }
    return { allLessons: lessons, completedCount: completed, completableCompleted: compCompleted, completableTotal: compTotal };
  }, [sections, progressData, getModuleContent]);

 useEffect(() => {
    if (!courseId || !userId) return;
    const total = completableTotal > 0 ? completableTotal : allLessons.length;
    const saved = completableTotal > 0 ? completableCompleted : completedCount;
    if (total === 0) return;
    saveCourseProgress(courseId, saved, total, 0, 0, userId).catch(() => {});
  }, [courseId, userId, completableCompleted, completableTotal, completedCount, allLessons.length]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>
        <View style={[styles.flex1, styles.itemsCenter, styles.justifyCenter]}>
          <ActivityIndicator size="large" color="#002366" />
          <Text style={[styles.mt4, styles.textGray500]}>Chargement du cours...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!id || isNaN(parsedCourseId) || parsedCourseId === 0) {
    return (
      <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>
        <View style={[styles.px5, styles.py4, styles.flexRow, styles.itemsCenter, styles.bgFAF9F6]}>
          <Pressable onPress={() => router.back()} style={[styles.mr4, styles.p2, styles.mlNegative2]}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={[styles.textLg, styles.fontBold, styles.textGray900, styles.flex1]}>Cours</Text>
        </View>
        <View style={[styles.flex1, styles.itemsCenter, styles.justifyCenter, styles.px5]}>
          <Feather name="alert-circle" size={48} color="#D1D5DB" />
          <Text style={[styles.textGray500, styles.mt4, styles.textCenter]}>Route non trouvée: {id}</Text>
          <Text style={[styles.textGray400, styles.textSm, styles.mt2, styles.textCenter]}>Cette page n&apos;existe pas</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !courseContent || sections.length === 0) {
    return (
      <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>
        <View style={[styles.px5, styles.py4, styles.flexRow, styles.itemsCenter, styles.bgFAF9F6]}>
          <Pressable onPress={() => router.back()} style={[styles.mr4, styles.p2, styles.mlNegative2]}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={[styles.textLg, styles.fontBold, styles.textGray900, styles.flex1]}>Cours</Text>
        </View>
        <View style={[styles.flex1, styles.itemsCenter, styles.justifyCenter, styles.px5]}>
          <Feather name="alert-circle" size={48} color="#D1D5DB" />
          <Text style={[styles.textGray500, styles.mt4, styles.textCenter]}>
            {error || "Impossible de charger le contenu du cours"}
          </Text>
          <Text style={[styles.textGray400, styles.textSm, styles.mt2, styles.textCenter]}>
            Vérifiez votre connexion ou réessayez plus tard
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const courseTitle = title || sections[0]?.title || "Cours";
  const courseDescription = sections[0]?.summary || "";
  const progressPercent = completableTotal > 0
    ? Math.min(100, Math.round((completableCompleted / completableTotal) * 100))
    : Math.round((completedCount / Math.max(allLessons.length, 1)) * 100);

  const getLessonIcon = (type: ActivityType) => {
    const iconName = getContentTypeIcon(type);
    const color = getContentTypeColor(type);
    return { icon: iconName, color };
  };

  // Mark static content (PDF, EPUB, HTML) as completed when opened — "view = complete"
  const markContentViewed = (cmid: number, contentType: ActivityType = 'lesson') => {
    if (!userId) return;

    // Already completed — sync to Moodle only, never re-award XP
    if (progressData.get(cmid)?.isCompleted) {
      syncAfterActivity({ courseId, cmid, score: 100, maxScore: 100, userId, tokenParam: token || undefined })
        .catch(e => { if (IS_DEV) console.warn('[markContentViewed] sync failed:', e); });
      return;
    }

    const xpForContent = XP_CONFIG[contentType]?.baseXP ?? 5;

    // Optimistic UI update — immediate progress bar refresh in this screen
    setProgressData(prev => {
      if (prev.get(cmid)?.isCompleted) return prev;
      const next = new Map(prev);
      next.set(cmid, {
        moduleId: cmid,
        courseId,
        type: contentType,
        bestScore: 100,
        totalScore: 100,
        attempts: 1,
        isCompleted: true,
        lastAttempt: new Date().toISOString(),
        xpEarned: xpForContent,
      });
      return next;
    });

    const totalModules = sections?.reduce((sum: number, s: any) => sum + (s.modules?.length || 0), 0) || 0;

    // Persist locally then update course_progress so the course list stays in sync
    saveActivityScore(cmid, courseId, contentType, 100, 100, xpForContent, userId, 0, token || undefined)
      .then(async () => {
        try {
          const { updateCourseProgressFromActivities } = await import('../../../services/storage/course-progress');
          await updateCourseProgressFromActivities(courseId, totalModules, userId);
          if (IS_DEV) console.log('[markContentViewed] course_progress updated', { courseId, totalModules });
        } catch (e) {
          if (IS_DEV) console.warn('[markContentViewed] course_progress update failed:', e);
        }
      })
      .catch(e => { if (IS_DEV) console.warn('[markContentViewed] save failed:', e); });

    // Sync to Moodle (non-blocking)
    syncAfterActivity({ courseId, cmid, score: 100, maxScore: 100, userId, tokenParam: token || undefined })
      .catch(e => { if (IS_DEV) console.warn('[markContentViewed] sync failed:', e); });
  };

  const handleLessonPress = async (lesson: Lesson) => {
    if (lesson.isLocked) return;

    const instanceId = lesson.instanceId || lesson.id;
    const params = `?moduleId=${lesson.id}&moduleTitle=${encodeURIComponent(lesson.title)}&courseId=${courseId}&cmid=${lesson.id}&instanceId=${instanceId}`;

    // ✅ Contenu éducatif: accessible SANS vies (visualisation/lecture)
    if (lesson.epubUrl) {
      markContentViewed(lesson.id, 'book');
      router.push(`/(stacks)/(cours)/epub/epub-reader?cmid=${lesson.id}&courseId=${courseId}&epubUrl=${encodeURIComponent(lesson.epubUrl!)}&title=${encodeURIComponent(lesson.title)}` as any);
      return;
    }

    if (lesson.pdfUrl) {
      markContentViewed(lesson.id, 'resource');
      router.push(`/(stacks)/(cours)/pdf/pdf-viewer?pdfUrl=${encodeURIComponent(lesson.pdfUrl)}&title=${encodeURIComponent(lesson.title)}` as any);
      return;
    }

    if (lesson.audioUrl) {
      markContentViewed(lesson.id, 'resource');
      router.push(`/(stacks)/(cours)/audio-player?audioUrl=${encodeURIComponent(lesson.audioUrl)}&moduleId=${lesson.id}&title=${encodeURIComponent(lesson.title)}&courseId=${courseId}` as any);
      return;
    }

    // Contenu statique (leçons, ressources) : accessible sans vies
    const isStaticContent = ['resource', 'folder', 'lesson', 'html', 'url', 'page'].includes(lesson.type);
    if (isStaticContent) {
      markContentViewed(lesson.id, lesson.type as ActivityType);
      router.push(`/(stacks)/(cours)/lesson/${lesson.id}?courseId=${courseId}` as any);
      return;
    }

    // ❌ Activités interactives: nécessitent une vie
    await checkLivesAndProceed(() => {
      switch (lesson.type) {
        case 'quiz':
          router.push({
            pathname: '/(stacks)/(cours)/quiz-native',
            params: {
              cmid: String(lesson.id),
              instanceId: String(instanceId),
              courseId: String(courseId),
              moduleTitle: lesson.title,
            },
          } as any);
          break;
        case 'dictation':
          router.push(`/(stacks)/(cours)/dictation${params}` as any);
          break;
        case 'listening':
          router.push(`/(stacks)/(cours)/listening${params}` as any);
          break;
        case 'association':
          router.push(`/(stacks)/(cours)/association${params}` as any);
          break;
        case 'wordOrder':
          router.push(`/(stacks)/(cours)/game${params}` as any);
          break;
        default:
          // Par défaut, considérer comme du contenu statique
          router.push(`/(stacks)/(cours)/lesson/${lesson.id}?courseId=${courseId}` as any);
          break;
      }
    });
  };

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>
      <View style={[styles.px5, styles.py4, styles.flexRow, styles.itemsCenter, styles.bgFAF9F6]}>
        <Pressable onPress={() => router.push('/(tabs)/(home)')} style={[styles.mr4, styles.p2, styles.mlNegative2]}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text style={[styles.textLg, styles.fontBold, styles.textGray900, styles.flex1]} numberOfLines={1}>
          {courseTitle}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.px5, styles.pb4, styles.bgFAF9F6]}>
        <View style={[styles.flexRow, styles.itemsCenter, styles.bgWhite, styles.roundedXl, styles.px4, styles.py3, styles.shadowSm]}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={[styles.flex1, styles.ml2, { color: "#374151" }]}
            placeholder="Rechercher une leçon ou activité..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={[styles.px5, styles.mb6]}>
          <View
            style={[styles.rounded3xl, styles.p6, { backgroundColor: '#002366' }]}
          >
            <Text style={[styles.textWhite, { fontSize: 24, fontWeight: "700" }, styles.mb2]}>{courseTitle}</Text>
            <View style={[styles.flexRow, styles.itemsCenter, styles.mb3]}>
              <View style={[styles.badgeWhite20, styles.mr2]}>
                <Text style={[styles.textWhite, styles.textXs, styles.fontMedium]}>
                  {courseContent.totalLessons} Leçons
                </Text>
              </View>
              <View style={styles.badgeWhite20}>
                <Text style={[styles.textWhite, styles.textXs, styles.fontMedium]}>
                  {courseContent.totalActivities} Activités
                </Text>
              </View>
            </View>
            <Text style={[styles.textWhite80, styles.textSm, styles.mb4, styles.leadingRelaxed]}>
              {courseDescription || "Apprends les langues nationales mauritaniennes"}
            </Text>

            <View style={[styles.bgWhite10, styles.roundedXl, styles.p4]}>
              <View style={[styles.flexRow, styles.justifyBetween, styles.itemsCenter, styles.mb2]}>
                <Text style={[styles.textWhite, styles.textSm, styles.fontMedium]}>Progression</Text>
                <Text style={[styles.textWhite, styles.fontBold]}>{progressPercent}%</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={[styles.textWhite60, styles.textXs, styles.mt2]}>
                {completableTotal > 0
                  ? `${completableCompleted}/${completableTotal} activités complétées`
                  : `${completedCount}/${allLessons.length} activités complétées`
                }
              </Text>
            </View>

            {/* <Pressable
              onPress={handleViewTimeline}
              style={[styles.mt4, styles.bgWhite10, styles.roundedXl, styles.p3, styles.flexRow, styles.itemsCenter, styles.justifyCenter]}
            >
              <Feather name="git-branch" size={18} color="white" style={styles.mr2} />
              <Text style={[styles.textWhite, styles.fontMedium]}>Voir le parcours d&apos;apprentissage</Text>
            </Pressable> */}
          </View>
        </View>

        <View style={[styles.px5, styles.mb4]}>
          <Text style={[styles.textLg, styles.fontBold, styles.textGray900, styles.mb3]}>Activités</Text>
          
          <ActivityTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={tabCounts}
          />
        </View>

        {/* Tab spécifique (quiz, dictation, etc.) -> ActivityCards */}
        {activeTab !== 'all' && (
          <View style={[styles.px5, styles.mb4]}>
            {activities.length === 0 ? (
              <EmptyState
                title="Aucune activité trouvée"
                message={`Ce cours ne contient pas d'activités de type ${activeTab}.`}
                actionLabel="Retour"
                onAction={() => router.back()}
              />
            ) : (
              <>
                {paginatedActivities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onPress={() => handleActivityPress(activity)}
                    isOfflineCached={offlineCachedCmids.has(activity.id)}
                  />
                ))}
                
                {pagination.hasMore && (
                  <Pressable
                    onPress={loadMore}
                    style={[styles.bgWhite, styles.borderGray200, styles.roundedXl, styles.py3, styles.itemsCenter, styles.mt2]}
                  >
                    <Text style={[styles.textPrimary, styles.fontMedium]}>Charger plus</Text>
                  </Pressable>
                )}
                
                {!pagination.hasMore && activities.length > pagination.itemsPerPage && (
                  <Text style={[styles.textCenter, styles.textGray400, styles.textSm, styles.mt2]}>
                    Fin des activités
                  </Text>
                )}
              </>
            )}
          </View>
        )}

        {/* Tab "Tous" ou Recherche -> Sections complètes */}
        {(activeTab === 'all' || searchQuery.trim()) && (searchQuery.trim() ? filteredSections : sections).map((section) => (
          <View key={section.id} style={[styles.px5, styles.mb4]}>
            <View style={[styles.flexRow, styles.itemsCenter, styles.mb3]}>
              <Text style={[styles.textLg, styles.fontBold, styles.textGray900]}>{section.title}</Text>
              {section.status !== 'available' && (
                <View style={[styles.ml2, styles.px2, { paddingVertical: 2 }, styles.roundedFull, { backgroundColor: 
                  section.status === 'completed' ? '#DCFCE7' :
                  section.status === 'locked' ? '#F3F4F6' : '#FEF3C7'
                }]}>
                  <Text style={[styles.textXs, styles.fontMedium, { color:
                    section.status === 'completed' ? '#16A34A' :
                    section.status === 'locked' ? '#6B7280' : '#D97706'
                  }]}>
                    {section.status === 'completed' ? 'Terminé' :
                     section.status === 'locked' ? 'Verrouillé' : 'En cours'}
                  </Text>
                </View>
              )}
            </View>

            {section.modules.map((mod: ModuleData, idx: number) => {
              const content = getModuleContent(mod.id);
              // ⚠️ content?.type peut être écrasé par la détection de fichiers (.html → 'html')
              // Pour le ROUTAGE : toujours utiliser modname (même source que les onglets spécifiques)
              // content sert uniquement pour epubUrl / pdfUrl / audioUrl
              const modnameLower = mod.modname?.toLowerCase() || '';
              const modnameTypeMap: Record<string, ActivityType> = {
                quiz: 'quiz', assign: 'dictation', choice: 'listening',
                glossary: 'association',
                resource: 'resource', book: 'book', folder: 'folder',
                label: 'label', page: 'html', url: 'html',
              };
              const type: ActivityType = modnameLower === 'lesson'
                ? lessonType(mod.name || '')
                : (modnameTypeMap[modnameLower] ?? content?.type ?? 'html');
              const { icon, color } = getLessonIcon(type);
              const typeLabel = getContentTypeLabel(type);
              const progressInfo = progressData.get(mod.id);
              const isCompleted = progressInfo?.isCompleted === true || (mod.completiondata?.completionstate ?? 0) >= 1;
              const isLocked = section.status === 'locked';

              return (
                <Pressable
                  key={mod.id}
                  onPress={() => {
                    if (!isLocked) {
                      const lesson: Lesson = {
                        id: mod.id,
                        title: mod.name || `Module ${mod.id}`,
                        type,
                        duration: "10 min",
                        xp: 10,
                        isCompleted,
                        isLocked,
                        moduleName: mod.name || "",
                        modname: mod.modname || "unknown",
                        epubUrl: content?.epubUrl,
                        pdfUrl: content?.pdfUrl,
                        audioUrl: content?.audioUrl,
                        instanceId: mod.instance || mod.id, // mod.instance = instanceId Moodle (≠ cmid)
                      };
                      handleLessonPress(lesson);
                    }
                  }}
                  style={[styles.moduleCard, isLocked && styles.moduleCardLocked]}
                >
                  <View style={[styles.flexRow, styles.itemsCenter]}>
                    <View style={[styles.w10, styles.h10, styles.roundedFull, styles.itemsCenter, styles.justifyCenter, styles.mr4]}>
                      {isCompleted && ACTIVITY_TYPES.includes(type) ? (
                        <View style={[styles.w10, styles.h10, styles.roundedFull, styles.bgGreen500, styles.itemsCenter, styles.justifyCenter]}>
                          <AntDesign name="check" size={20} color="white" />
                        </View>
                      ) : isLocked ? (
                        <View style={[styles.w10, styles.h10, styles.roundedFull, styles.bgGray200, styles.itemsCenter, styles.justifyCenter]}>
                          <Feather name="lock" size={18} color="#9CA3AF" />
                        </View>
                      ) : (
                        <View
                          style={[styles.w10, styles.h10, styles.roundedFull, styles.itemsCenter, styles.justifyCenter, styles.moduleIconContainer, { backgroundColor: `${color}20` }]}
                        >
                          <Feather name={icon as any} size={18} color={color} />
                        </View>
                      )}
                    </View>

                    <View style={styles.flex1}>
                      <View style={[styles.flexRow, styles.itemsCenter, styles.mb1]}>
                        <Text style={[styles.fontBold, styles.textGray900, styles.textSm, { flex: 1 }]}>
                          {mod.name}
                        </Text>
                      </View>
                      <View style={[styles.flexRow, styles.itemsCenter]}>
                        <View
                          style={[styles.px2, styles.typeBadge, styles.roundedFull, styles.mr2, { backgroundColor: `${color}15` }]}
                        >
                          <Text style={[styles.textXs, { color }]}>{typeLabel}</Text>
                        </View>
                        <Text style={[styles.textGray400, styles.textXs]}>{XP_CONFIG[type]?.baseXP ?? 10} XP</Text>
                      </View>
                    </View>

                    {!isLocked && (
                      <Feather name="chevron-right" size={20} color="#9CA3AF" style={styles.ml2} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

      
      </ScrollView>

      <BuyHeartsModal
        isVisible={isBuyModalVisible}
        onClose={() => setIsBuyModalVisible(false)}
        onBuy={handleBuyLife}
        lives={stats.lives}
        coins={stats.coins}
        nextHeartTime={stats.nextHeartTime}
        cost={LIFE_COST}
      />
    </SafeAreaView>
  );
}
