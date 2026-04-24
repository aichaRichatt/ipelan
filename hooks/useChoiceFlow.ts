import { useState, useCallback } from 'react';
import { getAuthToken } from '../services/contentLoader';
import { getChoiceOptions, submitChoiceResponse, ChoiceOption } from '../services/api/moodleActivities';

const IS_DEV = process.env.NODE_ENV === 'development';

export interface ChoiceState {
  status: 'idle' | 'loading' | 'ready' | 'submitting' | 'submitted' | 'error';
  options: ChoiceOption[];
  selectedOptionId: number | null;
  userChoice: number | null;
  errorMessage: string | null;
}

export function useChoiceFlow(choiceId: number) {
  const [state, setState] = useState<ChoiceState>({
    status: 'idle',
    options: [],
    selectedOptionId: null,
    userChoice: null,
    errorMessage: null,
  });

  const loadChoice = useCallback(async (token: string) => {
    const authToken = getAuthToken(token);
    
    if (!authToken || !choiceId) {
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: 'Paramètres manquants',
      }));
      return;
    }

    setState(prev => ({ 
      ...prev, 
      status: 'loading', 
      errorMessage: null,
      selectedOptionId: null 
    }));

    try {
      if (IS_DEV) console.log('[useChoiceFlow] Get options for choice:', choiceId);
      
      const result = await getChoiceOptions(authToken, choiceId);
      
      if (!result) {
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: "Permissions insuffisantes pour répondre à ce sondage",
        }));
        return;
      }

      const options = result.options || [];
      
      // Vérifier si l'utilisateur a déjà répondu
      const alreadyAnswered = options.find((o: ChoiceOption) => o.checked);
      
      if (IS_DEV) console.log('[useChoiceFlow] Options loaded:', {
        choiceId,
        total: options.length,
        alreadyAnswered: alreadyAnswered?.id || null,
      });

      setState({
        status: alreadyAnswered ? 'submitted' : 'ready',
        options: options.map((o: ChoiceOption) => ({
          ...o,
         
          disabled: o.disabled || !!alreadyAnswered,
        })),
        selectedOptionId: alreadyAnswered?.id || null,
        userChoice: alreadyAnswered?.id || null,
        errorMessage: null,
      });

    } catch (error: any) {
      if (IS_DEV) console.error('[useChoiceFlow] Exception:', error.message);
      
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error.message || "Erreur lors du chargement des options",
      }));
    }
  }, [choiceId]);

  const selectOption = useCallback((optionId: number) => {
    setState(prev => ({
      ...prev,
      selectedOptionId: optionId,
    }));
  }, []);

  const submitChoice = useCallback(async (token: string) => {
    const authToken = getAuthToken(token);
    const optionId = state.selectedOptionId;
    
    if (!authToken || !choiceId || !optionId) {
      setState(prev => ({
        ...prev,
        errorMessage: 'Paramètres manquants pour soumettre',
      }));
      return;
    }

    if (state.status === 'submitted') {
      if (IS_DEV) console.log('[useChoiceFlow] Already submitted');
      return;
    }

    setState(prev => ({ ...prev, status: 'submitting', errorMessage: null }));

    try {
      if (IS_DEV) console.log('[useChoiceFlow] Submit choice:', { choiceId, optionId });
      
      const result = await submitChoiceResponse(authToken, choiceId, optionId);
      
      if (!result?.success) {
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: 'Échec de la soumission',
        }));
        return;
      }

      if (IS_DEV) console.log('[useChoiceFlow] Submit success');

      // Mettre à jour les options
      setState(prev => ({
        ...prev,
        status: 'submitted',
        userChoice: optionId,
        options: prev.options.map((o: ChoiceOption) => ({
          ...o,
          checked: o.id === optionId,
          disabled: true,  
        })),
      }));

    } catch (error: any) {
      if (IS_DEV) console.error('[useChoiceFlow] Submit exception:', error.message);
      
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error.message || 'Erreur lors de la soumission',
      }));
    }
  }, [choiceId, state.selectedOptionId, state.status]);

  const resetChoice = useCallback(() => {
    setState({
      status: 'idle',
      options: [],
      selectedOptionId: null,
      userChoice: null,
      errorMessage: null,
    });
  }, []);

  return {
    ...state,
    loadChoice,
    selectOption,
    submitChoice,
    resetChoice,
  };
}