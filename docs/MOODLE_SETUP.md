# Guide de Configuration Moodle pour IPELAN

## Vue d'ensemble

Pour que l'application IPELAN fonctionne correctement avec Moodle, voici les activités à créer et leur configuration.

---

## 1. QUIZ (Test de connaissances)

### Création dans Moodle
1. Ajouter une activité **Quiz**
2. Ajouter des questions de type **Choix multiple**
3. Configurer 4 options par question avec une réponse correcte

### Structure des questions Moodle
```json
{
  "type": "multichoice",
  "question": "Quelle est la traduction de 'Bonjour' en Pulaar?",
  "options": [
    "Aboro",
    "Maas", 
    "Nde",
    "Alelu"
  ],
  "correctanswer": 0
}
```

### API utilisées
- `mod_quiz_get_quizzes_by_courses` - Liste les quizzes du cours
- `mod_quiz_start_attempt` - Démarre une tentative
- `mod_quiz_get_attempt_data` - Récupère les questions

---

## 2. ASSIGNMENT (Dictée audio)

### Création dans Moodle
1. Ajouter une activité **Assignment** (Devoir)
2. Activer la soumission de fichiers
3. Ajouter des fichiers audio dans la description (mp3/wav)

### API utilisées
- `mod_assign_get_assignments` - Liste les assignments du cours
- `mod_assign_view_submissions` - (non utilisé, permissions insuffisantes)

**Note:** La dictée utilise des données de fallback si l'API échoue.

---

## 3. CHOICE (Listening/Compréhension orale)

### Création dans Moodle
1. Ajouter une activité **Choice** 
2. Configurer les options de réponse
3. Limiter les réponses si nécessaire

### API utilisées
- `mod_choice_get_choice_options` - Retourne les options

---

 
## 4. GLOSSARY ( Association des mots )

### Création dans Moodle
1. Ajouter une activité **Glossary** (Glossaire)
2. Entrées avec mot + définition

---

## Mapping Activity IPELAN ↔ Moodle

| Type IPELAN | Modname Moodle | API | Paramètres |
|------------|-------------|-----|----------|
| quiz | quiz | mod_quiz_get_quizzes_by_courses | courseid |
| dictation | assign | mod_assign_get_assignments | courseid |
| listening | choice | mod_choice_get_choice_options | choiceid |
| association | lesson/glossary | mod_lesson_get_lessons_by_courses | courseid |

---

## API à activer dans Moodle

### Via Administration > Plugins > Web services > API Documentation

确保 ces fonctions sont activées:
- ✅ core_course_get_contents
- ✅ core_course_get_courses_by_field
- ✅ mod_quiz_get_quizzes_by_courses
- ✅ mod_quiz_start_attempt
- ✅ mod_quiz_get_attempt_data
- ✅ mod_assign_get_assignments
- ✅ mod_choice_get_choice_options
- ✅ mod_lesson_get_lessons_by_courses
- ✅ mod_lesson_get_pages

---

## Résolution des erreurs courantes

### "Aucun contenu disponible"
→ Vérifier que les activités sont publiées et visibles

### "Permissions insuffisantes"  
→ Vérifier les rôles Web Services de l'utilisateur

### "Valeur incorrecte de paramètre"
→ Vérifier les IDs des activités (cmid vs instance)

---

## Données de fallback

Quand les API Moodle échouent, l'app utilise des données de fallback:

- Quiz: Questions génériques sur les langues
- Dictée: Mots simples
- Association: Pairs de mots Pulaar/Français
- Listening: Questions génériques