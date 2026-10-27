import React, { useCallback, useEffect, useState } from 'react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next, useTranslation as useI18nextTranslation } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import {
  AppLanguage,
  detectInitialLanguage,
  getFallbackLanguage,
  normalizeLanguage,
  setCurrentLanguage,
} from './language';

type TranslationParams = Record<string, string | number | null | undefined>;

const initialLanguage = detectInitialLanguage();
setCurrentLanguage(initialLanguage);

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: initialLanguage,
  fallbackLng: getFallbackLanguage(),
  interpolation: {
    escapeValue: false,
  },
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [, setLanguageVersion] = useState(0);

  useEffect(() => {
    const handleLanguageChange = (language: string) => {
      setCurrentLanguage(normalizeLanguage(language));
      setLanguageVersion((version) => version + 1);
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export function useTranslation() {
  const { t: translate, i18n: instance } = useI18nextTranslation();
  const language = normalizeLanguage(instance.language);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setCurrentLanguage(nextLanguage);
    void instance.changeLanguage(nextLanguage);
  }, [instance]);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'es' ? 'en' : 'es');
  }, [language, setLanguage]);

  const t = useCallback(
    (key: string, params?: TranslationParams): string => translate(key, params) as string,
    [translate],
  );

  return {
    language,
    setLanguage,
    toggleLanguage,
    t,
  };
}

export default i18n;
