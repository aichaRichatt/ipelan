import * as Localization from 'expo-localization';

// Force French locale
export const FORCE_FRENCH_LOCALE = 'fr-FR';

// Get French locale info regardless of system language
export function getFrenchLocale() {
  return {
    languageCode: 'fr',
    countryCode: 'FR',
    languageTag: 'fr-FR',
    isRTL: false,
  };
}

// Format date in French
export function formatDateFR(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };
  return new Intl.DateTimeFormat('fr-FR', defaultOptions).format(date);
}

// Format number in French
export function formatNumberFR(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('fr-FR', options).format(value);
}

// Format currency in French
export function formatCurrencyFR(value: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(value);
}

// Get current locale (forced to French)
export function getCurrentLocale() {
  return getFrenchLocale();
}
