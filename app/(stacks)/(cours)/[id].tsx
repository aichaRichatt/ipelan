import { AntDesign, Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "../../../services/redux/store";
import { useCourseContent } from "../../../hooks/useCourseContent";
import { getContentTypeIcon, getContentTypeColor, getContentTypeLabel, MappedContent } from "../../../utils/contentMapper";
import { ActivityType } from "../../../utils/xpCalculator";
import { isEpubFile } from "../../../services/contentLoader";

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
}

export default function ModuleDetailScreen() {
  const router = useRouter();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  const courseId = parseInt(id || "0", 10);

  const {
    sections,
    courseContent,
    isLoading,
    error,
    getModuleContent,
  } = useCourseContent(token || "", courseId);

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
        content,
        epubUrl,
        pdfUrl,
        audioUrl,
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

    const handleLessonPress = (lesson: Lesson) => {
    if (lesson.isLocked) return;

    const params = `?moduleId=${lesson.id}&moduleTitle=${encodeURIComponent(lesson.title)}&courseId=${courseId}`;

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

    switch (lesson.type) {
      case 'quiz':
        router.push(`/(quiz)/index${params}` as any);
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
      case 'lesson':
      case 'html':
      default:
        router.push(`/(stacks)/(cours)/lesson/${lesson.id}?courseId=${courseId}` as any);
        break;
    }
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

        {sections.map((section) => (
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
              const type = content?.type || 'html';
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
    </SafeAreaView>
  );
}
