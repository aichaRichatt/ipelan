import { Language, Langue } from '@/types';

export const languages: Language[] = [
  { id: 'pulaar', name: 'Pulaar', flagEmoji: '🇲🇷' },
  { id: 'soninke', name: 'Soninké', flagEmoji: '🇲🇱' },
  { id: 'wolof', name: 'Wolof', flagEmoji: '🇸🇳' },
];

export const getLanguageById = (id: Langue): Language | undefined => {
  return languages.find(l => l.id === id);
};
