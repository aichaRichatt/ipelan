import { Feather } from "@expo/vector-icons";
import { createAudioPlayer } from "expo-audio";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { useActivityContent } from "../../../hooks/useActivityContent";
import { RootState } from "../../../services/redux/store";
import { normalizeAnswer } from "../../../utils/contentMapper";
import { calculateXP } from "../../../utils/xpCalculator";

// ── Design tokens (partagés avec tous les écrans d'activité) ──────────────
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

const RATES = [1.0, 1.5, 2.0, 0.5] as const;
type Rate = typeof RATES[number];
const WAVE_COUNT = 18;

export default function DictationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    moduleId?: string; moduleTitle?: string; courseId?: string;
    returnRoute?: string; cmid?: string; instanceId?: string;
  }>();

  const token  = useSelector((state: RootState) => state.auth.token);
  const streak = useSelector((state: RootState) => state.auth.user?.streak ?? 0);
  const startTimeRef = useRef(Date.now());

  const moduleId   = parseInt(params.moduleId   || '0', 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || '0', 10);
  const cmid       = parseInt(params.cmid       || '0', 10);
  const courseId   = parseInt(params.courseId   || '0', 10);

  const { dictation, isLoading, error } = useActivityContent(
    token || '', moduleId, instanceId, 'assign',
    cmid || instanceId, courseId, params.moduleTitle
  );

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userInput,        setUserInput]        = useState('');
  const [score,            setScore]            = useState(0);
  const [currentAnswer,    setCurrentAnswer]    = useState<boolean | null>(null);
  const [targetLanguage,   setTargetLanguage]   = useState<string | undefined>(undefined);

  useEffect(() => {
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.getItem('@ipelan_preferences').then(raw => {
        if (raw) { try { setTargetLanguage(JSON.parse(raw)?.language); } catch {} }
      });
    });
  }, []);

  const words       = dictation?.words?.length ? dictation.words : [];
  const currentWord = words[currentWordIndex] || { word: '', hint: '' };
  const progress    = words.length > 0
    ? (currentAnswer !== null ? (currentWordIndex + 1) : currentWordIndex) / words.length * 100
    : 0;
  const totalWords  = words.length;

  // ── Audio player ─────────────────────────────────────────────────────────
  const playerRef       = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackRate,   setPlaybackRate]   = useState<Rate>(1.0);

  // Waveform animée (interval stable — évite la boucle de re-render)
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(WAVE_COUNT).fill(12));
  useEffect(() => {
    if (!isPlaying) { setWaveHeights(Array(WAVE_COUNT).fill(12)); return; }
    const iv = setInterval(() => {
      setWaveHeights(Array.from({ length: WAVE_COUNT }, () => Math.floor(Math.random() * 32 + 12)));
    }, 150);
    return () => clearInterval(iv);
  }, [isPlaying]);

  // Crée le player quand l'URL audio est disponible
  useEffect(() => {
    if (!dictation?.audioUrl) return;
    setIsLoadingAudio(true);
    setIsPlaying(false);
    const p = createAudioPlayer({ uri: dictation.audioUrl });
    playerRef.current = p;

    // expo-audio v1.1 : vérifier duration (pas isLoaded qui n'existe pas)
    const iv = setInterval(() => {
      try {
        const dur = (p as any).duration;
        if (typeof dur === 'number' && dur > 0) setIsLoadingAudio(false);
        if (!(p as any).playing) setIsPlaying(false);
      } catch {}
    }, 200);
    // Filet de sécurité : activer le bouton après 3 s même si duration échoue
    const timeout = setTimeout(() => setIsLoadingAudio(false), 3000);

    return () => {
      clearInterval(iv);
      clearTimeout(timeout);
      try { p.pause(); } catch {}
      try { p.remove(); } catch {}
      if (playerRef.current === p) playerRef.current = null;
    };
  }, [dictation?.audioUrl]);

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
  const checkAnswer = () => {
    const isCorrect = normalizeAnswer(userInput, targetLanguage) === normalizeAnswer(currentWord.word, targetLanguage);
    setCurrentAnswer(isCorrect);
    const finalScore = isCorrect ? score + 1 : score;
    if (isCorrect) setScore(finalScore);
    setTimeout(() => {
      if (currentWordIndex < totalWords - 1) {
        setCurrentWordIndex(prev => prev + 1);
        setUserInput('');
        setCurrentAnswer(null);
      } else {
        navigateToResult(finalScore);
      }
    }, 1500);
  };

  const navigateToResult = (finalScore: number) => {
    const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const earnedXp = calculateXP('dictation', finalScore, totalWords, {
      perfectScore: finalScore === totalWords && totalWords > 0,
      timeSpent: elapsedSeconds, streak,
    }).totalXP;
    const returnRoute = params.returnRoute || `/(stacks)/(cours)/${params.courseId}`;
    router.replace({
      pathname: '/(stacks)/(cours)/result',
      params: {
        activity: 'Dictée audio',
        score: finalScore.toString(), total: totalWords.toString(),
        xp: earnedXp.toString(), courseId: params.courseId || '',
        moduleId: params.moduleId || '',
        instanceId: params.instanceId || params.moduleId || '0',
        moduleTitle: params.moduleTitle || '',
        returnRoute: encodeURIComponent(returnRoute),
      },
    } as any);
  };

  // ── États chargement / erreur ─────────────────────────────────────────────
  if (isLoading) return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader title="Dictée audio" onBack={() => router.back()} />
      <View style={s.centered}>
        <ActivityIndicator size="large" color={T.amber} />
        <Text style={s.loadingText}>Chargement depuis Moodle…</Text>
      </View>
    </SafeAreaView>
  );

  if (error || !words.length) return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader title="Dictée audio" onBack={() => router.back()} />
      <View style={s.centeredPad}>
        <View style={s.errorCard}>
          <View style={s.errorIconWrap}>
            <Feather name="alert-circle" size={32} color={T.error} />
          </View>
          <Text style={s.errorTitle}>Aucune activité trouvée</Text>
          <Text style={s.errorBody}>
            Ce contenu n&apos;est pas disponible.{error ? `\n${error}` : ''}
          </Text>
          <Pressable onPress={() => router.back()} style={s.errorBtn}>
            <Text style={s.errorBtnText}>Retour au cours</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );

  // ── Écran principal ───────────────────────────────────────────────────────
  const audioDisabled = isLoadingAudio || !dictation?.audioUrl;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ActivityHeader
        title="Dictée audio"
        subtitle={totalWords > 1 ? `Mot ${currentWordIndex + 1} / ${totalWords}` : undefined}
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
          <Text style={s.audioInstruction}>{dictation?.instructions ?? 'Écoute le mot et écris-le'}</Text>

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

          {currentWord.hint ? (
            <Text style={s.hintText}>Indice : {currentWord.hint}</Text>
          ) : null}
        </View>

        {/* Saisie */}
        <Text style={s.sectionLabel}>Écris ce que tu as entendu</Text>
        <View style={s.inputBox}>
          <TextInput
            value={userInput}
            onChangeText={setUserInput}
            placeholder="Écris ici…"
            placeholderTextColor={T.gray400}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Feedback */}
        {currentAnswer !== null && (
          <View style={[s.feedbackBox, currentAnswer ? s.feedbackOk : s.feedbackKo]}>
            <Feather
              name={currentAnswer ? 'check-circle' : 'x-circle'}
              size={22}
              color={currentAnswer ? T.success : T.error}
            />
            <Text style={[s.feedbackText, { color: currentAnswer ? T.successText : T.errorText }]}>
              {currentAnswer ? 'Correct !' : `Réponse : ${currentWord.word}`}
            </Text>
          </View>
        )}

        {/* Bouton vérifier */}
        <Pressable
          onPress={checkAnswer}
          disabled={!userInput.trim() || currentAnswer !== null}
          style={[s.actionBtn, (userInput.trim() && currentAnswer === null) ? s.actionBtnActive : s.actionBtnDisabled]}
        >
          <Text style={s.actionBtnText}>Vérifier</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sous-composant header commun ──────────────────────────────────────────
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
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn:    { padding: 8, marginLeft: -8, marginRight: 12 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: T.textMain },
  headerSub:   { fontSize: 12, color: T.textSub, marginTop: 2 },

  // Progress bar
  progressWrap: { paddingHorizontal: 20, marginBottom: 16 },
  progressBg:   { height: 8, backgroundColor: T.gray200, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: T.amber, borderRadius: 4 },

  // Scroll
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  // Audio card
  audioCard: {
    backgroundColor: T.card, borderRadius: 24, padding: 24,
    marginBottom: 24, borderWidth: 1, borderColor: T.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  audioInstruction: { color: T.textSub, textAlign: 'center', marginBottom: 16, fontSize: 14 },

  // Waveform
  waveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 64, marginBottom: 16 },
  waveBar: { width: 4, marginHorizontal: 2, borderRadius: 2 },

  // Audio controls
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
  hintText: { textAlign: 'center', color: T.textMid, fontSize: 13, marginTop: 14, fontStyle: 'italic' },

  // Input
  sectionLabel: { fontSize: 17, fontWeight: 'bold', color: T.textMain, marginBottom: 12, textAlign: 'center' },
  inputBox: {
    backgroundColor: T.card, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: T.border,
  },
  input: { color: T.textMain, fontSize: 18, fontWeight: '500', textAlign: 'center' },

  // Feedback
  feedbackBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 16, gap: 10 },
  feedbackOk:  { backgroundColor: T.successBg },
  feedbackKo:  { backgroundColor: T.errorBg },
  feedbackText: { fontWeight: 'bold', fontSize: 15, flex: 1 },

  // Action button
  actionBtn:         { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  actionBtnActive:   { backgroundColor: T.primary },
  actionBtnDisabled: { backgroundColor: T.gray200 },
  actionBtnText:     { color: '#fff', fontWeight: 'bold', fontSize: 17 },

  // Error
  errorCard: {
    backgroundColor: T.card, borderRadius: 24, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: T.border,
    width: '100%',
  },
  errorIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: T.errorBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  errorTitle: { fontSize: 18, fontWeight: 'bold', color: T.textMain, marginBottom: 8, textAlign: 'center' },
  errorBody:  { color: T.textSub, textAlign: 'center', marginBottom: 24, fontSize: 14 },
  errorBtn:   { backgroundColor: T.primary, borderRadius: 24, paddingHorizontal: 32, paddingVertical: 12 },
  errorBtnText: { color: '#fff', fontWeight: 'bold' },
});
