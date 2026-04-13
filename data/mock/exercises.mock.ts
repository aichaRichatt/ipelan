export interface ListeningExercise {
  id: string;
  word: string;
  translation: string;
  audioUrl?: string;
}

export interface DictationWord {
  id: string;
  word: string;
  translation: string;
  audioUrl?: string;
}

export interface AssociationItem {
  id: string;
  leftWord: string;
  rightWord: string;
}

export interface SentenceWord {
  id: string;
  words: string[];
  translation: string;
  audioUrl?: string;
}

export const MOCK_LISTENING_EXERCISES: ListeningExercise[] = [
  { id: "le1", word: "Jaa", translation: "Oui" },
  { id: "le2", word: "Ala", translation: "Non" },
  { id: "le3", word: "Te", translation: "Merci" },
  { id: "le4", word: "Suka", translation: "Jour" },
  { id: "le5", word: "Heri", translation: "Bonsoir" },
  { id: "le6", word: "Suba", translation: "Matin" },
  { id: "le7", word: "Ndeyni", translation: "Merci" },
  { id: "le8", word: "Baadi", translation: "Au revoir" },
];

export const MOCK_DICTATION_WORDS: DictationWord[] = [
  { id: "dw1", word: "Jaa", translation: "Oui" },
  { id: "dw2", word: "Baadi", translation: "Au revoir" },
  { id: "dw3", word: "Ndeyni", translation: "Merci" },
  { id: "dw4", word: "Nde", translation: "Mère" },
  { id: "dw5", word: "Bapp", translation: "Père" },
  { id: "dw6", word: "Yiiro", translation: "Enfant" },
  { id: "dw7", word: "Ala", translation: "Non" },
  { id: "dw8", word: "Suka", translation: "Jour" },
];

export const MOCK_ASSOCIATION_ITEMS: AssociationItem[] = [
  { id: "ai1", leftWord: "Jaa", rightWord: "Oui" },
  { id: "ai2", leftWord: "Ala", rightWord: "Non" },
  { id: "ai3", leftWord: "Nde", rightWord: "Mère" },
  { id: "ai4", leftWord: "Bapp", rightWord: "Père" },
  { id: "ai5", leftWord: "Yiiro", rightWord: "Enfant" },
  { id: "ai6", leftWord: "Baadi", rightWord: "Au revoir" },
  { id: "ai7", leftWord: "Ndeyni", rightWord: "Merci" },
  { id: "ai8", leftWord: "Suka", rightWord: "Jour" },
];

export const MOCK_SENTENCE_WORDS: SentenceWord[] = [
  {
    id: "sw1",
    words: ["Mi", "n‑aama"],
    translation: "Je vais bien",
  },
  {
    id: "sw2",
    words: ["Min", "yahi"],
    translation: "Comment vas-tu ?",
  },
  {
    id: "sw3",
    words: ["Jaarama"],
    translation: "Bonjour",
  },
  {
    id: "sw4",
    words: ["Nde", "ye"],
    translation: "La mère",
  },
  {
    id: "sw5",
    words: ["Yiiro", "n‑aadi"],
    translation: "L'enfant est venu",
  },
];

export const getListeningByCourse = (courseId: string): ListeningExercise[] => {
  return MOCK_LISTENING_EXERCISES;
};

export const getDictationByCourse = (courseId: string): DictationWord[] => {
  return MOCK_DICTATION_WORDS;
};

export const getAssociationByCourse = (courseId: string): AssociationItem[] => {
  return MOCK_ASSOCIATION_ITEMS;
};

export const getSentencesByCourse = (courseId: string): SentenceWord[] => {
  return MOCK_SENTENCE_WORDS;
};
