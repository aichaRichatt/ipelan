import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { buyLife as buyLifeService, getGlobalGamificationStats, LIFE_COST, MAX_LIVES } from '../services/gamification/gamificationService';
import { updateUser } from '../services/redux/slices/authSlice';
import { RootState } from '../services/redux/store';
import { syncQueue } from '../services/sync/syncQueue';

export const useLives = (onPurchaseSuccess?: () => void) => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);

  const onPurchaseSuccessRef = useRef(onPurchaseSuccess);
  useEffect(() => {
    onPurchaseSuccessRef.current = onPurchaseSuccess;
  });

  const [isBuying, setIsBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const capturedLives = user.lives;
    const capturedCoins = user.coins;
    const timer = setTimeout(() => {
      getGlobalGamificationStats(user.id).then(stats => {
        if (stats.lives !== capturedLives || stats.coins !== capturedCoins) {
          dispatch(updateUser({
            lives: stats.lives,
            coins: stats.coins,
          }));
        }
      }).catch(() => { });
    }, 100);
    return () => clearTimeout(timer);
  }, [user?.lives, user?.coins, user?.id, dispatch]);

  const lives = user?.lives ?? MAX_LIVES;
  const coins = user?.coins ?? 0;
  const maxLives = MAX_LIVES;
  const lifeCost = LIFE_COST;

  const canBuyLife = lives < maxLives && coins >= lifeCost;
  const canPlay = lives > 0;

  const buyLife = useCallback(async () => {
    if (!user?.id) return { success: false, message: 'Non connecté' };
    if (!canBuyLife) return { success: false, message: 'Fonds insuffisants ou vies au maximum' };

    setIsBuying(true);
    setError(null);

    try {
      const result = await buyLifeService(user.id);

      if (result.success) {
        dispatch(updateUser({
          lives: result.newLives,
          coins: result.newCoins
        }));

        onPurchaseSuccessRef.current?.();

        // Déclencher la synchro Moodle
        if (token) {
          syncQueue.syncGamification(user.id, token);
        }
      } else {
        setError(result.message);
      }
      return result;
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'achat');
      return { success: false, message: err.message || 'Erreur lors de l\'achat' };
    } finally {
      setIsBuying(false);
    }
  }, [user?.id, canBuyLife, dispatch, token]);

  return {
    lives,
    coins,
    maxLives,
    lifeCost,
    canBuyLife,
    canPlay,
    isBuying,
    error,
    buyLife
  };
};
