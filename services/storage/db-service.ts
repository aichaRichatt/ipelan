import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';
import { IPELANUser, CourseCategory, CourseSection, CourseModule, ModuleContent } from '../../types';

export type UserDB = Pick<IPELANUser, 'id' | 'username' | 'email' | 'firstname' | 'lastname' | 'fullname' | 'ipelan_xp' | 'coins' | 'streak'> & { token: string };

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
  `);
};

export const saveUser = async (db: SQLiteDatabase, user: UserDB) => {
   await db.runAsync(`DELETE FROM users`);
  
  const query = `INSERT OR REPLACE INTO users(id, username, email, firstname, lastname, fullname, ipelan_xp, coins, streak, token) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
    user.token
  ]);
};

export const getUser = async (db: SQLiteDatabase, id: number): Promise<UserDB | null> => {
  return await db.getFirstAsync<UserDB>(`SELECT * FROM users WHERE id = ?`, [id]);
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