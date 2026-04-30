# IPELAN — Architecture

> Diagrammes générés en Mermaid. Rendu natif sur GitHub, VS Code (extension Markdown Preview Mermaid Support), Obsidian, GitLab.

Ce document décrit l'architecture en couches de l'application mobile IPELAN
(React Native + Expo SDK 54) et ses interactions avec Moodle 4.4.3.

Le projet est organisé en quatre couches (UI, Hooks, Services, Storage) plus
un backend Moodle externe.

---

## 1. Vue d'ensemble — Couches

```mermaid
flowchart TB
    subgraph UI["UI - app/"]
        AUTH["(auth)/<br/>onboarding · login · signup<br/>language · grade · reset"]
        TABS["(tabs)/<br/>home · cours · progress · profile"]
        STACKS["(stacks)/(cours)/<br/>quiz · listening · dictation<br/>association · game · result · lesson"]
        SETTINGS["(settings)/<br/>index · edit-profile · about"]
    end

    subgraph HOOKS["Hooks - hooks/"]
        H_AUTH["useLogin · useSignup<br/>useAuthRestore"]
        H_ACT["useActivityContent<br/>useQuiz · useListening<br/>useAssociation"]
        H_COURSE["useCourses · useMoodleCourses<br/>useCourseContent · useEpubReader"]
        H_GAME["useLives · useUserStats<br/>useSyncStatus"]
    end

    subgraph SERVICES["Services - services/"]
        SVC_API["api/<br/>moodleClient · moodleAuth<br/>courseService · quizService<br/>dictationService · listeningService<br/>associationService · wordOrderService<br/>xpService · badgeService<br/>leaderboardService · backgroundSync"]
        SVC_GAME["gamification/<br/>gamificationService<br/>(XP · coins · lives · badges)"]
        SVC_SYNC["sync/<br/>syncQueue · queueProcessor<br/>progressSync · downloadService"]
        SVC_EPUB["epub/<br/>epubLoader · epubParserLite<br/>unzipService · pathResolver"]
        SVC_AUDIO["audio/<br/>audioService<br/>(cache offline)"]
        SVC_REDUX["redux/<br/>store · authSlice"]
    end

    subgraph STORAGE["Storage - services/storage/"]
        DB[("SQLite<br/>ipelan-data.db")]
        SECURE["expo-secure-store<br/>tokenStorage"]
        CACHE["expo-file-system<br/>(EPUB · audio)"]
    end

    subgraph MOODLE["Moodle 4.4.3 - moodle.richatt.com"]
        WS["Web Services REST<br/>/webservice/rest/server.php"]
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

    classDef ui fill:#dbeafe,stroke:#1e40af,color:#1e3a8a;
    classDef hooks fill:#fef3c7,stroke:#b45309,color:#78350f;
    classDef services fill:#dcfce7,stroke:#166534,color:#14532d;
    classDef storage fill:#f3e8ff,stroke:#6b21a8,color:#581c87;
    classDef moodle fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d;

    class UI,AUTH,TABS,STACKS,SETTINGS ui;
    class HOOKS,H_AUTH,H_ACT,H_COURSE,H_GAME hooks;
    class SERVICES,SVC_API,SVC_GAME,SVC_SYNC,SVC_EPUB,SVC_AUDIO,SVC_REDUX services;
    class STORAGE,DB,SECURE,CACHE storage;
    class MOODLE,WS,TOKEN,FILES moodle;
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
    participant S as tokenStorage
    participant R as Redux authSlice

    U->>L: email + password
    L->>H: login(email, password)
    alt email contient @
        H->>A: lookup username via admin token
        A->>M: core_user_get_users_by_field(email)
        M-->>A: { users: [{username}] }
    end
    H->>A: login(username, password)
    A->>M: POST /login/token.php
    M-->>A: { token }
    A->>M: core_webservice_get_site_info
    M-->>A: { userid, fullname, ... }
    H->>S: SecureStore.set(token, user)
    H->>R: dispatch(loginSuccess)
    R-->>L: isAuthenticated = true
    L->>U: redirection (tabs)/(home)
```

---

## 3. Flux d'une activité (Quiz / Listening / Dictation / Association)

```mermaid
sequenceDiagram
    participant SC as Écran activité
    participant HK as useActivityContent
    participant ID as moodleIdResolver
    participant M as Moodle WS
    participant DB as SQLite (activity_progress)
    participant Q as syncQueue
    participant R as result.tsx

    SC->>HK: token, cmid, instanceId, courseId, type
    HK->>ID: resolveActivityInstanceId(courseId, type, cmid)
    ID->>M: core_course_get_contents
    M-->>ID: sections + modules
    ID-->>HK: { instanceId, name, modname }

    alt type == quiz
        HK->>M: mod_quiz_start_attempt
        M-->>HK: attemptId
        HK->>M: mod_quiz_get_attempt_data (page=0..n)
        M-->>HK: questions HTML
    else type == dictation
        HK->>M: mod_assign_get_assignments(courseids)
        M-->>HK: assignment.intro + introfiles
        HK->>HK: parseDictationWordsFromIntro
    else type == listening
        HK->>M: mod_choice_get_choice_options
        M-->>HK: options + audioFile
    else type == association
        HK->>M: mod_glossary_get_entries_by_letter
        M-->>HK: pairs
    end

    HK-->>SC: contenu activité
    SC->>SC: utilisateur joue, score calculé
    SC->>R: navigate /result?score&xp
    R->>DB: saveActivityScore (best_score, xp_earned)
    R->>R: calculateNewBadges + saveBadge
    R->>Q: triggerGamificationSync (XP, coins, lives, badges)
    Q->>M: core_user_update_users (customfields)
    M-->>Q: ok
    Q->>M: core_grades_update_grades OR core_completion_*
    M-->>Q: ok
    Q->>DB: markActivitySynced
```

---

## 4. Mode hors ligne — File de sync persistante

```mermaid
flowchart LR
    A[Activité terminée] --> B{Online ?}
    B -->|Oui| C[Push direct Moodle]
    B -->|Non| D[(SQLite<br/>sync_queue)]
    D --> E[queueProcessor<br/>AppState=active]
    E --> F{Online ?}
    F -->|Non| D
    F -->|Oui| G[POST WS<br/>backoff exponentiel<br/>2s · 4s · 8s]
    G -->|exception| H{retries<br/>&lt; 3 ?}
    H -->|Oui| D
    H -->|Non| I[Drop + log]
    G -->|ok| J[removeFromQueue]
    C --> K[markActivitySynced]
    J --> K

    classDef online fill:#dcfce7,stroke:#166534;
    classDef offline fill:#fef3c7,stroke:#b45309;
    classDef storage fill:#f3e8ff,stroke:#6b21a8;
    class C,G,J,K online;
    class D,E offline;
    class D storage;
```

---

## 5. Pipeline EPUB (lecture hors ligne)

```mermaid
flowchart LR
    URL[URL EPUB Moodle] --> DL[downloadService<br/>downloadEPUB]
    DL --> CACHE[(Cache local<br/>expo-file-system)]
    CACHE --> UNZ[unzipService<br/>react-native-zip-archive]
    UNZ --> CONT[META-INF/container.xml]
    CONT --> OPF[epubParserLite<br/>findOPFPath + parseOPFLite]
    OPF --> SPINE[Spine + manifest items]
    SPINE --> RES[pathResolver<br/>résolution chemins relatifs]
    RES --> WV[EPUBLessonViewer<br/>WebView baseURL=file://]
    WV --> SQLDB[(SQLite<br/>epub_books<br/>epub_chapters)]

    classDef ext fill:#fee2e2,stroke:#b91c1c;
    classDef io fill:#dbeafe,stroke:#1e40af;
    classDef db fill:#f3e8ff,stroke:#6b21a8;
    class URL ext;
    class CACHE,WV io;
    class SQLDB db;
```

---

## 6. Schéma de la base SQLite

```mermaid
erDiagram
    users ||--o{ user_badges : earns
    users ||--o| user_streaks : has
    users ||--o{ activity_progress : completes
    courses ||--o{ course_sections : contains
    course_sections ||--o{ course_modules : contains
    course_modules ||--o{ module_contents : has
    course_modules ||--o{ activity_progress : tracked_by
    epub_books ||--o{ epub_chapters : contains
    courses ||--o| course_progress : tracks

    users {
        int id PK
        text username
        text email
        text fullname
        int ipelan_xp
        int coins
        int lives
        int streak
        text badges
        text token
        text last_lives_update
    }
    user_badges {
        text id PK
        int user_id FK
        text badge_id
        text earned_at
        text synced_at
    }
    user_streaks {
        int user_id PK
        int current_streak
        int best_streak
        text last_activity_date
        int total_days_active
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
        text last_attempt
        int xp_earned
        int coins_earned
        text synced_at
    }
    course_progress {
        int id PK
        int course_id
        int completed_activities
        int total_activities
        int total_xp
        int best_score
        text last_activity_at
        text synced_at
    }
    sync_queue {
        int id PK
        text type
        text wsfunction
        text payload
        text created_at
        int retries
        text last_error
    }
    epub_books {
        int id PK
        text title
        text source_url
        text local_path
        int total_chapters
        int last_chapter
    }
    epub_chapters {
        int id PK
        int book_id FK
        int chapter_index
        text chapter_title
        text content
    }
```

---

## 7. Synchronisation Gamification → Moodle (customfields)

| Custom field Moodle | Source locale | Type |
|---|---|---|
| `ipelan_xp` | `users.ipelan_xp` (somme `activity_progress.xp_earned`) | int |
| `ipelan_coins` | `users.coins` | int |
| `ipelan_lives` | `users.lives` (max 6, regen 1 / 12 h) | int |
| `ipelan_streak` | `user_streaks.current_streak` | int |
| `ipelan_badges` | `user_badges.badge_id` joints par `,` | text |
| `ipelan_badges_count` | `count(user_badges)` | int |
| `ipelan_last_badge` | dernier badge gagné (ordre `earned_at`) | text |

> **Préalable côté Moodle** : ces champs personnalisés doivent être créés
> (Site administration → Users → User profile fields). Sans eux, la sync
> retourne une erreur de permission qui est gérée gracieusement.

---

## 8. Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Framework | Expo | ~54.0 |
| Runtime | React Native | 0.81.5 |
| Routing | expo-router | ~6.0.23 |
| State | Redux Toolkit | ^2.11 |
| Persistance | expo-sqlite | ~16.0.10 |
| Sécurité tokens | expo-secure-store | ~15.0.8 |
| Audio | expo-audio | ~1.1.1 |
| Vidéo | expo-video | ~3.0.16 |
| EPUB | xmldom + react-native-zip-archive | 0.6.0 / 7.0.2 |
| Styling | NativeWind / Tailwind | 2.0.11 |
| HTTP | fetch natif (via moodleClient) | — |

---

## 9. Variables d'environnement

```env
EXPO_PUBLIC_MOODLE_API_URL=https://moodle.richatt.com
EXPO_PUBLIC_MOODLE_ADMIN_TOKEN=<token-admin>
SERVICE_NAME=IPELAN_FULL_SERVICE
```

> ⚠️ Toutes les variables exposées au runtime React Native **doivent**
> commencer par `EXPO_PUBLIC_`. Les variables sans ce préfixe sont
> `undefined` côté client.
