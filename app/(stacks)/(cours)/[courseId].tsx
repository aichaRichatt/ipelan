import { ActivityCard } from "@/components/ActivityCard";
import { ActivityTabs } from "@/components/ActivityTabs";
import { EmptyState } from "@/components/EmptyState";
import { BuyHeartsModal } from "@/components/BuyHeartsModal";
import { ActivityWithProgress, FilterTab, PaginationState } from "@/types/activity";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useCourseContent } from "../../../hooks/useCourseContent";
import { useUserStats } from "../../../hooks/useUserStats";
import { isEpubFile } from "../../../services/contentLoader";
import { RootState } from "../../../services/redux/store";
import { getAllScoresForCourse } from "../../../services/storage/activity-progress";
import { checkInternetConnection, syncCourseProgress } from "../../../services/sync/progressSync";
import { getContentTypeColor, getContentTypeIcon, getContentTypeLabel, MappedContent } from "../../../utils/contentMapper";
import { ActivityType, XP_CONFIG } from "../../../utils/xpCalculator";

const ACTIVITY_TYPES: ActivityType[] = ['quiz', 'dictation', 'listening', 'association', 'wordOrder'];
const ITEMS_PER_PAGE = 10;
const IS_DEV = process.env.NODE_ENV === "development";

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

  useEffect(() => {
    const loadProgress = async () => {
      if (!courseId || !token) {
        setProgressError("Connectez-vous pour voir votre progression");
        return;
      }
      try {
        const scores = await getAllScoresForCourse(courseId);
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
        
        console.log('[ModuleDetail] Loaded scores for', scores.size, 'activities from SQLite');
        
        const MODNAME_TO_ACTIVITY: Record<string, ActivityType> = {
          quiz: 'quiz',
          assign: 'dictation',
          choice: 'listening',
          lesson: 'association',
          glossary: 'association',
        };
        
        const totalActivities = sections?.reduce((sum, s) => sum + (s.modules?.filter(m => {
          const modname = (m.modname || '').toLowerCase();
          return MODNAME_TO_ACTIVITY[modname] !== undefined;
        }).length || 0), 0) || 0;
        
        console.log('[ModuleDetail] Total activities in course:', totalActivities);
        
        const isConnected = await checkInternetConnection();
        if (isConnected) {
          console.log('[ModuleDetail] Online - syncing with Moodle in background...');
          syncCourseProgress(token, courseId, totalActivities, userId).then(syncResult => {
            if (syncResult.success) {
              console.log('[ModuleDetail] Sync completed, reloading scores...');
              getAllScoresForCourse(courseId).then(updatedScores => {
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
                console.log('[ModuleDetail] Updated scores after sync:', updatedScores.size);
              });
            }
          });
        } else {
          console.log('[ModuleDetail] Offline - skipping Moodle sync');
        }
      } catch (err) {
        console.warn('Failed to load progress:', err);
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
          type = 'association';
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
      const { buyLife, triggerGamificationSync } = await import('@/services/gamification/gamificationService');
      const result = await buyLife(reduxUser?.id || 0);
      
      if (result.success) {
        const { updateUser } = await import('@/services/redux/slices/authSlice');
        dispatch(updateUser({
          lives: result.newLives,
          coins: result.newCoins
        }));
        await triggerGamificationSync(reduxUser?.id || 0, activeToken);
        
        const { Alert } = await import('react-native');
        Alert.alert("Succès", "Vous avez récupéré un cœur ! Bonne chance !");
        
        setIsBuyModalVisible(false);
        if (pendingAction) {
          pendingAction();
          setPendingAction(null);
        }
      } else {
        const { Alert } = await import('react-native');
        Alert.alert("Erreur", result.message);
      }
    } catch (error) {
      console.error("[handleBuyLife] Error:", error);
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
          // UI native (mod_quiz_*) — plus fiable que la WebView SSO
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
          console.warn('[handleActivityPress] Unknown activity type:', activity.type);
      }
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#002366" />
          <Text className="mt-4 text-gray-500">Chargement du cours...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!id || isNaN(parsedCourseId) || parsedCourseId === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
          <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900 flex-1">Cours</Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Feather name="alert-circle" size={48} color="#D1D5DB" />
          <Text className="text-gray-500 mt-4 text-center">Route non trouvée: {id}</Text>
          <Text className="text-gray-400 text-sm mt-2 text-center">Cette page n&apos;existe pas</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !courseContent || sections.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
          <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900 flex-1">Cours</Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Feather name="alert-circle" size={48} color="#D1D5DB" />
          <Text className="text-gray-500 mt-4 text-center">
            {error || "Impossible de charger le contenu du cours"}
          </Text>
          <Text className="text-gray-400 text-sm mt-2 text-center">
            Vérifiez votre connexion ou réessayez plus tard
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const allLessons: Lesson[] = [];
  let completedCount = 0;

  for (const section of sections) {
    const sectionModules = section.modules || [];
    for (let i = 0; i < sectionModules.length; i++) {
      const mod = sectionModules[i];
      const content = getModuleContent(mod.id);
      const type = content?.type || 'html';
      const isLocked = section.status === 'locked';
      const isCompleted = mod.completiondata?.completionstate === 2;

      let epubUrl: string | undefined;
      let pdfUrl: string | undefined;
      let audioUrl: string | undefined;
      if (mod.contents && mod.contents.length > 0) {
        console.log(`[Module ${mod.id}] Full contents:`, JSON.stringify(mod.contents, null, 2));
        for (const file of mod.contents) {
          const filename = file.filename?.toLowerCase() || '';
          const fileurl = file.fileurl || '';
          console.log(`[Module ${mod.id}] Checking file: "${filename}" from URL: ${fileurl.substring(0, 100)}...`);
          
          if (isEpubFile(filename)) {
            console.log(`[Module ${mod.id}] → Detected as EPUB`);
            epubUrl = file.fileurl;
          } else if (filename.endsWith('.pdf')) {
            console.log(`[Module ${mod.id}] → Detected as PDF`);
            pdfUrl = file.fileurl;
          } else if (filename.match(/\.(mp3|wav|ogg|m4a)$/)) {
            console.log(`[Module ${mod.id}] → Detected as audio`);
            audioUrl = file.fileurl;
          } else {
            console.log(`[Module ${mod.id}] → Unknown type (will use lesson screen)`);
          }
        }
      }

      if (isCompleted) completedCount++;

      allLessons.push({
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

  const courseTitle = title || sections[0]?.title || "Cours";
  const courseDescription = sections[0]?.summary || "";
  const progressPercent = Math.round((completedCount / Math.max(allLessons.length, 1)) * 100);

  const getLessonIcon = (type: ActivityType) => {
    const iconName = getContentTypeIcon(type);
    const color = getContentTypeColor(type);
    return { icon: iconName, color };
  };

  const handleLessonPress = async (lesson: Lesson) => {
    if (lesson.isLocked) return;

    const params = `?moduleId=${lesson.id}&moduleTitle=${encodeURIComponent(lesson.title)}&courseId=${courseId}&cmid=${lesson.id}&instanceId=${lesson.id}`;

    if (lesson.epubUrl) {
      router.push(`/(stacks)/(cours)/epub/epub-reader?epubUrl=${encodeURIComponent(lesson.epubUrl)}&title=${encodeURIComponent(lesson.title)}` as any);
      return;
    }

    if (lesson.pdfUrl) {
      router.push(`/(stacks)/(cours)/pdf/pdf-viewer?pdfUrl=${encodeURIComponent(lesson.pdfUrl)}&title=${encodeURIComponent(lesson.title)}` as any);
      return;
    }

    if (lesson.audioUrl) {
      router.push(`/(stacks)/(cours)/audio-player?audioUrl=${encodeURIComponent(lesson.audioUrl)}&moduleId=${lesson.id}&title=${encodeURIComponent(lesson.title)}&courseId=${courseId}` as any);
      return;
    }

    // Pour les activités, on vérifie les vies
    await checkLivesAndProceed(() => {
      switch (lesson.type) {
        case 'quiz':
          router.push({
            pathname: '/(stacks)/(cours)/quiz-native',
            params: {
              cmid: String(lesson.id),
              instanceId: String((lesson as any).instanceId || lesson.id),
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
        case 'resource':
        case 'folder':
        case 'lesson':
        case 'html':
          if (lesson.epubUrl) {
            router.push(`/(stacks)/(cours)/epub/epub-reader?epubUrl=${encodeURIComponent(lesson.epubUrl)}&title=${encodeURIComponent(lesson.title)}` as any);
          } else if (lesson.pdfUrl) {
            router.push(`/(stacks)/(cours)/pdf/pdf-viewer?pdfUrl=${encodeURIComponent(lesson.pdfUrl)}&title=${encodeURIComponent(lesson.title)}` as any);
          } else {
            router.push(`/(stacks)/(cours)/lesson/${lesson.id}?courseId=${courseId}` as any);
          }
          break;
        default:
          router.push(`/(stacks)/(cours)/lesson/${lesson.id}?courseId=${courseId}` as any);
          break;
      }
    });
  };

  const handleViewTimeline = () => {
    router.push(`/(stacks)/(cours)/learning-path?courseId=${courseId}&courseTitle=${encodeURIComponent(courseTitle)}` as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900 flex-1" numberOfLines={1}>
          {courseTitle}
        </Text>
      </View>

      {/* Search Bar */}
      <View className="px-5 pb-4 bg-[#FAF9F6]">
        <View className="flex-row items-center bg-white rounded-xl px-4 py-3 shadow-sm">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-3 text-gray-700"
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
        <View className="px-5 mb-6">
          <View
            className="rounded-3xl p-6"
            style={{ backgroundColor: '#002366' }}
          >
            <Text className="text-white text-2xl font-bold mb-2">{courseTitle}</Text>
            <View className="flex-row items-center mb-3">
              <View className="bg-white/20 px-3 py-1 rounded-full mr-2">
                <Text className="text-white text-xs font-medium">
                  {courseContent.totalLessons} Leçons
                </Text>
              </View>
              <View className="bg-white/20 px-3 py-1 rounded-full">
                <Text className="text-white text-xs font-medium">
                  {courseContent.totalActivities} Activités
                </Text>
              </View>
            </View>
            <Text className="text-white/80 text-sm mb-4 leading-relaxed">
              {courseDescription || "Apprends les langues nationales mauritaniennes"}
            </Text>

            <View className="bg-white/10 rounded-xl p-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-white text-sm font-medium">Progression</Text>
                <Text className="text-white font-bold">{progressPercent}%</Text>
              </View>
              <View className="h-2 bg-white/20 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{ width: `${progressPercent}%`, backgroundColor: '#F59E0B' }}
                />
              </View>
              <Text className="text-white/60 text-xs mt-2">
                {completedCount}/{allLessons.length} activités complétées
              </Text>
            </View>

            <Pressable
              onPress={handleViewTimeline}
              className="mt-4 bg-white/10 rounded-xl p-3 flex-row items-center justify-center"
            >
              <Feather name="git-branch" size={18} color="white" className="mr-2" />
              <Text className="text-white font-medium">Voir le parcours d&apos;apprentissage</Text>
            </Pressable>
          </View>
        </View>

        <View className="px-5 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Activités</Text>
          
          <ActivityTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={tabCounts}
          />
        </View>

        <View className="px-5 mb-4">
          {activities.length === 0 ? (
            <EmptyState
              title="Aucune activité trouvée"
              message="Ce cours ne contient pas d'activités de type quiz, dictée, listening, association ou ordre des mots."
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
                />
              ))}
              
              {pagination.hasMore && (
                <Pressable
                  onPress={loadMore}
                  className="bg-white border border-gray-200 rounded-xl py-3 items-center mt-2"
                >
                  <Text className="text-[#002366] font-medium">Charger plus</Text>
                </Pressable>
              )}
              
              {!pagination.hasMore && activities.length > pagination.itemsPerPage && (
                <Text className="text-center text-gray-400 text-sm mt-2">
                  Fin des activités
                </Text>
              )}
            </>
          )}
        </View>

        {/* Use filtered sections when searching */}
        {(searchQuery.trim() ? filteredSections : sections).map((section) => (
          <View key={section.id} className="px-5 mb-4">
            <View className="flex-row items-center mb-3">
              <Text className="text-lg font-bold text-gray-900">{section.title}</Text>
              {section.status !== 'available' && (
                <View className={`ml-2 px-2 py-0.5 rounded-full ${
                  section.status === 'completed' ? 'bg-green-100' :
                  section.status === 'locked' ? 'bg-gray-100' : 'bg-amber-100'
                }`}>
                  <Text className={`text-xs font-medium ${
                    section.status === 'completed' ? 'text-green-600' :
                    section.status === 'locked' ? 'text-gray-600' : 'text-amber-600'
                  }`}>
                    {section.status === 'completed' ? 'Terminé' :
                     section.status === 'locked' ? 'Verrouillé' : 'En cours'}
                  </Text>
                </View>
              )}
            </View>

            {section.modules.map((mod, idx) => {
              const content = getModuleContent(mod.id);
              const type = content?.type || (mod.modname === 'quiz' ? 'quiz' : mod.modname === 'resource' ? 'resource' : 'html');
              const { icon, color } = getLessonIcon(type);
              const typeLabel = getContentTypeLabel(type);
              const isCompleted = mod.completiondata?.completionstate === 2;
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
                        instanceId: mod.instance,
                      };
                      handleLessonPress(lesson);
                    }
                  }}
                  className={`bg-white rounded-2xl p-4 mb-2 border border-gray-200 ${
                    isLocked ? 'opacity-60' : ''
                  }`}
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                >
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full items-center justify-center mr-4">
                      {isCompleted ? (
                        <View className="w-10 h-10 rounded-full bg-green-500 items-center justify-center">
                          <AntDesign name="check" size={20} color="white" />
                        </View>
                      ) : isLocked ? (
                        <View className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center">
                          <Feather name="lock" size={18} color="#9CA3AF" />
                        </View>
                      ) : (
                        <View
                          className="w-10 h-10 rounded-full items-center justify-center"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          <Feather name={icon as any} size={18} color={color} />
                        </View>
                      )}
                    </View>

                    <View className="flex-1">
                      <View className="flex-row items-center mb-1">
                        <Text className="font-bold text-gray-900 text-sm flex-1">
                          {mod.name}
                        </Text>
                        {isCompleted && (
                          <View className="bg-green-100 px-2 py-0.5 rounded-full">
                            <Text className="text-green-600 text-xs font-medium">✓ Terminé</Text>
                          </View>
                        )}
                      </View>
                      <View className="flex-row items-center">
                        <View
                          className="px-2 py-0.5 rounded-full mr-2"
                          style={{ backgroundColor: `${color}15` }}
                        >
                          <Text className="text-xs" style={{ color }}>{typeLabel}</Text>
                        </View>
                        <Text className="text-gray-400 text-xs">{10} XP</Text>
                      </View>
                    </View>

                    {!isLocked && !isCompleted && (
                      <Feather name="chevron-right" size={20} color="#9CA3AF" className="ml-2" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View className="px-5 mt-6 mb-8">
          <Pressable
            onPress={() => {
              const nextLesson = allLessons.find(l => !l.isCompleted && !l.isLocked);
              if (nextLesson) handleLessonPress(nextLesson);
            }}
            className="bg-[#0961F5] rounded-2xl py-4 items-center"
            style={{
              shadowColor: "#F59E0B",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text className="text-white font-bold text-lg">
              {completedCount === 0 ? "Commencer" : "Continuer"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <BuyHeartsModal
        isVisible={isBuyModalVisible}
        onClose={() => setIsBuyModalVisible(false)}
        onBuy={handleBuyLife}
        lives={stats.lives}
        coins={stats.coins}
        nextHeartTime={stats.nextHeartTime}
      />
    </SafeAreaView>
  );
}
