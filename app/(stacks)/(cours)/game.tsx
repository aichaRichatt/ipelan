import { useActivityContent } from "@/hooks/useActivityContent";
import { moodleCall } from "@/services/api/moodleClient";
import { RootState } from "@/services/redux/store";
import { addToSyncQueue } from "@/services/storage/sync-queue";
import { shuffle } from "@/utils/shuffle";
import { calculateXP } from "@/utils/xpCalculator";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

// ── Design tokens (identiques à tous les écrans d'activité) ───────────────
const T = {
  bg:          '#FAF9F6',
  card:        '#FFFFFF',
  border:      '#E5E7EB',
  primary:     '#002366',
  amber:       '#F59E0B',
  success:     '#10B981',
  successBg:   '#F0FDF4',
  successText: '#15803D',
  error:       '#EF4444',
  errorBg:     '#FEF2F2',
  errorText:   '#B91C1C',
  textMain:    '#111827',
  textSub:     '#6B7280',
  textMid:     '#374151',
  gray100:     '#F3F4F6',
  gray200:     '#E5E7EB',
  gray400:     '#9CA3AF',
} as const;

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    moduleId?: string; moduleTitle?: string; courseId?: string;
    cmid?: string; instanceId?: string;
  }>();

  const token  = useSelector((state: RootState) => state.auth.token);
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const streak = useSelector((state: RootState) => state.auth.user?.streak ?? 0);
  const startTimeRef = useRef(Date.now());

  const moduleId   = parseInt(params.moduleId   || '0', 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || '0', 10);
  const cmid       = parseInt(params.cmid       || '0', 10);
  const courseId   = parseInt(params.courseId   || '0', 10);

  const { wordOrder: wordOrderData, isLoading, error } = useActivityContent(
    token || '', moduleId, instanceId, 'lesson',
    cmid || instanceId, courseId, params.moduleTitle
  );

  const sentences = wordOrderData?.sentences?.length ? wordOrderData.sentences : [];

  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [placedWords,    setPlacedWords]    = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [showResult,     setShowResult]     = useState(false);
  const [score,          setScore]          = useState(0);
  const [wrongAttempts,  setWrongAttempts]  = useState(0);
  const [showAnswer,     setShowAnswer]     = useState(false);
  const [feedback,       setFeedback]       = useState<'correct' | 'wrong' | null>(null);

  const sentence = sentences[currentSentenceIndex] || { words: [], translation: '' };

  // Stable key — évite la boucle infinie si le hook retourne un nouveau tableau à chaque render
  const sentenceKey = sentences.length > 0
    ? `${currentSentenceIndex}:${sentence.words.join('|')}`
    : '';

  const initSentence = React.useCallback(() => {
    if (!sentence.words.length) return;
    setAvailableWords(shuffle([...sentence.words]));
    setPlacedWords([]);
    setWrongAttempts(0);
    setShowAnswer(false);
    setFeedback(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentenceKey]);

  useEffect(() => { initSentence(); }, [initSentence]);

  // ── Logique jeu ──────────────────────────────────────────────────────────
  const handlePlaceWord = (word: string) => {
    if (placedWords.length >= sentence.words.length) return;
    setPlacedWords(prev => [...prev, word]);
    setAvailableWords(prev => {
      const idx = prev.indexOf(word);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleRemoveWord = (index: number) => {
    if (feedback === 'correct') return;
    const word = placedWords[index];
    setPlacedWords(prev  => prev.filter((_, i) => i !== index));
    setAvailableWords(prev => [...prev, word]);
  };

  const normalise = (words: string[]) =>
    words.join(' ').trim().replace(/\s+/g, ' ').toLowerCase();

  const checkOrder = () => {
    const correct = normalise(placedWords) === normalise(sentence.words);
    setFeedback(correct ? 'correct' : 'wrong');

    if (correct) {
      setScore(prev => prev + 1);
      setTimeout(() => {
        if (currentSentenceIndex < sentences.length - 1) {
          setCurrentSentenceIndex(prev => prev + 1);
        } else {
          setShowResult(true);
        }
      }, 1200);
    } else {
      const next = wrongAttempts + 1;
      setWrongAttempts(next);
      if (next >= 3) setShowAnswer(true);
      setTimeout(() => {
        const all = [...availableWords, ...placedWords];
        setPlacedWords([]);
        setAvailableWords(shuffle(all));
        setFeedback(null);
      }, 900);
    }
  };

  const handleContinue = async () => {
    if (token && wordOrderData?.id) {
      try {
        await moodleCall('mod_lesson_finish_attempt', { lessonid: String(wordOrderData.id) }, token);
      } catch {
        // Hors-ligne ou échec réseau : ne pas perdre l'appel, le mettre en queue (sync_queue générique, retry au retour réseau)
        await addToSyncQueue(
          'completion',
          'mod_lesson_finish_attempt',
          { wstoken: token, lessonid: String(wordOrderData.id), moodlewsrestformat: 'json' },
          userId
        ).catch(() => {});
      }
    }
    const iid = params.instanceId || params.moduleId || '0';
    const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const xp = calculateXP('wordOrder', score, sentences.length, {
      perfectScore: score === sentences.length && sentences.length > 0,
      timeSpent: elapsedSeconds, streak,
    }).totalXP;
    router.replace(
      `/(stacks)/(cours)/result?activity=Ordre+des+mots&score=${score}&total=${sentences.length}&xp=${xp}&moduleId=${params.moduleId || ''}&instanceId=${iid}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Ordre des mots')}&courseId=${params.courseId || ''}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ''}`)}` as any
    );
  };

  const handleRetry = () => {
    setCurrentSentenceIndex(0);
    setScore(0);
    setShowResult(false);
  };

  const getScoreEmoji = () => {
    const pct = (score / (sentences.length || 1)) * 100;
    if (pct === 100) return '🏆';
    if (pct >= 80)   return '🌟';
    if (pct >= 50)   return '👏';
    if (pct >= 40)   return '💪';
    return '📚';
  };

  // ── Chargement ────────────────────────────────────────────────────────────
  if (isLoading) return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader title="Ordre des mots" onBack={() => router.back()} />
      <View style={s.centered}>
        <ActivityIndicator size="large" color={T.amber} />
        <Text style={s.loadingText}>Chargement du jeu…</Text>
      </View>
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader title="Ordre des mots" onBack={() => router.back()} />
      <View style={s.centeredPad}>
        <View style={s.errorCard}>
          <View style={s.errorIconWrap}>
            <Feather name="alert-circle" size={32} color={T.error} />
          </View>
          <Text style={s.errorTitle}>Impossible de charger le jeu</Text>
          <Text style={s.errorBody}>{error}</Text>
          <Pressable onPress={() => router.back()} style={s.errorBtn}>
            <Text style={s.errorBtnText}>Retour au cours</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );

  if (!sentences.length) return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader title="Ordre des mots" onBack={() => router.back()} />
      <View style={s.centered}>
        <Feather name="layers" size={56} color={T.gray200} />
        <Text style={s.loadingText}>Aucune phrase disponible</Text>
        <Pressable onPress={() => router.back()} style={[s.errorBtn, { marginTop: 24 }]}>
          <Text style={s.errorBtnText}>Retour</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  // ── Écran résultat ────────────────────────────────────────────────────────
  if (showResult) {
    const percentage  = Math.round((score / sentences.length) * 100);
    const resultColor = percentage >= 50 ? T.success : T.error;
    return (
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={s.resultScroll}>
          <View style={s.resultCard}>
            <Text style={s.resultEmoji}>{getScoreEmoji()}</Text>
            <Text style={s.resultTitle}>
              {percentage >= 50 ? 'Bravo !' : 'Continue tes efforts !'}
            </Text>
            <Text style={s.resultSubtitle}>
              Tu as complété {score} phrase{score > 1 ? 's' : ''} sur {sentences.length}
            </Text>

            <View style={[s.resultCircle, { borderColor: resultColor, backgroundColor: resultColor + '18' }]}>
              <Text style={[s.resultPercent, { color: resultColor }]}>{percentage}%</Text>
            </View>

            <View style={s.xpTag}>
              <Text style={s.xpTagStar}>⭐</Text>
              <Text style={s.xpTagText}>
                +{calculateXP('wordOrder', score, sentences.length).totalXP} XP gagnés
              </Text>
            </View>

            <View style={s.resultBtnRow}>
              <Pressable onPress={handleContinue} style={s.btnSecondary}>
                <Text style={s.btnSecondaryText}>Continuer</Text>
              </Pressable>
              <Pressable onPress={handleRetry} style={s.btnPrimary}>
                <Text style={s.btnPrimaryText}>Rejouer</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Écran jeu ─────────────────────────────────────────────────────────────
  const progress    = sentences.length > 0 ? ((currentSentenceIndex + 1) / sentences.length) * 100 : 0;
  const canValidate = placedWords.length === sentence.words.length && feedback === null;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader
        title={params.moduleTitle || 'Ordre des mots'}
        subtitle={`Phrase ${currentSentenceIndex + 1} / ${sentences.length}`}
        onBack={() => router.back()}
        badge={`${score} pts`}
      />

      {/* Progress bar */}
      <View style={s.progressWrap}>
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${progress}%` as any }]} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Carte instruction */}
        <View style={s.instructionCard}>
          <Feather name="layers" size={26} color={T.primary} style={{ marginBottom: 8 }} />
          <Text style={s.instructionTitle}>Remets les mots dans le bon ordre</Text>
          <Text style={s.instructionHint}>Appuie sur un mot pour le placer · appuie dessus pour le retirer</Text>
        </View>

        {/* Zone réponse */}
        <View style={s.sectionBlock}>
          <Text style={s.sectionLabel}>Ta réponse</Text>
          <View style={[
            s.answerZone,
            feedback === 'correct' && s.answerZoneCorrect,
            feedback === 'wrong'   && s.answerZoneWrong,
          ]}>
            {placedWords.length === 0 ? (
              <View style={s.answerPlaceholder}>
                <Text style={s.answerPlaceholderText}>Place les mots ici…</Text>
              </View>
            ) : (
              <View style={s.wordsRow}>
                {placedWords.map((word, index) => (
                  <Pressable
                    key={`placed-${index}`}
                    onPress={() => handleRemoveWord(index)}
                    style={[
                      s.chipPlaced,
                      feedback === 'correct' && s.chipCorrect,
                      feedback === 'wrong'   && s.chipWrong,
                    ]}
                  >
                    <Text style={s.chipPlacedText}>{word}</Text>
                  </Pressable>
                ))}
                {Array.from({ length: sentence.words.length - placedWords.length }).map((_, i) => (
                  <View key={`slot-${i}`} style={s.emptySlot}>
                    <Text style={s.emptySlotText}>{placedWords.length + i + 1}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Feedback */}
        {feedback === 'correct' && (
          <View style={s.feedbackBox}>
            <Feather name="check-circle" size={20} color={T.success} />
            <Text style={[s.feedbackText, { color: T.successText }]}>Correct !</Text>
          </View>
        )}
        {feedback === 'wrong' && (
          <View style={[s.feedbackBox, s.feedbackWrong]}>
            <Feather name="x-circle" size={20} color={T.error} />
            <Text style={[s.feedbackText, { color: T.errorText }]}>Essaie encore !</Text>
          </View>
        )}

        {/* Afficher la bonne réponse après 3 erreurs */}
        {showAnswer && (
          <View style={s.answerReveal}>
            <View style={s.answerRevealRow}>
              <Feather name="check-circle" size={16} color={T.success} />
              <Text style={s.answerRevealLabel}>La bonne réponse :</Text>
            </View>
            <Text style={s.answerRevealText}>{sentence.words.join(' ')}</Text>
          </View>
        )}

        {/* Mots disponibles */}
        <View style={s.sectionBlock}>
          <Text style={s.sectionLabel}>Mots disponibles</Text>
          <View style={s.wordsRow}>
            {availableWords.map((word, index) => (
              <Pressable
                key={`avail-${index}`}
                onPress={() => handlePlaceWord(word)}
                style={s.chipAvailable}
              >
                <Text style={s.chipAvailableText}>{word}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Barre d'action */}
      <View style={s.bottomBar}>
        {wrongAttempts >= 3 && !showAnswer ? (
          <Pressable onPress={() => setShowAnswer(true)} style={s.showAnswerBtn}>
            <Text style={s.actionBtnText}>Voir la réponse</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={checkOrder}
            disabled={!canValidate}
            style={[s.actionBtn, canValidate ? s.actionBtnActive : s.actionBtnDisabled]}
          >
            <Text style={s.actionBtnText}>Valider</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Sous-composant header ─────────────────────────────────────────────────
function ActivityHeader({
  title, subtitle, badge, onBack,
}: { title: string; subtitle?: string; badge?: string; onBack: () => void }) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} style={s.backBtn}>
        <Feather name="arrow-left" size={24} color={T.textMain} />
      </Pressable>
      <View style={s.headerInfo}>
        <Text style={s.headerTitle}>{title}</Text>
        {subtitle ? <Text style={s.headerSub}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: T.bg },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centeredPad: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  loadingText: { marginTop: 16, color: T.textSub },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn:     { padding: 8, marginLeft: -8, marginRight: 12 },
  headerInfo:  { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: T.textMain },
  headerSub:   { fontSize: 12, color: T.textSub, marginTop: 2 },
  badge:       { backgroundColor: T.amber, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText:   { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // Progress bar
  progressWrap: { paddingHorizontal: 20, marginBottom: 16 },
  progressBg:   { height: 8, backgroundColor: T.gray200, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: T.amber, borderRadius: 4 },

  // Scroll
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },

  // Instruction card
  instructionCard: {
    backgroundColor: T.card, borderRadius: 24, padding: 24, marginBottom: 20,
    alignItems: 'center', borderWidth: 1, borderColor: T.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  instructionTitle: { fontSize: 16, fontWeight: '700', color: T.textMain, textAlign: 'center', marginBottom: 6 },
  instructionHint:  { fontSize: 13, color: T.gray400, textAlign: 'center' },

  // Sections
  sectionBlock: { marginBottom: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: T.textMain, marginBottom: 10 },

  // Answer zone
  answerZone: {
    backgroundColor: T.card, borderRadius: 16, borderWidth: 2,
    borderColor: T.border, borderStyle: 'dashed', minHeight: 72, padding: 12,
  },
  answerZoneCorrect:       { borderColor: T.success, backgroundColor: T.successBg },
  answerZoneWrong:         { borderColor: T.error,   backgroundColor: T.errorBg },
  answerPlaceholder:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  answerPlaceholderText:   { color: T.gray400, fontSize: 14 },

  // Word chips
  wordsRow:        { flexDirection: 'row', flexWrap: 'wrap' },
  chipPlaced:      { backgroundColor: T.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginRight: 8, marginBottom: 8 },
  chipCorrect:     { backgroundColor: T.success },
  chipWrong:       { backgroundColor: T.error },
  chipPlacedText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  chipAvailable:   { backgroundColor: T.card, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: T.border, marginRight: 8, marginBottom: 8 },
  chipAvailableText: { color: T.textMain, fontWeight: '700', fontSize: 15 },

  // Empty slot
  emptySlot: {
    width: 52, height: 44, borderWidth: 2, borderColor: T.gray200,
    borderStyle: 'dashed', borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', marginRight: 8, marginBottom: 8,
  },
  emptySlotText: { color: T.gray400, fontSize: 12 },

  // Feedback
  feedbackBox:  { flexDirection: 'row', alignItems: 'center', backgroundColor: T.successBg, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#BBF7D0', gap: 10 },
  feedbackWrong: { backgroundColor: T.errorBg, borderColor: '#FECACA' },
  feedbackText:  { fontWeight: '600', fontSize: 15, flex: 1 },

  // Answer reveal
  answerReveal:     { backgroundColor: T.successBg, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  answerRevealRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  answerRevealLabel: { color: T.successText, fontWeight: '700' },
  answerRevealText:  { color: '#166534', fontSize: 15, fontWeight: '500' },

  // Bottom bar
  bottomBar:         { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.card },
  actionBtn:         { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  actionBtnActive:   { backgroundColor: T.primary },
  actionBtnDisabled: { backgroundColor: T.gray200 },
  showAnswerBtn:     { borderRadius: 16, paddingVertical: 16, alignItems: 'center', backgroundColor: T.textSub },
  actionBtnText:     { color: '#fff', fontWeight: 'bold', fontSize: 17 },

  // Error
  errorCard: {
    backgroundColor: T.card, borderRadius: 24, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: T.border, width: '100%',
  },
  errorIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: T.errorBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  errorTitle:   { fontSize: 18, fontWeight: 'bold', color: T.textMain, marginBottom: 8, textAlign: 'center' },
  errorBody:    { color: T.textSub, textAlign: 'center', marginBottom: 24, fontSize: 14 },
  errorBtn:     { backgroundColor: T.primary, borderRadius: 24, paddingHorizontal: 32, paddingVertical: 12 },
  errorBtnText: { color: '#fff', fontWeight: 'bold' },

  // Result
  resultScroll:    { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  resultCard:      { backgroundColor: T.card, borderRadius: 28, padding: 32, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  resultEmoji:     { fontSize: 56, marginBottom: 12 },
  resultTitle:     { color: T.textMain, fontSize: 24, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  resultSubtitle:  { color: T.textSub, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  resultCircle:    { width: 120, height: 120, borderRadius: 60, borderWidth: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  resultPercent:   { fontSize: 34, fontWeight: '900' },
  xpTag:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 24, gap: 8 },
  xpTagStar:       { fontSize: 20 },
  xpTagText:       { color: '#92400E', fontWeight: 'bold', fontSize: 16 },
  resultBtnRow:    { flexDirection: 'row', gap: 10, width: '100%' },
  btnSecondary:    { flex: 1, backgroundColor: T.gray200, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryText: { color: T.textMid, fontWeight: '700', fontSize: 15 },
  btnPrimary:      { flex: 1, backgroundColor: T.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
});
