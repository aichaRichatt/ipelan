 

export interface MoodleError {
  type: 'auth' | 'permission' | 'network' | 'not_found' | 'empty' | 'parse' | 'unknown';
  message: string;
  originalError?: any;
  fallbackUsed: boolean;
}

export interface FetchResult<T> {
  data: T | null;
  error: MoodleError | null;
  fallback: boolean;
}

const IS_DEV = process.env.NODE_ENV === "development";

 
export function categorizeMoodleError(error: any, context: string): MoodleError {
  if (IS_DEV) console.warn(`[MoodleError][${context}]`, error);

   if (error?.exception) {
    const message = error.message || '';
    const errorcode = error.errorcode || '';

     if (errorcode === 'accessdenied' || message.includes('Access denied')) {
      return {
        type: 'permission',
        message: 'Permissions insuffisantes pour cette action',
        originalError: error,
        fallbackUsed: true,
      };
    }

     if (errorcode === 'invalidtoken' || errorcode === 'tokennotvalid') {
      return {
        type: 'auth',
        message: 'Session expirée, veuillez vous reconnecter',
        originalError: error,
        fallbackUsed: true,
      };
    }

     if (errorcode === 'invalidparameter' || errorcode === 'parameternotfound') {
      return {
        type: 'not_found',
        message: 'Activité introuvable (ID incorrect)',
        originalError: error,
        fallbackUsed: true,
      };
    }

     if (errorcode === 'nomoreattempts') {
      return {
        type: 'not_found',
        message: 'Nombre maximum de tentatives atteint',
        originalError: error,
        fallbackUsed: false,
      };
    }
  }

   if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
    return {
      type: 'network',
      message: 'Connexion au serveur impossible',
      originalError: error,
      fallbackUsed: true,
    };
  }

   if (error?.message?.includes('JSON') || error?.message?.includes('parse')) {
    return {
      type: 'parse',
      message: 'Réponse du serveur invalide',
      originalError: error,
      fallbackUsed: true,
    };
  }

   return {
    type: 'unknown',
    message: error?.message || 'Erreur inattendue',
    originalError: error,
    fallbackUsed: true,
  };
}

 
export function logActivityFetch(activityType: string, step: string, data?: any) {
  if (IS_DEV) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}][${activityType}] ${step}`, data ? JSON.stringify(data).slice(0, 200) : '');
  }
}

 
export function shouldUseFallback(error: MoodleError): boolean {
  return error.fallbackUsed && (
    error.type === 'permission' ||
    error.type === 'network' ||
    error.type === 'not_found' ||
    error.type === 'empty' ||
    error.type === 'parse' ||
    error.type === 'unknown'
  );
}

 
export function getUserFriendlyError(error: MoodleError): string {
  switch (error.type) {
    case 'auth':
      return 'Votre session a expiré. Veuillez vous reconnecter.';
    case 'permission':
      return "Vous n'avez pas les permissions pour cette activité.";
    case 'network':
      return 'Pas de connexion Internet. Mode hors ligne activé.';
    case 'not_found':
      return "Cette activité n'existe pas ou a été supprimée.";
    case 'empty':
      return 'Cette activité ne contient pas de contenu.';
    case 'parse':
      return 'Impossible de lire le contenu de cette activité.';
    default:
      return 'Une erreur est survenue. Veuillez réessayer.';
  }
}

 
export interface ErrorOptions {
  showToUser?: boolean;
  logToConsole?: boolean;
  useFallback?: boolean;
}

export const DEFAULT_ERROR_OPTIONS: ErrorOptions = {
  showToUser: true,
  logToConsole: true,
  useFallback: true,
};

export default {
  categorizeMoodleError,
  logActivityFetch,
  shouldUseFallback,
  getUserFriendlyError,
  DEFAULT_ERROR_OPTIONS,
};