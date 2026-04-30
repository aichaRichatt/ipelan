import { getUserData } from '../storage/tokenStorage';
import { moodleFetch } from '../api/moodleClient';

const IS_DEV = process.env.NODE_ENV === 'development';

export interface IdentityCheckResult {
  isValid: boolean;
  localUserId: number | null;
  moodleUserId: number | null;
  error?: string;
}

/**
 * Vérifie que l'identité de l'utilisateur local correspond à l'identité Moodle
 * Cette fonction doit être appelée avant toute synchronisation de données
 * pour éviter de mélanger les données de différents utilisateurs
 * 
 * @param token Token Moodle de l'utilisateur
 * @returns IdentityCheckResult avec isValid=true si les IDs correspondent
 */
export async function verifyUserIdentityBeforeSync(token: string): Promise<IdentityCheckResult> {
  try {
    // 1. Récupérer l'ID utilisateur local
    const localUserData = await getUserData();
    const localUserId = localUserData?.id;

    if (!localUserId) {
      return {
        isValid: false,
        localUserId: null,
        moodleUserId: null,
        error: 'Aucun utilisateur local trouvé'
      };
    }

    // 2. Récupérer l'ID utilisateur depuis Moodle via le token
    const moodleProfile = await moodleFetch('/webservice/rest/server.php', {
      wstoken: token,
      wsfunction: 'core_webservice_get_site_info',
      moodlewsrestformat: 'json',
    });

    if (moodleProfile?.exception) {
      return {
        isValid: false,
        localUserId,
        moodleUserId: null,
        error: `Erreur Moodle: ${moodleProfile.message || 'Token invalide'}`
      };
    }

    const moodleUserId = moodleProfile?.userid;

    if (!moodleUserId) {
      return {
        isValid: false,
        localUserId,
        moodleUserId: null,
        error: 'Impossible de récupérer l\'ID utilisateur depuis Moodle'
      };
    }

    // 3. Comparer les IDs
    if (localUserId !== moodleUserId) {
      if (IS_DEV) {
        console.error(`[UserIdentity] MISMATCH DETECTED! Local: ${localUserId}, Moodle: ${moodleUserId}`);
      }
      return {
        isValid: false,
        localUserId,
        moodleUserId,
        error: `ID utilisateur ne correspond pas (Local: ${localUserId}, Moodle: ${moodleUserId})`
      };
    }

    // 4. Vérification réussie
    if (IS_DEV) {
      console.log(`[UserIdentity] Identity verified - User ${localUserId}`);
    }

    return {
      isValid: true,
      localUserId,
      moodleUserId,
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Erreur inconnue';
    if (IS_DEV) {
      console.error('[UserIdentity] Verification error:', errorMsg);
    }
    return {
      isValid: false,
      localUserId: null,
      moodleUserId: null,
      error: errorMsg
    };
  }
}

/**
 * Vérifie si l'utilisateur actuel correspond à l'ID attendu
 * Version simplifiée pour les opérations internes
 */
export function checkUserIdMatch(currentUserId: number, expectedUserId: number): boolean {
  if (currentUserId !== expectedUserId) {
    console.error(`[UserIdentity] ID mismatch: expected ${expectedUserId}, got ${currentUserId}`);
    return false;
  }
  return true;
}

/**
 * Vérifie que les données à synchroniser appartiennent bien à l'utilisateur courant
 * À utiliser avant toute opération de mise à jour SQLite ou Moodle
 */
export function validateDataOwnership(dataUserId: number, currentUserId: number): boolean {
  if (dataUserId !== currentUserId) {
    console.error(
      `[UserIdentity] DATA OWNERSHIP VIOLATION! ` +
      `Data belongs to user ${dataUserId} but current user is ${currentUserId}. ` +
      `Operation aborted.`
    );
    return false;
  }
  return true;
}
