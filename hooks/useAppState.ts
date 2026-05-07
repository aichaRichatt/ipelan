import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Hook pour détecter quand l'app revient au premier plan
 * @param onForeground - Callback appelé quand l'app passe de background à foreground
 */
export function useAppState(onForeground?: () => void) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (IS_DEV) console.log('[AppState] App has come to the foreground!');
        onForeground?.();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [onForeground]);

  return appState.current;
}
