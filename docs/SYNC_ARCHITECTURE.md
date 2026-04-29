# Architecture de Synchronisation IPELAN

## Vue d'ensemble

L'application utilise une architecture **Offline-First** avec synchronisation bidirectionnelle automatique vers Moodle.

```
┌─────────────────────────────────────────────────────────────┐
│                    APP IPELAN                               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  useUserStats│    │  useSyncStatus│    │  Sync Queue  │  │
│  │   Hook       │───▶│   Hook        │───▶│   Service    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                       │                  │        │
│         ▼                       ▼                  ▼        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   SQLite     │    │  UI Indicator│    │    Moodle    │  │
│  │  (Local DB)  │◀──▶│   (Subtle)   │◀──▶│     API      │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Composants

### 1. `useUserStats` Hook
**Fichier**: `hooks/useUserStats.ts`

Gère le chargement et la synchronisation des statistiques utilisateur.

```typescript
const { stats, isLoading, isSyncing, error, refetch, syncToMoodle } = useUserStats();

// stats contient:
{
  xp: number;           // XP total
  coins: number;        // Pièces
  streak: number;         // Jours série actuels
  streakBest: number;     // Meilleur streak
  badges: number;         // Nombre de badges
  coursesInProgress: number;
  coursesCompleted: number;
  lastActivity: string | null;
}
```

**Flux de données**:
1. Charge depuis SQLite (rapide, offline)
2. Si online → récupère depuis Moodle
3. Compare et fusionne (prend les valeurs max)
4. Si local > Moodle → push vers Moodle
5. Si Moodle > local → update SQLite

### 2. `syncQueue` Service
**Fichier**: `services/sync/syncQueue.ts`

Gère la file d'attente de synchronisation avec retry automatique.

**Features**:
- Queue persistante en mémoire
- Retry avec backoff exponentiel (1s, 2s, 4s, 8s... max 30s)
- Max 5 tentatives par job
- Détection online/offline
- Fusion des jobs dupliqués

**Types de jobs**:
- `xp` - Synchronisation XP
- `streak` - Synchronisation streak
- `coins` - Synchronisation pièces
- `course_progress` - Progression des cours

### 3. `useSyncStatus` Hook
**Fichier**: `hooks/useSyncStatus.ts`

Fournit un indicateur visuel subtil du statut de sync.

```typescript
const { icon, color, opacity, isSyncing, isSynced } = useSyncStatus();

// Status:
// - 'synced':  Synchronisé (vert transparent)
// - 'syncing': En cours (bleu discret)
// - 'pending': En attente (orange très discret)
// - 'error':   Erreur (rouge très discret)
```

## Utilisation

### Dans les composants:

```typescript
// HomeScreen.tsx
const { stats, isSyncing } = useUserStats();
const { isAutoSyncing } = useSyncStatus();

// Affichage des stats
<Text>{stats.xp} XP</Text>
<Text>{stats.streak} jours</Text>

// Indicateur subtil (petit point bleu quand sync)
{isAutoSyncing && (
  <View className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-blue-400" 
        style={{ opacity: 0.6 }} />
)}
```

### Après une activité:

```typescript
import { syncQueue } from '@/services/sync/syncQueue';

// Après complétion d'un quiz
syncQueue.syncXP(userId, newXP, currentStreak, token);

// Après gain de pièces
syncQueue.syncCoins(userId, newCoins, token);

// Après progression dans un cours
syncQueue.syncCourseProgress(userId, courseId, {
  completedActivities: 5,
  totalActivities: 10,
  totalXP: 250
}, token);
```

## Configuration Moodle Requise

Créer ces champs personnalisés utilisateur dans Moodle:

| Shortname | Type | Nom | Description |
|-----------|------|-----|-------------|
| `ipelan_xp` | Texte | IPELAN XP | XP total de l'utilisateur |
| `ipelan_streak` | Texte | IPELAN Streak | Jours consécutifs |
| `ipelan_last_activity` | Texte | IPELAN Last Activity | Date dernière activité (YYYY-MM-DD) |
| `ipelan_coins` | Texte | IPELAN Coins | Pièces accumulées |

### Configuration API Moodle:
Activer dans **Administration** → **Plugins** → **Web services**:
- `core_user_update_users` - Pour mettre à jour les champs perso
- `core_user_get_users` - Pour récupérer les données

## Stratégie de Sync

### Offline-First
1. **Écriture**: Toujours en local d'abord (SQLite)
2. **Lecture**: SQLite prioritaire (rapide)
3. **Sync**: Background quand online disponible

### Conflict Resolution
```
Si Local > Moodle:
  → Push Local vers Moodle
  
Si Moodle > Local:
  → Update Local avec Moodle
  
Si Égal:
  → Pas d'action
```

### Retry Strategy
```
Tentative 1: Immédiate
Tentative 2: Après 1s
Tentative 3: Après 2s
Tentative 4: Après 4s
Tentative 5: Après 8s
Max delay: 30s entre tentatives
```

## Logs et Debugging

En mode développement (`IS_DEV = true`):

```
[useUserStats] Local stats loaded: { xp: 150, streak: 5, ... }
[useUserStats] Moodle data: { moodleXP: 100, badges: 3 }
[useUserStats] Local > Moodle, pushing to Moodle: { localXP: 150, moodleXP: 100 }
[useUserStats] Moodle > Local, updating SQLite XP: 200
[SyncQueue] Job added: xp { xp: 150, streak: 5 }
[SyncQueue] Job completed: xp
```

## Points Clés

✅ **100% Offline** - L'app fonctionne sans internet  
✅ **Sync silencieuse** - Pas d'interruption utilisateur  
✅ **Résiliente** - Retry automatique avec backoff  
✅ **Rapide** - Chargement immédiat depuis SQLite  
✅ **Sûre** - Données jamais perdues (SQLite + Moodle)  

## Fichiers Modifiés/Créés

```
hooks/
  useUserStats.ts        # Hook stats avec sync
  useSyncStatus.ts       # Hook indicateur visuel

services/sync/
  syncQueue.ts           # Service de file d'attente

services/api/
  userProgressService.ts # Fonctions setXP/setStreak

app/(tabs)/(home)/
  index.tsx              # Utilisation des hooks
```

## Tests Recommandés

1. **Nouveau compte**: Vérifier création champs Moodle
2. **Offline**: Fermer wifi → faire activité → vérifier SQLite
3. **Sync**: Ouvrir wifi → vérifier données montent
4. **Conflict**: Modifier sur 2 appareils → vérifier merge
5. **Retry**: Couper wifi pendant sync → vérifier retry
