import { enablePromise, openDatabase, SQLiteDatabase } from 'react-native-sqlite-storage';

export interface UserDB {
  id: number;
  username: string;
  email: string;
  fullname: string;
  ipelan_xp: number;
  coins: number;
  streak: number;
  token: string;
}

export interface CourseDB {
  id: number;
  shortname: string;
  fullname: string;
  displayname: string;
  idnumber: string;
  visible: number;
  summary: string;
  summaryformat: number;
  format: string;
  showgrades: number;
  lang: string;
  enablecompletion: number;
  completionhasrules: number;
}

enablePromise(true);

export const getDBConnection = async () => {
  return openDatabase({ name: 'ipelan-data.db', location: 'default' });
};

export const createTables = async (db: SQLiteDatabase) => {
  const usersQuery = `CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        fullname TEXT NOT NULL,
        ipelan_xp INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        token TEXT NOT NULL
    );`;

  const coursesQuery = `CREATE TABLE IF NOT EXISTS courses(
        id INTEGER PRIMARY KEY,
        shortname TEXT,
        fullname TEXT,
        displayname TEXT,
        idnumber TEXT,
        visible INTEGER,
        summary TEXT,
        summaryformat INTEGER,
        format TEXT,
        showgrades INTEGER,
        lang TEXT,
        enablecompletion INTEGER,
        completionhasrules INTEGER
    );`;

  await db.executeSql(usersQuery);
  await db.executeSql(coursesQuery);
};

export const saveUser = async (db: SQLiteDatabase, user: UserDB) => {
  const insertQuery = `INSERT OR REPLACE INTO users(id, username, email, fullname, ipelan_xp, coins, streak, token) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  
  return db.executeSql(insertQuery, [
    user.id, 
    user.username, 
    user.email, 
    user.fullname, 
    user.ipelan_xp, 
    user.coins, 
    user.streak, 
    user.token
  ]);
};

export const getUser = async (db: SQLiteDatabase, id: number): Promise<UserDB | null> => {
  try {
    const results = await db.executeSql(`SELECT * FROM users WHERE id = ?`, [id]);
    if (results[0].rows.length > 0) {
      return results[0].rows.item(0);
    }
    return null;
  } catch (error) {
    console.error(error);
    throw Error('Failed to get user');
  }
};

export const saveCourses = async (db: SQLiteDatabase, courses: CourseDB[]) => {
  const insertQuery = `INSERT OR REPLACE INTO courses(id, shortname, fullname, displayname, idnumber, visible, summary, summaryformat, format, showgrades, lang, enablecompletion, completionhasrules) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  for (const course of courses) {
    await db.executeSql(insertQuery, [
      course.id,
      course.shortname,
      course.fullname,
      course.displayname,
      course.idnumber,
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
  try {
    const courses: CourseDB[] = [];
    const results = await db.executeSql(`SELECT * FROM courses`);
    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        courses.push(result.rows.item(index));
      }
    });
    return courses;
  } catch (error) {
    console.error(error);
    throw Error('Failed to get courses');
  }
};

export const deleteUser = async (db: SQLiteDatabase, id: number) => {
  const deleteQuery = `DELETE from users where id = ?`;
  await db.executeSql(deleteQuery, [id]);
};