export * from './languages.mock';
export * from './courses.mock';
export * from './sections.mock';
export * from './contents.mock';
export * from './home.mock';
export * from './progress.mock';
export * from './quiz.mock';
export * from './exercises.mock';

export { languages } from './languages.mock';
export { courses, getCoursesByLanguage, getCoursesByGrade, getCoursesByLanguageAndGrade, getCourseById } from './courses.mock';
export { sections, getSectionsByCourse, getSectionById } from './sections.mock';
export { contents, getContentsBySection, getContentById, getContentsByType } from './contents.mock';
export { MOCK_HOME_MODULES, MOCK_QUICK_ACTIONS, MOCK_HOME_STATS, getModulesByLevel, getModulesByLanguage } from './home.mock';
export { MOCK_BADGES, MOCK_LEADERBOARD, MOCK_USER_PROGRESS, getBadgesByTier, getEarnedBadges, getLockedBadges } from './progress.mock';
export { MOCK_QUIZ_QUESTIONS, MOCK_QUIZZES, getQuizById, getQuizzesByCourse, getQuizzesByLanguage } from './quiz.mock';
export { MOCK_LISTENING_EXERCISES, MOCK_DICTATION_WORDS, MOCK_ASSOCIATION_ITEMS, MOCK_SENTENCE_WORDS } from './exercises.mock';
