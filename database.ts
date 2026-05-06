import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { adminDb as firebaseDb } from './firebase-admin.ts';

const DB_TYPE = process.env.DB_TYPE || 'FIREBASE';
const SQLITE_PATH = process.env.SQLITE_PATH || './data/database.sqlite';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null, // Server-side doesn't have a specific user context in the same way as client
      email: null,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class SQLiteCollection {
// ... existing SQLiteCollection code
  private db: Database.Database;
  private tableName: string;
  private queryConstraints: Array<{ type: string; field: string; op?: string; value?: any; dir?: string }> = [];

  constructor(db: Database.Database, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  doc(id: string) {
    return new SQLiteDoc(this.db, this.tableName, id);
  }

  where(field: string, op: string, value: any) {
    this.queryConstraints.push({ type: 'where', field, op, value });
    return this;
  }

  orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
    this.queryConstraints.push({ type: 'orderBy', field, dir });
    return this;
  }

  limit(n: number) {
    this.queryConstraints.push({ type: 'limit', field: '', value: n });
    return this;
  }

  async get() {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];
    const whereClauses: string[] = [];

    for (const c of this.queryConstraints) {
      if (c.type === 'where') {
        const op = c.op === '==' ? '=' : c.op;
        whereClauses.push(`${c.field} ${op} ?`);
        params.push(c.value);
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    const orderBy = this.queryConstraints.find(c => c.type === 'orderBy');
    if (orderBy) {
      sql += ` ORDER BY ${orderBy.field} ${orderBy.dir?.toUpperCase()}`;
    }

    const limit = this.queryConstraints.find(c => c.type === 'limit');
    if (limit) {
      sql += ` LIMIT ${limit.value}`;
    }

    try {
      const rows = this.db.prepare(sql).all(...params);
      return {
        empty: rows.length === 0,
        docs: rows.map((row: any) => ({
          id: row.id,
          data: () => {
            // If it's a 'config' table, data is JSON in the 'data' column
            if (this.tableName === 'config' && row.data) {
              return JSON.parse(row.data);
            }
            return row;
          },
          exists: true
        }))
      };
    } catch (e) {
      console.error(`SQLite get error for ${this.tableName}:`, e);
      return { empty: true, docs: [] };
    }
  }
}

class SQLiteDoc {
  private db: Database.Database;
  private tableName: string;
  private id: string;

  constructor(db: Database.Database, tableName: string, id: string) {
    this.db = db;
    this.tableName = tableName;
    this.id = id;
  }

  async get() {
    try {
      const row: any = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(this.id);
      return {
        id: this.id,
        exists: !!row,
        data: () => {
          if (this.tableName === 'config' && row?.data) {
            return JSON.parse(row.data);
          }
          return row;
        }
      };
    } catch (e) {
      return { id: this.id, exists: false, data: () => null };
    }
  }

  async set(data: any) {
    const fields = Object.keys(data);
    if (!fields.includes('id')) {
      data.id = this.id;
      fields.push('id');
    }

    if (this.tableName === 'config') {
      const sql = `INSERT OR REPLACE INTO config (id, data) VALUES (?, ?)`;
      this.db.prepare(sql).run(this.id, JSON.stringify(data));
      return;
    }

    const placeholders = fields.map(() => '?').join(', ');
    const columns = fields.join(', ');
    const values = fields.map(f => {
        const val = data[f];
        if (typeof val === 'boolean') return val ? 1 : 0;
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return val;
    });

    const sql = `INSERT OR REPLACE INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
    this.db.prepare(sql).run(...values);
  }

  async update(data: any) {
    if (this.tableName === 'config') {
      const existing = await this.get();
      const newData = { ...existing.data(), ...data };
      return this.set(newData);
    }

    const fields = Object.keys(data);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => {
        const val = data[f];
        if (typeof val === 'boolean') return val ? 1 : 0;
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return val;
    });
    values.push(this.id);

    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    this.db.prepare(sql).run(...values);
  }

  async delete() {
    this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(this.id);
  }

  onSnapshot(callback: (doc: any) => void) {
    // Basic implementation: call immediately
    this.get().then(callback);
    // In a real app we might use an event emitter here
    return () => {}; // Unsubscribe mock
  }
}

class SQLiteDB {
  private db: Database.Database | null = null;

  private getDb() {
    if (!this.db) {
      const dir = path.dirname(SQLITE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(SQLITE_PATH);
      this.init();
    }
    return this.db;
  }

  private init() {
    if (!this.db) return;
    try {
      const sql = fs.readFileSync('./sqlite-init.sql', 'utf8');
      this.db.exec(sql);
    } catch (e) {
      console.error('SQL init error:', e);
    }
  }

  collection(name: string) {
    const db = this.getDb();
    // Map Firestore names to SQLite tables
    let tableName = name;
    if (name === 'bans') tableName = 'global_bans';
    
    // Check if table exists, if not use a fallback or config pattern
    try {
        db.prepare(`SELECT 1 FROM ${tableName} LIMIT 1`).get();
    } catch (e) {
        // Create table as a json-store if it doesn't exist in schema
        db.prepare(`CREATE TABLE IF NOT EXISTS ${tableName} (id TEXT PRIMARY KEY, data TEXT)`).run();
    }

    return new SQLiteCollection(db, tableName);
  }

  batch() {
    return {
      set: (docRef: any, data: any) => docRef.set(data),
      update: (docRef: any, data: any) => docRef.update(data),
      delete: (docRef: any) => docRef.delete(),
      commit: async () => {}
    };
  }

  async initFirebase() {
    try {
        const usersSnap = await firebaseDb.collection('users').limit(1).get();
        if (usersSnap.empty) {
            console.log('Initializing Firebase with default superadmin...');
            await firebaseDb.collection('users').doc('superadmin').set({
                id: 'superadmin',
                username: 'admin',
                email: 'admin@example.com',
                password: '$2b$10$1xUBiO5w/emNGq1aEgxDguYE7AyDu7rQygeHhn27SwUsZFJIQV09C', // admin123
                role: 'SUPER_ADMIN',
                createdAt: new Date().toISOString(),
                messagesSent: 0
            });
            console.log('Default superadmin created in Firebase.');
        }
    } catch (e) {
        console.error('Failed to initialize Firebase data:', e);
    }
  }
}

export const sqliteDb = new SQLiteDB();

export const db = DB_TYPE === 'FIREBASE' ? firebaseDb : sqliteDb;

// Initialize Firebase if needed
if (DB_TYPE === 'FIREBASE') {
  sqliteDb.initFirebase();
}
