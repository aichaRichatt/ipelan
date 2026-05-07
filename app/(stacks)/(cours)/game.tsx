import { useActivityContent } from "@/hooks/useActivityContent";
import { RootState } from "@/services/redux/store";
import { shuffle } from "@/utils/shuffle";
import { calculateXP } from "@/utils/xpCalculator";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

const styles = StyleSheet.create({
  bgA78BFA_px3_py1_roundedfull: {
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  bgA78BFA10_border2_borderdashe: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16
  },
  bggray500_rounded2xl_py4_items: {
    alignItems: 'center',
    backgroundColor: '#6B7280',
    borderRadius: 16,
    paddingVertical: 16
  },
  bggreen50_rounded2xl_p4_mb4: {
    borderRadius: 16,
    marginBottom: 16,
    padding: 16
  },
  bgwhite_border2_bordergray200_: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
    marginRight: 8,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  bgwhite_rounded2xl_p4_mb6_bord: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    padding: 16
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
    paddingVertical: 32
  },
  flexrow_flexwrap: {
    flexDirection: 'row'
  },
  flexrow_itemscenter_justifycen: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center'
  },
  flexrow_itemscenter_mb2: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8
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
  hfull_bgA78BFA_roundedfull: {
    borderRadius: 9999,
    height: '100%'
  },
  mb6: {
    marginBottom: 24
  },
  mr4_p2_ml2: {
    marginLeft: -8,
    marginRight: 16,
    padding: 8
  },
  mt4: {
    marginTop: 16
  },
  mt4_bgyellow50_rounded2xl_p4: {
    borderRadius: 16,
    marginTop: 16,
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700'
  },
  style_2: {
    flexDirection: 'row'
  },
  style_3: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12
  },
  style_4: {
    marginBottom: 24
  },
  style_5: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  style_6: {
    backgroundColor: '#FAF9F6',
    flex: 1
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
  textgray300_textxs: {
    color: '#D1D5DB',
    fontSize: 12
  },
  textgray400_textsm: {
    color: '#9CA3AF',
    fontSize: 14
  },
  textgray500_textcenter_mb6: {
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center'
  },
  textgray500_textsm_mb2: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 8
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
  textgray700_fontmedium_italic: {
    color: '#374151',
    fontStyle: 'italic',
    fontWeight: '500'
  },
  textgray900_fontbold: {
    color: '#111827',
    fontWeight: '700'
  },
  textgreen700_fontbold_ml2: {
    color: '#15803D',
    fontWeight: '700',
    marginLeft: 8
  },
  textgreen800_fontmedium: {
    fontWeight: '500'
  },
  textlg_fontbold_textgray900: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700'
  },
  textsm_fontbold_textgray900_mb: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12
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
  textwhite_fontbold_textlg: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700'
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
  w16_h12_border2_borderdashed_b: {
    alignItems: 'center',
    borderColor: '#D1D5DB',
    borderRadius: 12,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    marginBottom: 8,
    marginRight: 8,
    width: 64
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

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moduleId?: string; moduleTitle?: string; courseId?: string; cmid?: string; instanceId?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const cmid = parseInt(params.cmid || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);
  
  const { wordOrder: wordOrderData } = useActivityContent(
    token || '',
    moduleId,
    instanceId,
    'lesson',
    cmid || instanceId,
    courseId,
    params.moduleTitle
  );
  
  const sentences = wordOrderData?.sentences?.length ? wordOrderData.sentences : [];
  
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [placedWords, setPlacedWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const sentence = sentences[currentSentenceIndex] || { words: [], translation: "" };

  const handleContinue = () => {
    const instanceId = params.instanceId || params.moduleId || '0';
    const earnedXp = calculateXP('wordOrder', score, sentences.length).totalXP;
    const resultParams = `?activity=Ordre+des+mots&score=${score}&total=${sentences.length}&xp=${earnedXp}&moduleId=${params.moduleId || ''}&instanceId=${instanceId}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Exercice')}&courseId=${params.courseId || ''}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ''}`)}`;
    router.push(`/(stacks)/(cours)/result${resultParams}` as any);
  };

  const initSentence = React.useCallback(() => {
    const shuffled = shuffle(sentence.words);
    setAvailableWords(shuffled);
    setPlacedWords([]);
    setWrongAttempts(0);
    setShowAnswer(false);
  }, [sentence.words]);

  useEffect(() => {
    initSentence();
  }, [currentSentenceIndex, initSentence]);

  const handlePlaceWord = (word: string) => {
    if (placedWords.length >= sentence.words.length) return;
    setPlacedWords(prev => [...prev, word]);
    setAvailableWords(prev => prev.filter(w => w !== word));
  };

  const handleRemoveWord = (index: number) => {
    const word = placedWords[index];
    setPlacedWords(prev => prev.filter((_, i) => i !== index));
    setAvailableWords(prev => [...prev, word]);
  };

  const normalizePhrase = (words: string[]) => words.join(' ').trim().replace(/\s+/g, ' ');

  const checkOrder = () => {
    const correct = normalizePhrase(placedWords) === normalizePhrase(sentence.words);

    if (correct) {
      setScore(prev => prev + 1);
      setTimeout(() => {
        if (currentSentenceIndex < sentences.length - 1) {
          setCurrentSentenceIndex(prev => prev + 1);
          // No need to call initSentence() here — the useEffect on currentSentenceIndex handles it
        } else {
          setShowResult(true);
        }
      }, 1500);
    } else {
      const newAttempts = wrongAttempts + 1;
      setWrongAttempts(newAttempts);
      if (newAttempts >= 3) {
        setShowAnswer(true);
      }
      const allWords = [...availableWords, ...placedWords];
      setTimeout(() => {
        setPlacedWords([]);
        setAvailableWords(shuffle(allWords));
      }, 1000);
    }
  };

  const getScoreEmoji = () => {
    const percentage = (score / sentences.length) * 100;
    if (percentage === 100) return "🏆";
    if (percentage >= 66) return "🌟";
    return "👏";
  };

  if (showResult) {
    const percentage = Math.round((score / sentences.length) * 100);
    
    return (
      <SafeAreaView style={styles.style_6} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
          <View style={styles.style_5}>
            <View style={styles.bgwhite_rounded3xl_p8_itemscen}>
              <Text style={styles.text6xl_mb4}>{getScoreEmoji()}</Text>
              <Text style={styles.text2xl_fontbold_textgray900_m}>
                {percentage >= 66 ? "Bravo !" : "Continue tes efforts !"}
              </Text>
              <Text style={styles.textgray500_textcenter_mb6}>
                Tu as complété {score} phrases sur {sentences.length}
              </Text>
              
              <View style={[styles.w32_h32_roundedfull_border8_mb,{ 
                  borderColor: percentage >= 60 ? '#10B981' : '#EF4444',
                  backgroundColor: `${percentage >= 60 ? '#10B981' : '#EF4444'}10`
                }]}
               >
                <Text style={[styles.text4xl_fontblack,{ color: percentage >= 60 ? '#10B981' : '#EF4444' }]} >
                  {percentage}%
                </Text>
              </View>

              <View style={styles.bgyellow50_roundedxl_px6_py3_m}>
                <Text style={styles.textxl_mr2}>⭐</Text>
                <Text style={styles.textyellow700_fontbold_textlg}>+{calculateXP('wordOrder', score, sentences.length).totalXP} XP gagnés</Text>
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
                    setCurrentSentenceIndex(0);
                    setScore(0);
                    setShowResult(false);
                    initSentence();
                  }}
                  style={styles.flex1_bg4a90e2_py4_roundedxl_m}
                >
                  <Text style={styles.textwhite_fontbold_textcenter}>Rejouer</Text>
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
          <Text style={styles.textlg_fontbold_textgray900}>Ordre des mots</Text>
          <Text style={styles.textgray500_textxs}>
            Phrase {currentSentenceIndex + 1}/{sentences.length}
          </Text>
        </View>
        <View style={styles.bgA78BFA_px3_py1_roundedfull}>
          <Text style={styles.textwhite_fontbold_textsm}>{score} pts</Text>
        </View>
      </View>

      <View style={styles.px5_mb4}>
        <View style={styles.h2_bggray200_roundedfull_overf}>
          <View 
            style={[styles.hfull_bgA78BFA_roundedfull,{ width: `${((currentSentenceIndex + 1) / sentences.length) * 100}%` }]}
           />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        
        <View style={styles.bgwhite_rounded2xl_p4_mb6_bord}>
          <Text style={styles.textgray500_textsm_mb2}>Remets les mots dans le bon ordre :</Text>
          <Text style={styles.textgray700_fontmedium_italic}>{sentence.translation}</Text>
        </View>

        <View style={styles.style_4}>
          <Text style={styles.style_3}>Zone de réponse</Text>
          <View style={styles.bgA78BFA10_border2_borderdashe}>
            {placedWords.length === 0 ? (
              <View style={styles.flex1_itemscenter_justifycente}>
                <Text style={styles.textgray400_textsm}>Place les mots ici</Text>
              </View>
            ) : (
              <View style={styles.style_2}>
                {placedWords.map((word, index) => (
                  <Pressable
                    key={`placed-${index}`}
                    onPress={() => handleRemoveWord(index)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 12,
                      marginRight: 8,
                      marginBottom: 8,
                      backgroundColor: showAnswer && word === sentence.words[index] 
                        ? '#22C55E' 
                        : showAnswer && word !== sentence.words[index]
                          ? '#EF4444'
                          : '#A78BFA'
                    }}
                  >
                    <Text style={styles.textwhite_fontbold}>{word}</Text>
                  </Pressable>
                ))}
                {Array.from({ length: sentence.words.length - placedWords.length }).map((_, index) => (
                  <View 
                    key={`slot-${index}`}
                    style={styles.w16_h12_border2_borderdashed_b}
                  >
                    <Text style={styles.textgray300_textxs}>{placedWords.length + index + 1}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.mb6}>
          <Text style={styles.textsm_fontbold_textgray900_mb}>Mots disponibles</Text>
          <View style={styles.flexrow_flexwrap}>
            {availableWords.map((word, index) => (
              <Pressable
                key={`avail-${index}`}
                onPress={() => handlePlaceWord(word)}
                style={styles.bgwhite_border2_bordergray200_}
              >
                <Text style={styles.textgray900_fontbold}>{word}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {showAnswer && (
          <View style={styles.bggreen50_rounded2xl_p4_mb4}>
            <View style={styles.flexrow_itemscenter_mb2}>
              <Feather name="check-circle" size={20} color="#10B981" />
              <Text style={styles.textgreen700_fontbold_ml2}>La bonne réponse :</Text>
            </View>
            <Text style={styles.textgreen800_fontmedium}>{sentence.words.join(' ')}</Text>
          </View>
        )}

        <View style={styles.mt4}>
          {wrongAttempts >= 3 && !showAnswer ? (
            <Pressable
              onPress={() => setShowAnswer(true)}
              style={styles.bggray500_rounded2xl_py4_items}
            >
              <Text style={styles.style_1}>Voir la réponse</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={checkOrder}
              disabled={placedWords.length !== sentence.words.length}
              style={{
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
                backgroundColor: placedWords.length === sentence.words.length 
                  ? '#A78BFA' 
                  : '#D1D5DB'
              }}
            >
              <Text style={styles.textwhite_fontbold_textlg}>Valider</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.mt4_bgyellow50_rounded2xl_p4}>
          <View style={styles.flexrow_itemscenter_justifycen}>
            <Feather name="info" size={18} color="#F59E0B" />
            <Text style={styles.textyellow700_ml2_textcenter}>
              Clique sur un mot pour le placer. Clique sur un mot placé pour le retirer.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
