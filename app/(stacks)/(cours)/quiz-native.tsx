/**
 * QuizNativePage — UI native pour les quiz Moodle.
 *
 * Pas de WebView. Pas de cookies SSO. 100 % via les Web Services
 * mod_quiz_* + le hook useQuiz. Fiable et simple.
 *
 * Routing :
 *   /(stacks)/(cours)/quiz-native?cmid=XX&instanceId=YY&courseId=ZZ&moduleTitle=...
 *   (rétrocompat : ?quizId=XX est aussi accepté)
 */

import { useQuiz } from '@/hooks/useQuiz';
import { RootState } from '@/services/redux/store';
import { calculateXP } from '@/utils/xpCalculator';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { parseQuestionHtml, ParsedQuestion } from '@/services/api/quizService';
import { getQuizOffline, saveOfflineQuizAttempt } from '@/services/quiz/quizOfflineService';
import { saveActivityScore } from '@/services/storage/activity-progress';

const IS_DEV = process.env.NODE_ENV === 'development';

const styles = StyleSheet.create({
  bg4a90e2_px6_py3_roundedxl: {
    backgroundColor: '#4a90e2',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  bgamber50_p4_roundedxl_border_: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16
  },
  bggray200_px6_py3_roundedxl_mr: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    marginRight: 8,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  bgwhite_rounded2xl_p6_shadowsm: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
    borderRadius: 16,
    borderWidth: 1,
    padding: 24
  },
  border2_bordergray200_roundedx: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 2,
    color: '#111827',
    fontSize: 16,
    padding: 16
  },
  flex1_bgFAF9F6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  flex1_itemscenter_justifycente: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  flex1_px4_py6: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24
  },
  flexrow_itemscenter: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  flexrow_itemscenter_justifybet: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  flexrow_itemsstart: {
    alignItems: 'flex-start',
    flexDirection: 'row'
  },
  flexrow_mt6: {
    flexDirection: 'row',
    marginTop: 24
  },
  fontbold: {
    fontWeight: '700'
  },
  h2_bggray200: {
    backgroundColor: '#E5E7EB',
    height: 8
  },
  hfull_bg4a90e2: {
    backgroundColor: '#4a90e2',
    height: '100%'
  },
  itemscenter: {
    alignItems: 'center'
  },
  ml2_flex1_textsm_textamber800: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8
  },
  ml2_textsm_textgray500: {
    color: '#6B7280',
    fontSize: 14,
    marginLeft: 8
  },
  mt2_textgray500_textcenter: {
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center'
  },
  mt4_flexrow_itemscenter_justif: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16
  },
  mt4_textgray500: {
    color: '#6B7280',
    marginTop: 16
  },
  mt4_textxl_fontbold_textgray90: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center'
  },
  p2_ml2: {
    marginLeft: -8,
    padding: 8
  },
  p4_bgwhite_bordert_bordergray1: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
    borderTopWidth: 1,
    padding: 16
  },
  style_1: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 2,
    color: '#111827',
    fontSize: 16,
    padding: 16
  },
  style_2: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  style_3: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  style_4: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  style_5: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  style_6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  textbase_fontbold_text002366: {
    color: '#002366',
    fontSize: 16,
    fontWeight: '700'
  },
  textgray500: {
    color: '#6B7280'
  },
  textgray700_fontbold: {
    color: '#374151',
    fontWeight: '700'
  },
  textwhite_fontbold: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  textwhite_textcenter_fontbold_: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center'
  },
  textxl_fontbold_textgray900_mb: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24
  },
  textxs_textgray500: {
    color: '#6B7280',
    fontSize: 12
  },
  w10: {
    width: 40
  },
});

export default function QuizNativePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    cmid?: string;
    quizId?: string;        // alias historique
    instanceId?: string;
    courseId?: string;
    moduleId?: string;      // alias dans certains routes
    moduleTitle?: string;
  }>();

  const token = useSelector((s: RootState) => s.auth.token) || '';
  const streak = useSelector((s: RootState) => s.auth.user?.streak ?? 0);
  const startTimeRef = useRef(Date.now());

  // Résolution multi-alias des paramètres
  const cmid = parseInt(params.cmid || params.quizId || params.moduleId || '0', 10);
  const instanceId = parseInt(params.instanceId || '0', 10);
  const courseId = parseInt(params.courseId || '0', 10);
  const title = params.moduleTitle || 'Quiz';

  const {
    questions,
    currentIndex,
    selectedValue,
    matchingAnswers,
    answers,
    isLoading,
    isSaving,
    error,
    score,
    isComplete,
    isLastQuestion,
    quizName,
    selectAnswer,
    selectMatchingAnswer,
    submitAnswer,
    submitMatchingAnswers,
    nextQuestion,
    finishQuiz,
    reload,
  } = useQuiz(token, cmid, courseId, instanceId);

  const [textAnswer, setTextAnswer] = React.useState('');

  // ─── Mode offline ───────────────────────────────────────────────────────────
  const [offlineMode,       setOfflineMode]       = React.useState(false);
  const [offlineQuestions,  setOfflineQuestions]  = React.useState<ParsedQuestion[]>([]);
  const [offlineAttemptId,  setOfflineAttemptId]  = React.useState<number | null>(null);
  const [offlineIdx,        setOfflineIdx]        = React.useState(0);
  const [offlineAnswers,    setOfflineAnswers]     = React.useState<Record<string, string>>({});
  const [offlineComplete,   setOfflineComplete]   = React.useState(false);
  const [offlineScore,      setOfflineScore]      = React.useState<{ correct: number; total: number } | null>(null);
  const userId = useSelector((s: RootState) => s.auth.user?.id ?? 0);

  // Quand useQuiz échoue → essayer le cache
  React.useEffect(() => {
    if (!error) return;
    (async () => {
      try {
        const cached = await getQuizOffline(cmid);
        if (cached?.questions?.length) {
          const parsed = cached.questions.map(q =>
            parseQuestionHtml(q.slot, q.sequencecheck, q.html)
          );
          setOfflineQuestions(parsed);
          setOfflineAttemptId(cached.attemptId);
          setOfflineMode(true);
          if (IS_DEV) console.log(`[QuizNative] Fallback offline — ${parsed.length} questions depuis cache`);
        }
      } catch {}
    })();
  }, [error, cmid]);

  // Données actives : online ou offline selon le mode
  const activeQuestions    = offlineMode ? offlineQuestions  : questions;
  const activeCurrentIndex = offlineMode ? offlineIdx        : currentIndex;
  const activeAnswers      = offlineMode ? offlineAnswers     : answers;
  const activeIsComplete   = offlineMode ? offlineComplete    : isComplete;

  const currentQuestion = activeQuestions[activeCurrentIndex];

  // Clear text answer when moving to a new question
  React.useEffect(() => {
    setTextAnswer('');
  }, [activeCurrentIndex]);

  // ─── États de chargement/erreur ─────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.style_6} edges={['top']}>
        <View style={styles.style_5}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.mt4_textgray500}>Chargement du quiz…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !offlineMode) {
    return (
      <SafeAreaView style={styles.style_4} edges={['top']}>
        <View style={styles.style_3}>
          <Feather name="alert-circle" size={48} color="#F59E0B" />
          <Text style={styles.mt4_textxl_fontbold_textgray90}>Quiz indisponible</Text>
          <Text style={styles.mt2_textgray500_textcenter}>{error}</Text>
          <View style={styles.flexrow_mt6}>
            <Pressable onPress={() => router.back()} style={styles.bggray200_px6_py3_roundedxl_mr}>
              <Text style={styles.textgray700_fontbold}>Retour</Text>
            </Pressable>
            <Pressable onPress={() => reload()} style={styles.bg4a90e2_px6_py3_roundedxl}>
              <Text style={styles.textwhite_fontbold}>Réessayer</Text>
            </Pressable>
          </View>
          {offlineQuestions.length > 0 && (
            <Pressable
              onPress={() => setOfflineMode(true)}
              style={[styles.bg4a90e2_px6_py3_roundedxl, { marginTop: 12, backgroundColor: '#10B981' }]}
            >
              <Text style={styles.textwhite_fontbold}>Continuer hors-ligne</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) {
    return (
      <SafeAreaView style={styles.style_2} edges={['top']}>
        <View style={styles.flex1_itemscenter_justifycente}>
          <Text style={styles.textgray500}>Aucune question disponible.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progress = ((activeCurrentIndex + 1) / activeQuestions.length) * 100;

  const savedValueForQuestion =
    currentQuestion.answerInputName
      ? activeAnswers[currentQuestion.answerInputName]
      : undefined;

  const effectiveSelected = offlineMode
    ? (offlineAnswers[currentQuestion.answerInputName] ?? null)
    : (selectedValue ?? savedValueForQuestion ?? null);

  const isLastActiveQuestion = activeCurrentIndex >= activeQuestions.length - 1;

  // ─── Actions offline ───────────────────────────────────────────────────────
  const handleOfflineSelect = (value: string) => {
    if (!currentQuestion.answerInputName) return;
    setOfflineAnswers(prev => ({ ...prev, [currentQuestion.answerInputName]: value }));
  };

  const handleOfflineFinish = async () => {
    const total   = offlineQuestions.length;
    // Offline: we can't verify correctness without the server — count answered questions
    const correct = offlineQuestions.filter(q =>
      !!offlineAnswers[q.answerInputName]
    ).length;

    setOfflineScore({ correct, total });
    setOfflineComplete(true);

    if (offlineAttemptId && userId) {
      const answers = Object.entries(offlineAnswers).map(([name, value], i) => ({
        slot: offlineQuestions.findIndex(q => q.answerInputName === name) + 1,
        name,
        value,
      }));
      await saveOfflineQuizAttempt(userId, cmid, 0, offlineAttemptId, answers, correct, total, startTimeRef.current)
        .catch(() => {});
    }

    const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const xp = calculateXP('quiz', correct, total, {
      perfectScore: correct === total && total > 0,
      timeSpent: elapsedSeconds,
      streak,
    }).totalXP;

    await saveActivityScore(cmid, courseId, 'quiz', correct, total, xp, userId).catch(() => {});

    const resultParams = new URLSearchParams({
      activity: 'Quiz',
      score: String(correct),
      total: String(total),
      xp: String(xp),
      moduleId: String(cmid),
      courseId: String(courseId),
      returnRoute: `/(stacks)/(cours)/${courseId}`,
      offlineMode: '1',
    });
    router.replace(`/(stacks)/(cours)/result?${resultParams.toString()}` as any);
  };

  // ─── Action : valider la question puis passer à la suivante ─────────────

  const handleNext = async () => {
    if (offlineMode) {
      if (!effectiveSelected) {
        Alert.alert('Sélectionne une réponse', 'Choisis une option avant de continuer.');
        return;
      }
      if (isLastActiveQuestion) {
        await handleOfflineFinish();
      } else {
        setOfflineIdx(i => i + 1);
      }
      return;
    }

    if (currentQuestion.type === 'matching') {
      const subQs = currentQuestion.matchingData?.subQuestions ?? [];
      const allAnswered = subQs.length > 0 && subQs.every(s => matchingAnswers[s.inputName]);
      if (!allAnswered) {
        Alert.alert('Répondre à toutes les paires', 'Associe chaque élément avant de continuer.');
        return;
      }
      const ok = await submitMatchingAnswers();
      if (!ok) {
        Alert.alert('Synchronisation impossible', 'Les réponses n\'ont pas pu être envoyées. Réessaie.');
        return;
      }
      if (isLastQuestion) { await handleFinish(); } else { nextQuestion(); }
      return;
    }

    if (effectiveSelected === null || effectiveSelected === undefined) {
      Alert.alert('Sélectionne une réponse', 'Choisis une option avant de continuer.');
      return;
    }

    if (selectedValue !== null) {
      const ok = await submitAnswer();
      if (!ok) {
        Alert.alert(
          'Synchronisation impossible',
          'Ta réponse n\'a pas pu être envoyée à Moodle. Réessaie.'
        );
        return;
      }
    }

    if (isLastQuestion) {
      await handleFinish();
    } else {
      nextQuestion();
    }
  };

  const handleFinish = async () => {
    const finalScore = await finishQuiz();
    if (!finalScore) {
      Alert.alert('Erreur', 'Impossible de terminer le quiz. Réessaie.');
      return;
    }

    if (IS_DEV) {
      console.log('[QuizNative] Final score:', finalScore);
    }

    const correct = finalScore.correct ?? 0;
    const total = finalScore.total ?? 0;
    const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const xp = calculateXP('quiz', correct, total, {
      perfectScore: correct === total && total > 0,
      timeSpent: elapsedSeconds,
      streak,
    }).totalXP;
    const resultParams = new URLSearchParams({
      activity: 'Quiz',
      score: String(correct),
      total: String(total),
      xp: String(xp),
      moduleId: String(cmid),
      instanceId: String(instanceId || cmid),
      moduleTitle: title,
      courseId: String(courseId),
      returnRoute: `/(stacks)/(cours)/${courseId}`,
    }).toString();

    router.replace(`/(stacks)/(cours)/result?${resultParams}` as any);
  };

  // ─── Rendu d'une option (multichoice / truefalse) ───────────────────────

  const renderOption = (
    option: { value: string; label: string; inputName: string },
    idx: number
  ) => {
    const isSelected = effectiveSelected === option.value;
    return (
      <Pressable
        key={`${currentQuestion.slot}-${idx}`}
        onPress={() => offlineMode ? handleOfflineSelect(option.value) : selectAnswer(option.value)}
        disabled={!offlineMode && isSaving}
        style={{
          padding: 16,
          borderRadius: 12,
          borderWidth: 2,
          marginBottom: 12,
          borderColor: isSelected ? '#4a90e2' : '#E5E7EB',
          backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF'
        }}
      >
        <View style={styles.flexrow_itemscenter}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 9999,
              borderWidth: 2,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
              borderColor: isSelected ? '#4a90e2' : '#D1D5DB',
              backgroundColor: isSelected ? '#4a90e2' : 'transparent'
            }}
          >
            {isSelected && <Feather name="check" size={14} color="white" />}
          </View>
          <Text
            style={{
              flex: 1,
              fontWeight: '500',
              color: isSelected ? '#4a90e2' : '#1F2937'
            }}
          >
            {option.label}
          </Text>
        </View>
      </Pressable>
    );
  };

  // ─── Rendu principal ─────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={['top']}>
      {/* Header */}
      <View style={styles.flexrow_itemscenter_justifybet}>
        <Pressable onPress={() => router.back()} style={styles.p2_ml2}>
          <Feather name="x" size={24} color="#374151" />
        </Pressable>
        <View style={styles.itemscenter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.textbase_fontbold_text002366} numberOfLines={1}>
              {quizName || title}
            </Text>
            {offlineMode && (
              <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>HORS-LIGNE</Text>
              </View>
            )}
          </View>
          <Text style={styles.textxs_textgray500}>
            Question {activeCurrentIndex + 1} / {activeQuestions.length}
          </Text>
        </View>
        <View style={styles.w10} />
      </View>

      {/* Progress bar */}
      <View style={styles.h2_bggray200}>
        <View
          style={[styles.hfull_bg4a90e2,{ width: `${progress}%` }]}
         />
      </View>

      <ScrollView style={styles.flex1_px4_py6}>
        <View style={styles.bgwhite_rounded2xl_p6_shadowsm}>
          {/* Énoncé */}
          <Text style={styles.textxl_fontbold_textgray900_mb}>
            {currentQuestion.text || 'Question'}
          </Text>

          {/* Options multichoice / truefalse */}
          {(currentQuestion.type === 'multichoice' ||
            currentQuestion.type === 'truefalse') &&
            currentQuestion.options.length > 0 && (
              <View>{currentQuestion.options.map(renderOption)}</View>
            )}

          {/* Réponse courte (shortanswer) */}
          {currentQuestion.type === 'shortanswer' && (
            <TextInput
              value={textAnswer}
              onChangeText={(text) => {
                setTextAnswer(text);
                selectAnswer(text);
              }}
              placeholder="Écris ta réponse..."
              placeholderTextColor="#9CA3AF"
              style={styles.style_1}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          {/* Réponse numérique (numerical) */}
          {currentQuestion.type === 'numerical' && (
            <TextInput
              value={textAnswer}
              onChangeText={(text) => {
                setTextAnswer(text);
                selectAnswer(text);
              }}
              placeholder="Écris un nombre..."
              placeholderTextColor="#9CA3AF"
              style={styles.border2_bordergray200_roundedx}
              keyboardType="numeric"
            />
          )}

          {/* Matching — liste de sous-questions avec choix par ligne */}
          {currentQuestion.type === 'matching' &&
            currentQuestion.matchingData && (
              <View>
                {currentQuestion.matchingData.subQuestions.map((sub, si) => {
                  const chosen = matchingAnswers[sub.inputName];
                  return (
                    <View key={sub.inputName} style={{ marginBottom: 16 }}>
                      <Text style={{ fontWeight: '600', color: '#1F2937', marginBottom: 8 }}>
                        {si + 1}. {sub.text}
                      </Text>
                      {currentQuestion.matchingData!.choices.map((choice) => {
                        const isSel = chosen === choice.value;
                        return (
                          <Pressable
                            key={choice.value}
                            onPress={() => selectMatchingAnswer(sub.inputName, choice.value)}
                            disabled={isSaving}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              padding: 12,
                              borderRadius: 10,
                              borderWidth: 2,
                              marginBottom: 6,
                              borderColor: isSel ? '#4a90e2' : '#E5E7EB',
                              backgroundColor: isSel ? '#EFF6FF' : '#FFFFFF',
                            }}
                          >
                            <View style={{
                              width: 20, height: 20, borderRadius: 9999,
                              borderWidth: 2, alignItems: 'center', justifyContent: 'center',
                              marginRight: 10,
                              borderColor: isSel ? '#4a90e2' : '#D1D5DB',
                              backgroundColor: isSel ? '#4a90e2' : 'transparent',
                            }}>
                              {isSel && <Feather name="check" size={12} color="white" />}
                            </View>
                            <Text style={{ flex: 1, color: isSel ? '#4a90e2' : '#374151' }}>
                              {choice.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            )}

          {/* Type non géré côté UI native */}
          {currentQuestion.type !== 'multichoice' &&
            currentQuestion.type !== 'truefalse' &&
            currentQuestion.type !== 'shortanswer' &&
            currentQuestion.type !== 'numerical' &&
            currentQuestion.type !== 'matching' && (
              <View style={styles.bgamber50_p4_roundedxl_border_}>
                <View style={styles.flexrow_itemsstart}>
                  <Feather name="info" size={20} color="#F59E0B" />
                  <Text style={styles.ml2_flex1_textsm_textamber800}>
                    Ce type de question (
                    <Text style={styles.fontbold}>{currentQuestion.type}</Text>
                    ) n'est pas encore pris en charge.
                    Tu peux la passer pour continuer .
                  </Text>
                </View>
              </View>
            )}

          {/* Indicateur de sauvegarde */}
          {isSaving && (
            <View style={styles.mt4_flexrow_itemscenter_justif}>
              <ActivityIndicator size="small" color="#4a90e2" />
              <Text style={styles.ml2_textsm_textgray500}>
                Synchronisation…
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bouton bas */}
      <View style={styles.p4_bgwhite_bordert_bordergray1}>
        <Pressable
          onPress={handleNext}
          disabled={isSaving}
          style={{
            paddingVertical: 16,
            borderRadius: 12,
            backgroundColor: isSaving ? '#D1D5DB' : '#4a90e2'
          }}
        >
          <Text style={styles.textwhite_textcenter_fontbold_}>
            {isSaving
              ? 'Envoi…'
              : isLastActiveQuestion
                ? 'Terminer le quiz'
                : 'Suivant'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
