import { calculateXP, ActivityType, XPScore } from '../utils/xpCalculator';

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  audioUrl?: string;
  imageUrl?: string;
}

export interface QuizResult {
  correctAnswers: number;
  totalQuestions: number;
  wrongAnswers: { questionId: string; userAnswer: number; correctAnswer: number }[];
  timeSpent: number;
  attempts: number;
  xpEarned: XPScore;
  isPerfect: boolean;
  feedback: string;
}

export interface DictationResult {
  correctChars: number;
  totalChars: number;
  correctWords: number;
  totalWords: number;
  wrongPositions: number[];
  timeSpent: number;
  attempts: number;
  xpEarned: XPScore;
  isPerfect: boolean;
  feedback: string;
}

export interface ListeningResult {
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number;
  attempts: number;
  xpEarned: XPScore;
  isPerfect: boolean;
  feedback: string;
}

export interface AssociationResult {
  correctPairs: number;
  totalPairs: number;
  timeSpent: number;
  attempts: number;
  xpEarned: XPScore;
  isPerfect: boolean;
  feedback: string;
}

export interface WordOrderResult {
  correctWords: number;
  totalWords: number;
  attempts: number;
  timeSpent: number;
  xpEarned: XPScore;
  isPerfect: boolean;
  feedback: string;
}

export function quizHandler(
  answers: Record<string, number>,
  questions: Question[],
  options: { timeSpent?: number; attempts?: number; streak?: number } = {}
): QuizResult {
  const { timeSpent = 0, attempts = 1, streak = 0 } = options;
  
  let correctAnswers = 0;
  const wrongAnswers: QuizResult['wrongAnswers'] = [];

  for (const question of questions) {
    const userAnswer = answers[question.id];
    if (userAnswer === question.correctAnswer) {
      correctAnswers++;
    } else {
      wrongAnswers.push({
        questionId: question.id,
        userAnswer: userAnswer ?? -1,
        correctAnswer: question.correctAnswer,
      });
    }
  }

  const totalQuestions = questions.length;
  const isPerfect = correctAnswers === totalQuestions && wrongAnswers.length === 0;

  const xpEarned = calculateXP('quiz', correctAnswers, totalQuestions, {
    timeSpent,
    perfectScore: isPerfect,
    streak,
    attempts,
  });

  let feedback: string;
  if (isPerfect) {
    feedback = 'Parfait ! Tu es un champion !';
  } else if (correctAnswers / totalQuestions >= 0.7) {
    feedback = 'Très bien ! Continue comme ça !';
  } else if (correctAnswers / totalQuestions >= 0.5) {
    feedback = 'Pas mal ! Révisons ensemble.';
  } else {
    feedback = 'Ne te décourage pas ! Recommence.';
  }

  return {
    correctAnswers,
    totalQuestions,
    wrongAnswers,
    timeSpent,
    attempts,
    xpEarned,
    isPerfect,
    feedback,
  };
}

export function dictationHandler(
  userText: string,
  correctText: string,
  options: { timeSpent?: number; attempts?: number; streak?: number } = {}
): DictationResult {
  const { timeSpent = 0, attempts = 1, streak = 0 } = options;

  const normalizeText = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
  const userNormalized = normalizeText(userText);
  const correctNormalized = normalizeText(correctText);

  const correctChars = userNormalized
    .split('')
    .filter((char, i) => char === correctNormalized[i]).length;
  const totalChars = correctNormalized.length;

  const userWords = userNormalized.split(' ');
  const correctWords = correctNormalized.split(' ');
  let correctWordCount = 0;
  const wrongPositions: number[] = [];

  for (let i = 0; i < correctWords.length; i++) {
    if (userWords[i] === correctWords[i]) {
      correctWordCount++;
    } else {
      wrongPositions.push(i);
    }
  }

  const totalWords = correctWords.length;
  const isPerfect = userNormalized === correctNormalized;

  const xpEarned = calculateXP('dictation', correctWordCount, totalWords, {
    timeSpent,
    perfectScore: isPerfect,
    streak,
    attempts,
  });

  let feedback: string;
  if (isPerfect) {
    feedback = 'Excellente dictée ! Parfait !';
  } else if (correctWordCount / totalWords >= 0.8) {
    feedback = 'Très bien ! Quelques petites erreurs.';
  } else if (correctWordCount / totalWords >= 0.5) {
    feedback = 'Continue à pratiquer !';
  } else {
    feedback = 'Écoute bien et réessaie !';
  }

  return {
    correctChars,
    totalChars,
    correctWords: correctWordCount,
    totalWords,
    wrongPositions,
    timeSpent,
    attempts,
    xpEarned,
    isPerfect,
    feedback,
  };
}

export function listeningHandler(
  answers: Record<string, number>,
  questions: Question[],
  options: { timeSpent?: number; attempts?: number; streak?: number } = {}
): ListeningResult {
  const { timeSpent = 0, attempts = 1, streak = 0 } = options;
  
  let correctAnswers = 0;

  for (const question of questions) {
    const userAnswer = answers[question.id];
    if (userAnswer === question.correctAnswer) {
      correctAnswers++;
    }
  }

  const totalQuestions = questions.length;
  const isPerfect = correctAnswers === totalQuestions;

  const xpEarned = calculateXP('listening', correctAnswers, totalQuestions, {
    timeSpent,
    perfectScore: isPerfect,
    streak,
    attempts,
  });

  let feedback: string;
  if (isPerfect) {
    feedback = 'Excellent ! Tu as tout compris !';
  } else if (correctAnswers / totalQuestions >= 0.7) {
    feedback = 'Très bien ! Tu progresses !';
  } else if (correctAnswers / totalQuestions >= 0.5) {
    feedback = 'Pas mal ! Réécoute pour améliorer.';
  } else {
    feedback = 'Écoute encore une fois !';
  }

  return {
    correctAnswers,
    totalQuestions,
    timeSpent,
    attempts,
    xpEarned,
    isPerfect,
    feedback,
  };
}

export function associationHandler(
  pairs: { left: string; right: string; correctRight: string }[],
  options: { timeSpent?: number; attempts?: number; streak?: number } = {}
): AssociationResult {
  const { timeSpent = 0, attempts = 1, streak = 0 } = options;
  
  let correctPairs = 0;

  for (const pair of pairs) {
    if (pair.right === pair.correctRight) {
      correctPairs++;
    }
  }

  const totalPairs = pairs.length;
  const isPerfect = correctPairs === totalPairs;

  const xpEarned = calculateXP('association', correctPairs, totalPairs, {
    timeSpent,
    perfectScore: isPerfect,
    streak,
    attempts,
  });

  let feedback: string;
  if (isPerfect) {
    feedback = 'Parfait ! Toutes les associations sont correctes !';
  } else if (correctPairs / totalPairs >= 0.7) {
    feedback = 'Très bien ! Quelques erreurs à corriger.';
  } else if (correctPairs / totalPairs >= 0.5) {
    feedback = 'Continue à t\'entraîner !';
  } else {
    feedback = 'Réfléchis bien aux associations !';
  }

  return {
    correctPairs,
    totalPairs,
    timeSpent,
    attempts,
    xpEarned,
    isPerfect,
    feedback,
  };
}

export function wordOrderHandler(
  userOrder: string[][],
  correctOrders: string[][],
  options: { timeSpent?: number; attempts?: number; streak?: number } = {}
): WordOrderResult {
  const { timeSpent = 0, attempts = 1, streak = 0 } = options;
  
  let correctWords = 0;
  let totalWords = 0;

  for (let i = 0; i < correctOrders.length; i++) {
    const correct = correctOrders[i] || [];
    const user = userOrder[i] || [];
    totalWords += correct.length;

    for (let j = 0; j < correct.length; j++) {
      if (user[j] === correct[j]) {
        correctWords++;
      }
    }
  }

  const isPerfect = correctWords === totalWords;

  const xpEarned = calculateXP('wordOrder', correctWords, totalWords, {
    timeSpent,
    perfectScore: isPerfect,
    streak,
    attempts,
  });

  let feedback: string;
  if (isPerfect) {
    feedback = 'Excellente phrase ! Parfaitement ordonnée !';
  } else if (correctWords / totalWords >= 0.8) {
    feedback = 'Très bien ! Presque parfait !';
  } else if (correctWords / totalWords >= 0.5) {
    feedback = 'Continue à pratiquer !';
  } else {
    feedback = 'Attention à l\'ordre des mots !';
  }

  return {
    correctWords,
    totalWords,
    attempts,
    timeSpent,
    xpEarned,
    isPerfect,
    feedback,
  };
}

export function getActivityResult(
  activityType: ActivityType,
  result: any
): { message: string; xpGained: number; isSuccess: boolean } {
  const xpGained = result.xpEarned?.totalXP || 0;
  const isSuccess = result.isPerfect || (result.correctAnswers !== undefined && result.correctAnswers / result.totalQuestions >= 0.5);

  return {
    message: result.feedback || 'Activité terminée',
    xpGained,
    isSuccess,
  };
}
