import { Platform } from 'react-native';

const defaultApiBaseUrl =
  Platform.select({
    android: 'http://10.0.2.2:4001',
    ios: 'http://localhost:4001',
    default: 'http://localhost:4001',
  }) ?? 'http://localhost:4001';

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl;
export const googleWebClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
export const googleIosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
export const googleAndroidClientId =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
export const sessionStorageKey = 'sonik.mobile.session';
