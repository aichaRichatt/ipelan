import { useListeningContent } from "@/hooks/useListening";
import { RootState } from "@/services/redux/store";
import { calculateXP } from "@/utils/xpCalculator";
import { Feather } from "@expo/vector-icons";
import { createAudioPlayer } from "expo-audio";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

const RATES      = [1.0, 1.5, 2.0, 0.5] as const;
type Rate        = typeof RATES[number];
const WAVE_COUNT = 18;

type OptionState = 'default' | 'selected' | 'correct' | 'wrong' | 'dimmed';

function getOptionState(
  idx: number, selected: number | null, showFeedback: boolean, correct?: number
): OptionState {
  if (!showFeedback) return selected === idx ? 'selected' : 'default';
  if (idx === correct)                          return 'correct';
  if (idx === selected && idx !== correct)      return 'wrong';
  return 'dimmed';
}

export default function ListeningScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    moduleId?: string; moduleTitle?: string; courseId?: string;
    cmid?: string; instanceId?: string;
  }>();

  const token  = useSelector((state: RootState) => state.auth.token);
  const streak = useSelector((state: RootState) => state.auth.user?.streak ?? 0);
  const startTimeRef = useRef(Date.now());

  const moduleId   = parseInt(params.moduleId   || '0', 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || '0', 10);
  const cmid       = parseInt(params.cmid       || '0', 10);
  const courseId   = parseInt(params.courseId   || '0', 10);

  const { exercises, isLoading, error } = useListeningContent(
    token || '', moduleId, instanceId, courseId, cmid
  );

  const [currentExercise, setCurrentExercise] = useState(0);
  const [score,           setScore]           = useState(0);
  const [selectedAnswer,  setSelectedAnswer]  = useState<number | null>(null);
  const [showFeedback,    setShowFeedback]    = useState(false);

  const exercise = exercises[currentExercise];
  const progress = exercises.length > 0
    ? ((currentExercise + 1) / exercises.length) * 100
    : 0;

  // ── Audio player ─────────────────────────────────────────────────────────
  const playerRef       = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackRate,   setPlaybackRate]   = useState<Rate>(1.0);

  // Waveform animée stable
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(WAVE_COUNT).fill(12));
  useEffect(() => {
    if (!isPlaying) { setWaveHeights(Array(WAVE_COUNT).fill(12)); return; }
    const iv = setInterval(() => {
      setWaveHeights(Array.from({ length: WAVE_COUNT }, () => Math.floor(Math.random() * 32 + 12)));
    }, 150);
    return () => clearInterval(iv);
  }, [isPlaying]);

  useEffect(() => {
    if (!exercise?.audioUrl) return;
    setIsLoadingAudio(true);
    setIsPlaying(false);
    const p = createAudioPlayer({ uri: exercise.audioUrl });
    playerRef.current = p;

    // expo-audio v1.1 : duration disponible une fois chargé
    const iv = setInterval(() => {
      try {
        const dur = (p as any).duration;
        if (typeof dur === 'number' && dur > 0) setIsLoadingAudio(false);
        if (!(p as any).playing) setIsPlaying(false);
      } catch {}
    }, 200);
    const timeout = setTimeout(() => setIsLoadingAudio(false), 3000);

    return () => {
      clearInterval(iv);
      clearTimeout(timeout);
      try { p.pause(); } catch {}
      try { p.remove(); } catch {}
      if (playerRef.current === p) playerRef.current = null;
    };
  }, [exercise?.audioUrl]);

  // Coupe l'audio immédiatement dès que l'écran perd le focus (back, swipe,
  // navigation vers un autre écran) — plus rapide que d'attendre le démontage
  // complet du composant, qui peut être retardé par l'animation de transition.
  useFocusEffect(
    useCallback(() => {
      return () => {
        try { playerRef.current?.pause(); } catch {}
        setIsPlaying(false);
      };
    }, [])
  );

  const handlePlayPause = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (isPlaying) { p.pause(); setIsPlaying(false); }
      else           { p.play();  setIsPlaying(true);  }
    } catch {}
  }, [isPlaying]);

  const handleReplay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try { p.seekTo(0); p.play(); setIsPlaying(true); } catch {}
  }, []);

  const cycleRate = useCallback(() => {
    const next = RATES[(RATES.indexOf(playbackRate) + 1) % RATES.length];
    setPlaybackRate(next);
    const p = playerRef.current;
    if (p) try { (p as any).setRate?.(next, true); } catch {}
  }, [playbackRate]);

  // ── Logique activité ─────────────────────────────────────────────────────
  const handleAnswer = (idx: number) => {
    if (showFeedback) return;
    setSelectedAnswer(idx);
    setShowFeedback(true);
    if (idx === exercise?.correctIndex) setScore(prev => prev + 1);
  };

  const handleContinue = () => {
    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      navigateToResult();
    }
  };

  const navigateToResult = () => {
    const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const earnedXp = calculateXP('listening', score, exercises.length, {
      perfectScore: score === exercises.length && exercises.length > 0,
      timeSpent: elapsedSeconds, streak,
    }).totalXP;
    const iId = params.instanceId || params.moduleId || '0';
    router.push(
      `/(stacks)/(cours)/result?activity=%C3%89coute&score=${score}&total=${exercises.length}&xp=${earnedXp}&moduleId=${params.moduleId || ''}&instanceId=${iId}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Compréhension Orale')}&courseId=${params.courseId || ''}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ''}`)}` as any
    );
  };

  // ── États chargement / erreur / vide ─────────────────────────────────────
  if (isLoading) return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader title="Compréhension Orale" onBack={() => router.back()} />
      <View style={s.centered}>
        <ActivityIndicator size="large" color={T.amber} />
        <Text style={s.loadingText}>Chargement des exercices…</Text>
      </View>
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader title="Compréhension Orale" onBack={() => router.back()} />
      <View style={s.centeredPad}>
        <View style={s.errorCard}>
          <View style={s.errorIconWrap}>
            <Feather name="alert-circle" size={32} color={T.error} />
          </View>
          <Text style={s.errorTitle}>Impossible de charger les exercices</Text>
          <Text style={s.errorBody}>{error}</Text>
          <Pressable onPress={() => router.back()} style={s.errorBtn}>
            <Text style={s.errorBtnText}>Retour au cours</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );

  if (!exercise) return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader title="Compréhension Orale" onBack={() => router.back()} />
      <View style={s.centered}>
        <Feather name="music" size={56} color={T.gray200} />
        <Text style={s.loadingText}>Aucun exercice disponible</Text>
        <Pressable onPress={() => router.back()} style={[s.errorBtn, { marginTop: 24 }]}>
          <Text style={s.errorBtnText}>Retour</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  // ── Écran principal ───────────────────────────────────────────────────────
  const audioDisabled = isLoadingAudio || !exercise.audioUrl;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader
        title={params.moduleTitle || 'Compréhension Orale'}
        subtitle={`Exercice ${currentExercise + 1} / ${exercises.length}`}
        onBack={() => router.back()}
      />

      {/* Barre de progression */}
      <View style={s.progressWrap}>
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${progress}%` as any }]} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Carte audio */}
        <View style={s.audioCard}>
          <Text style={s.audioInstruction}>Écoute et choisis la bonne traduction</Text>

          {/* Waveform */}
          <View style={s.waveRow}>
            {waveHeights.map((h, i) => (
              <View key={i} style={[s.waveBar, { height: h, backgroundColor: isPlaying ? T.amber : T.gray200 }]} />
            ))}
          </View>

          {/* Contrôles audio */}
          <View style={s.audioControls}>
            <Pressable onPress={handleReplay} disabled={audioDisabled}
              style={[s.ctrlBtn, audioDisabled && s.ctrlDisabled]}>
              <Feather name="rotate-ccw" size={20} color={T.textMid} />
            </Pressable>

            <Pressable onPress={handlePlayPause} disabled={audioDisabled}
              style={[s.playBtn, audioDisabled && s.playBtnDisabled]}>
              {isLoadingAudio
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" />}
            </Pressable>

            <Pressable onPress={cycleRate} disabled={audioDisabled}
              style={[s.ctrlBtn, audioDisabled && s.ctrlDisabled]}>
              <Text style={s.rateText}>{playbackRate}×</Text>
            </Pressable>
          </View>

          {exercise.word ? (
            <Text style={s.wordText}>&ldquo;{exercise.word}&rdquo;</Text>
          ) : null}
        </View>

        {/* Question */}
        <Text style={s.sectionLabel}>Quelle est la bonne traduction ?</Text>

        {/* Options */}
        <View style={s.optionsList}>
          {exercise.options.map((option, idx) => {
            const state = getOptionState(idx, selectedAnswer, showFeedback, exercise?.correctIndex);
            return (
              <Pressable
                key={idx}
                onPress={() => handleAnswer(idx)}
                style={[
                  s.optionBtn,
                  state === 'default'   && s.optDefault,
                  state === 'selected'  && s.optSelected,
                  state === 'correct'   && s.optCorrect,
                  state === 'wrong'     && s.optWrong,
                  state === 'dimmed'    && s.optDimmed,
                ]}
              >
                <View style={s.optionRow}>
                  <Text style={[
                    s.optionText,
                    state === 'selected' && s.optTextSelected,
                    state === 'correct'  && s.optTextCorrect,
                    state === 'wrong'    && s.optTextWrong,
                    state === 'dimmed'   && s.optTextDimmed,
                  ]}>
                    {option}
                  </Text>
                  {showFeedback && idx === exercise?.correctIndex && (
                    <Feather name="check-circle" size={22} color={T.success} />
                  )}
                  {showFeedback && idx === selectedAnswer && idx !== exercise?.correctIndex && (
                    <Feather name="x-circle" size={22} color={T.error} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Feedback */}
        {showFeedback && (
          <View style={[s.feedbackBox,
            selectedAnswer === exercise?.correctIndex ? s.feedbackOk : s.feedbackKo
          ]}>
            <Feather
              name={selectedAnswer === exercise?.correctIndex ? 'check-circle' : 'x-circle'}
              size={20}
              color={selectedAnswer === exercise?.correctIndex ? T.success : T.error}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[s.feedbackText,
                { color: selectedAnswer === exercise?.correctIndex ? T.successText : T.errorText }
              ]}>
                {selectedAnswer === exercise?.correctIndex ? 'Correct !' : 'Incorrect'}
              </Text>
              {selectedAnswer !== exercise?.correctIndex && (
                <Text style={s.feedbackAnswer}>
                  Bonne réponse : {exercise.options[exercise.correctIndex]}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Barre d'action fixe en bas */}
      <View style={s.bottomBar}>
        <Pressable
          onPress={handleContinue}
          disabled={!showFeedback}
          style={[s.actionBtn, showFeedback ? s.actionBtnActive : s.actionBtnDisabled]}
        >
          <Text style={s.actionBtnText}>
            {currentExercise < exercises.length - 1 ? 'Continuer' : 'Voir les résultats'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Sous-composant header ─────────────────────────────────────────────────
function ActivityHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} style={s.backBtn}>
        <Feather name="arrow-left" size={24} color={T.textMain} />
      </Pressable>
      <View style={s.headerInfo}>
        <Text style={s.headerTitle}>{title}</Text>
        {subtitle ? <Text style={s.headerSub}>{subtitle}</Text> : null}
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
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn:     { padding: 8, marginLeft: -8, marginRight: 12 },
  headerInfo:  { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: T.textMain },
  headerSub:   { fontSize: 12, color: T.textSub, marginTop: 2 },

  // Progress bar
  progressWrap: { paddingHorizontal: 20, marginBottom: 16 },
  progressBg:   { height: 8, backgroundColor: T.gray200, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: T.amber, borderRadius: 4 },

  // Scroll
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },

  // Audio card
  audioCard: {
    backgroundColor: T.card, borderRadius: 24, padding: 24,
    marginBottom: 24, borderWidth: 1, borderColor: T.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  audioInstruction: { color: T.textSub, textAlign: 'center', marginBottom: 16, fontSize: 14 },
  waveRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 64, marginBottom: 16 },
  waveBar:  { width: 4, marginHorizontal: 2, borderRadius: 2 },
  audioControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginVertical: 8 },
  ctrlBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: T.gray100, alignItems: 'center', justifyContent: 'center',
  },
  ctrlDisabled: { opacity: 0.4 },
  playBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: T.amber, alignItems: 'center', justifyContent: 'center',
  },
  playBtnDisabled: { opacity: 0.5 },
  rateText: { fontSize: 13, fontWeight: 'bold', color: T.textMid },
  wordText: { textAlign: 'center', color: T.textMid, fontWeight: '500', fontSize: 17, marginTop: 14 },

  // Section label
  sectionLabel: { fontSize: 17, fontWeight: 'bold', color: T.textMain, marginBottom: 16, textAlign: 'center' },

  // Options
  optionsList: { gap: 12, marginBottom: 16 },
  optionBtn: { padding: 16, borderRadius: 16, borderWidth: 2 },
  optDefault:  { borderColor: T.border,   backgroundColor: T.card },
  optSelected: { borderColor: T.primary,  backgroundColor: 'rgba(0,35,102,0.08)' },
  optCorrect:  { borderColor: T.success,  backgroundColor: T.successBg },
  optWrong:    { borderColor: T.error,    backgroundColor: T.errorBg },
  optDimmed:   { borderColor: T.border,   backgroundColor: T.card, opacity: 0.5 },
  optionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText:       { fontSize: 16, fontWeight: '500', color: T.textMain, flex: 1 },
  optTextSelected:  { color: T.primary },
  optTextCorrect:   { color: T.successText },
  optTextWrong:     { color: T.errorText },
  optTextDimmed:    { color: T.textSub },

  // Feedback
  feedbackBox:   { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 14, marginBottom: 16 },
  feedbackOk:    { backgroundColor: T.successBg },
  feedbackKo:    { backgroundColor: T.errorBg },
  feedbackText:  { fontWeight: 'bold', fontSize: 15 },
  feedbackAnswer: { color: T.textMid, fontSize: 13, marginTop: 4 },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.card,
  },
  actionBtn:         { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  actionBtnActive:   { backgroundColor: T.primary },
  actionBtnDisabled: { backgroundColor: T.gray200 },
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
});
