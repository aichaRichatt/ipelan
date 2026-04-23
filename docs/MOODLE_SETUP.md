
## 1. QUIZ — Test de connaissances

### Création dans Moodle
1. Activer mode édition dans le cours
2. Ajouter une activité → Quiz
3. Configuration recommandée :
   - Tentatives autorisées : Illimitées
   - Méthode de notation : Meilleure note
   - Navigation : Libre (pas séquentielle)
4. Ajouter des questions → Banque de questions → Choix multiple
   - 4 options par question
   - UNE seule réponse correcte (pas de pondération partielle)

### IDs importants
```
quiz.id (instance) ← utilisé par mod_quiz_start_attempt  ✅
quiz.coursemodule  ← utilisé pour la navigation seulement
```

### Flux API complet
```typescript
// 1. Lister les quizzes du cours
mod_quiz_get_quizzes_by_courses({ courseids: [courseId] })
→ quiz.id           // instance ID ✅
→ quiz.coursemodule // cmid (ne pas utiliser pour start_attempt)

// 2. Vérifier tentative existante
mod_quiz_get_user_attempts({ quizid: quiz.id, status: 'inprogress' })

// 3. Démarrer ou reprendre
mod_quiz_start_attempt({ quizid: quiz.id })
→ attempt.id

// 4. Récupérer les questions (boucle sur les pages)
mod_quiz_get_attempt_data({ attemptid: attempt.id, page: 0 })
→ questions[].html       // HTML à parser
→ questions[].slot       // numéro du slot
→ questions[].sequencecheck  // CRITIQUE pour sauvegarder
→ nextpage               // -1 = dernière page
```

---

## 2. ASSIGNMENT — Dictée audio

### Création dans Moodle
1. Ajouter une activité → Devoir (Assignment)
2. Configuration :
   - Type de soumission : Texte en ligne (pour la réponse écrite)
   - Description : Coller l'audio via l'éditeur de texte enrichi
   - **Important** : Uploader l'audio DANS la description (pas en pièce jointe)

### Comment uploader l'audio dans la description
1. Dans l'éditeur de description → cliquer sur l'icône "Insérer fichier"
2. Uploader le fichier .mp3 ou .wav
3. L'URL générée sera du format :
   `https://[moodle]/pluginfile.php/[contextid]/mod_assign/intro/[filename]`

### Flux API complet
```typescript
// 1. Récupérer les assignments du cours
mod_assign_get_assignments({ courseids: [courseId] })
→ assignments[].id       // assignment ID
→ assignments[].intro    // HTML contenant l'URL audio
→ assignments[].introfiles[].fileurl  // URL directe du fichier ✅

// 2. Transformer l'URL pour le web service
const fileUrl = assignment.introfiles[0].fileurl
  .replace('/pluginfile.php/', '/webservice/pluginfile.php/');
// Ajouter le token
const audioUrl = `${fileUrl}?token=${MOODLE_TOKEN}`;
```

### ⚠️ Point critique — Permissions
`mod_assign_view_submissions` requiert le rôle teacher.
Pour un étudiant, utiliser uniquement `mod_assign_get_assignments`.

---

## 3. CHOICE — Listening / Compréhension orale

### Création dans Moodle
1. Ajouter une activité → Choix (Choice)
2. Configuration :
   - Question : "Qu'avez-vous entendu ?" (ou la consigne)
   - Options : Les 4 réponses possibles
   - Autoriser la mise à jour : Oui
   - Limiter les réponses : Non
3. Ajouter le fichier audio dans la **description** (même méthode qu'Assignment)

### Flux API complet
```typescript
// ⚠️ Il n'existe pas de "get_choices_by_courses"
// Il faut d'abord lister les modules du cours :

// Étape 1 — Trouver le choiceid depuis le cours
core_course_get_contents({ courseid: courseId })
→ sections[].modules[]
   .filter(m => m.modname === 'choice')
   .map(m => ({
     choiceid: m.instance,  // ← instance ID, pas m.id (cmid) ✅
     name: m.name,
     audioUrl: extraireAudioDepuisDescription(m.description)
   }))

// Étape 2 — Récupérer les options
mod_choice_get_choice_options({ choiceid: choiceid })
→ options[].id      // ID de l'option pour voter
→ options[].text    // Texte de l'option
→ options[].enabled // Si l'option est sélectionnable
```

---

## 4. GLOSSARY — Association de mots

### Pourquoi Glossary plutôt que Lesson ?
- **Lesson** = parcours pédagogique avec pages et branchements → trop complexe
- **Glossary** = liste de paires mot/définition → parfait pour l'association ✅

### Création dans Moodle
1. Ajouter une activité → Glossaire (Glossary)
2. Configuration :
   - Type d'affichage : Simple, style dictionnaire
   - Entrées par page : Toutes (ou 50)
3. Ajouter des entrées :
   - Concept : mot en Pulaar (ex: "Nde")
   - Définition : mot en Français (ex: "Bonjour")

### Flux API complet
```typescript
// Étape 1 — Trouver le glossaryid depuis le cours
core_course_get_contents({ courseid: courseId })
→ sections[].modules[]
   .filter(m => m.modname === 'glossary')
   .map(m => m.instance)  // ← glossaryid ✅

// Étape 2 — Récupérer les entrées
mod_glossary_get_entries_by_letter({
  id: glossaryId,
  letter: 'ALL',  // toutes les entrées
  from: 0,
  limit: 50,
})
→ entries[].concept     // mot Pulaar
→ entries[].definition  // définition Française (HTML)
→ entries[].id          // ID de l'entrée
```

---

## Mapping Activity IPELAN ↔ Moodle (corrigé)

| Type IPELAN | modname | ID à utiliser | API principale |
|-------------|---------|---------------|----------------|
| quiz | quiz | `module.instance` → `quiz.id` | `mod_quiz_get_quizzes_by_courses` |
| dictation | assign | `module.instance` → `assign.id` | `mod_assign_get_assignments` |
| listening | choice | `module.instance` → `choiceid` | `mod_choice_get_choice_options` |
| association | glossary | `module.instance` → `glossaryid` | `mod_glossary_get_entries_by_letter` |

---

## Fonctions Web Service à vérifier

Administration → Plugins → Web services → API Documentation

```
✅ core_course_get_contents          (lister modules + instance IDs)
✅ core_course_get_courses_by_field  (info cours)
✅ mod_quiz_get_quizzes_by_courses
✅ mod_quiz_get_user_attempts
✅ mod_quiz_start_attempt
✅ mod_quiz_get_attempt_data
✅ mod_assign_get_assignments
✅ mod_choice_get_choice_options
✅ mod_glossary_get_entries_by_letter
✅ core_files_get_files              (accès fichiers si nécessaire)
```

---

## Pattern de résolution d'ID universel

```typescript
// Toujours partir de core_course_get_contents
// pour obtenir les instance IDs corrects

async function getActivityInstanceId(
  courseId: number,
  modname: 'quiz' | 'assign' | 'choice' | 'glossary',
  cmid: number,
  token: string
): Promise<number> {
  const contents = await moodleCall('core_course_get_contents', {
    wstoken: token,
    wsfunction: 'core_course_get_contents',
    moodlewsrestformat: 'json',
    courseid: String(courseId),
  });
  
  for (const section of contents) {
    for (const mod of section.modules ?? []) {
      if (mod.modname === modname && mod.id === cmid) {
        return mod.instance; // ← c'est l'instance ID ✅
      }
    }
  }
  
  throw new Error(`Module ${modname} cmid=${cmid} non trouvé`);
}
```

---

## Erreurs courantes et solutions

| Erreur | Cause | Solution |
|--------|-------|----------|
| `invalidparameter` sur `start_attempt` | cmid passé au lieu de quiz.id | Utiliser `module.instance` |
| `nomoreattempts` | Quiz limité à N tentatives | Configurer "Illimitées" dans Moodle |
| Audio inaccessible | URL sans token | Remplacer `pluginfile.php` → `webservice/pluginfile.php` + `?token=` |
| Choice options vides | `choiceid` incorrect (cmid passé) | Utiliser `module.instance` |
| Glossary vide | Aucune entrée créée | Ajouter les entrées dans l'activité |

---

## Différence cmid vs instance ID (IMPORTANT)

```
mdl_quiz / mdl_assign / mdl_choice / mdl_glossary
┌─────────────────────────────────────────────────────┐
│ id = 5          ← INSTANCE ID (utiliser pour API)   │
│ coursemodule = 23 ← CMID (pour navigation/liens)    │
└─────────────────────────────────────────────────────┘
```

Quand vous recevez un lien d'activité dans Moodle :
- L'URL contient le **cmid** (ex: `/mod/quiz/view.php?id=23`)
- L'API attend l'**instance ID** (ex: `quiz.id = 5`)

**Toujours** utiliser `core_course_get_contents` pour convertir cmid → instance ID avant d'appeler les API.