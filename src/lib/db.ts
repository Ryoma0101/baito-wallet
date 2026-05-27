import * as SQLite from 'expo-sqlite';
import type { UserSettings, Job } from '@/types';

let db: SQLite.SQLiteDatabase | null = null;

// ============================================================
// マイグレーション管理
// ============================================================

interface Migration {
  version: number;
  description: string;
  up: (database: SQLite.SQLiteDatabase) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: '初期テーブル作成',
    up: async (database) => {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS user_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          birth_date TEXT NOT NULL,
          dependent_type TEXT NOT NULL CHECK (dependent_type IN ('parent', 'spouse', 'none')),
          large_company INTEGER NOT NULL DEFAULT 0,
          carryover_income INTEGER NOT NULL DEFAULT 0,
          plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium'))
        );

        CREATE TABLE IF NOT EXISTS jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          hourly_wage INTEGER NOT NULL,
          employment_type TEXT NOT NULL CHECK (employment_type IN ('part', 'dispatch', 'other')),
          is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS shifts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id INTEGER NOT NULL REFERENCES jobs(id),
          date TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          break_minutes INTEGER NOT NULL DEFAULT 0,
          estimated_wage INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS payslips (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id INTEGER NOT NULL REFERENCES jobs(id),
          year INTEGER NOT NULL,
          month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
          actual_amount INTEGER NOT NULL
        );
      `);
    },
  },
];

// ============================================================
// DB初期化
// ============================================================

/**
 * DBを開いてマイグレーションを実行する。
 * アプリ起動時に一度だけ呼ぶこと。
 */
export async function initDB(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('baito-wallet.db');

  // マイグレーション管理テーブル
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 適用済みバージョンの取得
  const applied = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM _migrations ORDER BY version',
  );
  const appliedVersions = new Set(applied.map((row) => row.version));

  // 未適用のマイグレーションを順番に実行
  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      await migration.up(db);
      await db.runAsync(
        'INSERT INTO _migrations (version) VALUES (?)',
        [migration.version],
      );
    }
  }

  return db;
}

/**
 * DB接続を取得する。initDB() が先に呼ばれている必要がある。
 */
export function getDB(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('DBが初期化されていません。initDB()を先に呼んでください。');
  }
  return db;
}

// ============================================================
// user_settings CRUD
// ============================================================

/**
 * ユーザー設定を保存する（UPSERT）
 */
export async function saveUserSettings(settings: UserSettings): Promise<void> {
  const database = getDB();
  await database.runAsync(
    `INSERT INTO user_settings (id, birth_date, dependent_type, large_company, carryover_income, plan)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       birth_date = excluded.birth_date,
       dependent_type = excluded.dependent_type,
       large_company = excluded.large_company,
       carryover_income = excluded.carryover_income,
       plan = excluded.plan`,
    [
      settings.birth_date,
      settings.dependent_type,
      settings.large_company ? 1 : 0,
      settings.carryover_income,
      settings.plan,
    ],
  );
}

/**
 * ユーザー設定を取得する。未設定の場合はnullを返す。
 */
export async function getUserSettings(): Promise<UserSettings | null> {
  const database = getDB();
  const row = await database.getFirstAsync<{
    birth_date: string;
    dependent_type: string;
    large_company: number;
    carryover_income: number;
    plan: string;
  }>('SELECT * FROM user_settings WHERE id = 1');

  if (!row) return null;

  return {
    birth_date: row.birth_date,
    dependent_type: row.dependent_type as UserSettings['dependent_type'],
    large_company: row.large_company === 1,
    carryover_income: row.carryover_income,
    plan: row.plan as UserSettings['plan'],
  };
}

// ============================================================
// jobs CRUD
// ============================================================

/**
 * アクティブなバイト先一覧を取得する
 */
export async function getActiveJobs(): Promise<Job[]> {
  const database = getDB();
  const rows = await database.getAllAsync<{
    id: number;
    name: string;
    hourly_wage: number;
    employment_type: string;
    is_active: number;
  }>('SELECT * FROM jobs WHERE is_active = 1');

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    hourly_wage: row.hourly_wage,
    employment_type: row.employment_type as Job['employment_type'],
    is_active: row.is_active === 1,
  }));
}

export async function getAllJobs(): Promise<Job[]> {
  const database = getDB();
  const rows = await database.getAllAsync<{
    id: number;
    name: string;
    hourly_wage: number;
    employment_type: string;
    is_active: number;
  }>('SELECT * FROM jobs ORDER BY is_active DESC, id DESC');

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    hourly_wage: row.hourly_wage,
    employment_type: row.employment_type as Job['employment_type'],
    is_active: row.is_active === 1,
  }));
}

export async function addJob(job: Omit<Job, 'id'>): Promise<void> {
  const database = getDB();
  await database.runAsync(
    'INSERT INTO jobs (name, hourly_wage, employment_type, is_active) VALUES (?, ?, ?, ?)',
    [job.name, job.hourly_wage, job.employment_type, job.is_active ? 1 : 0]
  );
}

export async function updateJob(job: Job): Promise<void> {
  const database = getDB();
  await database.runAsync(
    'UPDATE jobs SET name = ?, hourly_wage = ?, employment_type = ?, is_active = ? WHERE id = ?',
    [job.name, job.hourly_wage, job.employment_type, job.is_active ? 1 : 0, job.id]
  );
}

export async function deleteJob(id: number): Promise<void> {
  const database = getDB();
  await database.runAsync('DELETE FROM jobs WHERE id = ?', [id]);
}

// ============================================================
// shifts
// ============================================================

export async function getAllShifts(): Promise<import('@/types').Shift[]> {
  const database = getDB();
  return await database.getAllAsync<import('@/types').Shift>('SELECT * FROM shifts');
}

// ============================================================
// payslips
// ============================================================

export async function getAllPayslips(): Promise<import('@/types').Payslip[]> {
  const database = getDB();
  return await database.getAllAsync<import('@/types').Payslip>('SELECT * FROM payslips');
}

