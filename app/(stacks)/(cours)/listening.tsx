import { useListeningContent } from "@/hooks/useListening";
import { audioService } from "@/services/audio/audioService";
import { RootState } from "@/services/redux/store";
import { calculateXP } from "@/utils/xpCalculator";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

const IS_DEV = process.env.NODE_ENV === "development";

type OptionState = 'default' | 'selected' | 'correct' | 'wrong' | 'dimmed';

function getOptionState(
  optionIndex: number,
  selectedAnswer: number | null,
  showFeedback: boolean,
  correctIndex: number | undefined
): OptionState {
  if (!showFeedback) {
    return selectedAnswer === optionIndex ? 'selected' : 'default';
  }
  if (optionIndex === correctIndex) return 'correct';
  if (optionIndex === selectedAnswer && optionIndex !== correctIndex) return 'wrong';
  return 'dimmed';
}

export default function ListeningScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    moduleId?: string;
    moduleTitle?: string;
    courseId?: string;
    cmid?: string;
    instanceId?: string
  }>();
  const token = useSelector((state: RootState) => state.auth.token);

  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const cmid = parseInt(params.cmid || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);

  const { exercises, isLoading, error, refetch } = useListeningContent(
    token || '',
    moduleId,
    instanceId,
    courseId,
    cmid
  );

  const [currentExercise, setCurrentExercise] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    return () => {
      audioService.stop();
    };
  }, []);

  const exercise = exercises[currentExercise];
  const progress = exercises.length > 0 ? ((currentExercise + 1) / exercises.length) * 100 : 0;

  const handlePlayAudio = async () => {
    if (exercise?.audioUrl) {
      setIsPlaying(true);
      try {
        await audioService.playRemoteUrl(exercise.audioUrl, token || '');
        setIsPlaying(false);
      } catch (err) {
        if (IS_DEV) console.error('[Listening] Audio play failed:', err);
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(true);
      setTimeout(() => setIsPlaying(false), 2000);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (showFeedback) return;

    setSelectedAnswer(optionIndex);
    setShowFeedback(true);

    const isCorrect = optionIndex === exercise?.correctIndex;
    const newAnswers = [...answers, isCorrect];
    setAnswers(newAnswers);

    if (isCorrect) {
      setScore(prev => prev + 1);
    }
  };

  const handleContinue = () => {
    if (currentExercise < exercises.length - 1) {
      setTimeout(() => {
        setCurrentExercise(prev => prev + 1);
        setSelectedAnswer(null);
        setShowFeedback(false);
      }, 1500);
    } else {
      setShowResult(true);
    }
  };

  const handleFinish = () => {
    const iId = params.instanceId || params.moduleId || '0';
    const earnedXp = calculateXP('listening', score, exercises.length).totalXP;
    const resultParams = `?activity=Listening&score=${score}&total=${exercises.length}&xp=${earnedXp}&moduleId=${params.moduleId || ''}&instanceId=${iId}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Compréhension Orale')}&courseId=${params.courseId || ''}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ''}`)}`;
    router.push(`/(stacks)/(cours)/result${resultParams}` as any);
  };

  const handleRetry = () => {
    setCurrentExercise(0);
    setScore(0);
    setAnswers([]);
    setShowResult(false);
    setSelectedAnswer(null);
    setShowFeedback(false);
    refetch();
  };

  const getScoreEmoji = () => {
    const percentage = (score / (exercises.length || 1)) * 100;
    if (percentage === 100) return "🏆";
    if (percentage >= 80) return "🌟";
    if (percentage >= 60) return "👏";
    if (percentage >= 40) return "💪";
    return "📚";
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={styles.headerTitle}>Compréhension Orale</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#002366" />
          <Text style={styles.loadingText}>Chargement des exercices...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={styles.headerTitle}>Compréhension Orale</Text>
        </View>
        <View style={styles.centeredPadded}>
          <View style={styles.errorCard}>
            <Feather name="alert-circle" size={64} color="#EF4444" />
            <Text style={styles.errorTitle}>Impossible de charger les exercices</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable onPress={() => router.back()} style={styles.errorButton}>
              <Text style={styles.errorButtonText}>Retour</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (showResult) {
    const percentage = exercises.length > 0 ? Math.round((score / exercises.length) * 100) : 0;
    const resultColor = percentage >= 50 ? '#10B981' : '#EF4444';

    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.resultScrollContent}>
          <View style={styles.resultContainer}>
            <View style={styles.resultCard}>
              <Text style={styles.resultEmoji}>{getScoreEmoji()}</Text>
              <Text style={styles.resultTitle}>
                {percentage >= 50 ? "Bravo !" : "Continue tes efforts !"}
              </Text>
              <Text style={styles.resultSubtitle}>
                Tu as obtenu {score} bonnes réponses sur {exercises.length}
              </Text>

              <View style={[styles.resultCircle, { borderColor: resultColor, backgroundColor: resultColor + '10' }]}>
                <Text style={[styles.resultPercent, { color: resultColor }]}>{percentage}%</Text>
              </View>

              <View style={styles.xpTag}>
                <Text style={styles.xpTagStar}>⭐</Text>
                <Text style={styles.xpTagText}>+{calculateXP('listening', score, exercises.length).totalXP} XP gagnés</Text>
              </View>

              <View style={styles.resultButtonRow}>
                <Pressable onPress={handleFinish} style={styles.continueButton}>
                  <Text style={styles.continueButtonText}>Continuer</Text>
                </Pressable>
                <Pressable onPress={handleRetry} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Recommencer</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!exercise) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={styles.headerTitle}>Compréhension Orale</Text>
        </View>
        <View style={styles.centered}>
          <Feather name="music" size={64} color="#D1D5DB" />
          <Text style={styles.loadingText}>Aucun exercice disponible</Text>
          <Pressable onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{params.moduleTitle || 'Compréhension Orale'}</Text>
          <Text style={styles.headerSubtitle}>Exercice {currentExercise + 1}/{exercises.length}</Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreBadgeText}>{score} pts</Text>
        </View>
      </View>

      <View style={styles.progressBarSection}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` as any }]} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.audioCard}>
          <Text style={styles.audioInstruction}>Écoute le mot et choisis la bonne traduction</Text>

          <View style={styles.waveformRow}>
            {[...Array(18)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  { backgroundColor: isPlaying ? '#4a90e2' : '#d1d5db', height: isPlaying ? Math.floor(Math.random() * 32 + 12) : 12 }
                ]}
              />
            ))}
          </View>

          <Pressable onPress={handlePlayAudio} style={styles.playButton}>
            <Feather name={isPlaying ? "pause" : "play"} size={24} color="white" />
          </Pressable>

          <Text style={styles.wordText}>&ldquo;{exercise.word}&rdquo;</Text>
          <Text style={styles.courseNameText}>{exercise.courseName}</Text>
        </View>

        <Text style={styles.questionText}>Quelle est la bonne traduction en français ?</Text>

        <View style={styles.optionsList}>
          {exercise.options.map((option, index) => {
            const state = getOptionState(index, selectedAnswer, showFeedback, exercise?.correctIndex);
            return (
              <Pressable
                key={index}
                onPress={() => handleAnswer(index)}
                style={[
                  styles.optionButton,
                  state === 'default' && styles.optionDefault,
                  state === 'selected' && styles.optionSelected,
                  state === 'correct' && styles.optionCorrect,
                  state === 'wrong' && styles.optionWrong,
                  state === 'dimmed' && styles.optionDimmed,
                ]}
              >
                <View style={styles.optionRow}>
                  <Text style={[
                    styles.optionText,
                    state === 'selected' && styles.optionTextSelected,
                    state === 'correct' && styles.optionTextCorrect,
                    state === 'wrong' && styles.optionTextWrong,
                    state === 'dimmed' && styles.optionTextDimmed,
                  ]}>
                    {option}
                  </Text>
                  {showFeedback && index === exercise?.correctIndex && (
                    <Feather name="check-circle" size={24} color="#10B981" />
                  )}
                  {showFeedback && index === selectedAnswer && index !== exercise?.correctIndex && (
                    <Feather name="x-circle" size={24} color="#EF4444" />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {showFeedback && (
          <View style={[styles.feedbackBox, selectedAnswer === exercise?.correctIndex ? styles.feedbackCorrect : styles.feedbackWrong]}>
            <View style={styles.feedbackRow}>
              <Feather
                name={selectedAnswer === exercise?.correctIndex ? "check-circle" : "x-circle"}
                size={20}
                color={selectedAnswer === exercise?.correctIndex ? '#10B981' : '#EF4444'}
              />
              <Text style={[styles.feedbackText, selectedAnswer === exercise?.correctIndex ? styles.feedbackTextCorrect : styles.feedbackTextWrong]}>
                {selectedAnswer === exercise?.correctIndex ? 'Correct !' : 'Incorrect'}
              </Text>
            </View>
            {selectedAnswer !== exercise?.correctIndex && (
              <Text style={styles.feedbackAnswer}>
                La bonne réponse était : {exercise.options[exercise.correctIndex]}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          onPress={handleContinue}
          disabled={!showFeedback}
          style={[styles.continueBtn, showFeedback ? styles.continueBtnActive : styles.continueBtnDisabled]}
        >
          <Text style={styles.continueBtnText}>
            {currentExercise < exercises.length - 1 ? "Continuer" : "Voir les résultats"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF9F6' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
  },
  backButton: { marginRight: 16, padding: 8, marginLeft: -8 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  headerSubtitle: { color: '#6b7280', fontSize: 12 },
  scoreBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  scoreBadgeText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  progressBarSection: { paddingHorizontal: 20, marginBottom: 16 },
  progressBarBg: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  audioCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  audioInstruction: { color: '#6b7280', textAlign: 'center', marginBottom: 16 },
  waveformRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 64, marginBottom: 16 },
  waveBar: { width: 4, marginHorizontal: 2, borderRadius: 2 },
  playButton: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#002366',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  wordText: { textAlign: 'center', color: '#4b5563', fontWeight: '500', fontSize: 18, marginTop: 16, marginBottom: 8 },
  courseNameText: { textAlign: 'center', color: '#9ca3af', fontSize: 14 },
  questionText: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 16, textAlign: 'center' },
  optionsList: { gap: 12 },
  optionButton: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
  },
  optionDefault: { borderColor: '#e5e7eb', backgroundColor: '#ffffff' },
  optionSelected: { borderColor: '#002366', backgroundColor: 'rgba(0,35,102,0.1)' },
  optionCorrect: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  optionWrong: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  optionDimmed: { borderColor: '#e5e7eb', backgroundColor: '#ffffff', opacity: 0.5 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { fontSize: 18, fontWeight: '500', color: '#111827' },
  optionTextSelected: { color: '#002366' },
  optionTextCorrect: { color: '#15803d' },
  optionTextWrong: { color: '#b91c1c' },
  optionTextDimmed: { color: '#6b7280' },
  feedbackBox: {
    marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1,
  },
  feedbackCorrect: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  feedbackWrong: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  feedbackRow: { flexDirection: 'row', alignItems: 'center' },
  feedbackText: { marginLeft: 8, fontWeight: '500' },
  feedbackTextCorrect: { color: '#15803d' },
  feedbackTextWrong: { color: '#b91c1c' },
  feedbackAnswer: { color: '#4b5563', fontSize: 14, marginTop: 8 },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  continueBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  continueBtnActive: { backgroundColor: '#002366' },
  continueBtnDisabled: { backgroundColor: '#d1d5db' },
  continueBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 18 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centeredPadded: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  loadingText: { color: '#6b7280', marginTop: 16 },
  errorCard: {
    backgroundColor: '#fef2f2', borderRadius: 24, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: '#fecaca',
  },
  errorTitle: { fontSize: 20, fontWeight: 'bold', color: '#7f1d1d', marginTop: 16, textAlign: 'center' },
  errorBody: { color: '#b91c1c', textAlign: 'center', marginTop: 8, fontSize: 14 },
  errorButton: { backgroundColor: '#ef4444', borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12, marginTop: 24 },
  errorButtonText: { color: '#ffffff', fontWeight: 'bold' },
  resultScrollContent: { flexGrow: 1, paddingBottom: 120 },
  resultContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  resultCard: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: 32,
    alignItems: 'center', width: '100%', maxWidth: 360,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  resultEmoji: { fontSize: 56, marginBottom: 16 },
  resultTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8, textAlign: 'center' },
  resultSubtitle: { color: '#6b7280', textAlign: 'center', marginBottom: 24 },
  resultCircle: {
    width: 128, height: 128, borderRadius: 64, borderWidth: 8,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  resultPercent: { fontSize: 36, fontWeight: '900' },
  xpTag: {
    backgroundColor: '#fefce8', borderRadius: 12, paddingHorizontal: 24,
    paddingVertical: 12, marginBottom: 24, flexDirection: 'row', alignItems: 'center',
  },
  xpTagStar: { fontSize: 20, marginRight: 8 },
  xpTagText: { color: '#a16207', fontWeight: 'bold', fontSize: 18 },
  resultButtonRow: { flexDirection: 'row', width: '100%' },
  continueButton: { flex: 1, backgroundColor: '#e5e7eb', paddingVertical: 16, borderRadius: 12, marginRight: 8 },
  continueButtonText: { color: '#374151', fontWeight: 'bold', textAlign: 'center' },
  retryButton: { flex: 1, backgroundColor: '#4a90e2', paddingVertical: 16, borderRadius: 12, marginLeft: 8 },
  retryButtonText: { color: '#ffffff', fontWeight: 'bold', textAlign: 'center' },
});
