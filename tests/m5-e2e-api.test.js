/**
 * ชุดทดสอบระบบ API Integration และ End-to-End M5 - M10
 * รันด้วยคำสั่ง: node --test tests/m5-e2e-api.test.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { app } from '../src/server/app.js';

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  if (server) server.close();
});

describe('E2E REST API & Full-Stack System Tests (M5 - M10)', () => {

  let adminToken;
  let proctorToken;

  describe('Auth APIs', () => {
    it('ล็อกอินด้วยบัญชี Admin สำเร็จและได้รับ Signed Token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin1234' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.token);
      assert.equal(data.user.role, 'ADMIN');
      adminToken = data.token;
    });

    it('ล็อกอินด้วยบัญชี Proctor สำเร็จ', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'proctor1', password: 'proctor1234' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.token);
      assert.equal(data.user.role, 'PROCTOR');
      assert.ok(data.user.proctorId);
      proctorToken = data.token;
    });

    it('ดึงรายชื่อ Demo Accounts ได้ครบทุกบทบาท', async () => {
      const res = await fetch(`${baseUrl}/api/auth/demo-accounts`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.accounts.length >= 4);
    });
  });

  describe('Schedule & Solver APIs (M5 & M6)', () => {
    it('ดึงข้อมูล Schedule เริ่มต้นพบ 10 ห้องสอบจริง และ 42 Slots', async () => {
      const res = await fetch(`${baseUrl}/api/schedule`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.rooms.length, 10);
      assert.equal(data.slots.length, 42);
      assert.ok(data.workloadStats);
      assert.ok(data.validation);
    });

    it('จัดตารางอัตโนมัติด้วย 5-Priority Solver ผ่าน API สำเร็จครบ 42 ตำแหน่ง', async () => {
      const res = await fetch(`${baseUrl}/api/schedule/solve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ proctorCount: 40 })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.solvedCount, 42);
      assert.ok(data.executionTimeMs < 1000);
    });

    it('ตรวจสอบตารางหลังจัดอัตโนมัติพบว่าผ่าน Hard Constraints 100%', async () => {
      const res = await fetch(`${baseUrl}/api/schedule`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      assert.equal(data.validation.isValid, true);
      assert.equal(data.validation.hardViolationsCount, 0);
      assert.ok(data.validation.softScore > 80);
    });
  });

  describe('Undo & Redo APIs (M5)', () => {
    it('สามารถ Undo การกระทำและย้อนกลับตารางได้', async () => {
      const res = await fetch(`${baseUrl}/api/schedule/undo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    });

    it('สามารถ Redo การกระทำได้', async () => {
      const res = await fetch(`${baseUrl}/api/schedule/redo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    });
  });

  describe('Digital Attendance Signature API (M4 & M5)', () => {
    it('Proctor สามารถลงนามในตำแหน่งของตนเองได้สำเร็จ', async () => {
      const schedRes = await fetch(`${baseUrl}/api/schedule`);
      const schedData = await schedRes.json();
      const unsignedSlot = schedData.slots.find(s => s.sessionId === 'S_AFTERNOON');

      if (unsignedSlot) {
        // มอบหมายให้ proctor1 (P001)
        await fetch(`${baseUrl}/api/schedule/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ slotId: unsignedSlot.id, proctorId: 'P001', force: true })
        });

        const signRes = await fetch(`${baseUrl}/api/schedule/sign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${proctorToken}`
          },
          body: JSON.stringify({ slotId: unsignedSlot.id })
        });

        const signData = await signRes.json();
        if (signRes.status === 200) {
          assert.equal(signData.success, true);
          assert.ok(signData.signature.signatureHash);
        } else {
          // ถ้าเคยลงนามแล้วในรอบการทดสอบก่อนหน้า
          assert.ok(signData.error.includes('เรียบร้อยแล้ว'));
        }
      }
    });
  });

  describe('Guest Examinee Portal Seat Finder API (M7)', () => {
    it('ค้นหาที่นั่งสอบด้วยเลขประชาชนถูกต้อง และส่งข้อมูลแบบ Masked ID พร้อมตำแหน่งห้องและจุดลงทะเบียน', async () => {
      const res = await fetch(`${baseUrl}/api/guest/search?citizenId=00001`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.examinee);
      assert.ok(data.examinee.roomCode);
      assert.ok(data.examinee.registrationTable);
      assert.ok(data.examinee.maskedCitizenId.includes('*****'));
    });

    it('แจ้งข้อผิดพลาดเมื่อไม่พบข้อมูล', async () => {
      const res = await fetch(`${baseUrl}/api/guest/search?citizenId=999999999`);
      assert.equal(res.status, 404);
    });
  });

  describe('Export API (M8)', () => {
    it('ดาวน์โหลด CSV สำเร็จและมี UTF-8 BOM (\uFEFF) สำหรับ Excel ภาษาไทย', async () => {
      const res = await fetch(`${baseUrl}/api/export/csv`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'text/csv; charset=utf-8');
      const buf = Buffer.from(await res.arrayBuffer());
      assert.equal(buf[0], 0xEF);
      assert.equal(buf[1], 0xBB);
      assert.equal(buf[2], 0xBF);
      const text = buf.toString('utf8');
      assert.ok(text.includes('รอบสอบ,วันที่,เวลา,ห้องสอบ'));
    });
  });

  describe('AI Rules Assistant API (M9)', () => {
    it('ตอบคำถามเกี่ยวกับการตรวจสอบกฎได้อย่างถูกต้อง', async () => {
      const res = await fetch(`${baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'ช่วยตรวจสอบตารางปัจจุบันหน่อยว่าถูกต้องตามกฎหรือไม่' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.answer);
      assert.ok(data.answer.includes('Hard Constraints') || data.answer.includes('ผลการตรวจสอบ'));
    });

    it('ตอบคำถามเกี่ยวกับอัตรากำลังห้อง 17201 (ห้อง 80 ที่นั่ง 3 คน) ได้ถูกต้อง', async () => {
      const res = await fetch(`${baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'ห้อง 17201 ต้องใช้ผู้คุมกี่คน' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.answer.includes('17201'));
      assert.ok(data.answer.includes('3'));
    });
  });

});
