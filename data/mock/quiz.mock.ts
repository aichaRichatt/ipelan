export interface QuizQuestion {
  id: string;
  type: 'text-mcq' | 'audio-mcq';
  question: string;
  audioUrl?: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface Quiz {
  id: string;
  title: string;
  language: string;
  grade: number;
  courseId: string;
  questions: QuizQuestion[];
  passingScore: number;
  timeLimit?: number;
}

export const MOCK_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    type: "text-mcq",
    question: "Comment dit-on 'Bonjour' en Pulaar ?",
    options: ["Jaarama", "Baadi", "Min yaha", "Hol ko"],
    correctIndex: 0,
    explanation: "Jaarama signifie 'Bonjour' en Pulaar",
  },
  {
    id: "q2",
    type: "audio-mcq",
    question: "Écoute et choisis la bonne réponse :",
    audioUrl: "salutation_1.mp3",
    options: ["Merci", "Au revoir", "Comment vas-tu ?", "Je m'appelle"],
    correctIndex: 0,
    explanation: "Jaarama signifie 'Merci' en Pulaar",
  },
  {
    id: "q3",
    type: "text-mcq",
    question: "Que signifie 'Baadi' ?",
    options: ["Bonjour", "Au revoir", "Merci", "Comment ça va"],
    correctIndex: 1,
    explanation: "Baadi signifie 'Au revoir' en Pulaar",
  },
  {
    id: "q4",
    type: "text-mcq",
    question: "Comment dit-on 'Merci' en Pulaar ?",
    options: ["Jaarama", "Baadi", "Min yaha", "Ndeyni"],
    correctIndex: 3,
    explanation: "Ndeyni signifie 'Merci' en Pulaar",
  },
  {
    id: "q5",
    type: "text-mcq",
    question: "Que signifie 'Min yaha' ?",
    options: ["Bonjour", "Au revoir", "Comment vas-tu ?", "Merci"],
    correctIndex: 2,
    explanation: "Min yaha signifie 'Comment vas-tu ?' en Pulaar",
  },
  {
    id: "q6",
    type: "text-mcq",
    question: "Comment dit-on 'Oui' en Pulaar ?",
    options: ["Ala", "Jaa", "Te", "Ko"],
    correctIndex: 1,
    explanation: "Jaa signifie 'Oui' en Pulaar",
  },
  {
    id: "q7",
    type: "text-mcq",
    question: "Que signifie 'Ala' ?",
    options: ["Oui", "Non", "Merci", "Pardon"],
    correctIndex: 1,
    explanation: "Ala signifie 'Non' en Pulaar",
  },
  {
    id: "q8",
    type: "text-mcq",
    question: "Comment dit-on 'La mère' en Pulaar ?",
    options: ["Bapp", "Nde", "Yiiro", "Kombo"],
    correctIndex: 1,
    explanation: "Nde signifie 'La mère' en Pulaar",
  },
  {
    id: "q9",
    type: "text-mcq",
    question: "Que signifie 'Bapp' ?",
    options: ["La mère", "Le père", "L'enfant", "La sœur"],
    correctIndex: 1,
    explanation: "Bapp signifie 'Le père' en Pulaar",
  },
  {
    id: "q10",
    type: "text-mcq",
    question: "Comment dit-on 'L\\'enfant' en Pulaar ?",
    options: ["Nde", "Bapp", "Yiiro", "Suka"],
    correctIndex: 2,
    explanation: "Yiiro signifie 'L\\'enfant' en Pulaar",
  },
];

export const MOCK_QUIZZES: Quiz[] = [
  {
    id: "quiz-pulaar-1-salutations",
    title: "Quiz - Salutations",
    language: "pulaar",
    grade: 1,
    courseId: "course_pulaar_1_lecture",
    questions: MOCK_QUIZ_QUESTIONS.slice(0, 5),
    passingScore: 70,
    timeLimit: 300,
  },
  {
    id: "quiz-pulaar-1-famille",
    title: "Quiz - La Famille",
    language: "pulaar",
    grade: 1,
    courseId: "course_pulaar_1_vocab",
    questions: MOCK_QUIZ_QUESTIONS.slice(5, 10),
    passingScore: 70,
    timeLimit: 300,
  },
  {
    id: "quiz-pulaar-2-comprehension",
    title: "Quiz - Compréhension",
    language: "pulaar",
    grade: 2,
    courseId: "course_pulaar_2_lecture",
    questions: MOCK_QUIZ_QUESTIONS,
    passingScore: 80,
    timeLimit: 600,
  },
];

export const getQuizById = (id: string): Quiz | undefined => {
  return MOCK_QUIZZES.find(q => q.id === id);
};

export const getQuizzesByCourse = (courseId: string): Quiz[] => {
  return MOCK_QUIZZES.filter(q => q.courseId === courseId);
};

export const getQuizzesByLanguage = (language: string): Quiz[] => {
  return MOCK_QUIZZES.filter(q => q.language === language);
};
