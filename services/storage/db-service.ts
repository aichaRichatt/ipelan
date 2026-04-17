import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';
import { IPELANUser, CourseCategory, CourseSection, CourseModule, ModuleContent } from '../../types';

export type UserDB = Pick<IPELANUser, 'id' | 'username' | 'email' | 'firstname' | 'lastname' | 'fullname' | 'ipelan_xp' | 'coins' | 'streak'> & { token: string; badges?: string };

export interface CourseDB {
  id: number;
  shortname: string;
  fullname: string;
  displayname: string;
  idnumber: string;
  categoryid?: number;
  visible: number;
  summary: string;
  summaryformat: number;
  format: string;
  showgrades: number;
  lang: string;
  enablecompletion: number;
  completionhasrules: number;
}

export const getDBConnection = async () => {
  try {
    const db = await openDatabaseAsync('ipelan-data.db', { useNewConnection: true });
    console.log("SQLite: Database opened successfully (via expo-sqlite)");
    return db;
  } catch (error: any) {
    console.error("erreur d'initialisation de la base de donnee:", error);
    throw error;
  }
};

export const createTables = async (db: SQLiteDatabase) => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        firstname TEXT DEFAULT '',
        lastname TEXT DEFAULT '',
        fullname TEXT NOT NULL,
        ipelan_xp INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        badges TEXT DEFAULT '[]',
        token TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS courses(
        id INTEGER PRIMARY KEY,
        shortname TEXT,
        fullname TEXT,
        displayname TEXT,
        idnumber TEXT,
        categoryid INTEGER,
        visible INTEGER,
        summary TEXT,
        summaryformat INTEGER,
        format TEXT,
        showgrades INTEGER,
        lang TEXT,
        enablecompletion INTEGER,
        completionhasrules INTEGER
    );
    CREATE TABLE IF NOT EXISTS course_categories(
        id INTEGER PRIMARY KEY,
        name TEXT,
        description TEXT
    );
    CREATE TABLE IF NOT EXISTS course_sections(
        id INTEGER PRIMARY KEY,
        courseid INTEGER,
        name TEXT,
        summary TEXT,
        section INTEGER,
        hiddenbynumsections INTEGER,
        uservisible INTEGER
    );
    CREATE TABLE IF NOT EXISTS course_modules(
        id INTEGER PRIMARY KEY,
        courseid INTEGER,
        sectionid INTEGER,
        name TEXT,
        modname TEXT,
        modplural TEXT,
        modicon TEXT,
        indent INTEGER,
        url TEXT,
        description TEXT,
        visible INTEGER,
        uservisible INTEGER,
        completion INTEGER
    );
    CREATE TABLE IF NOT EXISTS module_contents(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moduleid INTEGER,
        type TEXT,
        filename TEXT,
        filepath TEXT,
        filesize INTEGER,
        fileurl TEXT,
        timecreated INTEGER,
        timemodified INTEGER,
        sortorder INTEGER,
        userid INTEGER,
        author TEXT,
        license TEXT
    );
    CREATE TABLE IF NOT EXISTS epub_books(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        author TEXT,
        source_url TEXT UNIQUE,
        local_path TEXT,
        total_chapters INTEGER DEFAULT 0,
        downloaded_at INTEGER,
        last_read_at INTEGER,
        last_chapter INTEGER DEFAULT 0,
        size INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS epub_chapters(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER,
        chapter_index INTEGER,
        chapter_title TEXT,
        content TEXT,
        FOREIGN KEY (book_id) REFERENCES epub_books(id) ON DELETE CASCADE
    );
  `);
};

export interface EPUBBookDB {
  id: number;
  title: string;
  author?: string;
  source_url: string;
  local_path?: string;
  total_chapters: number;
  downloaded_at: number;
  last_read_at?: number;
  last_chapter: number;
  size?: number;
}

export interface EPUBChapterDB {
  id: number;
  book_id: number;
  chapter_index: number;
  chapter_title?: string;
  content: string;
}

export const saveEPUBBook = async (db: SQLiteDatabase, book: {
  title: string;
  author?: string;
  source_url: string;
  local_path?: string;
  size?: number;
  total_chapters: number;
  chapters: Array<{ index: number; title?: string; content: string }>;
}): Promise<number> => {
  await db.runAsync(`DELETE FROM epub_chapters WHERE book_id IN (SELECT id FROM epub_books WHERE source_url = ?)`, [book.source_url]);
  await db.runAsync(`DELETE FROM epub_books WHERE source_url = ?`, [book.source_url]);

  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO epub_books(title, author, source_url, local_path, total_chapters, downloaded_at, last_chapter, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [book.title, book.author || null, book.source_url, book.local_path || null, book.total_chapters, now, 0, book.size || 0]
  );

  const bookId = typeof result.lastInsertRowId === 'number' ? result.lastInsertRowId : 0;

  for (const chapter of book.chapters) {
    await db.runAsync(
      `INSERT INTO epub_chapters(book_id, chapter_index, chapter_title, content) VALUES (?, ?, ?, ?)`,
      [bookId, chapter.index, chapter.title || null, chapter.content]
    );
  }

  return bookId;
};

export const getEPUBBook = async (db: SQLiteDatabase, sourceUrl: string): Promise<EPUBBookDB | null> => {
  return await db.getFirstAsync<EPUBBookDB>(`SELECT * FROM epub_books WHERE source_url = ?`, [sourceUrl]);
};

export const getEPUBChapter = async (db: SQLiteDatabase, bookId: number, chapterIndex: number): Promise<EPUBChapterDB | null> => {
  return await db.getFirstAsync<EPUBChapterDB>(
    `SELECT * FROM epub_chapters WHERE book_id = ? AND chapter_index = ?`,
    [bookId, chapterIndex]
  );
};

export const getEPUBChapters = async (db: SQLiteDatabase, bookId: number): Promise<EPUBChapterDB[]> => {
  return await db.getAllAsync<EPUBChapterDB>(
    `SELECT * FROM epub_chapters WHERE book_id = ? ORDER BY chapter_index ASC`,
    [bookId]
  );
};

export const updateEPUBProgress = async (db: SQLiteDatabase, bookId: number, chapterIndex: number): Promise<void> => {
  await db.runAsync(
    `UPDATE epub_books SET last_read_at = ?, last_chapter = ? WHERE id = ?`,
    [Date.now(), chapterIndex, bookId]
  );
};

export const deleteEPUBBook = async (db: SQLiteDatabase, bookId: number): Promise<void> => {
  await db.runAsync(`DELETE FROM epub_chapters WHERE book_id = ?`, [bookId]);
  await db.runAsync(`DELETE FROM epub_books WHERE id = ?`, [bookId]);
};

export const getAllEPUBBooks = async (db: SQLiteDatabase): Promise<EPUBBookDB[]> => {
  return await db.getAllAsync<EPUBBookDB>(`SELECT * FROM epub_books ORDER BY downloaded_at DESC`);
};

export const saveUser = async (db: SQLiteDatabase, user: UserDB) => {
   await db.runAsync(`DELETE FROM users`);
  
  const query = `INSERT OR REPLACE INTO users(id, username, email, firstname, lastname, fullname, ipelan_xp, coins, streak, badges, token) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  await db.runAsync(query, [
    user.id, 
    user.username, 
    user.email, 
    user.firstname || "",
    user.lastname || "",
    user.fullname, 
    user.ipelan_xp, 
    user.coins, 
    user.streak, 
    user.badges || '[]',
    user.token
  ]);
};

export const getUser = async (db: SQLiteDatabase, id: number): Promise<UserDB | null> => {
  return await db.getFirstAsync<UserDB>(`SELECT * FROM users WHERE id = ?`, [id]);
};

export const saveUserXP = async (db: SQLiteDatabase, userId: number, xp: number): Promise<void> => {
  await db.runAsync('UPDATE users SET ipelan_xp = ? WHERE id = ?', [xp, userId]);
};

export const getUserXP = async (db: SQLiteDatabase, userId: number): Promise<number> => {
  const row = await db.getFirstAsync<{ ipelan_xp: number }>('SELECT ipelan_xp FROM users WHERE id = ?', [userId]);
  return row?.ipelan_xp ?? 0;
};

export const saveCourses = async (db: SQLiteDatabase, courses: CourseDB[]) => {
  const query = `INSERT OR REPLACE INTO courses(id, shortname, fullname, displayname, idnumber, categoryid, visible, summary, summaryformat, format, showgrades, lang, enablecompletion, completionhasrules) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  for (const course of courses) {
    await db.runAsync(query, [
      course.id,
      course.shortname,
      course.fullname,
      course.displayname,
      course.idnumber,
      course.categoryid || 0,
      course.visible,
      course.summary,
      course.summaryformat,
      course.format,
      course.showgrades,
      course.lang,
      course.enablecompletion,
      course.completionhasrules
    ]);
  }
};

export const getCourses = async (db: SQLiteDatabase): Promise<CourseDB[]> => {
  return await db.getAllAsync<CourseDB>(`SELECT * FROM courses`);
};

export const getCoursesByCategory = async (db: SQLiteDatabase, categoryid: number): Promise<CourseDB[]> => {
  return await db.getAllAsync<CourseDB>(`SELECT * FROM courses WHERE categoryid = ?`, [categoryid]);
};

export const saveCourseCategories = async (db: SQLiteDatabase, categories: CourseCategory[]) => {
  const query = `INSERT OR REPLACE INTO course_categories(id, name, description) VALUES (?, ?, ?)`;
  for (const cat of categories) {
    await db.runAsync(query, [cat.id, cat.name, cat.description]);
  }
};

export const getCourseCategories = async (db: SQLiteDatabase): Promise<CourseCategory[]> => {
  return await db.getAllAsync<CourseCategory>(`SELECT * FROM course_categories`);
};

export const saveCourseSections = async (db: SQLiteDatabase, sections: CourseSection[]) => {
  const query = `INSERT OR REPLACE INTO course_sections(id, courseid, name, summary, section, hiddenbynumsections, uservisible) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  for (const sec of sections) {
    await db.runAsync(query, [
      sec.id, sec.courseid, sec.name, sec.summary, sec.section, sec.hiddenbynumsections, sec.uservisible
    ]);
  }
};

export const getCourseSectionsByCourse = async (db: SQLiteDatabase, courseid: number): Promise<CourseSection[]> => {
  return await db.getAllAsync<CourseSection>(`SELECT * FROM course_sections WHERE courseid = ? ORDER BY section ASC`, [courseid]);
};

export const saveCourseModules = async (db: SQLiteDatabase, modules: CourseModule[]) => {
  const query = `INSERT OR REPLACE INTO course_modules(id, courseid, sectionid, name, modname, modplural, modicon, indent, url, description, visible, uservisible, completion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  for (const mod of modules) {
    await db.runAsync(query, [
      mod.id, mod.courseid, mod.sectionid, mod.name, mod.modname, mod.modplural, mod.modicon, mod.indent, mod.url, mod.description, mod.visible, mod.uservisible, mod.completion
    ]);
  }
};

export const getCourseModulesBySection = async (db: SQLiteDatabase, sectionid: number): Promise<CourseModule[]> => {
  return await db.getAllAsync<CourseModule>(`SELECT * FROM course_modules WHERE sectionid = ?`, [sectionid]);
};

export const saveModuleContents = async (db: SQLiteDatabase, contents: ModuleContent[]) => {
  const insertQuery = `INSERT INTO module_contents(moduleid, type, filename, filepath, filesize, fileurl, timecreated, timemodified, sortorder, userid, author, license) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  for (const content of contents) {
    await db.runAsync(`DELETE FROM module_contents WHERE moduleid = ? AND filename = ?`, [content.moduleid, content.filename]);
    await db.runAsync(insertQuery, [
      content.moduleid, content.type, content.filename, content.filepath, content.filesize, content.fileurl, content.timecreated, content.timemodified, content.sortorder, content.userid, content.author, content.license
    ]);
  }
};

export const getModuleContentsByModule = async (db: SQLiteDatabase, moduleid: number): Promise<ModuleContent[]> => {
  return await db.getAllAsync<ModuleContent>(`SELECT * FROM module_contents WHERE moduleid = ? ORDER BY sortorder ASC`, [moduleid]);
};

export const deleteUser = async (db: SQLiteDatabase, id: number) => {
  await db.runAsync(`DELETE from users where id = ?`, [id]);
};