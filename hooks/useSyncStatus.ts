/**
 * Hook pour afficher le statut de sync de manière subtile
 * Indicateur visuel automatique, sans interruption utilisateur
 */

import { syncQueue, SyncStatus } from '@/services/sync/syncQueue';
import { useEffect, useState } from 'react';

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>('synced');

  useEffect(() => {
    const unsubscribe = syncQueue.subscribe(setStatus);
    return () => { unsubscribe(); };
  }, []);

  // Retourne un objet avec l'icône et la couleur appropriées
  const getSyncIndicator = () => {
    switch (status) {
      case 'syncing':
        return { icon: 'sync', color: '#4a90e2', opacity: 0.6 }; // Bleu discret
      case 'pending':
        return { icon: 'cloud-upload', color: '#F59E0B', opacity: 0.5 }; // Orange très discret
      case 'error':
        return { icon: 'cloud-offline', color: '#EF4444', opacity: 0.4 }; // Rouge très discret
      default:
        return { icon: 'checkmark-circle', color: '#10B981', opacity: 0 }; // Vert transparent (invisible)
    }
  };

  return {
    status,
    ...getSyncIndicator(),
    isSynced: status === 'synced',
    isSyncing: status === 'syncing',
    hasPending: status === 'pending',
    hasError: status === 'error',
  };
}
