import QuizWebView from "@/components/quiz/QuizWebView";
import { RootState } from "@/services/redux/store";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { useSelector } from "react-redux";

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Quiz WebView Page
 * 
 * This page loads a Moodle quiz inside a WebView with:
 * - Auto-authentication
 * - Mobile-friendly UI (Duolingo-style)
 * - Progress tracking
 * - Completion detection
 * 
 * URL Parameters:
 * - quizId: The cmid of the quiz module (e.g., 772)
 * - courseId: Optional course ID for context
 * - moduleTitle: Optional title to display
 */
export default function QuizWebViewPage() {
  const params = useLocalSearchParams<{
    quizId?: string;
    courseId?: string;
    moduleTitle?: string;
  }>();

  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);

  const router = useRouter();
  const quizId = parseInt(params.quizId || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);

  if (!quizId) {
    return (
      <View className="flex-1 items-center justify-center bg-[#FAF9F6]">
        <Text className="text-gray-500">Quiz ID manquant</Text>
      </View>
    );
  }

  const handleComplete = (score: number, maxScore: number) => {
    if (IS_DEV) {
      console.log("[QuizWebViewPage] Quiz completed:", { score, maxScore });
    }

    // Navigate to results page
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const xp = Math.round(percentage * 0.5); // 0-50 XP based on score

    const resultParams = `?activity=Quiz&score=${score}&total=${maxScore}&xp=${xp}&moduleId=${quizId}&instanceId=${quizId}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Quiz')}&courseId=${courseId}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${courseId}`)}`;
    router.push(`/(stacks)/(cours)/result${resultParams}` as any);
  };

  const handleError = (error: string) => {
    if (IS_DEV) {
      console.error("[QuizWebViewPage] Quiz error:", error);
    }
  };

  return (
    <QuizWebView
      quizId={quizId}
      courseId={courseId}
      userToken={token || undefined}
      onComplete={handleComplete}
      onError={handleError}
    />
  );
}
