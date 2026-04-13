import { Content, ContentType } from '@/types';

export const contents: Content[] = [
  // Section: Leçons Pulaar 1 - Lecture
  {
    id: 'content_pulaar_1_lecture_epub_1',
    sectionId: 'section_pulaar_1_lecture_1',
    type: 'epub',
    title: 'Alphabet Pulaar',
    fileUrl: 'https://ipelan.mr/archives/pulaar/1/alphabet.epub',
    description: 'Apprendre l\'alphabet en Pulaar',
  },
  {
    id: 'content_pulaar_1_lecture_epub_2',
    sectionId: 'section_pulaar_1_lecture_1',
    type: 'epub',
    title: 'Salutations',
    fileUrl: 'https://ipelan.mr/archives/pulaar/1/salutations.epub',
    description: 'Les salutations de base',
  },
  {
    id: 'content_pulaar_1_lecture_epub_3',
    sectionId: 'section_pulaar_1_lecture_1',
    type: 'epub',
    title: 'La famille',
    fileUrl: 'https://ipelan.mr/archives/pulaar/1/famille.epub',
    description: 'Vocabulaire de la famille',
  },
  // Section: Audio Pulaar 1 - Lecture
  {
    id: 'content_pulaar_1_lecture_audio_1',
    sectionId: 'section_pulaar_1_lecture_2',
    type: 'audio',
    title: 'Alphabet Audio',
    fileUrl: 'https://ipelan.mr/archives/pulaar/1/audio/alphabet.mp3',
    duration: 120,
  },
  {
    id: 'content_pulaar_1_lecture_audio_2',
    sectionId: 'section_pulaar_1_lecture_2',
    type: 'audio',
    title: 'Salutations Audio',
    fileUrl: 'https://ipelan.mr/archives/pulaar/1/audio/salutations.mp3',
    duration: 90,
  },
  // Section: Activités Pulaar 1 - Lecture
  {
    id: 'content_pulaar_1_lecture_quiz_1',
    sectionId: 'section_pulaar_1_lecture_3',
    type: 'quiz',
    title: 'Quiz Alphabet',
  },
  {
    id: 'content_pulaar_1_lecture_listening_1',
    sectionId: 'section_pulaar_1_lecture_3',
    type: 'listening',
    title: 'Exercice d\'écoute',
  },
  {
    id: 'content_pulaar_1_lecture_dictation_1',
    sectionId: 'section_pulaar_1_lecture_3',
    type: 'dictation',
    title: 'Dictée',
  },
  {
    id: 'content_pulaar_1_lecture_association_1',
    sectionId: 'section_pulaar_1_lecture_3',
    type: 'association',
    title: 'Association de mots',
  },
  // Section: Leçons Pulaar 1 - Vocabulaire
  {
    id: 'content_pulaar_1_vocab_epub_1',
    sectionId: 'section_pulaar_1_vocab_1',
    type: 'epub',
    title: 'Couleurs et nombres',
    fileUrl: 'https://ipelan.mr/archives/pulaar/1/couleurs.epub',
    description: 'Les couleurs et les nombres',
  },
  // Section: Activités Pulaar 1 - Vocabulaire
  {
    id: 'content_pulaar_1_vocab_quiz_1',
    sectionId: 'section_pulaar_1_vocab_2',
    type: 'quiz',
    title: 'Quiz Vocabulaire',
  },
  {
    id: 'content_pulaar_1_vocab_association_1',
    sectionId: 'section_pulaar_1_vocab_2',
    type: 'association',
    title: 'Association',
  },
];

export const getContentsBySection = (sectionId: string): Content[] => {
  return contents.filter(c => c.sectionId === sectionId);
};

export const getContentById = (id: string): Content | undefined => {
  return contents.find(c => c.id === id);
};

export const getContentsByType = (type: ContentType): Content[] => {
  return contents.filter(c => c.type === type);
};
