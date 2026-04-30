import { useState } from 'react';
import { requestPasswordReset } from '../services/api/moodleAuth';

const IS_DEV = process.env.NODE_ENV === "development";

export interface ResetPasswordState {
  email: string;
  isLoading: boolean;
  error: string | null;
  success: boolean;
  step: number;
}

export function useResetPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);

  const validateEmail = (email: string): string | null => {
    if (!email.trim()) {
      return "Veuillez entrer votre adresse email";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Veuillez entrer une adresse email valide";
    }
    return null;
  };

  const submitResetRequest = async (): Promise<boolean> => {
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await requestPasswordReset(email.trim().toLowerCase());

      if (IS_DEV) {
        console.log('[useResetPassword] API result:', result);
      }

      // Moodle returns success even if email doesn't exist (security)
      // We consider it a success if no exception/error is thrown
      setSuccess(true);
      setStep(2);
      return true;
    } catch (err: any) {
      const errorMessage = err?.message || '';
      
      if (IS_DEV) {
        console.warn('[useResetPassword] Error:', err);
      }

      // Handle specific error cases
      if (errorMessage.toLowerCase().includes('network') || 
          errorMessage.toLowerCase().includes('fetch') ||
          errorMessage.toLowerCase().includes('internet')) {
        setError('Vérifiez votre connexion internet');
      } else if (errorMessage.toLowerCase().includes('not found') ||
                 errorMessage.toLowerCase().includes('introuvable')) {
        // For security, we don't reveal if email exists or not
        setSuccess(true);
        setStep(2);
        return true;
      } else {
        setError(errorMessage || 'Impossible d\'envoyer le lien de réinitialisation');
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setEmail('');
    setIsLoading(false);
    setError(null);
    setSuccess(false);
    setStep(1);
  };

  const goToLogin = () => {
    reset();
    // Return true to indicate navigation should happen
    return true;
  };

  return {
    // State
    email,
    isLoading,
    error,
    success,
    step,
    
    // Actions
    setEmail,
    submitResetRequest,
    reset,
    goToLogin,
    setStep,
    validateEmail,
  };
}
