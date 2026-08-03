import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NativeModules, Platform } from 'react-native';

import en from './translations/en.json';
import fr from './translations/fr.json';

function getDeviceLanguage(): string {
  try {
    // Safe dynamic require so missing native module doesn't crash app on startup
    const ExpoLocalization = require('expo-localization');
    const locales = ExpoLocalization.getLocales?.();
    if (locales && locales.length > 0 && locales[0]?.languageCode) {
      return locales[0].languageCode;
    }
  } catch (e) {
    // Native module 'ExpoLocalization' not found in current build binary
  }

  try {
    const intlLocale = Intl?.DateTimeFormat?.().resolvedOptions?.().locale;
    if (intlLocale) {
      return intlLocale.split('-')[0].split('_')[0];
    }
  } catch (e) {
    // Intl fallback failed
  }

  try {
    const nativeLocale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;
    if (nativeLocale) {
      return nativeLocale.split('-')[0].split('_')[0];
    }
  } catch (e) {
    // NativeModules fallback failed
  }

  return 'en';
}

const primaryLanguage = getDeviceLanguage();
const initialLanguage = primaryLanguage.startsWith('fr') ? 'fr' : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
