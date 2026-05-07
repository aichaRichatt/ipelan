# useUserStats — Documentation

> Hook principal pour toutes les statistiques utilisateur.  
> Fichier : `hooks/useUserStats.ts`

---

## API du hook

```typescript
const {
  stats,          // Toutes les statistiques actuelles
  isLoading,      // Chargement initial en cours
  isSyncing,      // Sync Moodle en cours
  error,          // Message d'erreur éventuel
  refetch,        // Recharger depuis SQLite + Moodle
  syncToMoodle,   // Forcer une sync manuelle vers Moodle
  addXP,          // Ajouter de l'XP
  updateStreak,   // Mettre à jour le streak du jour
  addBadge,       // Ajouter un badge (vérifie les doublons)
  addCoins,       // Ajouter des pièces
} = useUserStats();
```

---

## Structure de `stats`

```typescript
interface UserStats {
  xp: number;             // XP total
  coins: number;          // Pièces
  streak: number;         // Jours consécutifs actuels
  streakBest: number;     // Meilleur streak historique
  badges: number;         // Nombre de badges gagnés
  lives: number;          // Vies restantes (0–6)
  nextHeartTime: string | null; // ISO datetime prochaine regen vie (null si max)
  coursesInProgress: number;    // Cours en cours (toujours 0 — non implémenté)
  coursesCompleted: number;     // Cours terminés (toujours 0 — non implémenté)
  lastActivity: string | null;  // ISO date dernière activité
}
```

> `coursesInProgress` et `coursesCompleted` dans `stats` ne sont pas calculés.  
> Utiliser `useMoodleCourses` pour la progression par cours.

---

## Flux de chargement — `loadStats()`

```
1. Lit depuis SQLite (users, user_badges, user_streaks) — instantané, offline
2. dispatch(updateUser) → Redux immédiat pour l'UI

3. Si online :
   a. getUserGamificationProfile(token, userId) → Moodle customfields
   b. Fusion : xp_merged = max(local.xp, moodle.xp)
               coins_merged = max(local.coins, moodle.coins)
               streak_merged = max(local.streak, moodle.streak)
               lives → recalcul via checkAndRegenerateLives(serverLastLivesUpdate)
   c. Si local > Moodle → syncQueue.syncGamification() → push vers Moodle
   d. Si Moodle > local → saveUser() → update SQLite
   e. dispatch(updateUser) → UI mise à jour

4. Si offline : utilise uniquement SQLite
```

---

## Actions disponibles

### `addXP(amount: number)`
```typescript
const { addXP } = useUserStats();
await addXP(50);
// → SQLite users.ipelan_xp += 50
// → dispatch(updateUser)
// → syncQueue.syncGamification()  ← sync Moodle auto
```

### `addCoins(amount: number)`
```typescript
await addCoins(10);
// → SQLite users.coins += 10
// → dispatch(updateUser)
// → syncQueue.syncGamification()
```

### `updateStreak()`
```typescript
await updateStreak();
// → Calcule si nouvelle journée (compare last_activity_date)
// → SQLite user_streaks.current_streak++
// → dispatch(updateUser)
// → syncQueue.syncGamification()
```

### `addBadge(badgeId: string)`
```typescript
await addBadge('learner');
// → Vérifie hasBadge() → ignore si déjà gagné
// → saveBadge(userId, badgeId) → SQLite user_badges
// → dispatch(updateUser)
// → syncQueue.syncGamification()
```

### `syncToMoodle()` — sync manuelle
```typescript
const success = await syncToMoodle();
// → verifyUserIdentityBeforeSync(token) — vérification sécurité
// → syncQueue.syncGamification(userId, token)
// → retourne true/false
```

---

## Utilisation dans les écrans

### Afficher les stats (home, progress)
```tsx
function HomeScreen() {
  const { stats, isLoading } = useUserStats();

  return (
    <View>
      <Text>{stats.xp} XP</Text>
      <Text>{stats.streak} jours 🔥</Text>
      <Text>{stats.lives}/6 ❤️</Text>
      <Text>{stats.coins} 🪙</Text>
    </View>
  );
}
```

### Après une activité (result.tsx)
```tsx
// result.tsx utilise directement saveActivityScore() + syncAfterActivity()
// et ne passe pas par useUserStats pour le push de notes.
// useUserStats est utilisé pour afficher les stats mises à jour.

const { refetch } = useUserStats();
useFocusEffect(useCallback(() => { refetch(); }, [refetch]));
```

### Pull-to-refresh
```tsx
const { refetch, isLoading } = useUserStats();
<RefreshControl refreshing={isLoading} onRefresh={refetch} />
```

---

## Sources de données par stat

| Stat | Source SQLite | Source Moodle |
|------|--------------|---------------|
| `xp` | `users.ipelan_xp` | `ipelan_xp` customfield |
| `coins` | `users.coins` | `ipelan_coins` customfield |
| `streak` | `user_streaks.current_streak` | `ipelan_streak` customfield |
| `streakBest` | `user_streaks.best_streak` | — |
| `lives` | `users.lives` (regen calculée) | `ipelan_lives` + `ipelan_last_lives_update` |
| `nextHeartTime` | Calculé depuis `last_lives_update` | — |
| `badges` | `COUNT(user_badges WHERE user_id=?)` | `ipelan_badges_count` customfield |
| `lastActivity` | `users.last_activity` | `ipelan_last_activity` customfield |

---

## Triggers automatiques de refetch

| Événement | Mécanisme |
|-----------|-----------|
| Tab progress focus | `useFocusEffect` → `refetchUserStats()` |
| XP change | `useEffect([userStats.xp])` dans progress/index.tsx |
| App foreground | `handleForeground()` dans useUserStats → recalcul vies |

---

## Logs de debug

```
[useUserStats] Local stats loaded: { xp: 150, streak: 5, lives: 4 }
[useUserStats] Moodle data: { moodleXP: 100, ... }
[useUserStats] Local > Moodle, pushing to Moodle
[useUserStats] Moodle > Local, updating SQLite XP: 200
[useUserStats] Offline mode - using local data
[useUserStats] App came to foreground, recalculating lives...
```
