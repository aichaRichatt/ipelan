const DEV_MODE = __DEV__;

export const ENV = {
  IS_DEV: DEV_MODE,
  IS_PROD: !DEV_MODE,
  
  API: {
    MOODLE_URL: process.env.EXPO_PUBLIC_MOODLE_API_URL || 'https://moodle.richatt.com',
    API_TIMEOUT: 30000,
  },
  
  AUTH: {
    TOKEN_KEY: 'ipelan_auth_token',
    USER_KEY: 'ipelan_user_data',
  },
  
  CONTENT: {
    EPUB_BASE_URL: process.env.EXPO_PUBLIC_EPUB_BASE_URL || 'https://moodle.richatt.com',
    AUDIO_BASE_URL: process.env.EXPO_PUBLIC_AUDIO_BASE_URL || 'https://moodle.richatt.com',
    DOWNLOAD_WIFI_ONLY: true,
    MAX_STORAGE_MB: 500,
  },
  
  SYNC: {
    AUTO_SYNC_ON_START: true,
    AUTO_SYNC_INTERVAL_MS: 24 * 60 * 60 * 1000,
    SYNC_RETRY_ATTEMPTS: 3,
    SYNC_RETRY_DELAY_MS: 5000,
  },
  
  CACHE: {
    EPUB_CACHE_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
    AUDIO_CACHE_MAX_AGE_MS: 30 * 24 * 60 * 60 * 1000,
    MAX_CACHE_SIZE_MB: 200,
  },
  
  UX: {
    MIN_TOUCH_SIZE: 60,
    ANIMATION_DURATION_MS: 300,
    HAPTIC_ENABLED: true,
  },
  
  DEBUG: {
    LOG_API_REQUESTS: DEV_MODE,
    LOG_SYNC_OPERATIONS: DEV_MODE,
    SHOW_DEV_BANNER: DEV_MODE,
  },
} as const;

export const isDevMode = (): boolean => ENV.IS_DEV;

export const getApiUrl = (): string => ENV.API.MOODLE_URL;

export const getEpubBaseUrl = (): string => ENV.CONTENT.EPUB_BASE_URL;

export const getAudioBaseUrl = (): string => ENV.CONTENT.AUDIO_BASE_URL;

export default ENV;
