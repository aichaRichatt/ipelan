import { SQLiteDatabase } from 'expo-sqlite';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        fullname TEXT NOT NULL,
        grade INTEGER DEFAULT 1,
        ipelan_xp INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY,
        shortname TEXT,
        fullname TEXT,
        displayname TEXT,
        categoryid INTEGER,
        visible INTEGER DEFAULT 1,
        summary TEXT,
        lang TEXT,
        grade INTEGER DEFAULT 0,
        format TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS course_categories (
        id INTEGER PRIMARY KEY,
        name TEXT,
        description TEXT
      );
      
      CREATE TABLE IF NOT EXISTS course_sections (
        id INTEGER PRIMARY KEY,
        courseid INTEGER,
        name TEXT,
        summary TEXT,
        section INTEGER,
        hiddenbynumsections INTEGER,
        uservisible INTEGER DEFAULT 1,
        FOREIGN KEY (courseid) REFERENCES courses(id)
      );
      
      CREATE TABLE IF NOT EXISTS course_modules (
        id INTEGER PRIMARY KEY,
        courseid INTEGER,
        sectionid INTEGER,
        name TEXT,
        modname TEXT,
        modplural TEXT,
        modicon TEXT,
        indent INTEGER DEFAULT 0,
        url TEXT,
        description TEXT,
        visible INTEGER DEFAULT 1,
        uservisible INTEGER DEFAULT 1,
        completion INTEGER DEFAULT 0,
        FOREIGN KEY (courseid) REFERENCES courses(id),
        FOREIGN KEY (sectionid) REFERENCES course_sections(id)
      );
      
      CREATE TABLE IF NOT EXISTS module_contents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moduleid INTEGER,
        type TEXT,
        filename TEXT,
        filepath TEXT,
        filesize INTEGER,
        fileurl TEXT,
        local_path TEXT,
        is_downloaded INTEGER DEFAULT 0,
        sortorder INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (moduleid) REFERENCES course_modules(id)
      );
      
      CREATE TABLE IF NOT EXISTS sync_state (
        entity TEXT PRIMARY KEY,
        last_sync_at TEXT,
        last_version INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS reading_progress (
        userId INTEGER,
        moduleId INTEGER,
        lastNodeIndex INTEGER DEFAULT 0,
        lastScrollY REAL DEFAULT 0,
        updatedAt TEXT DEFAULT (datetime('now')),
        PRIMARY KEY(userId, moduleId),
        FOREIGN KEY (userId) REFERENCES users(id)
      );
    `,
  },
  {
    version: 2,
    name: 'add_activities_table',
    up: `
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY,
        courseid INTEGER,
        type TEXT NOT NULL,
        title TEXT,
        data_json TEXT,
        timemodified INTEGER,
        is_downloaded INTEGER DEFAULT 0,
        FOREIGN KEY (courseid) REFERENCES courses(id)
      );
      
      CREATE TABLE IF NOT EXISTS activity_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id INTEGER,
        question_text TEXT,
        options_json TEXT,
        correct_answer TEXT,
        points INTEGER DEFAULT 10,
        sortorder INTEGER DEFAULT 0,
        FOREIGN KEY (activity_id) REFERENCES activities(id)
      );
    `,
  },
  {
    version: 3,
    name: 'add_user_progress_table',
    up: `
      CREATE TABLE IF NOT EXISTS user_progress (
        userId INTEGER PRIMARY KEY,
        totalXp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        streak INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 0,
        lessonsCompleted INTEGER DEFAULT 0,
        quizzesCompleted INTEGER DEFAULT 0,
        timeSpentMinutes INTEGER DEFAULT 0,
        updatedAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id)
      );
      
      CREATE TABLE IF NOT EXISTS user_badges (
        userId INTEGER,
        badgeId TEXT,
        earnedAt TEXT DEFAULT (datetime('now')),
        PRIMARY KEY(userId, badgeId),
        FOREIGN KEY (userId) REFERENCES users(id)
      );
    `,
  },
  {
    version: 4,
    name: 'add_indexes',
    up: `
      CREATE INDEX IF NOT EXISTS idx_courses_lang ON courses(lang);
      CREATE INDEX IF NOT EXISTS idx_courses_grade ON courses(grade);
      CREATE INDEX IF NOT EXISTS idx_courses_lang_grade ON courses(lang, grade);
      CREATE INDEX IF NOT EXISTS idx_sections_courseid ON course_sections(courseid);
      CREATE INDEX IF NOT EXISTS idx_modules_sectionid ON course_modules(sectionid);
      CREATE INDEX IF NOT EXISTS idx_modules_courseid ON course_modules(courseid);
      CREATE INDEX IF NOT EXISTS idx_contents_moduleid ON module_contents(moduleid);
      CREATE INDEX IF NOT EXISTS idx_contents_downloaded ON module_contents(is_downloaded);
      CREATE INDEX IF NOT EXISTS idx_activities_courseid ON activities(courseid);
      CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
    `,
  },
];

export const getCurrentVersion = async (db: SQLiteDatabase): Promise<number> => {
  try {
    const result = await db.getFirstAsync<{ version: number }>(
      'SELECT MAX(version) as version FROM schema_version'
    );
    return result?.version || 0;
  } catch {
    return 0;
  }
};

export const applyMigration = async (db: SQLiteDatabase, migration: Migration): Promise<void> => {
  console.log(`Applying migration v${migration.version}: ${migration.name}`);
  
  await db.execAsync(migration.up);
  
  await db.runAsync(
    'INSERT INTO schema_version (version, name) VALUES (?, ?)',
    [migration.version, migration.name]
  );
  
  console.log(`Migration v${migration.version} applied successfully`);
};

export const runMigrations = async (db: SQLiteDatabase): Promise<void> => {
  console.log('Starting database migrations...');
  
  const currentVersion = await getCurrentVersion(db);
  console.log(`Current schema version: ${currentVersion}`);
  
  const pendingMigrations = MIGRATIONS.filter(m => m.version > currentVersion);
  
  if (pendingMigrations.length === 0) {
    console.log('No pending migrations');
    return;
  }
  
  console.log(`Found ${pendingMigrations.length} pending migrations`);
  
  await db.execAsync('BEGIN TRANSACTION');
  
  try {
    for (const migration of pendingMigrations) {
      await applyMigration(db, migration);
    }
    
    await db.execAsync('COMMIT');
    console.log('All migrations applied successfully');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    console.error('Migration failed, rolled back:', error);
    throw error;
  }
};

export const rollbackMigration = async (db: SQLiteDatabase, version: number): Promise<void> => {
  const migration = MIGRATIONS.find(m => m.version === version);
  if (!migration || !migration.down) {
    throw new Error(`Cannot rollback migration v${version}`);
  }
  
  console.log(`Rolling back migration v${version}: ${migration.name}`);
  
  await db.execAsync('BEGIN TRANSACTION');
  
  try {
    await db.execAsync(migration.down);
    await db.runAsync('DELETE FROM schema_version WHERE version = ?', [version]);
    await db.execAsync('COMMIT');
    console.log(`Migration v${version} rolled back successfully`);
  } catch (error) {
    await db.execAsync('ROLLBACK');
    console.error('Rollback failed:', error);
    throw error;
  }
};

export const resetDatabase = async (db: SQLiteDatabase): Promise<void> => {
  console.log('Resetting database...');
  
  await db.execAsync('BEGIN TRANSACTION');
  
  try {
    await db.execAsync(`
      DROP TABLE IF EXISTS user_badges;
      DROP TABLE IF EXISTS user_progress;
      DROP TABLE IF EXISTS activity_questions;
      DROP TABLE IF EXISTS activities;
      DROP TABLE IF EXISTS reading_progress;
      DROP TABLE IF EXISTS sync_state;
      DROP TABLE IF EXISTS module_contents;
      DROP TABLE IF EXISTS course_modules;
      DROP TABLE IF EXISTS course_sections;
      DROP TABLE IF EXISTS course_categories;
      DROP TABLE IF EXISTS courses;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS schema_version;
    `);
    
    await db.execAsync('COMMIT');
    console.log('Database reset successfully');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    console.error('Database reset failed:', error);
    throw error;
  }
};
