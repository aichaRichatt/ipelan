import { AssociationPair, useActivityContent } from "@/hooks/useActivityContent";
import { setLives } from "@/services/api/userProgressService";
import { updateUser } from "@/services/redux/slices/authSlice";
import { RootState } from "@/services/redux/store";
import { syncQueue } from "@/services/sync/syncQueue";
import { calculateXP } from "@/utils/xpCalculator";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

// ── Design tokens (identiques à tous les écrans d'activité) ───────────────
const T = {
  bg:          '#FAF9F6',
  card:        '#FFFFFF',
  border:      '#E5E7EB',
  primary:     '#002366',
  primaryBg:   'rgba(0,35,102,0.08)',
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

const CONSECUTIVE_ERROR_THRESHOLD = 4;
const XP_PENALTY_PER_LIFE = 5;
const IS_DEV = process.env.NODE_ENV === 'development';

export default function AssociationScreen() {
  const router   = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{
    moduleId?: string; moduleTitle?: string; courseId?: string;
    cmid?: string; instanceId?: string;
  }>();

  const token         = useSelector((state: RootState) => state.auth.token);
  const userId        = useSelector((state: RootState) => state.auth.user?.id);
  const currentLives  = useSelector((state: RootState) => state.auth.user?.lives ?? 6);
  const currentStreak = useSelector((state: RootState) => state.auth.user?.streak ?? 0);

  const moduleId   = parseInt(params.moduleId   || '0', 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || '0', 10);
  const cmid       = parseInt(params.cmid       || '0', 10);
  const courseId   = parseInt(params.courseId   || '0', 10);

  const { association: associationData, isLoading, error } = useActivityContent(
    token || '', moduleId, instanceId, 'glossary',
    cmid || instanceId, courseId, params.moduleTitle
  );

  const matchItems = associationData?.pairs?.length ? associationData.pairs : [];
  const totalPairs = matchItems.length;

  const [leftColumn,        setLeftColumn]        = useState<{ item: AssociationPair; originalIndex: number }[]>([]);
  const [rightColumn,       setRightColumn]       = useState<{ item: AssociationPair; originalIndex: number }[]>([]);
  const [selectedLeft,      setSelectedLeft]      = useState<number | null>(null);
  const [selectedRight,     setSelectedRight]     = useState<number | null>(null);
  const [matchedLeft,       setMatchedLeft]       = useState<number[]>([]);
  const [matchedRight,      setMatchedRight]      = useState<number[]>([]);
  const [errorLeft,         setErrorLeft]         = useState<number | null>(null);
  const [errorRight,        setErrorRight]        = useState<number | null>(null);
  const [showResult,        setShowResult]        = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [livesLost,         setLivesLost]         = useState(0);
  const [xpPenalty,         setXpPenalty]         = useState(0);
  const [showPenaltyBanner, setShowPenaltyBanner] = useState(false);

  const penaltyAnim       = useRef(new Animated.Value(0)).current;
  const currentLivesRef   = useRef(currentLives);
  const startTimeRef      = useRef(Date.now());
  useEffect(() => { currentLivesRef.current = currentLives; }, [currentLives]);

  // ── Initialisation colonnes ───────────────────────────────────────────────
  useEffect(() => {
    if (!matchItems.length) return;
    const left  = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
    const right = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
    for (let i = right.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [right[i], right[j]] = [right[j], right[i]];
    }
    setLeftColumn(left);
    setRightColumn(right);
  }, [matchItems]);

  const progress = totalPairs > 0 ? (matchedLeft.length / totalPairs) * 100 : 0;
  const score    = matchedLeft.length;

  // ── Pénalité vie ──────────────────────────────────────────────────────────
  const applyLifePenalty = async () => {
    if (!userId) return;
    const newLives = Math.max(0, currentLivesRef.current - 1);
    try {
      await setLives(userId, newLives);
      dispatch(updateUser({ lives: newLives }));
      if (token) syncQueue.syncGamification(userId, token);
    } catch (e) {
      if (IS_DEV) console.warn('[Association] Failed to deduct life:', e);
    }
    setLivesLost(prev => prev + 1);
    setXpPenalty(prev => prev + XP_PENALTY_PER_LIFE);
    setShowPenaltyBanner(true);
    penaltyAnim.setValue(0);
    Animated.sequence([
      Animated.timing(penaltyAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(penaltyAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setShowPenaltyBanner(false));
    if (newLives <= 0) setTimeout(() => setShowResult(true), 1600);
  };

  // ── Matching logic ────────────────────────────────────────────────────────
  const handleLeftSelect = (index: number) => {
    if (matchedLeft.includes(index)) return;
    if (errorLeft !== null) setErrorLeft(null);
    setSelectedLeft(index);
    if (selectedRight !== null) tryMatch(index, selectedRight);
  };

  const handleRightSelect = (index: number) => {
    if (matchedRight.includes(index)) return;
    if (errorRight !== null) setErrorRight(null);
    setSelectedRight(index);
    if (selectedLeft !== null) tryMatch(selectedLeft, index);
  };

  const tryMatch = (leftIdx: number | null, rightIdx: number | null) => {
    if (leftIdx === null || rightIdx === null) return;
    const leftItem  = leftColumn.find(l => l.originalIndex === leftIdx);
    const rightItem = rightColumn[rightIdx];
    if (!leftItem || !rightItem) return;

    if (leftItem.originalIndex === rightItem.originalIndex) {
      setConsecutiveErrors(0);
      setMatchedLeft(prev  => [...prev, leftIdx]);
      setMatchedRight(prev => [...prev, rightIdx]);
      setSelectedLeft(null);
      setSelectedRight(null);
      if (matchedLeft.length + 1 === totalPairs) setTimeout(() => setShowResult(true), 800);
    } else {
      setErrorLeft(leftIdx);
      setErrorRight(rightIdx);
      setSelectedLeft(null);
      setSelectedRight(null);
      const next = consecutiveErrors + 1;
      if (next >= CONSECUTIVE_ERROR_THRESHOLD) {
        setConsecutiveErrors(0);
        applyLifePenalty();
      } else {
        setConsecutiveErrors(next);
      }
      setTimeout(() => { setErrorLeft(null); setErrorRight(null); }, 800);
    }
  };

  const resetGame = () => {
    setSelectedLeft(null); setSelectedRight(null);
    setMatchedLeft([]); setMatchedRight([]);
    setErrorLeft(null); setErrorRight(null);
    setConsecutiveErrors(0); setLivesLost(0); setXpPenalty(0);
    setShowResult(false);
    startTimeRef.current = Date.now();
    const left  = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
    const right = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
    for (let i = right.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [right[i], right[j]] = [right[j], right[i]];
    }
    setLeftColumn(left);
    setRightColumn(right);
  };

  const handleContinue = () => {
    const iId      = params.instanceId || params.moduleId || '0';
    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const isPerfect = score === totalPairs && livesLost === 0;
    const rawXp     = calculateXP('association', score, totalPairs, {
      perfectScore: isPerfect, timeSpent, streak: currentStreak,
    }).totalXP;
    const earnedXp  = Math.max(0, rawXp - xpPenalty);
    router.push(
      `/(stacks)/(cours)/result?activity=Association&score=${score}&total=${totalPairs}&xp=${earnedXp}&moduleId=${params.moduleId || ''}&instanceId=${iId}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Exercice')}&courseId=${params.courseId || ''}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ''}`)}` as any
    );
  };

  const getScoreEmoji = () => {
    const pct = (score / totalPairs) * 100;
    if (pct === 100) return '🏆';
    if (pct >= 80)   return '🌟';
    if (pct >= 50)   return '👏';
    if (pct >= 40)   return '💪';
    return '📚';
  };

  // ── Chargement ────────────────────────────────────────────────────────────
  if (isLoading) return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader title="Association de mots" onBack={() => router.back()} />
      <View style={s.centered}>
        <ActivityIndicator size="large" color={T.amber} />
        <Text style={s.loadingText}>Chargement des mots…</Text>
      </View>
    </SafeAreaView>
  );

  if (error || matchItems.length === 0) return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader title="Association de mots" onBack={() => router.back()} />
      <View style={s.centeredPad}>
        <View style={s.errorCard}>
          <View style={s.errorIconWrap}>
            <Feather name="alert-circle" size={32} color={T.error} />
          </View>
          <Text style={s.errorTitle}>Aucune donnée trouvée</Text>
          <Text style={s.errorBody}>{error || 'Ce module ne contient pas de paires à associer.'}</Text>
          <Pressable onPress={() => router.back()} style={s.errorBtn}>
            <Text style={s.errorBtnText}>Retour au cours</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );

  // ── Écran résultat ────────────────────────────────────────────────────────
  if (showResult) {
    const percentage = Math.round((score / totalPairs) * 100);
    const isGood     = percentage >= 50;
    const timeSpent  = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const isPerfect  = score === totalPairs && livesLost === 0;
    const earnedXp   = Math.max(0, calculateXP('association', score, totalPairs, {
      perfectScore: isPerfect, timeSpent, streak: currentStreak,
    }).totalXP - xpPenalty);

    return (
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={s.resultScroll}>
          <View style={s.resultCard}>
            <Text style={s.resultEmoji}>{getScoreEmoji()}</Text>
            <Text style={s.resultTitle}>
              {percentage === 100 ? 'Parfait !' : isGood ? 'Excellent !' : 'Bien joué !'}
            </Text>
            <Text style={s.resultSubtitle}>
              {score} paire{score > 1 ? 's' : ''} correcte{score > 1 ? 's' : ''} sur {totalPairs}
            </Text>

            <View style={[
              s.resultCircle,
              { borderColor: isGood ? T.success : T.error, backgroundColor: isGood ? T.successBg : T.errorBg },
            ]}>
              <Text style={[s.resultPercent, { color: isGood ? T.success : T.error }]}>
                {percentage}%
              </Text>
            </View>

            <View style={s.xpBadge}>
              <Text style={{ fontSize: 20 }}>⭐</Text>
              <Text style={s.xpBadgeText}>+{earnedXp} XP gagnés</Text>
            </View>

            {xpPenalty > 0 && (
              <View style={s.penaltySummary}>
                <Text style={s.penaltySummaryText}>
                  ❤️ −{livesLost} vie{livesLost > 1 ? 's' : ''}  ·  −{xpPenalty} XP (erreurs)
                </Text>
              </View>
            )}

            <View style={s.resultBtnRow}>
              <Pressable style={s.btnSecondary} onPress={handleContinue}>
                <Text style={s.btnSecondaryText}>Terminer</Text>
              </Pressable>
              <Pressable style={s.btnPrimary} onPress={resetGame}>
                <Text style={s.btnPrimaryText}>Recommencer</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Écran principal ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {showPenaltyBanner && (
        <Animated.View style={[s.penaltyBanner, { opacity: penaltyAnim }]}>
          <Text style={s.penaltyTitle}>❤️ −1 vie · −{XP_PENALTY_PER_LIFE} XP</Text>
          <Text style={s.penaltySub}>4 erreurs consécutives !</Text>
        </Animated.View>
      )}

      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={24} color={T.textMain} />
        </Pressable>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle}>Association de mots</Text>
        </View>
        {/* Vies */}
        <View style={s.livesRow}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Text key={i} style={{ fontSize: 14, opacity: i < currentLives ? 1 : 0.2 }}>❤️</Text>
          ))}
        </View>
        {/* Score */}
        <View style={s.scoreBadge}>
          <Text style={s.scoreBadgeText}>{matchedLeft.length}/{totalPairs}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progressWrap}>
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${progress}%` as any }]} />
        </View>
        {consecutiveErrors > 0 && (
          <View style={s.streakRow}>
            {Array.from({ length: CONSECUTIVE_ERROR_THRESHOLD }).map((_, i) => (
              <View key={i} style={i < consecutiveErrors ? s.streakDot : s.streakDotEmpty} />
            ))}
            <Text style={s.streakText}>
              encore {CONSECUTIVE_ERROR_THRESHOLD - consecutiveErrors} avant pénalité
            </Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.board}>
        <Text style={s.instruction}>Associe chaque mot à sa traduction</Text>

        <View style={s.columns}>
          {/* Colonne gauche */}
          <View style={s.column}>
            {leftColumn.map(({ item, originalIndex }) => {
              const isMatched  = matchedLeft.includes(originalIndex);
              const isSelected = selectedLeft === originalIndex;
              const isError    = errorLeft === originalIndex;
              return (
                <Pressable
                  key={`L-${originalIndex}`}
                  onPress={() => handleLeftSelect(originalIndex)}
                  disabled={isMatched}
                  style={[
                    s.card,
                    isSelected && s.cardSelected,
                    isMatched  && s.cardMatched,
                    isError    && s.cardError,
                  ]}
                >
                  <Text style={[
                    s.cardTextLeft,
                    isSelected && s.cardTextSelected,
                    isMatched  && s.cardTextMatched,
                    isError    && s.cardTextError,
                  ]}>
                    {item.word}
                  </Text>
                  {isMatched && <Text style={s.checkMark}>✓</Text>}
                </Pressable>
              );
            })}
          </View>

          {/* Colonne droite */}
          <View style={s.column}>
            {rightColumn.map(({ item, originalIndex }, rightIndex) => {
              const isMatched  = matchedRight.includes(rightIndex);
              const isSelected = selectedRight === rightIndex;
              const isError    = errorRight === rightIndex;
              return (
                <Pressable
                  key={`R-${originalIndex}`}
                  onPress={() => handleRightSelect(rightIndex)}
                  disabled={isMatched}
                  style={[
                    s.card,
                    isSelected && s.cardSelected,
                    isMatched  && s.cardMatched,
                    isError    && s.cardError,
                  ]}
                >
                  <Text style={[
                    s.cardTextRight,
                    isSelected && s.cardTextSelected,
                    isMatched  && s.cardTextMatched,
                    isError    && s.cardTextError,
                  ]}>
                    {item.translation}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.hintRow}>
          <Feather name="info" size={15} color={T.textSub} />
          <Text style={s.hintText}>Sélectionne un mot à gauche, puis sa traduction à droite</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sous-composant header ─────────────────────────────────────────────────
function ActivityHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} style={s.backBtn}>
        <Feather name="arrow-left" size={24} color={T.textMain} />
      </Pressable>
      <View style={s.headerInfo}>
        <Text style={s.headerTitle}>{title}</Text>
      </View>
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
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn:     { padding: 8, marginLeft: -8, marginRight: 12 },
  headerInfo:  { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: T.textMain },
  livesRow:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 10 },
  scoreBadge:  { backgroundColor: T.amber, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  scoreBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // Progress
  progressWrap: { paddingHorizontal: 20, paddingBottom: 4, marginBottom: 4 },
  progressBg:   { height: 8, backgroundColor: T.gray200, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: T.amber, borderRadius: 4 },
  streakRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  streakDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: T.error },
  streakDotEmpty: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.gray200 },
  streakText:   { color: T.errorText, fontSize: 12, fontWeight: '600', marginLeft: 4 },

  // Board
  board:       { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  instruction: { textAlign: 'center', color: T.textSub, fontSize: 13, marginBottom: 16 },
  columns:     { flexDirection: 'row', gap: 10 },
  column:      { flex: 1, gap: 10 },

  // Cards
  card: {
    borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center', minHeight: 72,
    borderWidth: 2, borderColor: T.border, backgroundColor: T.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardSelected: { borderColor: T.primary,  backgroundColor: T.primaryBg },
  cardMatched:  { borderColor: T.success,  backgroundColor: T.successBg },
  cardError:    { borderColor: T.error,    backgroundColor: T.errorBg },
  cardTextLeft:     { textAlign: 'center', fontWeight: '700', fontSize: 16, color: T.textMain },
  cardTextRight:    { textAlign: 'center', fontWeight: '500', fontSize: 14, color: T.textMid },
  cardTextSelected: { color: T.primary },
  cardTextMatched:  { color: T.successText },
  cardTextError:    { color: T.errorText },
  checkMark:        { position: 'absolute', top: 6, right: 8, fontSize: 14, color: T.success, fontWeight: '700' },

  // Hint
  hintRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: T.gray100, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, marginTop: 20, gap: 8 },
  hintText: { color: T.textSub, fontSize: 13, flex: 1 },

  // Penalty banner
  penaltyBanner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    backgroundColor: T.error, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10,
  },
  penaltyTitle: { color: '#fff', fontWeight: '800', fontSize: 17 },
  penaltySub:   { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },

  // Error card
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
  xpBadge:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 12, gap: 8 },
  xpBadgeText:     { color: '#92400E', fontWeight: '700', fontSize: 16 },
  penaltySummary:  { backgroundColor: T.errorBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16, width: '100%' },
  penaltySummaryText: { color: T.errorText, fontWeight: '700', textAlign: 'center', fontSize: 13 },
  resultBtnRow:    { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
  btnSecondary:    { flex: 1, backgroundColor: T.gray200, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryText: { color: T.textMid, fontWeight: '700', fontSize: 15 },
  btnPrimary:      { flex: 1, backgroundColor: T.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
});
