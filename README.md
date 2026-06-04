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
