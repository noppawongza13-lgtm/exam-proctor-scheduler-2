/**
 * ชุดทดสอบระบบความปลอดภัยและการยืนยันตัวตน M4 (Auth & Security Unit Tests)
 * รันด้วยคำสั่ง: node --test tests/m4-auth.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { initDatabase } from '../src/db/database.js';
import { 
  hashPassword, 
  verifyPassword, 
  createToken, 
  verifyToken, 
  hasPermission, 
  signAttendance, 
  logAuditAction, 
  seedDefaultUsers,
  ROLE_PERMISSIONS
} from '../src/auth/auth-service.js';
import { USER_ROLES } from '../src/data/schema.js';

describe('M4: Authentication, RBAC & Attendance Security Tests', () => {

  describe('Password Hashing & Verification', () => {
    it('เข้ารหัสและตรวจสอบรหัสผ่านได้อย่างถูกต้อง (scrypt)', () => {
      const password = 'BRUSecurePassword2026!';
      const { hash, salt } = hashPassword(password);

      assert.ok(hash && hash.length === 128); // 64 bytes hex = 128 chars
      assert.ok(salt && salt.length === 32);  // 16 bytes hex = 32 chars

      assert.equal(verifyPassword(password, hash, salt), true);
      assert.equal(verifyPassword('WrongPassword', hash, salt), false);
    });
  });

  describe('Signed HMAC Tokens', () => {
    it('สร้างและยืนยัน Signed Token ได้ถูกต้อง', () => {
      const payload = { id: 'U001', username: 'admin', role: USER_ROLES.ADMIN };
      const token = createToken(payload, 2); // 2 hours

      const verified = verifyToken(token);
      assert.ok(verified);
      assert.equal(verified.id, 'U001');
      assert.equal(verified.username, 'admin');
      assert.equal(verified.role, USER_ROLES.ADMIN);
    });

    it('ปฏิเสธ Token ที่ถูกดัดแปลงหรือปลอมแปลง (Tampered Token)', () => {
      const token = createToken({ id: 'U001', role: USER_ROLES.PROCTOR });
      const tampered = token.slice(0, -4) + 'abcd';
      assert.equal(verifyToken(tampered), null);
    });
  });

  describe('Role-Based Access Control (RBAC Permissions)', () => {
    it('Admin ต้องมีสิทธิ์แก้ไขตาราง ตั้งค่าโควตา และส่งออกข้อมูล', () => {
      assert.equal(hasPermission(USER_ROLES.ADMIN, 'SCHEDULE_EDIT'), true);
      assert.equal(hasPermission(USER_ROLES.ADMIN, 'QUOTA_CONFIG'), true);
      assert.equal(hasPermission(USER_ROLES.ADMIN, 'EXPORT_DATA'), true);
    });

    it('Teacher ต้องดูตารางสาขาได้ แต่ไม่มีสิทธิ์แก้ไขหรือตั้งค่าโควตา', () => {
      assert.equal(hasPermission(USER_ROLES.TEACHER, 'FACULTY_SCHEDULE_VIEW'), true);
      assert.equal(hasPermission(USER_ROLES.TEACHER, 'SCHEDULE_EDIT'), false);
      assert.equal(hasPermission(USER_ROLES.TEACHER, 'QUOTA_CONFIG'), false);
    });

    it('Proctor ต้องมีสิทธิ์ดูตารางตนเองและลงนามปฏิบัติหน้าที่', () => {
      assert.equal(hasPermission(USER_ROLES.PROCTOR, 'MY_SCHEDULE_VIEW'), true);
      assert.equal(hasPermission(USER_ROLES.PROCTOR, 'SIGN_ATTENDANCE'), true);
      assert.equal(hasPermission(USER_ROLES.PROCTOR, 'SCHEDULE_EDIT'), false);
    });

    it('Guest ค้นหาเลขที่นั่งได้อย่างจำกัด ห้ามดูตารางภายในหรือข้อมูลผู้คุม', () => {
      assert.equal(hasPermission(USER_ROLES.GUEST, 'SEARCH_SEAT_LIMITED'), true);
      assert.equal(hasPermission(USER_ROLES.GUEST, 'SCHEDULE_VIEW'), false);
      assert.equal(hasPermission(USER_ROLES.GUEST, 'SIGN_ATTENDANCE'), false);
    });
  });

  describe('Attendance Digital Signature Security (ผูกมัดบัญชีจริง)', () => {
    let db;
    beforeEach(() => {
      // ใช้งานฐานข้อมูลในหน่วยความจำสำหรับการทดสอบที่สะอาด
      db = initDatabase(':memory:');
      seedDefaultUsers(db);
    });

    it('ผู้คุมสอบสามารถลงนามในหน้าที่ของตนเองได้สำเร็จและบันทึก Hash ป้องกันการแก้ไข', () => {
      const proctorUser = {
        id: 'U_PROCTOR_1',
        username: 'proctor1',
        role: USER_ROLES.PROCTOR,
        proctorId: 'P001',
        displayName: 'ศ.ดร.ประสิทธิ์ วงศ์ปัญญา'
      };

      const result = signAttendance({
        db,
        currentUser: proctorUser,
        sessionId: 'S_MORNING',
        roomId: 'R17108',
        proctorId: 'P001', // ตรงกับ proctorId ของบัญชี
        ipAddress: '192.168.1.50',
        userAgent: 'Mozilla/5.0 Chrome'
      });

      assert.ok(result.id.startsWith('SIG_'));
      assert.equal(result.proctorId, 'P001');
      assert.equal(result.signerName, proctorUser.displayName);
      assert.ok(result.signatureHash);
      assert.equal(result.isVerified, true);

      // ตรวจสอบว่าบันทึกลง SQLite จริง
      const row = db.prepare('SELECT * FROM attendance_signatures WHERE id = ?').get(result.id);
      assert.ok(row);
      assert.equal(row.user_id, proctorUser.id);
      assert.equal(row.proctor_id, 'P001');

      // ตรวจสอบ Audit Log
      const audit = db.prepare('SELECT * FROM audit_logs WHERE target_id = ?').get(result.id);
      assert.ok(audit);
      assert.equal(audit.action, 'ATTENDANCE_SIGNED');
    });

    it('ปฏิเสธเมื่อผู้คุมสอบพยายามลงนามแทนผู้อื่น (Impersonation Prevention)', () => {
      const proctorUser = {
        id: 'U_PROCTOR_1',
        username: 'proctor1',
        role: USER_ROLES.PROCTOR,
        proctorId: 'P001',
        displayName: 'ศ.ดร.ประสิทธิ์ วงศ์ปัญญา'
      };

      // พยายามลงนามในตำแหน่งของ P002
      assert.throws(() => {
        signAttendance({
          db,
          currentUser: proctorUser,
          sessionId: 'S_MORNING',
          roomId: 'R17108',
          proctorId: 'P002' // คนละคนกับ proctorUser.proctorId
        });
      }, /ไม่อนุญาตให้ลงนามแทนผู้คุมสอบท่านอื่น/);
    });

    it('ป้องกันการลงนามซ้ำซ้อนในตำแหน่งเดียวกัน', () => {
      const proctorUser = {
        id: 'U_PROCTOR_1',
        role: USER_ROLES.PROCTOR,
        proctorId: 'P001',
        displayName: 'ศ.ดร.ประสิทธิ์'
      };

      // ลงนามครั้งแรก
      signAttendance({
        db,
        currentUser: proctorUser,
        sessionId: 'S_MORNING',
        roomId: 'R17108',
        proctorId: 'P001'
      });

      // พยายามลงนามครั้งที่สองในรอบเดิม ห้องเดิม ตำแหน่งเดิม
      assert.throws(() => {
        signAttendance({
          db,
          currentUser: proctorUser,
          sessionId: 'S_MORNING',
          roomId: 'R17108',
          proctorId: 'P001'
        });
      }, /ตำแหน่งนี้ได้รับการลงนามปฏิบัติหน้าที่เรียบร้อยแล้ว/);
    });
  });

});
