/**
 * /quiz — alias historique. Redirige vers l'écran natif si on a les params,
 * sinon vers la liste des cours.
 */

import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function QuizIndex() {
  const params = useLocalSearchParams<{
    moduleId?: string;
    moduleTitle?: string;
    courseId?: string;
    instanceId?: string;
  }>();

  // Si on a au minimum un cmid → redirection vers l'écran natif
  const cmid = params.moduleId;
  const courseId = params.courseId;
  const instanceId = params.instanceId || params.moduleId;
  const moduleTitle = params.moduleTitle || 'Quiz';

  if (cmid) {
    const search = new URLSearchParams({
      cmid,
      instanceId: instanceId || cmid,
      courseId: courseId || '0',
      moduleTitle,
    }).toString();

    return <Redirect href={`/(stacks)/(cours)/quiz-native?${search}` as any} />;
  }

  // Pas de contexte → on retourne à la liste des cours
  return <Redirect href={'/(tabs)/(cours)' as any} />;
}
