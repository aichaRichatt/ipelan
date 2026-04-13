import { Section } from '@/types';

export const sections: Section[] = [
  // Pulaar 1 - Lecture
  {
    id: 'section_pulaar_1_lecture_1',
    courseId: 'course_pulaar_1_lecture',
    title: 'Leçons',
    order: 1,
  },
  {
    id: 'section_pulaar_1_lecture_2',
    courseId: 'course_pulaar_1_lecture',
    title: 'Audio',
    order: 2,
  },
  {
    id: 'section_pulaar_1_lecture_3',
    courseId: 'course_pulaar_1_lecture',
    title: 'Activités',
    order: 3,
  },
  // Pulaar 1 - Vocabulaire
  {
    id: 'section_pulaar_1_vocab_1',
    courseId: 'course_pulaar_1_vocab',
    title: 'Leçons',
    order: 1,
  },
  {
    id: 'section_pulaar_1_vocab_2',
    courseId: 'course_pulaar_1_vocab',
    title: 'Activités',
    order: 2,
  },
  // Pulaar 2 - Lecture
  {
    id: 'section_pulaar_2_lecture_1',
    courseId: 'course_pulaar_2_lecture',
    title: 'Leçons',
    order: 1,
  },
  {
    id: 'section_pulaar_2_lecture_2',
    courseId: 'course_pulaar_2_lecture',
    title: 'Audio',
    order: 2,
  },
  {
    id: 'section_pulaar_2_lecture_3',
    courseId: 'course_pulaar_2_lecture',
    title: 'Activités',
    order: 3,
  },
];

export const getSectionsByCourse = (courseId: string): Section[] => {
  return sections
    .filter(s => s.courseId === courseId)
    .sort((a, b) => a.order - b.order);
};

export const getSectionById = (id: string): Section | undefined => {
  return sections.find(s => s.id === id);
};
