import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../services/redux/slices/authSlice';
import { getToken, getUserData } from '../services/storage/tokenStorage';

export function useAuthRestore() {
  const dispatch = useDispatch();

  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const token = await getToken();
        const userData = await getUserData();

        if (token && userData) {
          dispatch(loginSuccess({ user: userData, token }));
        }
      } catch (error) {
        console.warn('[AuthRestore] Failed to restore auth state:', error);
      }
    };

    restoreAuth();
  }, [dispatch]);
}
