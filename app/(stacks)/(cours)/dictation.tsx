import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { DictationData, useActivityContent } from "../../../hooks/useActivityContent";
import { audioService } from "../../../services/audio/audioService";
import { RootState } from "../../../services/redux/store";
import { calculateXP } from "../../../utils/xpCalculator";

const EMPTY_DICTATION: DictationData = {
  id: 0,
  title: "Aucune dictée",
  words: [],
};

export default function DictationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    moduleId?: string;
    moduleTitle?: string;
    courseId?: string;
    returnRoute?: string;
    cmid?: string;
    instanceId?: string;
  }>();

  const token = useSelector((state: RootState) => state.auth.token);
  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const cmid = parseInt(params.cmid || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);

  const { dictation, isLoading, error } = useActivityContent(
    token || '',
    moduleId,
    instanceId,
    'assign',
    cmid || instanceId,
    courseId,
    params.moduleTitle
  );

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Array<{ word: string; correct: boolean }>>([]);

  const currentDictation = dictation?.words?.length ? dictation : null;
  const words = currentDictation?.words || [];
  const currentWord = words[currentWordIndex] || { word: "", hint: "" };
  const progress = words.length > 0 ? ((currentWordIndex + 1) / words.length) * 100 : 0;
  const totalWords = words.length;

  useEffect(() => {
    return () => {
      audioService.stop();
    };
  }, []);

  const handlePlayAudio = async () => {
    if (dictation?.audioUrl) {
      setIsPlaying(true);
      try {
        await audioService.playRemoteUrl(dictation.audioUrl, token || '');
        setIsPlaying(false);
      } catch {
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(true);
      try {
        await audioService.playWord();
        setIsPlaying(false);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const normalizeText = (text: string) =>
    text.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const checkAnswer = () => {
    const isCorrect = normalizeText(userInput) === normalizeText(currentWord.word);
    setCurrentAnswer(isCorrect);

    const finalScore = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(finalScore);
    }

    setAnswers(prev => [...prev, { word: currentWord.word, correct: isCorrect }]);

    setTimeout(() => {
      if (currentWordIndex < totalWords - 1) {
        setCurrentWordIndex(prev => prev + 1);
        setUserInput("");
        setCurrentAnswer(null);
      } else {
        navigateToResult(finalScore);
      }
    }, 1500);
  };

  const navigateToResult = (finalScore: number) => {
    const totalQuestions = totalWords;
    const earnedXp = calculateXP('dictation', finalScore, totalQuestions).totalXP;
    const returnRoute = params.returnRoute || `/(stacks)/(cours)/${params.courseId}`;
    const iId = params.instanceId || params.moduleId || '0';

    router.push({
      pathname: "/(stacks)/(cours)/result",
      params: {
        activity: "Dictée audio",
        score: finalScore.toString(),
        total: totalQuestions.toString(),
        xp: earnedXp.toString(),
        courseId: params.courseId || '',
        moduleId: params.moduleId || '',
        instanceId: iId,
        moduleTitle: params.moduleTitle || '',
        returnRoute: encodeURIComponent(returnRoute),
      }
    } as any);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={styles.headerTitle}>Dictée audio</Text>
        </View>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#002366" />
          <Text style={styles.loadingText}>Chargement depuis Moodle...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || (!dictation && !EMPTY_DICTATION.words.length)) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={styles.headerTitle}>Dictée audio</Text>
        </View>
        <View style={styles.centeredPadded}>
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrapper}>
              <Feather name="alert-circle" size={32} color="#EF4444" />
            </View>
            <Text style={styles.errorTitle}>
              Aucune activité trouvée
            </Text>
            <Text style={styles.errorBody}>
              Ce contenu n&apos;est pas disponible sur Moodle.{'\n'}
              {error && `Erreur: ${error}`}
            </Text>
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Text style={styles.backBtnText}>Retour au cours</Text>
            </Pressable>
          </View>
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
          <Text style={styles.headerTitle}>Dictée audio</Text>
          <Text style={styles.headerSubtitle}>
            Mot {currentWordIndex + 1}/{totalWords}
          </Text>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.audioCard}>
          <Text style={styles.audioCardInstruction}>Écoute le mot et écris-le</Text>

          <View style={styles.waveformRow}>
            {[...Array(18)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  { backgroundColor: isPlaying ? '#F59E0B' : '#d1d5db', height: isPlaying ? Math.floor(Math.random() * 32 + 12) : 12 }
                ]}
              />
            ))}
          </View>

          <Pressable
            onPress={handlePlayAudio}
            style={styles.playButton}
          >
            <Feather name={isPlaying ? "pause" : "volume-2"} size={24} color="white" />
          </Pressable>

          <Text style={styles.hintText}>
            Indice : {currentWord.hint}
          </Text>
        </View>

        <Text style={styles.inputInstruction}>
          Écris le mot que tu as entendu
        </Text>

        <View style={styles.inputWrapper}>
          <TextInput
            value={userInput}
            onChangeText={setUserInput}
            placeholder="Écris ici..."
            placeholderTextColor="#9CA3AF"
            style={styles.textInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {currentAnswer !== null && (
          <View style={[styles.feedbackBox, currentAnswer ? styles.feedbackCorrect : styles.feedbackWrong]}>
            <View style={styles.feedbackRow}>
              <Feather
                name={currentAnswer ? "check-circle" : "x-circle"}
                size={24}
                color={currentAnswer ? "#10B981" : "#EF4444"}
              />
              <Text style={[styles.feedbackText, currentAnswer ? styles.feedbackTextCorrect : styles.feedbackTextWrong]}>
                {currentAnswer ? "Correct !" : `La bonne réponse était : ${currentWord.word}`}
              </Text>
            </View>
          </View>
        )}

        <Pressable
          onPress={checkAnswer}
          disabled={!userInput.trim() || currentAnswer !== null}
          style={[styles.verifyButton, (userInput.trim() && currentAnswer === null) ? styles.verifyButtonActive : styles.verifyButtonDisabled]}
        >
          <Text style={styles.verifyButtonText}>Vérifier</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    marginLeft: -8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    color: '#6b7280',
    fontSize: 12,
  },
  scoreBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  scoreBadgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  progressBarSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
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
  audioCardInstruction: {
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 64,
    marginBottom: 16,
  },
  waveBar: {
    width: 4,
    marginHorizontal: 2,
    borderRadius: 2,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  hintText: {
    textAlign: 'center',
    color: '#4b5563',
    fontSize: 14,
    marginTop: 16,
    fontStyle: 'italic',
  },
  inputInstruction: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textInput: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  feedbackBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  feedbackCorrect: {
    backgroundColor: '#f0fdf4',
  },
  feedbackWrong: {
    backgroundColor: '#fef2f2',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackText: {
    marginLeft: 12,
    fontWeight: 'bold',
  },
  feedbackTextCorrect: {
    color: '#15803d',
  },
  feedbackTextWrong: {
    color: '#b91c1c',
  },
  verifyButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  verifyButtonActive: {
    backgroundColor: '#002366',
  },
  verifyButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  verifyButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#6b7280',
  },
  centeredPadded: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  errorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  errorIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  backBtn: {
    backgroundColor: '#002366',
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  backBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
