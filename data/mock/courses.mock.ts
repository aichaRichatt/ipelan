import { Course, Langue, Grade } from '@/types';

export const courses: Course[] = [
  // Pulaar - 1ère année
  {
    id: 'course_pulaar_1_lecture',
    language: 'pulaar',
    grade: 1,
    title: 'Lecture',
    description: 'Apprendre à lire en Pulaar',
    icon: 'book',
    color: '#4a90e2',
  },
  {
    id: 'course_pulaar_1_vocab',
    language: 'pulaar',
    grade: 1,
    title: 'Vocabulaire',
    description: 'Mots de base en Pulaar',
    icon: 'message-circle',
    color: '#10B981',
  },
  // Pulaar - 2ème année
  {
    id: 'course_pulaar_2_lecture',
    language: 'pulaar',
    grade: 2,
    title: 'Lecture avancée',
    description: 'Lecture et compréhension',
    icon: 'book-open',
    color: '#6366F1',
  },
  {
    id: 'course_pulaar_2_vocab',
    language: 'pulaar',
    grade: 2,
    title: 'Vocabulaire avancé',
    description: 'Nouveau vocabulaire',
    icon: 'message-square',
    color: '#F59E0B',
  },
  // Soninké - 1ère année
  {
    id: 'course_soninke_1_lecture',
    language: 'soninke',
    grade: 1,
    title: 'Lecture',
    description: 'Apprendre à lire en Soninké',
    icon: 'book',
    color: '#EC4899',
  },
  {
    id: 'course_soninke_1_vocab',
    language: 'soninke',
    grade: 1,
    title: 'Vocabulaire',
    description: 'Mots de base en Soninké',
    icon: 'message-circle',
    color: '#8B5CF6',
  },
  // Wolof - 1ère année
  {
    id: 'course_wolof_1_lecture',
    language: 'wolof',
    grade: 1,
    title: 'Lecture',
    description: 'Apprendre à lire en Wolof',
    icon: 'book',
    color: '#14B8A6',
  },
  {
    id: 'course_wolof_1_vocab',
    language: 'wolof',
    grade: 1,
    title: 'Vocabulaire',
    description: 'Mots de base en Wolof',
    icon: 'message-circle',
    color: '#F97316',
  },
];

export const getCoursesByLanguage = (language: Langue): Course[] => {
  return courses.filter(c => c.language === language);
};

export const getCoursesByGrade = (grade: Grade): Course[] => {
  return courses.filter(c => c.grade === grade);
};

export const getCoursesByLanguageAndGrade = (language: Langue, grade: Grade): Course[] => {
  return courses.filter(c => c.language === language && c.grade === grade);
};

export const getCourseById = (id: string): Course | undefined => {
  return courses.find(c => c.id === id);
};
