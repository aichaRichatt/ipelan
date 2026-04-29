# useUserStats Hook - Documentation Complète

## Vue d'ensemble

Le hook `useUserStats` est le **point central** pour gérer toutes les statistiques utilisateur :
- XP (points d'expérience)
- Streak (jours consécutifs)
- Badges IPELAN
- Coins (pièces)
- Progression des cours

## Architecture de données

```
┌──────────────────────────────────────────────────────────────┐
│                    DONNÉES UTILISATEUR                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐        ┌──────────────┐        ┌─────────┐  │
│  │   SQLite     │◀──────▶│  useUserStats │◀──────▶│ Moodle  │  │
│  │   (Local)    │        │    Hook       │        │  (API)  │  │
│  └──────────────┘        └──────────────┘        └─────────┘  │
│         ▲                                              ▲        │
│         │                                              │        │
│         └──────────── Sync Bidirectionnel ───────────┘        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Interface

```typescript
const { 
  stats,           // Toutes les stats actuelles
  isLoading,       // Chargement initial
  isSyncing,       // Sync en cours
  error,           // Erreur éventuelle
  refetch,         // Recharger les données
  syncToMoodle,    // Forcer la sync
  addXP,           // Ajouter XP
  updateStreak,    // Mettre à jour streak
  addBadge,        // Ajouter un badge
  addCoins,        // Ajouter des coins
} = useUserStats();
```

## Structure des données

### `stats` object

```typescript
{
  xp: number;                    // XP total
  coins: number;                 // Pièces
  streak: number;                // Jours consécutifs actuels
  streakBest: number;            // Meilleur streak
  badges: number;              // Nombre de badges
  coursesInProgress: number;   // Cours en cours
  coursesCompleted: number;      // Cours terminés
  lastActivity: string | null;  // Dernière activité (ISO date)
}
```

## Flux de données

### 1. Chargement initial (loadStats)

```
1. Charge depuis SQLite (rapide, offline)
   - XP, coins, streak, badges
   - Progression des cours

2. Si ONLINE :
   - Récupère depuis Moodle API
   - Fusionne les données (max des deux)
   - Si local > Moodle → push vers Moodle
   - Si Moodle > local → update SQLite

3. Met à jour le state React
```

### 2. Modification locale (addXP, addBadge, etc.)

```
1. Update SQLite immédiatement
2. Update state React (UI réactive)
3. Queue sync vers Moodle (background)
4. Retry automatique si échec
```

### 3. Sync manuelle (syncToMoodle)

```
1. Sync XP + streak
2. Sync badges
3. Retourne succès/échec
```

## Utilisation dans les composants

### Afficher les stats

```tsx
function HomeScreen() {
  const { stats, isLoading } = useUserStats();
  
  if (isLoading) return <Loading />;
  
  return (
    <View>
      <Text>XP: {stats.xp}</Text>
      <Text>Streak: {stats.streak} jours</Text>
      <Text>Badges: {stats.badges}</Text>
    </View>
  );
}
```

### Ajouter XP après une activité

```tsx
function QuizScreen() {
  const { addXP } = useUserStats();
  
  const handleQuizComplete = async (score: number) => {
    const xpEarned = score * 10;
    await addXP(xpEarned);
    // La sync Moodle se fait automatiquement en background !
  };
}
```

### Ajouter un badge

```tsx
function ActivityScreen() {
  const { addBadge } = useUserStats();
  
  const checkAndAwardBadges = async () => {
    // Vérifier si conditions remplies
    if (completedLessons >= 5) {
      await addBadge('learner'); // ID du badge
    }
  };
}
```

### Forcer la sync (pull-to-refresh)

```tsx
function ProfileScreen() {
  const { syncToMoodle, isSyncing } = useUserStats();
  
  const handleRefresh = async () => {
    const success = await syncToMoodle();
    if (success) {
      Alert.alert('Sync réussie !');
    }
  };
}
```

## Stockage SQLite

### Tables utilisées

```sql
-- Stats utilisateur
CREATE TABLE user_progress (
  user_id INTEGER PRIMARY KEY,
  xp INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  streak_current INTEGER DEFAULT 0,
  streak_best INTEGER DEFAULT 0,
  last_activity TEXT
);

-- Badges
CREATE TABLE user_badges (
  id TEXT PRIMARY KEY,  -- "userId_badgeId"
  user_id INTEGER,
  badge_id TEXT,
  earned_at TEXT,
  synced_at TEXT
);

-- Progression des cours
CREATE TABLE course_progress (
  course_id TEXT PRIMARY KEY,
  completedActivities INTEGER,
  totalActivities INTEGER,
  totalXP INTEGER
);
```

## Sync Moodle

### Champs personnalisés requis

Dans **Administration → Utilisateurs → Champs personnalisés** :

| Shortname | Type | Description |
|-----------|------|-------------|
| `ipelan_xp` | Texte | XP total |
| `ipelan_streak` | Texte | Streak actuel |
| `ipelan_badges` | Texte | IDs badges (séparés par virgule) |
| `ipelan_badges_count` | Texte | Nombre de badges |
| `ipelan_coins` | Texte | Pièces |
| `ipelan_last_activity` | Texte | Date dernière activité |

### API Moodle utilisées

- `core_user_get_users` - Récupérer les champs perso
- `core_user_update_users` - Mettre à jour les champs perso

## Gestion des erreurs

### Offline
- Toutes les modifications sont sauvegardées localement
- Sync automatique quand la connexion revient
- Queue avec retry (5 tentatives max)

### Conflict Resolution
```
Si Local > Moodle :
  → Push local vers Moodle
  
Si Moodle > Local :
  → Update SQLite avec Moodle
  
Si Égal :
  → Pas d'action
```

## Performance

- **Chargement initial** : Depuis SQLite (instantané)
- **Sync background** : Async, ne bloque pas l'UI
- **Optimistic updates** : UI mise à jour immédiatement

## Exemple complet

```tsx
import { useUserStats } from '@/hooks/useUserStats';
import { calculateNewBadges } from '@/constants/badges';

function GameScreen() {
  const { 
    stats, 
    addXP, 
    updateStreak, 
    addBadge,
    addCoins 
  } = useUserStats();
  
  const handleGameComplete = async (score: number) => {
    // 1. Calculer les récompenses
    const xp = score * 10;
    const coins = Math.floor(score / 2);
    
    // 2. Mettre à jour les stats (local + sync auto)
    await addXP(xp);
    await addCoins(coins);
    await updateStreak();
    
    // 3. Vérifier les nouveaux badges
    const progressData = {
      completedLessons: stats.coursesCompleted,
      currentStreak: stats.streak,
      totalXP: stats.xp + xp,
      quizPassed: 1,
      perfectScores: score === 100 ? 1 : 0,
      daysActive: 1
    };
    
    const newBadges = calculateNewBadges(
      progressData, 
      [] // badges existants
    );
    
    for (const badge of newBadges) {
      await addBadge(badge.id);
    }
    
    // 4. Tout est sync automatiquement vers Moodle !
  };
}
```

## Points clés

✅ **Offline-first** - Fonctionne sans internet  
✅ **Sync automatique** - Background, sans interruption  
✅ **Réactif** - UI se met à jour immédiatement  
✅ **Résilient** - Retry automatique, pas de perte de données  
✅ **Simple** - API propre et facile à utiliser  
