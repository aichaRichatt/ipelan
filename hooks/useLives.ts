import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../services/redux/store';
import { updateUser } from '../services/redux/slices/authSlice';
import { buyLife as buyLifeService } from '../services/gamification/gamificationService';
import { syncQueue } from '../services/sync/syncQueue';

export const useLives = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  
  const [isBuying, setIsBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lives = user?.lives ?? 6;
  const coins = user?.coins ?? 0;
  const maxLives = 6;
  const lifeCost = 20;

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
  }, [user?.id, canBuyLife, dispatch]);

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
