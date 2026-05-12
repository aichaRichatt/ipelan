import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const IS_DEV = process.env.NODE_ENV === 'development';

// Module-level singleton — one AppState listener regardless of how many hook instances exist
type ForegroundCallback = () => void;
const _callbacks = new Set<ForegroundCallback>();
let _appState: AppStateStatus = AppState.currentState;
let _subscription: ReturnType<typeof AppState.addEventListener> | null = null;

function _ensureListener() {
  if (_subscription) return;
  _subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (_appState.match(/inactive|background/) && nextState === 'active') {
      if (IS_DEV) console.log('[AppState] App has come to the foreground!');
      _callbacks.forEach(cb => cb());
    }
    _appState = nextState;
  });
}

/**
 * Hook pour détecter quand l'app revient au premier plan.
 * Uses a module-level singleton listener — safe to call from multiple hook instances.
 * @param onForeground - Callback appelé quand l'app passe de background à foreground
 */
export function useAppState(onForeground?: () => void) {
  const cbRef = useRef<ForegroundCallback | undefined>(onForeground);
  cbRef.current = onForeground;

  useEffect(() => {
    _ensureListener();

    const stableCallback: ForegroundCallback = () => cbRef.current?.();
    _callbacks.add(stableCallback);

    return () => {
      _callbacks.delete(stableCallback);
    };
  }, []);

  return _appState;
}
