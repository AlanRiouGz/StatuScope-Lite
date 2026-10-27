import * as Localization from 'expo-localization';

export type AppLanguage = 'en' | 'es';

const fallbackLanguage: AppLanguage = 'en';
const supportedLanguages = new Set<AppLanguage>(['en', 'es']);
let currentLanguage: AppLanguage = fallbackLanguage;

export function normalizeLanguage(locale: string | undefined | null): AppLanguage {
  const language = locale?.split('-')[0]?.toLowerCase();
  return supportedLanguages.has(language as AppLanguage) ? (language as AppLanguage) : fallbackLanguage;
}

export function detectInitialLanguage(): AppLanguage {
  try {
    const locale = Localization.getLocales()[0];
    return normalizeLanguage(locale?.languageTag ?? locale?.languageCode);
  } catch {
    return fallbackLanguage;
  }
}

export function getCurrentLanguage(): AppLanguage {
  return currentLanguage;
}

export function setCurrentLanguage(language: AppLanguage) {
  currentLanguage = language;
}

export function getFallbackLanguage(): AppLanguage {
  return fallbackLanguage;
}
