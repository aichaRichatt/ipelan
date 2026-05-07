# IPELAN — Gamification & Synchronisation

> Décrit le système de gamification (XP, vies, pièces, streak, badges) et sa synchronisation vers Moodle.

---

## Composants

| Fichier | Rôle |
|---------|------|
| `services/gamification/gamificationService.ts` | Logique cœur : calcul vies, XP global, sync Moodle |
| `services/sync/syncQueue.ts` | File d'attente in-memory + SQLite (gamification_queue) |
| `services/api/xpService.ts` | Lecture/écriture des custom fields Moodle |
| `services/api/badgeService.ts` | Lecture badges depuis Moodle |
| `services/storage/badge-storage.ts` | Persistance badges en SQLite (user_badges) |
| `services/storage/streak.ts` | Lecture/écriture streak (user_streaks) |
| `hooks/useUserStats.ts` | Hook principal — état, actions, sync |
| `hooks/useLives.ts` | Gestion des vies (achat, consommation) |
| `constants/badges.ts` | Définitions et critères des badges |

---

## Flux complet — Fin d'activité

```
Utilisateur termine une activité
         │
         ▼
result.tsx
  ├─ saveActivityScore() → SQLite activity_progress
  ├─ calculateNewBadges() → saveBadge() → SQLite user_badges
  ├─ dispatch(updateUser {xp, coins, lives, streak}) → Redux
  └─ syncQueue.syncGamification(userId, token)
         │
         ▼
syncQueue.ts — SyncQueue.addJob('gamification', userId, token, {})
  ├─ Dédup : remplace job existant du même (type, userId)
  ├─ persistGamificationJob() → SQLite gamification_queue
  └─ processQueue()
         │
         ▼
gamificationService.ts — triggerGamificationSync(userId, token)
  ├─ getGlobalGamificationStats(userId) → lecture SQLite
  └─ syncUserGamificationToMoodle(userId, {xp, coins, lives, streak, badges}, token)
         │
         ▼
xpService.ts — updateUserGamification(token, userId, data)
  └─ core_user_update_users (customfields)
       ├─ ipelan_xp
       ├─ ipelan_coins
       ├─ ipelan_lives
       ├─ ipelan_streak
       ├─ ipelan_last_lives_update
       ├─ ipelan_badges (IDs séparés par virgule)
       ├─ ipelan_badges_count
       ├─ ipelan_last_badge
       └─ ipelan_last_activity
```

---

## Système de Vies

### Règles
- Maximum : **6 vies**
- Régénération : **1 vie toutes les 6 heures**
- Coût achat : configurable via `lifeCost` dans `useLives`
- Activités interactives (quiz, dictée, écoute, association, word order) coûtent **1 vie**
- Contenu statique (EPUB, PDF, leçons) est **gratuit**

### Régénération offline
`services/background/lifeRegeneration.ts` — tâche expo-background-fetch (15 min) :
1. Lit `users.lives` et `users.last_lives_update` depuis SQLite
2. Calcule `Math.floor(elapsed / REGEN_INTERVAL_MS)` vies à ajouter
3. Conserve le reliquat dans `last_lives_update` pour le cycle suivant

### Multi-device
`checkAndRegenerateLives()` compare le timestamp local vs le timestamp serveur (`serverLastLivesUpdate` venant de `ipelan_last_lives_update` Moodle) et prend le plus récent.

---

## Système de Badges

### Définitions (`constants/badges.ts`)

| Badge | Critère |
|-------|---------|
| `first_step` | 1ère activité complétée |
| `learner` | 5 activités complétées |
| `streak_3` | Streak 3 jours |
| `streak_7` | Streak 7 jours |
| `quiz_master` | N quiz réussis |
| `perfect_score` | Score parfait (100%) |
| *(etc.)* | Voir `constants/badges.ts` |

### Lecture custom fields Moodle

```typescript
// ✅ Extraction correcte
const extractCustomField = (user: any, shortname: string): string | null => {
  const field = user.customfields?.find((f: any) => f.shortname === shortname);
  return field?.value || null;
};

const xp    = extractCustomField(moodleUser, 'ipelan_xp');
const badges = extractCustomField(moodleUser, 'ipelan_badges'); // "id1,id2,id3"
```

### Stockage `ipelan_badges`

Le champ `ipelan_badges` contient la **liste complète** des IDs séparés par virgule.  
`ipelan_last_badge` contient le **dernier badge obtenu** uniquement.

---

## Fusion au login (useUserStats)

Au démarrage, `loadStats()` dans `useUserStats.ts` :

```
1. Charge depuis SQLite (xp, coins, streak, lives, badges)
2. Si online → getUserGamificationProfile(token, userId) → Moodle customfields
3. Fusion (prend le MAX pour chaque valeur)
   ├─ xp     = max(local.xp, moodle.xp)
   ├─ coins  = max(local.coins, moodle.coins)
   ├─ streak = max(local.streak, moodle.streak)
   └─ lives  = valeur Moodle si plus récente (multi-device)
4. Si local > Moodle → syncGamification() push vers Moodle
5. Si Moodle > local → saveUser() update SQLite
6. dispatch(updateUser) → Redux pour l'UI
```

---

## XP — Calcul

Défini dans `utils/xpCalculator.ts` (`XP_CONFIG`) :

| Type activité | XP de base |
|---------------|-----------|
| `quiz` | Selon score (baseXP × ratio) |
| `dictation` | Selon score |
| `listening` | Selon score |
| `association` | Selon score |
| `wordOrder` | Selon score |
| `lesson` / `html` | XP fixe |
| `resource` / `folder` | XP fixe minimal |

Niveau calculé dans `utils/levelCalculator.ts` via `getLevelFromXP(xp)`.

---

## Pièces — Achat de vies

```
useLives.ts — buyLife()
  ├─ Vérifie coins >= lifeCost
  ├─ coins -= lifeCost  → SQLite + Redux
  ├─ lives += 1         → SQLite + Redux
  └─ syncQueue.syncGamification(userId, token)
```

---

## Tests recommandés

1. **Fin d'activité** → vérifier dans Moodle Admin que `ipelan_xp` a augmenté
2. **Offline** → passer en mode avion → finir une activité → reconnecter → vérifier sync
3. **Crash app** → finir activité → kill l'app avant sync → relancer → vérifier que job est restauré depuis `gamification_queue`
4. **Multi-device** → modifier `ipelan_xp` manuellement dans Moodle → relancer app → vérifier fusion (max)
5. **Vies** → vérifier régénération après 6h (changer `REGEN_INTERVAL_MS` pour test)
