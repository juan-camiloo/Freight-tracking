// Configuracion i18n global para la app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import es from '../locales/es.json';

// Clave de almacenamiento del idioma preferido.
const STORAGE_KEY = 'app_language';
// Idiomas soportados por la app.
const supportedLanguages = ['es', 'en'] as const;

type SupportedLanguage = (typeof supportedLanguages)[number];

// Resuelve el idioma del dispositivo y lo mapea a los soportados.
const getDeviceLanguage = (): SupportedLanguage => {
  const localeLanguage = getLocales()[0]?.languageCode?.toLowerCase();
  return localeLanguage === 'en' ? 'en' : 'es';
};

// Inicializa i18n con recursos locales y aplica preferencia guardada.
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
    // Reemplaza el idioma inicial si el usuario ya guardo una preferencia.
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && supportedLanguages.includes(saved as SupportedLanguage)) {
      await i18n.changeLanguage(saved);
    }
  })
  .catch((error) => {
    console.error('Error initializing i18n:', error);
  });

// Cambia idioma y lo persiste para futuros inicios.
export const setAppLanguage = async (language: SupportedLanguage) => {
  await i18n.changeLanguage(language);
  await AsyncStorage.setItem(STORAGE_KEY, language);
};

export default i18n;
