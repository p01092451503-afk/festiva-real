import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ko from './locales/ko.json';
import en from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ko: { translation: ko }, en: { translation: en } },
    fallbackLng: 'ko',
    supportedLngs: ['ko', 'en'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'nfl-lang',
      lookupQuerystring: 'lang',
    },
    interpolation: { escapeValue: false },
  });

// Keep the document language attribute in sync with the active language so
// that screen readers, search engines, and browser features (e.g. spell-check)
// see the correct locale. This also ensures the very first paint reflects the
// detected language without waiting for any component to mount.
const applyHtmlLang = (lng: string) => {
  const normalized = lng?.toLowerCase().startsWith('en') ? 'en' : 'ko';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalized;
  }
};
applyHtmlLang(i18n.language);
i18n.on('languageChanged', applyHtmlLang);

export default i18n;
