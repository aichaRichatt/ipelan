import { AssociationPair, useActivityContent } from "@/hooks/useActivityContent";
import { RootState } from "@/services/redux/store";
import { calculateXP } from "@/utils/xpCalculator";
import { AntDesign, Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

const styles = StyleSheet.create({
  absolute_top1_right1: {
    position: 'absolute'
  },
  bgF59E0B_px3_py1_roundedfull: {
    backgroundColor: '#F59E0B',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  bgwhite_rounded3xl_p8_itemscen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: '100%'
  },
  bgyellow50_roundedxl_px6_py3_m: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 24,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  flex1: {
    flex: 1
  },
  flex1_bg4a90e2_py4_roundedxl_m: {
    backgroundColor: '#4a90e2',
    borderRadius: 12,
    flex: 1,
    marginLeft: 8,
    paddingVertical: 16
  },
  flex1_bgFAF9F6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  flex1_bggray200_py4_roundedxl_: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
    paddingVertical: 16
  },
  flex1_itemscenter_justifycente: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  flexrow_flexwrap_justifybetwee: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  flexrow_itemscenter_justifycen: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center'
  },
  flexrow_wfull: {
    flexDirection: 'row',
    width: '100%'
  },
  h2_bggray200_roundedfull_overf: {
    backgroundColor: '#E5E7EB',
    borderRadius: 9999,
    height: 8,
    overflow: 'hidden'
  },
  hfull_bg10B981_roundedfull_tra: {
    borderRadius: 9999,
    height: '100%'
  },
  hpx_bggray300_my6: {
    backgroundColor: '#D1D5DB',
    marginVertical: 24
  },
  mr4_p2_ml2: {
    marginLeft: -8,
    marginRight: 16,
    padding: 8
  },
  mt4_bg4a90e2_px6_py3_roundedxl: {
    backgroundColor: '#4a90e2',
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  mt6_bgyellow50_rounded2xl_p4: {
    borderRadius: 16,
    marginTop: 24,
    padding: 16
  },
  px5_mb4: {
    marginBottom: 16,
    paddingHorizontal: 20
  },
  px5_py4_flexrow_itemscenter_bg: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  style_1: {
    position: 'absolute'
  },
  style_10: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  style_11: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  style_12: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700'
  },
  style_13: {
    flex: 1
  },
  style_14: {
    marginLeft: -8,
    marginRight: 16,
    padding: 8
  },
  style_15: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  style_16: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  style_2: {
    position: 'absolute'
  },
  style_3: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  style_4: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  style_5: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  style_6: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700'
  },
  style_7: {
    flex: 1
  },
  style_8: {
    marginLeft: -8,
    marginRight: 16,
    padding: 8
  },
  style_9: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  text2xl_fontbold_textgray900_m: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  text4xl_fontblack: {
    fontSize: 36,
    fontWeight: '900'
  },
  text6xl_mb4: {
    marginBottom: 16
  },
  textcenter_textgray600_mb4: {
    color: '#4B5563',
    marginBottom: 16,
    textAlign: 'center'
  },
  textcenter_textgray600_mb6: {
    color: '#4B5563',
    marginBottom: 24,
    textAlign: 'center'
  },
  textgray500_mt4: {
    color: '#6B7280',
    marginTop: 16
  },
  textgray500_textcenter_mb6: {
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center'
  },
  textgray500_textxs: {
    color: '#6B7280',
    fontSize: 12
  },
  textgray700_fontbold_textcente: {
    color: '#374151',
    fontWeight: '700',
    textAlign: 'center'
  },
  textlg_fontbold_textgray900: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700'
  },
  textred500_textcenter: {
    color: '#EF4444',
    textAlign: 'center'
  },
  textwhite_fontbold: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  textwhite_fontbold_textcenter: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center'
  },
  textwhite_fontbold_textsm: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
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
  textyellow700_ml2_textcenter: {
    color: '#A16207',
    marginLeft: 8,
    textAlign: 'center'
  },
  w32_h32_roundedfull_border8_mb: {
    alignItems: 'center',
    borderRadius: 9999,
    height: 128,
    justifyContent: 'center',
    marginBottom: 24,
    width: 128
  },
});

export default function AssociationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moduleId?: string; moduleTitle?: string; courseId?: string; cmid?: string; instanceId?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const cmid = parseInt(params.cmid || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);
  
  const { association: associationData, isLoading, error } = useActivityContent(
    token || '',
    moduleId,
    instanceId,
    'glossary',
    cmid || instanceId,
    courseId,
    params.moduleTitle
  );
  
  const matchItems = associationData?.pairs?.length ? associationData.pairs : [];
  const totalPairs = matchItems.length;
  const [leftColumn, setLeftColumn] = useState<Array<{item: AssociationPair; originalIndex: number}>>([]);
  const [rightColumn, setRightColumn] = useState<Array<{item: AssociationPair; originalIndex: number}>>([]);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<number[]>([]);
  const [matchedRight, setMatchedRight] = useState<number[]>([]);
  const [errorLeft, setErrorLeft] = useState<number | null>(null);
  const [errorRight, setErrorRight] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (matchItems.length > 0) {
      const left = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
      const right = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
      
      for (let i = right.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [right[i], right[j]] = [right[j], right[i]];
      }
      
      setLeftColumn(left);
      setRightColumn(right);
    }
  }, [matchItems]);

  const progress = totalPairs > 0 ? (matchedLeft.length / totalPairs) * 100 : 0;
  const score = matchedLeft.length;

  const handleContinue = () => {
    const instanceId = params.instanceId || params.moduleId || '0';
    const earnedXp = calculateXP('association', score, totalPairs).totalXP;
    const resultParams = `?activity=Association&score=${score}&total=${totalPairs}&xp=${earnedXp}&moduleId=${params.moduleId || ''}&instanceId=${instanceId}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Exercice')}&courseId=${params.courseId || ''}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ''}`)}`;
    router.push(`/(stacks)/(cours)/result${resultParams}` as any);
  };

  const handleLeftSelect = (index: number) => {
    if (matchedLeft.includes(index)) return;
    if (errorLeft !== null) setErrorLeft(null);
    setSelectedLeft(index);
    // Si un élément de droite est déjà sélectionné, essayer le match immédiatement
    if (selectedRight !== null) {
      tryMatch(index, selectedRight);
    }
  };

  const handleRightSelect = (index: number) => {
    if (matchedRight.includes(index)) return;
    if (errorRight !== null) setErrorRight(null);
    setSelectedRight(index);
    // Si un élément de gauche est déjà sélectionné, essayer le match immédiatement
    if (selectedLeft !== null) {
      tryMatch(selectedLeft, index);
    }
  };

  const tryMatch = (leftIdx: number | null, rightIdx: number | null) => {
    if (leftIdx === null || rightIdx === null) return;
    
    // leftIdx est l'originalIndex, trouver l'index dans leftColumn
    const leftArrayIdx = leftColumn.findIndex(l => l.originalIndex === leftIdx);
    const rightItem = rightColumn[rightIdx];
    const leftItem = leftColumn[leftArrayIdx];
    
    if (!leftItem || !rightItem) return;
    
    // Vérifier si c'est une correspondance correcte (par contenu ou par index original)
    const isMatch = leftItem.item.word === rightItem.item.translation || 
                    leftItem.item.translation === rightItem.item.word ||
                    leftItem.originalIndex === rightItem.originalIndex;
    
    if (isMatch) {
      // Match correct - les deux deviennent verts
      setMatchedLeft(prev => [...prev, leftIdx]);
      setMatchedRight(prev => [...prev, rightIdx]);
      setSelectedLeft(null);
      setSelectedRight(null);
      
      // Vérifier si c'est la fin du jeu (utiliser matchedLeft.length + 1 car le state n'est pas encore mis à jour)
      const newMatchedCount = matchedLeft.length + 1;
      if (newMatchedCount === totalPairs) {
        setTimeout(() => setShowResult(true), 800);
      }
    } else {
      // Erreur - les deux deviennent rouges temporairement
      setErrorLeft(leftIdx);
      setErrorRight(rightIdx);
      setSelectedLeft(null);
      setSelectedRight(null);
      
      // Réinitialiser les erreurs après un délai
      setTimeout(() => {
        setErrorLeft(null);
        setErrorRight(null);
      }, 800);
    }
  };

  const getScoreEmoji = () => {
    const percentage = (score / totalPairs) * 100;
    if (percentage === 100) return "🏆";
    if (percentage >= 80) return "🌟";
    if (percentage >= 60) return "👏";
    if (percentage >= 40) return "💪";
    return "📚";
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.style_16} edges={['top']}>
        <View style={styles.style_15}>
          <Pressable onPress={() => router.back()} style={styles.style_14}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <View style={styles.style_13}>
            <Text style={styles.style_12}>Association de mots</Text>
          </View>
        </View>
        <View style={styles.style_11}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.textgray500_mt4}>Chargement des mots...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || matchItems.length === 0) {
    return (
      <SafeAreaView style={styles.style_10} edges={['top']}>
        <View style={styles.style_9}>
          <Pressable onPress={() => router.back()} style={styles.style_8}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <View style={styles.style_7}>
            <Text style={styles.style_6}>Association de mots</Text>
          </View>
        </View>
        <View style={styles.style_5}>
          <Text style={styles.textred500_textcenter}>{error || 'Aucune donnée trouvée'}</Text>
          <Pressable 
            onPress={() => router.back()} 
            style={styles.mt4_bg4a90e2_px6_py3_roundedxl}
          >
            <Text style={styles.textwhite_fontbold}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (showResult) {
    const percentage = Math.round((score / totalPairs) * 100);
    
    return (
      <SafeAreaView style={styles.style_4} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
          <View style={styles.flex1_itemscenter_justifycente}>
            <View style={styles.bgwhite_rounded3xl_p8_itemscen}>
              <Text style={styles.text6xl_mb4}>{getScoreEmoji()}</Text>
              <Text style={styles.text2xl_fontbold_textgray900_m}>
                {percentage >= 60 ? "Excellent !" : "Bien joué !"}
              </Text>
              <Text style={styles.textgray500_textcenter_mb6}>
                Tu as associé {score} paires correctement
              </Text>
              
              <View style={[styles.w32_h32_roundedfull_border8_mb, { 
                borderColor: percentage >= 60 ? '#10B981' : '#EF4444',
                backgroundColor: `${percentage >= 60 ? '#10B981' : '#EF4444'}10`
              }]}>
                <Text style={[styles.text4xl_fontblack, { color: percentage >= 60 ? '#10B981' : '#EF4444' }]}>
                  {percentage}%
                </Text>
              </View>

              <View style={styles.bgyellow50_roundedxl_px6_py3_m}>
                <Text style={styles.textxl_mr2}>⭐</Text>
                <Text style={styles.textyellow700_fontbold_textlg}>+{calculateXP('association', score, totalPairs).totalXP} XP gagnés</Text>
              </View>

              <View style={styles.flexrow_wfull}>
                <Pressable
                  onPress={handleContinue}
                  style={styles.flex1_bggray200_py4_roundedxl_}
                >
                  <Text style={styles.textgray700_fontbold_textcente}>Continuer</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setSelectedLeft(null);
                    setSelectedRight(null);
                    setMatchedLeft([]);
                    setMatchedRight([]);
                    setErrorLeft(null);
                    setErrorRight(null);
                    setShowResult(false);
                    const left = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
                    const right = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
                    for (let i = right.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [right[i], right[j]] = [right[j], right[i]];
                    }
                    setLeftColumn(left);
                    setRightColumn(right);
                  }}
                  style={styles.flex1_bg4a90e2_py4_roundedxl_m}
                >
                  <Text style={styles.textwhite_fontbold_textcenter}>Recommencer</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>
      <View style={styles.px5_py4_flexrow_itemscenter_bg}>
        <Pressable onPress={() => router.back()} style={styles.mr4_p2_ml2}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.textlg_fontbold_textgray900}>Association de mots</Text>
          <Text style={styles.textgray500_textxs}>
            Trouve les paires
          </Text>
        </View>
        <View style={styles.bgF59E0B_px3_py1_roundedfull}>
          <Text style={styles.textwhite_fontbold_textsm}>{matchedLeft.length}/{totalPairs}</Text>
        </View>
      </View>

      <View style={styles.px5_mb4}>
        <View style={styles.h2_bggray200_roundedfull_overf}>
          <View 
            style={[styles.hfull_bg10B981_roundedfull_tra, { width: `${progress}%` }]}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        
        <Text style={styles.textcenter_textgray600_mb6}>
          Associe chaque mot Pulaar à sa traduction française
        </Text>

        <View style={styles.style_3}>
          {leftColumn.map(({ item, originalIndex }) => {
            const isMatched = matchedLeft.includes(originalIndex);
            const isSelected = selectedLeft === originalIndex;
            const isError = errorLeft === originalIndex;
            
            return (
              <Pressable
                key={`left-${originalIndex}`}
                onPress={() => handleLeftSelect(originalIndex)}
                disabled={isMatched}
                style={{
                  width: '48%',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 2,
                  backgroundColor: isMatched ? '#DCFCE7' : isError ? '#FEE2E2' : isSelected ? '#EFF6FF' : '#FFFFFF',
                  borderColor: isMatched ? '#22C55E' : isError ? '#EF4444' : isSelected ? '#4a90e2' : '#E5E7EB'
                }}
              >
                <Text style={{
                  textAlign: 'center',
                  fontWeight: '700',
                  fontSize: 18,
                  color: isMatched ? '#15803D' : isError ? '#B91C1C' : '#111827'
                }}>
                  {item.word}
                </Text>
                {isMatched && (
                  <View style={styles.style_2}>
                    <AntDesign name="check-circle" size={16} color="#10B981" />
                  </View>
                )}
                {isError && (
                  <View style={styles.style_1}>
                    <AntDesign name="close-circle" size={16} color="#EF4444" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.hpx_bggray300_my6} />

        <Text style={styles.textcenter_textgray600_mb4}>
          Traductions françaises
        </Text>

        <View style={styles.flexrow_flexwrap_justifybetwee}>
          {rightColumn.map(({ item, originalIndex }, rightIndex) => {
            const isMatched = matchedRight.includes(rightIndex);
            const isSelected = selectedRight === rightIndex;
            const isError = errorRight === rightIndex;
            
            return (
              <Pressable
                key={`right-${originalIndex}`}
                onPress={() => handleRightSelect(rightIndex)}
                disabled={isMatched}
                style={{
                  width: '48%',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 2,
                  backgroundColor: isMatched ? '#DCFCE7' : isError ? '#FEE2E2' : isSelected ? '#EFF6FF' : '#FFFFFF',
                  borderColor: isMatched ? '#22C55E' : isError ? '#EF4444' : isSelected ? '#4a90e2' : '#E5E7EB'
                }}
              >
                <Text style={{
                  textAlign: 'center',
                  fontWeight: '500',
                  color: isMatched ? '#15803D' : isError ? '#B91C1C' : '#374151'
                }}>
                  {item.translation}
                </Text>
                {isError && (
                  <View style={styles.absolute_top1_right1}>
                    <AntDesign name="close-circle" size={16} color="#EF4444" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.mt6_bgyellow50_rounded2xl_p4}>
          <View style={styles.flexrow_itemscenter_justifycen}>
            <Feather name="info" size={18} color="#F59E0B" />
            <Text style={styles.textyellow700_ml2_textcenter}>
              Sélectionne un mot Pulaar, puis sa traduction
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
