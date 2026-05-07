import { getCourseContents } from "@/services/api/courseService";
import { RootState } from "@/services/redux/store";
import { AntDesign, Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

interface Lesson {
  id: number;
  title: string;
  type: "audio" | "reading" | "quiz" | "exercise" | "game";
  duration: string;
  xp: number;
  isCompleted: boolean;
  isLocked: boolean;
}

interface ModuleData {
  id: number;
  title: string;
  description: string;
  language: string;
  level: string;
  totalLessons: number;
  completedLessons: number;
  lessons: Lesson[];
}

const mapModtypeToType = (modname: string): Lesson["type"] => {
  const m = modname?.toLowerCase() || "";
  if (m.includes("lesson")) return "audio";
  if (m.includes("resource")) return "reading";
  if (m.includes("quiz")) return "quiz";
  if (m.includes("assign") || m.includes("exercise")) return "exercise";
  if (m.includes("game")) return "game";
  return "audio";
};

const styles = StyleSheet.create({
  absolute_bottom3_left0_right0_: {
    left: 0,
    margin: 8,
    position: 'absolute',
    right: 0
  },
  bg0961F5_rounded2xl_py4_itemsc: {
    alignItems: 'center',
    borderRadius: 16,
    marginTop: 12,
    paddingVertical: 16
  },
  bgF59E0B_px2_py1_roundedfull: {
    backgroundColor: '#F59E0B',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  bggreen100_px2_py1_roundedfull: {
    backgroundColor: '#DCFCE7',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  bgwhite20_px3_py1_roundedfull: {
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  bgwhite20_px3_py1_roundedfull_: {
    borderRadius: 9999,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 4
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
  flexrow: {
    flexDirection: 'row'
  },
  flexrow_itemscenter: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  flexrow_itemscenter_justifybet: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  flexrow_itemscenter_mb3: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12
  },
  flexrow_justifybetween_itemsce: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  h2_bgwhite20_roundedfull_overf: {
    borderRadius: 9999,
    height: 8,
    overflow: 'hidden'
  },
  hfull_roundedfull: {
    borderRadius: 9999,
    height: '100%'
  },
  itemscenter_mr4: {
    alignItems: 'center',
    marginRight: 16
  },
  mr4_p2_ml2: {
    marginLeft: -8,
    marginRight: 16,
    padding: 8
  },
  px5: {
    paddingHorizontal: 20
  },
  px5_mb6: {
    marginBottom: 24,
    paddingHorizontal: 20
  },
  px5_py4_flexrow_itemscenter_bg: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  rounded3xl_p5: {
    borderRadius: 24,
    padding: 20
  },
  style_1: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500'
  },
  style_2: {
    color: '#111827',
    flex: 1,
    fontSize: 18,
    fontWeight: '700'
  },
  style_3: {
    marginLeft: -8,
    marginRight: 16,
    padding: 8
  },
  style_4: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  style_5: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  style_6: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  style_7: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  textF59E0B_textxs_fontbold: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700'
  },
  textgray400_textxs_mr3: {
    color: '#9CA3AF',
    fontSize: 12,
    marginRight: 12
  },
  textgray500: {
    color: '#6B7280'
  },
  textgray500_textxs_mr3: {
    color: '#6B7280',
    fontSize: 12,
    marginRight: 12
  },
  textgreen600_textxs_fontmedium: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '500'
  },
  textlg_fontbold_textgray900_fl: {
    color: '#111827',
    flex: 1,
    fontSize: 18,
    fontWeight: '700'
  },
  textlg_fontbold_textgray900_mb: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16
  },
  textwhite_fontbold: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  textwhite_fontbold_textlg_: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700'
  },
  textwhite_textsm_fontmedium: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500'
  },
  textwhite_textxs_fontbold: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  textwhite_textxs_fontmedium: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500'
  },
  textwhite60_textxs_mt2: {
    fontSize: 12,
    marginTop: 8
  },
  w8_h8_roundedfull_itemscenter_: {
    alignItems: 'center',
    borderRadius: 9999,
    height: 32,
    justifyContent: 'center',
    marginRight: 8,
    width: 32
  },
});

export default function LearningPathScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const [moduleData, setModuleData] = useState<ModuleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchModuleData = async () => {
      if (!token || !id) return;
      
      try {
        const courseId = parseInt(id);
        const contents = await getCourseContents(token, courseId);
        
        if (!contents || contents.length === 0) {
          setIsLoading(false);
          return;
        }

        const allLessons: Lesson[] = [];
        let completedCount = 0;
        
        for (const section of contents) {
          const modules = section.modules || [];
          
          for (let i = 0; i < modules.length; i++) {
            const mod = modules[i];
            const isLocked = i > 0 && allLessons.length === 0;
            const isCompleted = mod.completed?.[0]?.state === 2;
            
            if (isCompleted) completedCount++;
            
            allLessons.push({
              id: mod.id || mod.cmid || Math.random(),
              title: mod.name || mod.title || "Leçon",
              type: mapModtypeToType(mod.modname || ""),
              duration: mod.duration || "10 min",
              xp: mod.xp || 10,
              isCompleted,
              isLocked
            });
          }
        }

        const firstSection = contents[0] || {};
        const courseSummary = firstSection.summary || "";
        const courseName = firstSection.name || "Cours";

        setModuleData({
          id: courseId,
          title: courseName,
          description: courseSummary.replace(/<[^>]*>/g, ""),
          language: "Pulaar",
          level: "Fondamental",
          totalLessons: allLessons.length,
          completedLessons: completedCount,
          lessons: allLessons
        });
      } catch (err) {
        console.error("Error fetching module:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModuleData();
  }, [token, id]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.style_7} edges={['top']}>
        <View style={styles.style_6}>
          <ActivityIndicator size="large" color="#002366" />
        </View>
      </SafeAreaView>
    );
  }

  if (!moduleData) {
    return (
      <SafeAreaView style={styles.style_5} edges={['top']}>
        <View style={styles.style_4}>
          <Pressable onPress={() => router.back()} style={styles.style_3}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={styles.style_2}>Parcours</Text>
        </View>
        <View style={styles.flex1_itemscenter_justifycente}>
          <Text style={styles.textgray500}>Aucune donnée disponible</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progressPercent = Math.round((moduleData.completedLessons / Math.max(moduleData.totalLessons, 1)) * 100);
  const currentLessonIndex = moduleData.lessons.findIndex(l => !l.isCompleted && !l.isLocked);
  const currentLesson = moduleData.lessons[currentLessonIndex >= 0 ? currentLessonIndex : 0];

  const getLessonTypeIcon = (type: Lesson["type"]) => {
    switch (type) {
      case "audio": return { icon: "headphones", color: "#60A5FA", label: "Audio" };
      case "reading": return { icon: "book-open", color: "#34D399", label: "Lecture" };
      case "quiz": return { icon: "edit-2", color: "#F87171", label: "Quiz" };
      case "exercise": return { icon: "link", color: "#FBBF24", label: "Exercice" };
      case "game": return { icon: "gamepad-2", color: "#A78BFA", label: "Jeu" };
      default: return { icon: "circle", color: "#9CA3AF", label: "" };
    }
  };

  const handleLessonPress = (lesson: Lesson) => {
    if (lesson.isLocked) return;
    router.push(`/(stacks)/(cours)/lesson/${lesson.id}` as any);
  };

  const handleContinue = () => {
    if (currentLesson) {
      handleLessonPress(currentLesson);
    }
  };

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>
      
      <View style={styles.px5_py4_flexrow_itemscenter_bg}>
        <Pressable onPress={() => router.back()} style={styles.mr4_p2_ml2}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <Text style={styles.textlg_fontbold_textgray900_fl} numberOfLines={1}>
          {moduleData.title}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.px5_mb6}>
          <View style={[styles.rounded3xl_p5,{ backgroundColor: '#002366' }]}>
            <View style={styles.flexrow_itemscenter_mb3}>
              <View style={styles.bgwhite20_px3_py1_roundedfull_}>
                <Text style={styles.style_1}>{moduleData.language}</Text>
              </View>
              <View style={styles.bgwhite20_px3_py1_roundedfull}>
                <Text style={styles.textwhite_textxs_fontmedium}>{moduleData.level}</Text>
              </View>
            </View>
            
            <View style={styles.flexrow_justifybetween_itemsce}>
              <Text style={styles.textwhite_textsm_fontmedium}>Progression</Text>
              <Text style={styles.textwhite_fontbold}>{progressPercent}%</Text>
            </View>
            <View style={styles.h2_bgwhite20_roundedfull_overf}>
              <View 
                style={[styles.hfull_roundedfull,{ width: `${progressPercent}%`, backgroundColor: '#F59E0B' }]}
               />
            </View>
            <Text style={styles.textwhite60_textxs_mt2}>
              {moduleData.completedLessons}/{moduleData.totalLessons} leçons complétées
            </Text>
          </View>
        </View>

        <View style={styles.px5}>
          <Text style={styles.textlg_fontbold_textgray900_mb}>Ton parcours</Text>
          
          {moduleData.lessons.map((lesson, index) => {
            const typeInfo = getLessonTypeIcon(lesson.type);
            const isCurrent = index === currentLessonIndex;
            const isAvailable = !lesson.isLocked && !lesson.isCompleted;
            
            return (
              <View key={lesson.id} style={styles.flexrow}>
                <View style={styles.itemscenter_mr4}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 9999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: lesson.isCompleted ? '#22C55E' : lesson.isLocked ? '#E5E7EB' : isCurrent ? '#002366' : '#FFFFFF',
                    borderWidth: (!lesson.isCompleted && !lesson.isLocked && !isCurrent) || (isCurrent && !lesson.isCompleted) ? 2 : 0,
                    borderColor: '#002366'
                  }}>
                    {lesson.isCompleted ? (
                      <AntDesign name="check" size={24} color="white" />
                    ) : lesson.isLocked ? (
                      <Feather name="lock" size={20} color="#9CA3AF" />
                    ) : (
                      <Text style={{
                        fontWeight: '700',
                        fontSize: 18,
                        color: isCurrent ? '#FFFFFF' : '#002366'
                      }}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  {index < moduleData.lessons.length - 1 && (
                    <View style={{
                      width: 2,
                      height: 48,
                      backgroundColor: lesson.isCompleted ? '#22C55E' : '#E5E7EB'
                    }} />
                  )}
                </View>

                <Pressable
                  onPress={() => handleLessonPress(lesson)}
                  disabled={lesson.isLocked}
                  style={{
                    flex: 1,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: isCurrent ? 2 : 1,
                    borderColor: isCurrent ? '#F59E0B' : '#E5E7EB',
                    opacity: lesson.isLocked ? 0.6 : 1,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                >
                  <View style={styles.flexrow_itemscenter_justifybet}>
                    <Text style={{
                      fontWeight: '700',
                      fontSize: 14,
                      flex: 1,
                      color: lesson.isLocked ? '#9CA3AF' : '#111827'
                    }}>
                      {lesson.title}
                    </Text>
                    {isCurrent && (
                      <View style={styles.bgF59E0B_px2_py1_roundedfull}>
                        <Text style={styles.textwhite_textxs_fontbold}>Continuer</Text>
                      </View>
                    )}
                    {lesson.isCompleted && (
                      <View style={styles.bggreen100_px2_py1_roundedfull}>
                        <Text style={styles.textgreen600_textxs_fontmedium}>Terminé</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.flexrow_itemscenter}>
                    <View 
                      style={[styles.w8_h8_roundedfull_itemscenter_,{ backgroundColor: `${typeInfo.color}20` }]}
                     >
                      <Feather name={typeInfo.icon as any} size={14} color={typeInfo.color} />
                    </View>
                    <Text style={styles.textgray500_textxs_mr3}>{typeInfo.label}</Text>
                    <Text style={styles.textgray400_textxs_mr3}>{lesson.duration}</Text>
                    <Text style={styles.textF59E0B_textxs_fontbold}>+{lesson.xp} XP</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.absolute_bottom3_left0_right0_}>
        <Pressable
          onPress={handleContinue}
          style={[styles.bg0961F5_rounded2xl_py4_itemsc,{
            shadowColor: "#F59E0B",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }]} 
         >
          <Text style={styles.textwhite_fontbold_textlg_}>
            {currentLesson ? `Commencer "${currentLesson.title}"` : "Aucune leçon disponible"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}