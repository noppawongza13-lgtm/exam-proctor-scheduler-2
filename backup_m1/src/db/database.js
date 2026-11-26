/**
 * โมดูลจัดการฐานข้อมูล SQLite (SQLite Database Layer)
 * 
 * ใช้ DatabaseSync จาก node:sqlite (มาตรฐานในตัวของ Node.js)
 * จัดการ Schema, ตารางผู้ใช้งาน, การลงนามดิจิทัล (Attendance Signatures),
 * บันทึกประวัติ (Audit Logs) และสถานะตารางสอบ (Schedule States)
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'elms_scheduler.sqlite');

/**
 * สร้างหรือเปิดการเชื่อมต่อฐานข้อมูล SQLite
 * @param {string} [customPath] ระบุ path พิเศษสำหรับทดสอบ (:memory: หรือไฟล์เฉพาะ)
 * @returns {DatabaseSync}
 */
export function initDatabase(customPath = null) {
  let dbPath = customPath || DB_FILE;

  if (dbPath !== ':memory:') {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);

  // เปิดใช้งาน Foreign Keys และ WAL Mode สำหรับความเสถียร
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA foreign_keys = ON;');

  // สร้างตาราง Schema
  db.exec(`
    -- ตารางผู้ใช้งานระบบ
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL,
      proctor_id TEXT,
      display_name TEXT NOT NULL,
      faculty TEXT,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    -- ตารางบันทึกการลงนามดิจิทัลปฏิบัติหน้าที่ (Attendance Digital Signatures)
    -- ผูกมัดกับบัญชีผู้ใช้งานที่ล็อกอินจริง ป้องกันการสวมสิทธิ์
    CREATE TABLE IF NOT EXISTS attendance_signatures (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      proctor_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      signed_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      signature_hash TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- ตารางบันทึกประวัติการกระทำของผู้ใช้ (Audit Log)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details_json TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    -- ตารางจัดเก็บสถานะและเวอร์ชันของตารางคุมสอบ
    CREATE TABLE IF NOT EXISTS schedule_states (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      data_json TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- สร้าง Index เพื่อความรวดเร็วในการค้นหา
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_signatures_session_room ON attendance_signatures(session_id, room_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);

  return db;
}

// Singleton DB instance
let globalDbInstance = null;

export function getDatabase() {
  if (!globalDbInstance) {
    globalDbInstance = initDatabase();
  }
  return globalDbInstance;
}
