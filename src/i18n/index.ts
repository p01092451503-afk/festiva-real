import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';

// 한국어 전용 서비스 — 언어 감지/전환 없이 KO로 고정합니다.
i18n
  .use(initReactI18next)
  .init({
    resources: { ko: { translation: ko } },
    lng: 'ko',
    fallbackLng: 'ko',
    supportedLngs: ['ko'],
    load: 'languageOnly',
    interpolation: { escapeValue: false },
  });

try {
  localStorage.removeItem('nfl-lang');
} catch {
  /* ignore */
}

// Keep the document language attribute in sync with the active language so
// that screen readers, search engines, and browser features (e.g. spell-check)
// see the correct locale. This also ensures the very first paint reflects the
// detected language without waiting for any component to mount.
if (typeof document !== 'undefined') {
  document.documentElement.lang = 'ko';
}

export default i18n;
