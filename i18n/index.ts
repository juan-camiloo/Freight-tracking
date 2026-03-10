import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import es from '../locales/es.json';

const STORAGE_KEY = 'app_language';
const supportedLanguages = ['es', 'en'] as const;

type SupportedLanguage = (typeof supportedLanguages)[number];

const getDeviceLanguage = (): SupportedLanguage => {
  const localeLanguage = getLocales()[0]?.languageCode?.toLowerCase();
  return localeLanguage === 'en' ? 'en' : 'es';
};

void i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: getDeviceLanguage(),
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  })
  .then(async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && supportedLanguages.includes(saved as SupportedLanguage)) {
      await i18n.changeLanguage(saved);
    }
  })
  .catch((error) => {
    console.error('Error initializing i18n:', error);
  });

export const setAppLanguage = async (language: SupportedLanguage) => {
  await i18n.changeLanguage(language);
  await AsyncStorage.setItem(STORAGE_KEY, language);
};

export default i18n;
