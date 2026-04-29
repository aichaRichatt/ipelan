# Synchronisation de la Gamification (XP, Badges, Coins)

## ✅ Corrections Apportées

### 1. **Service Centralisé de Gamification** 
**Fichier**: `services/gamification/gamificationService.ts`

Service unique qui gère:
- ✅ Calcul des badges gagnés selon les critères
- ✅ Détermination du **dernier badge obtenu**
- ✅ Synchronisation vers Moodle (XP, coins, dernier badge)

```typescript
const gamification = createGamificationService(userId, token);

// Traiter une activité terminée
const result = await gamification.processActivityResult({
  xpEarned: 50,
  coinsEarned: 10,
  activityType: 'quiz',
  metadata: { score: 85 }
});

// Retourne:
{
  newBadges: [...],     // Nouveaux badges gagnés
  lastBadge: 'learner', // Dernier badge obtenu
  totalXP: 150,
  totalCoins: 60
}
```

### 2. **Stockage du Dernier Badge**
Le champ personnalisé **`ipelan_badges`** stocke UNIQUEMENT le **dernier badge obtenu**, pas la liste complète.

```
Avant (INCORRECT):
ipelan_badges = "first_step,learner,streak_3,quiz_master"

Après (CORRECT):
ipelan_badges = "learner"  // Dernier badge uniquement
```

**Pourquoi ?** Le dernier badge indique la progression actuelle de l'utilisateur de manière simple et lisible.

### 3. **Sync Queue Améliorée**
**Fichier**: `services/sync/syncQueue.ts`

Nouveau type de job: **`last_badge`**

```typescript
// Synchroniser le dernier badge
syncQueue.syncLastBadge(userId, 'learner', token);
```

### 4. **Détermination Intelligente du Dernier Badge**

```typescript
export function determineLastBadge(allBadges, newlyEarnedIds): string | null {
  // 1. Si nouveaux badges gagnés → prendre le plus avancé
  if (newlyEarnedIds.length > 0) {
    return getMostAdvancedBadge(newlyEarnedIds);
  }
  
  // 2. Sinon → retourner le dernier existant
  return getMostRecentBadge(allBadges);
}
```

---

## 📋 Configuration Moodle Requise

### Champs Personnalisés (OBLIGATOIRES)

Dans **Administration → Utilisateurs → Champs de profil utilisateur** :

| Shortname | Type | Description | Exemple de valeur |
|-----------|------|-------------|-------------------|
| `ipelan_xp` | Entier | XP total | `150` |
| `ipelan_coins` | Entier | Pièces | `45` |
| `ipelan_streak` | Entier | Jours consécutifs | `5` |
| `ipelan_badges` | Texte | **Dernier badge obtenu** | `learner` |
| `ipelan_badges_count` | Entier | Nombre total de badges | `3` |
| `ipelan_last_activity` | Texte | Date dernière activité | `2026-04-29` |

### ⚠️ Important
- Les shortnames doivent être **EXACTEMENT** comme indiqué ci-dessus
- Le champ `ipelan_badges` doit être de type **Texte** (pas Texte court)

---

## 🔄 Flux de Données

### Après une Activité (ex: quiz réussi)

```
[Quiz Complété]
    ↓
[GamificationService.processActivityResult]
    ↓
├─► Calcul XP gagné (score × 10)
├─► Calcul coins gagnés (score ÷ 2)
├─► Vérifier nouveaux badges (conditions dans constants/badges.ts)
├─► Déterminer dernier badge
    ↓
[Update SQLite Local]
    ↓
[Update State React] (UI réactive)
    ↓
[Queue Sync Moodle] (background)
    ├─► syncQueue.syncXP(xp, streak)
    ├─► syncQueue.syncCoins(coins)
    ├─► syncQueue.syncBadges(allBadges)
    └─► syncQueue.syncLastBadge(lastBadge) ← STOCKE ipelan_badges
```

### Au Login (Récupération des données)

```
[Login]
    ↓
[getUserXP] → Récupère ipelan_xp depuis Moodle
[getBadgesFromMoodle] → Récupère ipelan_badges_count
    ↓
[Merge avec SQLite Local]
    ├─► Si Moodle > Local → update SQLite
    ├─► Si Local > Moodle → push vers Moodle
    └─► Si égal → pas d'action
    ↓
[Affichage dans l'app]
```

---

## 🎯 Utilisation dans les Composants

### Après un Quiz

```typescript
import { createGamificationService } from '@/services/gamification/gamificationService';

function QuizScreen() {
  const handleQuizComplete = async (score: number) => {
    const gamification = createGamificationService(userId, token);
    
    const result = await gamification.processActivityResult({
      xpEarned: score * 10,
      coinsEarned: Math.floor(score / 2),
      activityType: 'quiz',
      metadata: { score }
    });
    
    if (result.newBadges.length > 0) {
      showBadgePopup(result.newBadges[0]); // 🎉 Nouveau badge !
    }
    
    console.log('Dernier badge:', result.lastBadge);
    console.log('XP total:', result.totalXP);
  };
}
```

### Après une Leçon

```typescript
const handleLessonComplete = async () => {
  const gamification = createGamificationService(userId, token);
  
  await gamification.processActivityResult({
    xpEarned: 20,
    coinsEarned: 5,
    activityType: 'lesson',
    metadata: { lessonId: '123' }
  });
};
```

### Pour le Streak Quotidien

```typescript
const handleDailyLogin = async () => {
  const gamification = createGamificationService(userId, token);
  
  await gamification.processActivityResult({
    xpEarned: 10,
    coinsEarned: 2,
    activityType: 'streak'
  });
};
```

---

## 📊 Extraction Correcte des Custom Fields

### ❌ Avant (INCORRECT)

```typescript
// NE FONCTIONNE PAS !
const userXP = moodleUser.ipelan_xp; // undefined
const coins = moodleUser.coins;      // undefined
```

### ✅ Après (CORRECT)

```typescript
// Depuis moodleUser.customfields
const extractCustomField = (user: any, shortname: string): string | null => {
  const field = user.customfields?.find(
    (f: any) => f.shortname === shortname
  );
  return field?.value || null;
};

// Utilisation
const xp = extractCustomField(moodleUser, 'ipelan_xp');
const coins = extractCustomField(moodleUser, 'ipelan_coins');
const lastBadge = extractCustomField(moodleUser, 'ipelan_badges');
```

**Implémenté dans**: `services/api/badgeService.ts` → `getBadgesFromMoodle()`

---

## 🧪 Plan de Vérification

### Test 1: Synchronisation
1. Compléter une activité dans l'app
2. Vérifier dans Moodle Admin que `ipelan_xp` a augmenté
3. Vérifier que `ipelan_badges` contient le dernier badge

### Test 2: Récupération
1. Modifier manuellement `ipelan_xp` dans Moodle
2. Se déconnecter/reconnecter dans l'app
3. Vérifier que l'XP affiché correspond à Moodle

### Test 3: Offline
1. Passer en mode avion
2. Compléter une activité (doit fonctionner)
3. Remettre le réseau (sync automatique)
4. Vérifier dans Moodle que les données sont à jour

---

## 📁 Fichiers Modifiés/Créés

```
services/
  gamification/
    gamificationService.ts  ✅ NEW - Service centralisé
  
  api/
    badgeService.ts         ✅ MODIFIED - Sync badges + dernier badge
    userProgressService.ts  ✅ EXISTANT - XP, coins, streak
    xpService.ts            ✅ EXISTANT - Récupération XP
  
  storage/
    badge-storage.ts        ✅ EXISTANT - Stockage SQLite badges
  
  sync/
    syncQueue.ts            ✅ MODIFIED - Ajout last_badge job

constants/
  badges.ts                 ✅ EXISTANT - Définitions badges

hooks/
  useUserStats.ts           ✅ EXISTANT - Hook principal stats
```

---

## ✅ Résumé des Corrections

| Problème | Solution | Statut |
|----------|----------|--------|
| Pas de service centralisé | Création `gamificationService.ts` | ✅ |
| Stockage liste badges dans ipelan_badges | Stockage dernier badge uniquement | ✅ |
| Pas de sync du dernier badge | Ajout type `last_badge` dans syncQueue | ✅ |
| Extraction incorrecte customfields | Fonction extractCustomField | ✅ |
| Pas de calcul automatique badges | Fonction calculateEarnedBadges | ✅ |

---

**Le système est prêt à être testé !** 🚀

N'oubliez pas de créer les champs personnalisés dans Moodle avant de tester.
