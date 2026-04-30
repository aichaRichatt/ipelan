/**
 * @deprecated — l'écran WebView SSO a été remplacé par l'écran natif
 * `quiz-native` qui utilise les Web Services Moodle (mod_quiz_*).
 *
 * Cet alias redirige vers le nouvel écran pour préserver les deep links
 * existants (?quizId=…&courseId=…&moduleTitle=…).
 */

import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function QuizWebViewRedirect() {
  const params = useLocalSearchParams<{
    quizId?: string;
    courseId?: string;
    moduleTitle?: string;
    instanceId?: string;
  }>();

  const cmid = params.quizId || '0';
  const courseId = params.courseId || '0';
  const moduleTitle = params.moduleTitle || 'Quiz';
  const instanceId = params.instanceId || cmid;

  const search = new URLSearchParams({
    cmid,
    instanceId,
    courseId,
    moduleTitle,
  }).toString();

  return <Redirect href={`/(stacks)/(cours)/quiz-native?${search}` as any} />;
}
