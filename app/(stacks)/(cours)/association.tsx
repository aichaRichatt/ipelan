import { AssociationPair, useActivityContent } from "@/hooks/useActivityContent";
import { updateUser } from "@/services/redux/slices/authSlice";
import { RootState } from "@/services/redux/store";
import { setLives } from "@/services/api/userProgressService";
import { syncQueue } from "@/services/sync/syncQueue";
import { calculateXP } from "@/utils/xpCalculator";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

const CONSECUTIVE_ERROR_THRESHOLD = 4;
const XP_PENALTY_PER_LIFE = 5;
const IS_DEV = process.env.NODE_ENV === "development";

const C = {
  bg: "#F7F8FA",
  card: "#FFFFFF",
  primary: "#1CB0F6",
  primaryBg: "#E8F7FD",
  success: "#58CC02",
  successBg: "#DCFCE7",
  successText: "#15803D",
  error: "#FF4B4B",
  errorBg: "#FEE2E2",
  errorText: "#B91C1C",
  xp: "#FF9600",
  xpBg: "#FFF3E0",
  xpText: "#A16207",
  border: "#E5E7EB",
  text: "#111827",
  textSub: "#6B7280",
  textMid: "#374151",
  white: "#FFFFFF",
  progressBg: "#E5E7EB",
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  header: { backgroundColor: C.bg, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.card,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.border, marginRight: 12,
  },
  headerTitle: { flex: 1, color: C.text, fontSize: 16, fontWeight: "700" },
  livesRow: { flexDirection: "row", alignItems: "center", gap: 3, marginRight: 10 },
  heart: { fontSize: 15 },
  scoreBadge: { backgroundColor: C.xp, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  scoreBadgeText: { color: C.white, fontWeight: "700", fontSize: 13 },
  progressWrap: { marginBottom: 4 },
  progressTrack: { height: 10, backgroundColor: C.progressBg, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: C.success, borderRadius: 999 },
  streakRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  streakDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.error },
  streakDotEmpty: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.border },
  streakText: { color: C.error, fontSize: 12, fontWeight: "600", marginLeft: 4 },
  board: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 },
  instructions: { textAlign: "center", color: C.textSub, fontSize: 13, marginBottom: 16, marginTop: 4 },
  columns: { flexDirection: "row", gap: 10 },
  column: { flex: 1, gap: 10 },
  card: {
    borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12,
    alignItems: "center", justifyContent: "center", minHeight: 72,
    borderWidth: 2, borderColor: C.border, backgroundColor: C.card,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardSelected: { borderColor: C.primary, backgroundColor: C.primaryBg },
  cardMatched: { borderColor: C.success, backgroundColor: C.successBg },
  cardError: { borderColor: C.error, backgroundColor: C.errorBg },
  cardTextLeft: { textAlign: "center", fontWeight: "700", fontSize: 16, color: C.text },
  cardTextRight: { textAlign: "center", fontWeight: "500", fontSize: 14, color: C.textMid },
  cardTextSelected: { color: C.primary },
  cardTextMatched: { color: C.successText },
  cardTextError: { color: C.errorText },
  cardCheck: { position: "absolute", top: 6, right: 8 },
  cardCheckText: { fontSize: 14, color: C.success, fontWeight: "700" },
  hintRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.xpBg,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, marginTop: 20, gap: 8,
  },
  hintText: { color: C.xpText, fontSize: 13, flex: 1 },
  penaltyBanner: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 100,
    backgroundColor: C.error, paddingVertical: 16, paddingHorizontal: 20, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 10,
  },
  penaltyTitle: { color: C.white, fontWeight: "800", fontSize: 17 },
  penaltySub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  loadingText: { color: C.textSub, marginTop: 16, textAlign: "center" },
  errorText: { color: C.error, textAlign: "center", marginBottom: 16 },
  retryBtn: { backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: C.white, fontWeight: "700" },
  resultScroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  resultCard: {
    backgroundColor: C.card, borderRadius: 28, padding: 32, alignItems: "center", width: "100%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  resultEmoji: { fontSize: 56, marginBottom: 12 },
  resultTitle: { color: C.text, fontSize: 26, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  resultSubtitle: { color: C.textSub, fontSize: 14, textAlign: "center", marginBottom: 24 },
  resultCircle: {
    width: 120, height: 120, borderRadius: 60, borderWidth: 8,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  resultPercent: { fontSize: 34, fontWeight: "900" },
  xpBadge: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.xpBg,
    borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 12, gap: 8,
  },
  xpBadgeText: { color: C.xpText, fontWeight: "700", fontSize: 16 },
  penaltySummary: {
    backgroundColor: C.errorBg, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16, width: "100%",
  },
  penaltySummaryText: { color: C.errorText, fontWeight: "700", textAlign: "center", fontSize: 13 },
  resultBtnRow: { flexDirection: "row", gap: 10, width: "100%", marginTop: 8 },
  btnSecondary: { flex: 1, backgroundColor: C.progressBg, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  btnSecondaryText: { color: C.textMid, fontWeight: "700", fontSize: 15 },
  btnPrimary: { flex: 1, backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  btnPrimaryText: { color: C.white, fontWeight: "700", fontSize: 15 },
});

export default function AssociationScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{
    moduleId?: string;
    moduleTitle?: string;
    courseId?: string;
    cmid?: string;
    instanceId?: string;
  }>();

  const token = useSelector((state: RootState) => state.auth.token);
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const currentLives = useSelector((state: RootState) => state.auth.user?.lives ?? 6);
  const currentStreak = useSelector((state: RootState) => state.auth.user?.streak ?? 0);

  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const cmid = parseInt(params.cmid || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);

  const { association: associationData, isLoading, error } = useActivityContent(
    token || "",
    moduleId,
    instanceId,
    "glossary",
    cmid || instanceId,
    courseId,
    params.moduleTitle
  );

  const matchItems = associationData?.pairs?.length ? associationData.pairs : [];
  const totalPairs = matchItems.length;

  const [leftColumn, setLeftColumn] = useState<Array<{ item: AssociationPair; originalIndex: number }>>([]);
  const [rightColumn, setRightColumn] = useState<Array<{ item: AssociationPair; originalIndex: number }>>([]);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<number[]>([]);
  const [matchedRight, setMatchedRight] = useState<number[]>([]);
  const [errorLeft, setErrorLeft] = useState<number | null>(null);
  const [errorRight, setErrorRight] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [livesLost, setLivesLost] = useState(0);
  const [xpPenalty, setXpPenalty] = useState(0);
  const [showPenaltyBanner, setShowPenaltyBanner] = useState(false);
  const penaltyAnim = useRef(new Animated.Value(0)).current;
  const currentLivesRef = useRef(currentLives);
  const startTimeRef = useRef(Date.now());
  useEffect(() => { currentLivesRef.current = currentLives; }, [currentLives]);

  const applyLifePenalty = async () => {
    if (!userId) return;
    const newLives = Math.max(0, currentLivesRef.current - 1);
    try {
      await setLives(userId, newLives);
      dispatch(updateUser({ lives: newLives }));
      if (token) syncQueue.syncGamification(userId, token);
    } catch (e) {
      if (IS_DEV) console.warn("[Association] Failed to deduct life:", e);
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

  const resetGame = () => {
    setSelectedLeft(null); setSelectedRight(null);
    setMatchedLeft([]); setMatchedRight([]);
    setErrorLeft(null); setErrorRight(null);
    setConsecutiveErrors(0); setLivesLost(0); setXpPenalty(0);
    setShowResult(false);
    startTimeRef.current = Date.now();
    const left = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
    const right = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
    for (let i = right.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [right[i], right[j]] = [right[j], right[i]];
    }
    setLeftColumn(left); setRightColumn(right);
  };

  const handleContinue = () => {
    const iId = params.instanceId || params.moduleId || "0";
    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const isPerfect = score === totalPairs && livesLost === 0;
    const rawXp = calculateXP("association", score, totalPairs, {
      perfectScore: isPerfect,
      timeSpent,
      streak: currentStreak,
    }).totalXP;
    const earnedXp = Math.max(0, rawXp - xpPenalty);
    const resultParams =
      `?activity=Association&score=${score}&total=${totalPairs}&xp=${earnedXp}` +
      `&moduleId=${params.moduleId || ""}&instanceId=${iId}` +
      `&moduleTitle=${encodeURIComponent(params.moduleTitle || "Exercice")}` +
      `&courseId=${params.courseId || ""}` +
      `&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ""}`)}`;
    router.push(`/(stacks)/(cours)/result${resultParams}` as any);
  };

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
    const leftArrayIdx = leftColumn.findIndex(l => l.originalIndex === leftIdx);
    const rightItem = rightColumn[rightIdx];
    const leftItem = leftColumn[leftArrayIdx];
    if (!leftItem || !rightItem) return;
    const isMatch =
      leftItem.item.word === rightItem.item.translation ||
      leftItem.item.translation === rightItem.item.word ||
      leftItem.originalIndex === rightItem.originalIndex;
    if (isMatch) {
      setConsecutiveErrors(0);
      setMatchedLeft(prev => [...prev, leftIdx]);
      setMatchedRight(prev => [...prev, rightIdx]);
      setSelectedLeft(null); setSelectedRight(null);
      if (matchedLeft.length + 1 === totalPairs) setTimeout(() => setShowResult(true), 800);
    } else {
      setErrorLeft(leftIdx); setErrorRight(rightIdx);
      setSelectedLeft(null); setSelectedRight(null);
      const newCount = consecutiveErrors + 1;
      if (newCount >= CONSECUTIVE_ERROR_THRESHOLD) {
        setConsecutiveErrors(0);
        applyLifePenalty();
      } else {
        setConsecutiveErrors(newCount);
      }
      setTimeout(() => { setErrorLeft(null); setErrorRight(null); }, 800);
    }
  };

  const getScoreEmoji = () => {
    const pct = (score / totalPairs) * 100;
    if (pct === 100) return "🏆";
    if (pct >= 80) return "🌟";
    if (pct >= 60) return "👏";
    if (pct >= 40) return "💪";
    return "📚";
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Feather name="arrow-left" size={20} color={C.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Association de mots</Text>
          </View>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Chargement des mots…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || matchItems.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Feather name="arrow-left" size={20} color={C.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Association de mots</Text>
          </View>
        </View>
        <View style={styles.centered}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>😕</Text>
          <Text style={styles.errorText}>{error || "Aucune donnée trouvée"}</Text>
          <Pressable style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (showResult) {
    const percentage = Math.round((score / totalPairs) * 100);
    const isGood = percentage >= 60;
    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const isPerfect = score === totalPairs && livesLost === 0;
    const earnedXp = Math.max(0, calculateXP("association", score, totalPairs, {
      perfectScore: isPerfect,
      timeSpent,
      streak: currentStreak,
    }).totalXP - xpPenalty);
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.resultScroll}>
          <View style={styles.resultCard}>
            <Text style={styles.resultEmoji}>{getScoreEmoji()}</Text>
            <Text style={styles.resultTitle}>
              {percentage === 100 ? "Parfait !" : isGood ? "Excellent !" : "Bien joué !"}
            </Text>
            <Text style={styles.resultSubtitle}>
              {score} paire{score > 1 ? "s" : ""} correcte{score > 1 ? "s" : ""} sur {totalPairs}
            </Text>
            <View style={[
              styles.resultCircle,
              { borderColor: isGood ? C.success : C.error, backgroundColor: isGood ? C.successBg : C.errorBg },
            ]}>
              <Text style={[styles.resultPercent, { color: isGood ? C.success : C.error }]}>
                {percentage}%
              </Text>
            </View>
            <View style={styles.xpBadge}>
              <Text style={{ fontSize: 20 }}>⭐</Text>
              <Text style={styles.xpBadgeText}>+{earnedXp} XP gagnés</Text>
            </View>
            {xpPenalty > 0 && (
              <View style={styles.penaltySummary}>
                <Text style={styles.penaltySummaryText}>
                  ❤️ −{livesLost} vie{livesLost > 1 ? "s" : ""}  ·  −{xpPenalty} XP (erreurs)
                </Text>
              </View>
            )}
            <View style={styles.resultBtnRow}>
              <Pressable style={styles.btnSecondary} onPress={handleContinue}>
                <Text style={styles.btnSecondaryText}>Terminer</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={resetGame}>
                <Text style={styles.btnPrimaryText}>Recommencer</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>

      {showPenaltyBanner && (
        <Animated.View style={[styles.penaltyBanner, { opacity: penaltyAnim }]}>
          <Text style={styles.penaltyTitle}>❤️ −1 vie · −{XP_PENALTY_PER_LIFE} XP</Text>
          <Text style={styles.penaltySub}>4 erreurs consécutives !</Text>
        </Animated.View>
      )}

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={C.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Association de mots</Text>
          <View style={styles.livesRow}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Text key={i} style={[styles.heart, { opacity: i < currentLives ? 1 : 0.2 }]}>❤️</Text>
            ))}
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeText}>{matchedLeft.length}/{totalPairs}</Text>
          </View>
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          {consecutiveErrors > 0 && (
            <View style={styles.streakRow}>
              {Array.from({ length: CONSECUTIVE_ERROR_THRESHOLD }).map((_, i) => (
                <View key={i} style={i < consecutiveErrors ? styles.streakDot : styles.streakDotEmpty} />
              ))}
              <Text style={styles.streakText}>
                encore {CONSECUTIVE_ERROR_THRESHOLD - consecutiveErrors} avant pénalité
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.board}>
        <Text style={styles.instructions}>Associe chaque mot à sa traduction</Text>

        <View style={styles.columns}>
          <View style={styles.column}>
            {leftColumn.map(({ item, originalIndex }) => {
              const isMatched = matchedLeft.includes(originalIndex);
              const isSelected = selectedLeft === originalIndex;
              const isError = errorLeft === originalIndex;
              return (
                <Pressable
                  key={`left-${originalIndex}`}
                  onPress={() => handleLeftSelect(originalIndex)}
                  disabled={isMatched}
                  style={[
                    styles.card,
                    isSelected && styles.cardSelected,
                    isMatched && styles.cardMatched,
                    isError && styles.cardError,
                  ]}
                >
                  <Text style={[
                    styles.cardTextLeft,
                    isSelected && styles.cardTextSelected,
                    isMatched && styles.cardTextMatched,
                    isError && styles.cardTextError,
                  ]}>
                    {item.word}
                  </Text>
                  {isMatched && (
                    <View style={styles.cardCheck}>
                      <Text style={styles.cardCheckText}>✓</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.column}>
            {rightColumn.map(({ item, originalIndex }, rightIndex) => {
              const isMatched = matchedRight.includes(rightIndex);
              const isSelected = selectedRight === rightIndex;
              const isError = errorRight === rightIndex;
              return (
                <Pressable
                  key={`right-${originalIndex}`}
                  onPress={() => handleRightSelect(rightIndex)}
                  disabled={isMatched}
                  style={[
                    styles.card,
                    isSelected && styles.cardSelected,
                    isMatched && styles.cardMatched,
                    isError && styles.cardError,
                  ]}
                >
                  <Text style={[
                    styles.cardTextRight,
                    isSelected && styles.cardTextSelected,
                    isMatched && styles.cardTextMatched,
                    isError && styles.cardTextError,
                  ]}>
                    {item.translation}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.hintRow}>
          <Feather name="info" size={16} color={C.xpText} />
          <Text style={styles.hintText}>
            Sélectionne un mot à gauche, puis sa traduction à droite
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
