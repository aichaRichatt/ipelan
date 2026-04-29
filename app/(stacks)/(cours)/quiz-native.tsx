import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '@/services/redux/store';
import { fetchAllQuizQuestions, getOrCreateAttempt, finishQuizAttempt, saveQuizAnswers, ParsedQuestion } from '@/services/api/quizService';

const IS_DEV = process.env.NODE_ENV === 'development';

export default function QuizNativePage() {
  const params = useLocalSearchParams<{
    quizId?: string;
    instanceId?: string;
    courseId?: string;
    moduleTitle?: string;
  }>();

  const token = useSelector((state: RootState) => state.auth.token);
  const router = useRouter();

  const quizId = parseInt(params.instanceId || '0', 10);
  const courseId = parseInt(params.courseId || '0', 10);
  const cmid = parseInt(params.quizId || '0', 10);

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sequenceChecks, setSequenceChecks] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadQuiz();
  }, [quizId, token]);

  const loadQuiz = async () => {
    if (!quizId || !token) {
      setError('Quiz ID ou token manquant');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (IS_DEV) {
        console.log('[QuizNative] Starting quiz load for instanceId:', quizId);
      }

      // 1. Create or get existing attempt
      const attempt = await getOrCreateAttempt(token, quizId);
      if (!attempt) {
        throw new Error('Impossible de démarrer le quiz. Vérifiez que vous êtes inscrit au cours.');
      }

      if (IS_DEV) {
        console.log('[QuizNative] Got attempt ID:', attempt);
      }

      setAttemptId(attempt);

      // 2. Fetch all questions
      const questionsData = await fetchAllQuizQuestions(token, attempt);
      
      if (IS_DEV) {
        console.log('[QuizNative] Fetched', questionsData.length, 'questions');
        console.log('[QuizNative] Questions:', JSON.stringify(questionsData, null, 2));
      }

      if (questionsData.length === 0) {
        throw new Error('Aucune question trouvée dans ce quiz.');
      }

      setQuestions(questionsData);

      // Initialize sequence checks
      const checks: Record<number, number> = {};
      questionsData.forEach(q => {
        checks[q.slot] = q.sequencecheck;
      });
      setSequenceChecks(checks);

    } catch (err: any) {
      console.error('[QuizNative] Error loading quiz:', err);
      setError(err.message || 'Erreur lors du chargement du quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (inputName: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [inputName]: value
    }));
  };

  const handleNext = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    
    // Check if answer is selected
    const answerSelected = currentQuestion.options.some(opt => answers[opt.inputName]);
    if (!answerSelected) {
      Alert.alert('Sélectionnez une réponse', 'Veuillez choisir une réponse avant de continuer.');
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Last question - finish quiz
      await handleFinish();
    }
  };

  const handleFinish = async () => {
    if (!attemptId || !token) return;

    setIsSubmitting(true);
    try {
      if (IS_DEV) {
        console.log('[QuizNative] Finishing quiz with answers:', answers);
      }

      // Save all answers first
      await saveQuizAnswers(token, attemptId, answers, sequenceChecks);

      // Finish the attempt
      const finished = await finishQuizAttempt(token, attemptId, answers, sequenceChecks);

      if (finished) {
        // Navigate to results
        const score = calculateScore();
        const maxScore = questions.length;
        const xp = Math.round((score / maxScore) * 50);

        const resultParams = `?activity=Quiz&score=${score}&total=${maxScore}&xp=${xp}&moduleId=${cmid}&instanceId=${quizId}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Quiz')}&courseId=${courseId}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${courseId}`)}`;
        router.push(`/(stacks)/(cours)/result${resultParams}` as any);
      } else {
        Alert.alert('Erreur', 'Impossible de terminer le quiz. Réessayez.');
      }
    } catch (err: any) {
      console.error('[QuizNative] Error finishing quiz:', err);
      Alert.alert('Erreur', err.message || 'Erreur lors de la soumission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateScore = () => {
    // Simple scoring - count answered questions
    // In a real implementation, you'd verify correct answers
    return Object.keys(answers).length;
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text className="mt-4 text-gray-500">Chargement du quiz...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <Feather name="alert-circle" size={48} color="#F59E0B" />
          <Text className="mt-4 text-xl font-bold text-gray-900 text-center">
            Erreur
          </Text>
          <Text className="mt-2 text-gray-500 text-center">{error}</Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 bg-[#4a90e2] px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold">Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Feather name="x" size={24} color="#374151" />
        </Pressable>
        <Text className="text-lg font-bold text-[#002366]">Question {currentQuestionIndex + 1}/{questions.length}</Text>
        <View className="w-10" />
      </View>

      {/* Progress bar */}
      <View className="h-2 bg-gray-200">
        <View 
          className="h-full bg-[#4a90e2]" 
          style={{ width: `${progress}%` }}
        />
      </View>

      <ScrollView className="flex-1 px-4 py-6">
        {currentQuestion && (
          <View className="bg-white rounded-2xl p-6 shadow-sm">
            {/* Question text */}
            <Text className="text-xl font-bold text-gray-900 mb-6">
              {currentQuestion.text}
            </Text>

            {/* Options */}
            <View className="space-y-3">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = answers[option.inputName] === option.value;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => handleAnswerSelect(option.inputName, option.value)}
                    className={`p-4 rounded-xl border-2 ${
                      isSelected 
                        ? 'border-[#4a90e2] bg-blue-50' 
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <Text className={`font-medium ${isSelected ? 'text-[#4a90e2]' : 'text-gray-700'}`}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom button */}
      <View className="p-4 bg-white border-t border-gray-100">
        <Pressable
          onPress={handleNext}
          disabled={isSubmitting}
          className={`py-4 rounded-xl ${
            isSubmitting ? 'bg-gray-300' : 'bg-[#4a90e2]'
          }`}
        >
          <Text className="text-white text-center font-bold text-lg">
            {isSubmitting 
              ? 'Envoi...' 
              : currentQuestionIndex === questions.length - 1 
                ? 'Terminer' 
                : 'Suivant'
            }
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
