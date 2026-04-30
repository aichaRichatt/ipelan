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

import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useQuiz } from '@/hooks/useQuiz';
import { RootState } from '@/services/redux/store';

const IS_DEV = process.env.NODE_ENV === 'development';

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

  // Résolution multi-alias des paramètres
  const cmid = parseInt(params.cmid || params.quizId || params.moduleId || '0', 10);
  const instanceId = parseInt(params.instanceId || '0', 10);
  const courseId = parseInt(params.courseId || '0', 10);
  const title = params.moduleTitle || 'Quiz';

  const {
    questions,
    currentIndex,
    selectedValue,
    answers,
    isLoading,
    isSaving,
    error,
    score,
    isComplete,
    isLastQuestion,
    quizName,
    selectAnswer,
    submitAnswer,
    nextQuestion,
    finishQuiz,
    reload,
  } = useQuiz(token, cmid, courseId, instanceId);

  const currentQuestion = questions[currentIndex];

  // ─── États de chargement/erreur ─────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text className="mt-4 text-gray-500">Chargement du quiz…</Text>
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
            Quiz indisponible
          </Text>
          <Text className="mt-2 text-gray-500 text-center">{error}</Text>
          <View className="flex-row mt-6">
            <Pressable
              onPress={() => router.back()}
              className="bg-gray-200 px-6 py-3 rounded-xl mr-2"
            >
              <Text className="text-gray-700 font-bold">Retour</Text>
            </Pressable>
            <Pressable
              onPress={() => reload()}
              className="bg-[#4a90e2] px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-bold">Réessayer</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Aucune question disponible.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progress = ((currentIndex + 1) / questions.length) * 100;

  // Pour multichoice/truefalse : la réponse est sélectionnée si la valeur
  // courante (selectedValue) ou une valeur déjà sauvée correspond.
  const savedValueForQuestion =
    currentQuestion.answerInputName
      ? answers[currentQuestion.answerInputName]
      : undefined;

  const effectiveSelected = selectedValue ?? savedValueForQuestion ?? null;

  // ─── Action : valider la question puis passer à la suivante ─────────────

  const handleNext = async () => {
    if (effectiveSelected === null || effectiveSelected === undefined) {
      Alert.alert('Sélectionne une réponse', 'Choisis une option avant de continuer.');
      return;
    }

    // Si la réponse n'est pas encore sauvegardée → submitAnswer
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

    const xp = Math.max(0, Math.round(finalScore.percentage * 0.5));
    const resultParams = new URLSearchParams({
      activity: 'Quiz',
      score: String(finalScore.correct),
      total: String(finalScore.total),
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
        onPress={() => selectAnswer(option.value)}
        disabled={isSaving}
        className={`p-4 rounded-xl border-2 mb-3 ${
          isSelected
            ? 'border-[#4a90e2] bg-blue-50'
            : 'border-gray-200 bg-white'
        }`}
      >
        <View className="flex-row items-center">
          <View
            className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
              isSelected ? 'border-[#4a90e2] bg-[#4a90e2]' : 'border-gray-300'
            }`}
          >
            {isSelected && <Feather name="check" size={14} color="white" />}
          </View>
          <Text
            className={`flex-1 font-medium ${
              isSelected ? 'text-[#4a90e2]' : 'text-gray-800'
            }`}
          >
            {option.label}
          </Text>
        </View>
      </Pressable>
    );
  };

  // ─── Rendu principal ─────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Feather name="x" size={24} color="#374151" />
        </Pressable>
        <View className="items-center">
          <Text className="text-base font-bold text-[#002366]" numberOfLines={1}>
            {quizName || title}
          </Text>
          <Text className="text-xs text-gray-500">
            Question {currentIndex + 1} / {questions.length}
          </Text>
        </View>
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
        <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {/* Énoncé */}
          <Text className="text-xl font-bold text-gray-900 mb-6">
            {currentQuestion.text || 'Question'}
          </Text>

          {/* Options multichoice / truefalse */}
          {(currentQuestion.type === 'multichoice' ||
            currentQuestion.type === 'truefalse') &&
            currentQuestion.options.length > 0 && (
              <View>{currentQuestion.options.map(renderOption)}</View>
            )}

          {/* Type non géré côté UI native */}
          {currentQuestion.type !== 'multichoice' &&
            currentQuestion.type !== 'truefalse' && (
              <View className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <View className="flex-row items-start">
                  <Feather name="info" size={20} color="#F59E0B" />
                  <Text className="ml-2 flex-1 text-sm text-amber-800">
                    Ce type de question (
                    <Text className="font-bold">{currentQuestion.type}</Text>
                    ) n'est pas encore pris en charge par l'UI native.
                    Tu peux la passer pour continuer le quiz.
                  </Text>
                </View>
              </View>
            )}

          {/* Indicateur de sauvegarde */}
          {isSaving && (
            <View className="mt-4 flex-row items-center justify-center">
              <ActivityIndicator size="small" color="#4a90e2" />
              <Text className="ml-2 text-sm text-gray-500">
                Synchronisation…
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bouton bas */}
      <View className="p-4 bg-white border-t border-gray-100">
        <Pressable
          onPress={handleNext}
          disabled={isSaving}
          className={`py-4 rounded-xl ${
            isSaving ? 'bg-gray-300' : 'bg-[#4a90e2]'
          }`}
        >
          <Text className="text-white text-center font-bold text-lg">
            {isSaving
              ? 'Envoi…'
              : isLastQuestion
                ? 'Terminer le quiz'
                : 'Suivant'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
