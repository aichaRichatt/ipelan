# IPELAN — Configuration Moodle

> Moodle version : 4.4.3  
> URL : https://moodle.richatt.com  
> Service Web : `ipelan_full`

---

## 1. Activer les Web Services

```
Administration du site
  → Plugins
    → Web services
      → Vue d'ensemble

Étapes à cocher :
  ✅ 1. Activer les services web
  ✅ 2. Activer les protocoles REST
  ✅ 3. Créer un service externe
  ✅ 4. Ajouter des fonctions au service
  ✅ 5. Créer un token utilisateur
```

---

## 2. Créer le service externe

```
Administration → Plugins → Web services → Services externes
→ Ajouter un service

Nom : IPELAN Full Service
Nom court : ipelan_full
Activé : ✅
Utilisateurs autorisés : Tous les utilisateurs connectés
```

---

## 3. Fonctions Web Service requises

Ajouter ces fonctions au service `ipelan_full` :

### Authentification & Utilisateurs
```
core_webservice_get_site_info
core_user_get_users_by_field
core_user_update_users
auth_email_signup_user
core_auth_request_password_reset
core_user_agree_site_policy
```

### Cours & Contenu
```
core_course_get_enrolled_courses_by_timeline_classification
core_course_get_contents
core_course_get_courses_by_field
core_enrol_get_users_courses
```

### Activités
```
mod_quiz_get_quizzes_by_courses
mod_quiz_get_user_attempts
mod_quiz_start_attempt
mod_quiz_get_attempt_data
mod_quiz_save_attempt
mod_quiz_process_attempt
mod_quiz_get_attempt_review
mod_assign_get_assignments
mod_choice_get_choice_options
mod_glossary_get_entries_by_letter
```

### Complétion & Notes
```
core_completion_get_activities_completion_status
core_completion_update_activity_completion_status_manually
core_grades_update_grades
```

### Enrollment (admin uniquement)
```
enrol_manual_enrol_users
```

---

## 4. Tokens

### Token étudiant (par utilisateur)
```
Administration → Plugins → Web services → Gérer les tokens
→ Créer un token pour chaque utilisateur (ou laisser l'app le générer via /login/token.php)
```

### Token admin (une seule fois)
```
Créer un compte admin dédié (ex: ipelan_admin)
Générer un token pour ce compte
→ Mettre dans EXPO_PUBLIC_MOODLE_ADMIN_TOKEN dans .env
```

Le token admin est utilisé pour :
- Créer des comptes (`auth_email_signup_user`)
- Enrôler des utilisateurs (`enrol_manual_enrol_users`)
- Mettre à jour les profils (`core_user_update_users`)
- Pousser les notes (`core_grades_update_grades`)

---

## 5. Champs personnalisés profil

Voir [CUSTOM_FIELDS.md](./CUSTOM_FIELDS.md) pour la liste complète.

```
Administration → Utilisateurs → Champs de profil utilisateur
→ Créer catégorie "IPELAN"
→ Créer 9 champs de type Texte :
   ipelan_xp, ipelan_coins, ipelan_lives, ipelan_streak,
   ipelan_last_lives_update, ipelan_badges, ipelan_badges_count,
   ipelan_last_badge, ipelan_last_activity
```

---

## 6. Structure des activités par type IPELAN

| Type IPELAN | Module Moodle | modname | Instance ID | API principale |
|-------------|--------------|---------|-------------|----------------|
| Quiz | Quiz | `quiz` | `module.instance` → `quiz.id` | `mod_quiz_get_quizzes_by_courses` |
| Dictée | Devoir | `assign` | `module.instance` → `assign.id` | `mod_assign_get_assignments` |
| Écoute | Choix | `choice` | `module.instance` → `choiceid` | `mod_choice_get_choice_options` |
| Association | Glossaire | `glossary` | `module.instance` → `glossaryid` | `mod_glossary_get_entries_by_letter` |
| Ordre mots | Devoir *(custom)* | `assign` | `module.instance` | `mod_assign_get_assignments` |

> ⚠️ **cmid vs instance ID** : L'URL Moodle contient le cmid (ex: `/mod/quiz/view.php?id=23`).  
> L'API quiz attend l'**instance ID** (`quiz.id = 5`, différent du cmid).  
> Toujours utiliser `core_course_get_contents` → `module.instance` pour obtenir le bon ID.

---

## 7. Création des activités dans Moodle

### Quiz (mod_quiz)
```
Cours → Activer mode édition → Ajouter activité → Quiz
Configuration :
  - Tentatives autorisées : Illimitées (ou selon pédagogie)
  - Méthode de notation : Meilleure note
  - Navigation : Libre
Questions → Banque de questions → Choix multiple (1 bonne réponse)
```

### Dictée (mod_assign)
```
Cours → Ajouter activité → Devoir
Configuration :
  - Type soumission : Texte en ligne
  - Description : Uploader le fichier audio dans la description
    (Éditeur enrichi → Insérer fichier → Upload .mp3/.wav)
  URL audio générée : pluginfile.php/.../mod_assign/intro/audio.mp3
  → L'app remplace par : webservice/pluginfile.php/...?token=TOKEN
```

### Écoute (mod_choice)
```
Cours → Ajouter activité → Choix
Configuration :
  - Question : consigne
  - Options : 4 réponses possibles
  - Description : fichier audio (même méthode que dictée)
```

### Association (mod_glossary)
```
Cours → Ajouter activité → Glossaire
Configuration :
  - Type d'affichage : Simple, style dictionnaire
  - Entrées par page : Toutes
Entrées :
  - Concept : mot Pulaar (ex: "Nde")
  - Définition : mot Français (ex: "Bonjour")
```

---

## 8. Catégorie de cours

La page Cours (`(tabs)/(cours)/index.tsx`) utilise la catégorie ID **18** en dur :

```typescript
// app/(tabs)/(cours)/index.tsx:116
await getAllCoursesFromLanguageCategory(token, 18);
```

> ⚠️ Vérifier que la catégorie "Langues Nationales IPELAN" a bien l'ID **18** dans Moodle.  
> Sinon, modifier la constante ou la rendre configurable via `.env`.

---

## 9. Enrôlement automatique

À l'inscription (`signup.tsx`), l'utilisateur est automatiquement enrôlé dans les cours de la catégorie principale :

```typescript
// services/api/moodleAuth.ts
enrol_manual_enrol_users({
  enrolments: [{ roleid: 5, userid, courseid }]
})
// roleid 5 = Student
```

---

## 10. Vérification de l'installation

```bash
# Test de connexion
curl "https://moodle.richatt.com/login/token.php" \
  -d "username=test&password=test&service=ipelan_full"

# Test custom fields
curl "https://moodle.richatt.com/webservice/rest/server.php" \
  -d "wstoken=TOKEN&wsfunction=core_user_get_users_by_field&field=id&values[0]=2&moodlewsrestformat=json" \
  | jq '.users[0].customfields | map(.shortname)'

# Résultat attendu :
# ["ipelan_xp","ipelan_coins","ipelan_lives","ipelan_streak",
#  "ipelan_last_lives_update","ipelan_badges","ipelan_badges_count",
#  "ipelan_last_badge","ipelan_last_activity"]
```
