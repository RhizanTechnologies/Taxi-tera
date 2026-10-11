import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import am from './am.json';
import en from './en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      am: { translation: am },
      en: { translation: en },
    },
    fallbackLng: 'am',
    supportedLngs: ['am', 'en'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'taxi-tera-lang',
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
