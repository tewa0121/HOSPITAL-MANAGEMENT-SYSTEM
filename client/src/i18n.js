import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import am from './locales/am.json';
import enStep5 from './locales/en.step5.json';
import amStep5 from './locales/am.step5.json';
import enStep6 from './locales/en.step6.json';
import amStep6 from './locales/am.step6.json';
import enStep7 from './locales/en.step7.json';
import amStep7 from './locales/am.step7.json';
import enStep8 from './locales/en.step8.json';
import amStep8 from './locales/am.step8.json';
import enStep9 from './locales/en.step9.json';
import amStep9 from './locales/am.step9.json';
import enStep10 from './locales/en.step10.json';
import amStep10 from './locales/am.step10.json';
import enStep11 from './locales/en.step11.json';
import amStep11 from './locales/am.step11.json';
import enStep12 from './locales/en.step12.json';
import amStep12 from './locales/am.step12.json';
import enStep13 from './locales/en.step13.json';
import amStep13 from './locales/am.step13.json';
import enStep15 from './locales/en.step15.json';
import amStep15 from './locales/am.step15.json';

// deep merge: later files can add keys inside groups that earlier files created
const merge = (...objs) => objs.reduce((acc, o) => {
  Object.entries(o).forEach(([k, v]) => {
    acc[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(acc[k] || {}, v) : v;
  });
  return acc;
}, {});

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: merge(en, enStep5, enStep6, enStep7, enStep8, enStep9, enStep10, enStep11, enStep12, enStep13, enStep15) },
    am: { translation: merge(am, amStep5, amStep6, amStep7, amStep8, amStep9, amStep10, amStep11, amStep12, amStep13, amStep15) },
  },
  lng: localStorage.getItem('lang') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18n.language;

// The hospital name and default language come from the Settings page (public, no login needed)
export async function loadPublicSettings() {
  try {
    const res = await fetch('/api/settings/public');
    if (!res.ok) return;
    const { data } = await res.json();
    if (data.hospital_name) {
      i18n.addResource('en', 'translation', 'app.hospital', data.hospital_name);
      i18n.addResource('am', 'translation', 'app.hospital', data.hospital_name_am || data.hospital_name);
    }
    const chosen = localStorage.getItem('lang'); // a language picked by the user wins
    const lng = chosen || (['en', 'am'].includes(data.default_language) ? data.default_language : i18n.language);
    await i18n.changeLanguage(lng); // also re-renders the screen with the new name
    document.documentElement.lang = lng;
  } catch { /* the app keeps working with the built-in names */ }
}

export default i18n;