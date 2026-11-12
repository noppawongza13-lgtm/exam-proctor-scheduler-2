/**
 * Unit Test สำหรับ Milestone M1: โครงสร้างโปรเจกต์ กฎระเบียบ ELMS และโมเดลข้อมูลหลัก
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { 
  ELMS_CENTER_METADATA, 
  ROOM_STAFFING_RULES, 
  getRequiredProctorCount, 
  SENIORITY_RANKS, 
  STAFF_POOLS, 
  SESSION_PATTERNS 
} from '../src/config/elms-rules.js';

import { REAL_EXAM_ROOMS, ROOM_SUMMARY, getExamRoom } from '../src/data/rooms-data.js';
import { BUILDING_17_DIRECTORY, getDirectoryByFloor } from '../src/data/building-directory.js';
import { generateMockProctors, createRNG } from '../src/data/seed-generator.js';
import { createRoom, createProctor, createExamSession, createProctorAssignment } from '../src/data/schema.js';

describe('M1: Configuration & Rules Specification (ELMS Rules)', () => {
  it('ควรมีข้อมูลเมตาของศูนย์สอบ มรภ.บุรีรัมย์ อาคาร 17 ครบถ้วน', () => {
    assert.equal(ELMS_CENTER_METADATA.roomCount, 10);
    assert.equal(ELMS_CENTER_METADATA.totalSeats, 520);
    assert.equal(ELMS_CENTER_METADATA.staffPerSession, 21);
    assert.equal(ELMS_CENTER_METADATA.timezone, 'Asia/Bangkok');
  });

  it('ควรคำนวณจำนวนผู้คุมสอบตามเกณฑ์ความจุได้ถูกต้อง (ห้อง 40-60 ที่นั่ง = 2 คน, ห้อง >=70 ที่นั่ง = 3 คน)', () => {
    // ห้องมาตรฐาน (40 - 60 ที่นั่ง)
    const standardRoom = getRequiredProctorCount(40);
    assert.equal(standardRoom.requiredProctors, 2);
    assert.equal(standardRoom.composition.chief, 1);
    assert.equal(standardRoom.composition.coProctor, 1);

    const standardRoom60 = getRequiredProctorCount(60);
    assert.equal(standardRoom60.requiredProctors, 2);

    // ห้องขนาดใหญ่ (เช่น ห้อง 17201 ความจุ 80 ที่นั่ง)
    const largeRoom = getRequiredProctorCount(80);
    assert.equal(largeRoom.requiredProctors, 3);
    assert.equal(largeRoom.composition.chief, 1);
    assert.equal(largeRoom.composition.coProctor, 2);
  });

  it('ควรมีลำดับอาวุโส Seniority Rank 10 ถึง 3 ตาม ELMS ข้อ 3.2', () => {
    assert.equal(SENIORITY_RANKS.PROFESSOR.rank, 10);
    assert.equal(SENIORITY_RANKS.PROFESSOR.academicType, 'TEACHER');

    assert.equal(SENIORITY_RANKS.ASSOCIATE_PROFESSOR.rank, 9);
    assert.equal(SENIORITY_RANKS.ASSISTANT_PROFESSOR.rank, 8);
    assert.equal(SENIORITY_RANKS.LECTURER.rank, 7);

    assert.equal(SENIORITY_RANKS.SENIOR_SPECIALIST_STAFF.rank, 5);
    assert.equal(SENIORITY_RANKS.SENIOR_SPECIALIST_STAFF.academicType, 'SUPPORT');

    assert.equal(SENIORITY_RANKS.SENIOR_STAFF.rank, 4);
    assert.equal(SENIORITY_RANKS.PRACTITIONER_STAFF.rank, 3);
  });
});

describe('M1: Real Exam Rooms (10 ห้องสอบจริง 520 ที่นั่ง)', () => {
  it('ควรมีห้องสอบจริงครบ 10 ห้อง ความจุรวม 520 ที่นั่ง และอัตรากำลังรวม 21 ตำแหน่ง', () => {
    assert.equal(REAL_EXAM_ROOMS.length, 10);
    assert.equal(ROOM_SUMMARY.totalRooms, 10);
    assert.equal(ROOM_SUMMARY.totalCapacity, 520);
    assert.equal(ROOM_SUMMARY.totalRequiredProctors, 21);
  });

  it('ช่วงเลขที่นั่งต้องต่อเนื่องกันตั้งแต่ 1 ถึง 520 โดยไม่ทับซ้อนและไม่มีช่องว่าง', () => {
    let currentSeat = 1;
    for (const room of REAL_EXAM_ROOMS) {
      assert.equal(room.seatStart, currentSeat, `ห้อง ${room.roomCode} เลขที่นั่งเริ่มต้นไม่ถูกต้อง`);
      const expectedEnd = currentSeat + room.capacity - 1;
      assert.equal(room.seatEnd, expectedEnd, `ห้อง ${room.roomCode} เลขที่นั่งสิ้นสุดไม่ถูกต้อง`);
      currentSeat = expectedEnd + 1;
    }
    assert.equal(currentSeat - 1, 520);
  });

  it('ห้อง 17201 (ชั้น 2) ต้องมีความจุ 80 ที่นั่ง และต้องใช้ผู้คุม 3 คน', () => {
    const room17201 = getExamRoom('17201');
    assert.ok(room17201, 'ต้องพบห้อง 17201');
    assert.equal(room17201.capacity, 80);
    assert.equal(room17201.floor, 2);
    assert.equal(room17201.requiredProctors, 3);
    assert.equal(room17201.seatStart, 211);
    assert.equal(room17201.seatEnd, 290);
  });

  it('ต้องมีโต๊ะลงทะเบียนครบทั้ง 10 จุด (โต๊ะที่ 1 ถึง 10)', () => {
    REAL_EXAM_ROOMS.forEach((room, index) => {
      assert.equal(room.registrationDesk, `โต๊ะที่ ${index + 1}`);
    });
  });
});

describe('M1: Building 17 Directory (สารบบอาคาร 17)', () => {
  it('ชั้น 1 ต้องมีสารบบครบ 13 ห้อง (17101 - 17113)', () => {
    const floor1 = getDirectoryByFloor(1);
    assert.equal(floor1.length, 13);
    assert.equal(floor1[0].code, '17101');
    assert.equal(floor1[12].code, '17113');
  });

  it('ชั้น 2 ต้องมีสารบบครบ 14 ห้อง (17201 - 17214)', () => {
    const floor2 = getDirectoryByFloor(2);
    assert.equal(floor2.length, 14);
    assert.equal(floor2[0].code, '17201');
    assert.equal(floor2[13].code, '17214');
  });
});

describe('M1: Mock Seed Data Generator (สร้างข้อมูลจำลอง)', () => {
  it('ควรสร้างผู้คุมสอบจำลองได้ถูกต้องตามจำนวนที่กำหนด (20, 40, 80 คน)', () => {
    const proctors20 = generateMockProctors(20, 101);
    const proctors40 = generateMockProctors(40, 102);
    const proctors80 = generateMockProctors(80, 103);

    assert.equal(proctors20.length, 20);
    assert.equal(proctors40.length, 40);
    assert.equal(proctors80.length, 80);
  });

  it('การใช้ Seed เดียวกันต้องได้ข้อมูลผลลัพธ์เดิมแน่นอน (Deterministic Output)', () => {
    const run1 = generateMockProctors(40, 9999);
    const run2 = generateMockProctors(40, 9999);

    assert.deepEqual(run1, run2, 'ผลการสุ่มด้วย Seed เดียวกันต้องเท่ากันทุกประการ');
  });

  it('ต้องมีทั้งกลุ่ม Core Pool และ Reserve Pool', () => {
    const proctors = generateMockProctors(40, 2026);
    const hasCore = proctors.some(p => p.pool === STAFF_POOLS.CORE);
    const hasReserve = proctors.some(p => p.pool === STAFF_POOLS.RESERVE);

    assert.ok(hasCore, 'ต้องมีบุคลากร Core Pool');
    assert.ok(hasReserve, 'ต้องมีบุคลากร Reserve Pool');
  });

  it('ต้องไม่มีการใช้ชื่อบุคคลจริง (จำลองขึ้นใหม่ทั้งหมด)', () => {
    const proctors = generateMockProctors(20, 555);
    for (const p of proctors) {
      assert.ok(p.name.length > 5);
      assert.ok(p.id.startsWith('P'));
      assert.ok(p.seniorityRank >= 3 && p.seniorityRank <= 10);
    }
  });
});
