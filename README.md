# IPELAN Mobile Application

**Apprentissage des Langues Mauritaniennes — Pulaar, Soninké, Wolof**

Application mobile éducative pour enfants, développée avec React Native / Expo SDK 54.

---

## Fonctionnalités

- **5 types d'activités interactives** : Quiz, Listening, Dictée, Association, Ordre des mots
- **Système de progression gamifié** : XP, badges, classements
- **Support hors ligne complet** : Contenus EPUB, SQLite local
- **Interface adaptée aux enfants** : Cibles tactiles grandes, animations
- **Backend Moodle** : Synchronisation avec serveur éducatif

---

## Installation

```bash
# Cloner le projet
git clone <repo-url>
cd ipelan

# Installer les dépendances
npm install

# Démarrer le serveur Expo
bun expo start
```

---

## Scripts Disponibles

```bash
# Développement
bun expo start              # Démarrer Expo (avec .env)
npm start                   # Alternative
npm run android            # Démarrer pour Android
npm run ios                 # Démarrer pour iOS
npm run web                 # Démarrer pour Web

# Qualité du code
npm run lint                # ESLint + TypeScript check

# Build
npx expo export             # Exporter pour production
```

---

## Architecture

### Stack Technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Expo | ~54.0 |
| UI Framework | React Native | 0.81.5 |
| Routing | expo-router | ~6.0.23 |
| State Management | Redux Toolkit | ^2.11 |
| Database | expo-sqlite | ~16.0.10 |
| Secure Storage | expo-secure-store | ~15.0.8 |
| Audio | expo-audio | ~1.1.1 |
| Video | expo-video | ~3.0.16 |
| EPUB Parsing | xmldom | 0.6.0 |
| ZIP Archive | react-native-zip-archive | 7.0.2 |
 
### Structure des Répertoires

```
app/
├── _layout.tsx              # Root layout (Stack + Redux Provider)
├── index.tsx                # Splash screen avec auth restore
├── (auth)/                  # Authentification (sans tab bar)
│   ├── onboarding.tsx       # Tutoriel 3 slides
│   ├── language-selection.tsx
│   ├── grade-selection.tsx   # Sélection niveau 1-6
│   ├── login.tsx
│   ├── signup.tsx
│   └── resetpassword.tsx
├── (tabs)/                  # Navigation tabs (AVEC tab bar)
│   ├── (home)/index.tsx     # Accueil
│   ├── (cours)/index.tsx    # Liste cours
│   ├── (progress)/index.tsx # XP, badges, classement
│   └── (profile)/index.tsx  # Profil
├── (stacks)/(cours)/        # Stack screens (SANS tab bar)
│   ├── [id].tsx             # Détail module
│   ├── learning-path.tsx     # Timeline
│   ├── lesson/[id].tsx      # Contenu EPUB
│   ├── listening.tsx
│   ├── dictation.tsx
│   ├── association.tsx
│   ├── game.tsx
│   └── result.tsx
├── (quiz)/index.tsx         # Moteur quiz
└── (settings)/              # Paramètres
    ├── index.tsx
    ├── edit-profile.tsx
    └── about.tsx

services/
├── api/
│   ├── moodleClient.ts       # fetch + isMoodleOnline (centralisé)
│   ├── moodleAuth.ts         # Login / signup / enrolment
│   ├── courseService.ts      # Catégories + cours par langue/grade
│   ├── quizService.ts        # mod_quiz_*
│   ├── dictationService.ts   # mod_assign_*
│   ├── listeningService.ts   # mod_choice_*
│   ├── associationService.ts # mod_glossary_*
│   ├── wordOrderService.ts   # mod_lesson_*
│   ├── xpService.ts          # Custom fields IPELAN
│   ├── badgeService.ts
│   ├── leaderboardService.ts
│   ├── userProgressService.ts
│   ├── moduleResolver.ts
│   └── backgroundSync.ts     # expo-background-fetch (optionnel)
├── activity/
│   └── activityIdentifier.ts
├── audio/
│   └── audioService.ts       # Lecture + cache offline
├── epub/
│   ├── epubLoader.ts
│   ├── epubParserLite.ts     # Parse OPF/spine
│   ├── epubService.ts
│   ├── unzipService.ts
│   ├── pathResolver.ts
│   ├── epubPathHelper.ts
│   └── imageOptimizer.ts
├── gamification/
│   └── gamificationService.ts # XP/Coins/Lives/Badges + sync
├── redux/
│   ├── store.ts
│   └── slices/authSlice.ts
├── storage/
│   ├── db-service.ts          # SQLite + migrations versionnées
│   ├── tokenStorage.ts        # SecureStore
│   ├── activity-progress.ts
│   ├── course-progress.ts
│   ├── badge-storage.ts
│   ├── streak.ts
│   └── sync-queue.ts          # Queue persistante
├── sync/
│   ├── syncQueue.ts           # Queue mémoire (gamification)
│   ├── queueProcessor.ts      # Traite la queue persistante
│   ├── progressSync.ts        # Sync grade + completion
│   └── downloadService.ts     # Téléchargement EPUB / audio
├── utils/
│   ├── moodleErrorHandler.ts
│   ├── moodleIdResolver.ts
│   └── urlNormalizer.ts
├── contentLoader.ts
├── activityHandlers.ts
├── activityLoader.ts
├── moodleParser.ts
├── epubParser.ts
└── urlAuth.ts
```

---
