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
| Audio | expo-av | ^16.0.8 |
| EPUB Parsing | xmldom | 0.6.0 |
| ZIP Archive | react-native-zip-archive | 7.0.2 |
| Styling | NativeWind (Tailwind) | 2.0.11 |

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
│   └── moodleAuth.ts        # Auth Moodle
├── epub/
│   ├── epubParserLite.ts    # Parse OPF/spine
│   ├── epubService.ts       # Service EPUB principal
│   ├── pathResolver.ts      # Résolution chemins
│   └── unzipService.ts      # Décompression EPUB
├── sync/
│   └── downloadService.ts   # Téléchargement fichiers
├── audio/
│   └── audioService.ts      # Service audio
├── storage/
│   ├── db-service.ts        # SQLite
│   ├── tokenStorage.ts       # Secure storage
│   └── migrations.ts        # Migrations BDD
└── redux/
    ├── store.ts
    └── slices/authSlice.ts
```

---

## Pipeline EPUB (Hors Ligne)

```
EPUB URL
    ↓
downloadService.downloadEPUB()
    ↓
unzipService.unzipEPUB()
    ↓
epubParserLite.findOPFPath() → container.xml
    ↓
epubParserLite.parseOPFLite() → spine
    ↓
pathResolver.resolveChapterPath()
    ↓
EPUBLessonViewer (WebView avec base URL)
```

### Étapes d'implémentation

1. **Phase 0** : Téléchargement + Décompression + Extraction HTML ✅
2. **Phase 1** : Parsing OPF + Spine + Chemins ✅
3. **Phase 2** : Correction assets (images/audio) ⏳
4. **Phase 3** : Navigation chapitres ⏳

---

## Contenus Pédagogiques

Source : **https://ipelan.mr/archives**

Structure :
```
Langue (Pulaar/Soninké/Wolof)
└── Niveau (1ère à 6ème année)
    └── Matière
        ├── Leçons → EPUB
        ├── Audio → Fichiers audio
        └── Activités → Quiz, Dictée, etc.
```

---

## Configuration Environment

Créer `.env` :

```env
EXPO_PUBLIC_MOODLE_API_URL=https://moodle.richatt.com
EXPO_PUBLIC_MOODLE_TOKEN=your_admin_token_here
```

---

## État du Projet

| Composant | Status |
|-----------|--------|
| Authentification | ✅ Fonctionnel |
| Navigation tabs | ✅ Fonctionnel |
| Écrans activités | ✅ Fonctionnel |
| Quiz | ✅ Fonctionnel |
| SQLite | ✅ Fonctionnel |
| EPUB Download | ✅ Fonctionnel |
| EPUB Parse | ✅ Fonctionnel |
| Images/Audio | ⏳ En cours |
| Moodle Sync | 🔜 À venir |

---

## License

MIT
