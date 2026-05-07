# IPELAN — Architecture Générale

> Diagrammes Mermaid. Rendu natif sur GitHub, VS Code (Markdown Preview Mermaid), Obsidian.

---

## 1. Vue d'ensemble — Couches

```mermaid
flowchart TB
    subgraph UI["UI — app/"]
        AUTH["(auth)/\nonboarding · login · signup\nlanguage · grade · reset"]
        TABS["(tabs)/\nhome · cours · progress · profile"]
        STACKS["(stacks)/(cours)/\nquiz · listening · dictation\nassociation · game · result\nlesson · epub · pdf · unified-viewer"]
        SETTINGS["(settings)/\nindex · edit-profile · about"]
    end

    subgraph HOOKS["Hooks — hooks/"]
        H_AUTH["useLogin · useSignup · useAuthRestore"]
        H_ACT["useActivityContent · useQuiz\nuseListening · useAssociation"]
        H_COURSE["useCourses · useMoodleCourses\nuseCourseContent"]
        H_GAME["useLives · useUserStats\nuseSyncStatus · useProgressSync\nuseAppState"]
    end

    subgraph SERVICES["Services — services/"]
        SVC_API["api/\nmoodleClient · moodleAuth\ncourseService · quizService\ndictationService · listeningService\nassociationService · wordOrderService\nxpService · badgeService · leaderboardService\nuserProgressService · backgroundSync"]
        SVC_GAME["gamification/\ngamificationService\n(XP · coins · lives · badges · streak)"]
        SVC_SYNC["sync/\nsyncQueue · queueProcessor\nprogressSync · downloadService\nprogressSync · syncQueue"]
        SVC_EPUB["epub/\nepubLoader · epubParserLite\nunzipService · pathResolver"]
        SVC_AUDIO["audio/audioService"]
        SVC_REDUX["redux/\nstore · authSlice"]
        SVC_BG["background/\nlifeRegeneration"]
    end

    subgraph STORAGE["Storage — services/storage/"]
        DB[("SQLite\nipelan-data.db\nv5")]
        SECURE["expo-secure-store\nmoodle_token · credentials"]
        ASYNC["AsyncStorage\nuser_data · preferences"]
    end

    subgraph MOODLE["Moodle 4.4.3 — moodle.richatt.com"]
        WS["REST /webservice/rest/server.php"]
        TOKEN["/login/token.php"]
        FILES["/webservice/pluginfile.php"]
    end

    UI --> HOOKS
    HOOKS --> SERVICES
    SERVICES --> STORAGE
    SVC_API -- "wstoken" --> WS
    SVC_API -- "login" --> TOKEN
    SVC_AUDIO -- "GET audio" --> FILES
    SVC_EPUB -- "GET epub" --> FILES
    SVC_SYNC -- "queue retry" --> WS
    SVC_GAME -- "customfields" --> WS

    classDef ui fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef hooks fill:#fef3c7,stroke:#b45309,color:#78350f
    classDef services fill:#dcfce7,stroke:#166534,color:#14532d
    classDef storage fill:#f3e8ff,stroke:#6b21a8,color:#581c87
    classDef moodle fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d
    class UI,AUTH,TABS,STACKS,SETTINGS ui
    class HOOKS,H_AUTH,H_ACT,H_COURSE,H_GAME hooks
    class SERVICES,SVC_API,SVC_GAME,SVC_SYNC,SVC_EPUB,SVC_AUDIO,SVC_REDUX,SVC_BG services
    class STORAGE,DB,SECURE,ASYNC storage
    class MOODLE,WS,TOKEN,FILES moodle
```

---

## 2. Flux d'authentification

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant L as login.tsx
    participant H as useLogin
    participant A as moodleAuth
    participant M as Moodle
    participant S as SecureStore
    participant R as Redux authSlice

    U->>L: email + password
    L->>H: login(email, password)
    alt email contient @
        H->>A: résoudre username via admin token
        A->>M: core_user_get_users_by_field(email)
        M-->>A: [{username}]
    end
    H->>A: login(username, password)
    A->>M: POST /login/token.php {service: ipelan_full}
    M-->>A: {token}
    A->>M: core_webservice_get_site_info
    M-->>A: {userid, fullname, ...}
    H->>S: SecureStore.set("moodle_token", token)
    H->>R: dispatch(loginSuccess({user, token}))
    R-->>L: isAuthenticated = true
    L->>U: router.push("/(tabs)/(home)")
```

**Restauration au démarrage** (`app/index.tsx`) :
1. Lit le token depuis `SecureStore`
2. Lit `user_data` depuis `AsyncStorage`
3. Dispatch `loginSuccess` → navigation automatique vers tabs

---

## 3. Flux d'une activité complète

```mermaid
sequenceDiagram
    participant SC as Écran activité
    participant HK as useActivityContent
    participant ID as moodleIdResolver
    participant M as Moodle WS
    participant DB as SQLite
    participant PS as progressSync
    participant SQ as syncQueue
    participant R as result.tsx

    SC->>HK: {token, cmid, instanceId, courseId, type}
    HK->>ID: resolveIds(courseId, cmid, token)
    ID->>M: core_course_get_contents(courseid)
    M-->>ID: sections + modules
    ID-->>HK: {instanceId, modname}

    alt quiz
        HK->>M: mod_quiz_start_attempt(quizid)
        HK->>M: mod_quiz_get_attempt_data(page=0..n)
    else dictation (assign)
        HK->>M: mod_assign_get_assignments(courseids)
    else listening (choice)
        HK->>M: mod_choice_get_choice_options(choiceid)
    else association (glossary)
        HK->>M: mod_glossary_get_entries_by_letter(id, ALL)
    end

    SC->>SC: utilisateur joue → score calculé
    SC->>R: navigate /result?score&xp&coins
    R->>DB: saveActivityScore (activity_progress)
    R->>PS: syncAfterActivity({courseId, cmid, score, maxScore, userId})
    PS->>M: core_grades_update_grades OU core_completion_*
    R->>SQ: syncGamification(userId, token)
    SQ->>M: core_user_update_users (customfields XP/coins/badges)
```

---

## 4. Schéma SQLite complet (v5)

```mermaid
erDiagram
    users ||--o{ user_badges : earns
    users ||--o| user_streaks : has
    users ||--o{ activity_progress : completes
    users ||--o{ course_progress : tracks
    users ||--o{ gamification_queue : queues
    courses ||--o{ course_sections : contains
    course_sections ||--o{ course_modules : contains
    course_modules ||--o{ module_contents : has
    epub_books ||--o{ epub_chapters : contains

    users {
        int id PK
        text username
        text email
        text firstname
        text lastname
        text fullname
        int ipelan_xp
        int coins
        int lives
        int streak
        text last_activity
        text badges
        text last_lives_update
        int token_expiry
    }
    activity_progress {
        int id PK
        int user_id
        int module_id
        int course_id
        text type
        int best_score
        int total_score
        int attempts_count
        int is_completed
        text xp_earned
        int coins_earned
        text synced_at
        UNIQUE user_id_module_id_course_id
    }
    course_progress {
        int id PK
        int user_id
        int course_id
        int completed_activities
        int total_activities
        int total_xp
        text last_activity_at
        text synced_at
        UNIQUE user_id_course_id
    }
    sync_queue {
        int id PK
        text type
        text wsfunction
        text payload
        int user_id
        text created_at
        int retries
        text last_error
    }
    gamification_queue {
        int id PK
        int user_id
        text job_type
        text job_data
        text created_at
        int attempts
        UNIQUE user_id_job_type
    }
    user_badges {
        text id PK
        int user_id FK
        text badge_id
        text earned_at
        text synced_at
        UNIQUE user_id_badge_id
    }
    user_streaks {
        int user_id PK
        int current_streak
        int best_streak
        text last_activity_date
        int total_days_active
    }
```

**Versionnement schema** (`PRAGMA user_version`) :

| Version | Migration |
|---------|-----------|
| v1 | `users.lives`, `last_activity`, `last_lives_update` |
| v2 | `user_badges` + index |
| v3 | `sync_queue.user_id` ; `course_progress` UNIQUE(user_id, course_id) |
| v4 | `users.token_expiry` |
| v5 | `gamification_queue` — persistance jobs in-memory entre crashes |

---

## 5. Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | Expo | ~54.0 |
| Runtime | React Native | 0.81.5 |
| Routing | expo-router | ~6.0.23 |
| Language | TypeScript | ~5.9.2 |
| State global | Redux Toolkit + react-redux | 2.11.2 / 9.2.0 |
| Styling | NativeWind + TailwindCSS | 2.0.11 / 3.3.2 |
| SQLite | expo-sqlite | ~16.0.10 |
| Secure Storage | expo-secure-store | ~15.0.8 |
| Key-Value | AsyncStorage | ~2.2.0 |
| Audio | expo-audio | ~1.1.1 |
| EPUB | jszip + xmldom + pako | 3.10.1 / 0.6.0 / 2.1.0 |
| PDF | react-native-pdf | ^7.0.4 |
| WebView | react-native-webview | 13.15.0 |
| Animations | reanimated + gesture-handler | ~4.1.1 / ~2.28.0 |
| Background | expo-background-fetch | ^55.0.15 |
| Connectivity | netinfo | ^12.0.1 |

---

## 6. Variables d'environnement

```env
EXPO_PUBLIC_MOODLE_API_URL=https://moodle.richatt.com
EXPO_PUBLIC_MOODLE_ADMIN_TOKEN=<token-admin-wstoken>
EXPO_PUBLIC_EPUB_BASE_URL=https://moodle.richatt.com
EXPO_PUBLIC_AUDIO_BASE_URL=https://moodle.richatt.com
```

> ⚠️ Toutes les variables React Native **doivent** commencer par `EXPO_PUBLIC_`.  
> `EXPO_PUBLIC_MOODLE_ADMIN_TOKEN` n'est utilisé que pour les opérations admin (signup, enrol, grade push, profile update).

---

## 7. Conventions de code

| Convention | Règle |
|------------|-------|
| Appels Moodle | Toujours via `moodleCall()` ou `moodleFetch()` |
| Token admin | `EXPO_PUBLIC_MOODLE_ADMIN_TOKEN` uniquement pour ops admin |
| Styling |  `StyleSheet.create` |
| Navigation | `useRouter().push(path as any)` — cast nécessaire (types stricts) |
| Logs dev | Gardés par `const IS_DEV = process.env.NODE_ENV === "development"` |
| Alias | `@/` → racine projet (tsconfig) |
