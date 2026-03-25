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

  await db.executeSql(usersQuery);
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

export const deleteUser = async (db: SQLiteDatabase, id: number) => {
  const deleteQuery = `DELETE from users where id = ?`;
  await db.executeSql(deleteQuery, [id]);
};