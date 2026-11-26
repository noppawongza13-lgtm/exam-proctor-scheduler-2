/**
 * ชุดทดสอบระบบตรวจสอบกฎ M2 (Rule Checker Unit Tests: H1 - H9 & Soft Constraints S1 - S5)
 * รันด้วยคำสั่ง: node --test tests/m2-rule-checker.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { 
  checkH1NoOverlap,
  checkH2RoomCapacityAndOverlap,
  checkH3QuotaLimits,
  checkH4AvailabilityAndPattern,
  checkH5RoomStaffingAndChiefSeniority,
  checkH6MinimumRestBreak,
  checkH7SpecialRequirements,
  checkH8ReservePoolRestriction,
  checkH9ConflictOfInterest
} from '../src/rules/hard-constraints.js';

import {
  calculateJainsFairnessIndex,
  calculateSoftScore,
  evaluateS1Fairness,
  evaluateS2RoomStickiness
} from '../src/rules/soft-constraints.js';

import {
  validateSchedule,
  validateCandidateForSlot
} from '../src/rules/rule-checker.js';

import { SENIORITY_RANKS, STAFF_POOLS, SESSION_PATTERNS } from '../src/config/elms-rules.js';

// ข้อมูลจำลองสำหรับทดสอบ
const mockDate = '2026-11-15';

const mockSessions = [
  {
    id: 'S1',
    title: 'รอบสอบเช้า (08:30 - 11:30)',
    date: mockDate,
    startTime: '08:30',
    endTime: '11:30',
    prepMinutes: 30, // 08:00
    wrapMinutes: 15  // 11:45
  },
  {
    id: 'S2',
    title: 'รอบสอบบ่าย (13:00 - 16:00)',
    date: mockDate,
    startTime: '13:00',
    endTime: '16:00',
    prepMinutes: 30, // 12:30 (เวลาพัก 11:45 ถึง 12:30 คือ 45 นาที ผ่านเกณฑ์ H6)
    wrapMinutes: 15  // 16:15
  },
  {
    id: 'S_OVERLAP',
    title: 'รอบสอบทับซ้อน (09:00 - 12:00)',
    date: mockDate,
    startTime: '09:00',
    endTime: '12:00',
    prepMinutes: 30,
    wrapMinutes: 15
  }
];

const mockRooms = [
  {
    id: 'R17101',
    roomCode: '17101',
    name: 'Lab 1',
    capacity: 50,
    requiredProctors: 2,
    isActive: true,
    isAccessible: true
  },
  {
    id: 'R17201',
    roomCode: '17201',
    name: 'Lab ใหญ่',
    capacity: 80,
    requiredProctors: 3,
    isActive: true,
    isAccessible: false
  }
];

const mockProctors = [
  {
    id: 'P01',
    name: 'ศ.ดร.ประสิทธิ์',
    seniorityRank: SENIORITY_RANKS.PROFESSOR.rank, // 10
    maxSessions: 4,
    availableDates: [mockDate],
    pool: STAFF_POOLS.CORE,
    sessionPattern: SESSION_PATTERNS.FULL_DAY_PAIRED
  },
  {
    id: 'P02',
    name: 'ผศ.ดร.สมชาย',
    seniorityRank: SENIORITY_RANKS.ASSISTANT_PROFESSOR.rank, // 8
    maxSessions: 4,
    availableDates: [mockDate],
    pool: STAFF_POOLS.CORE,
    sessionPattern: SESSION_PATTERNS.FULL_DAY_PAIRED
  },
  {
    id: 'P03',
    name: 'อาจารย์สุดา',
    seniorityRank: SENIORITY_RANKS.LECTURER.rank, // 7
    maxSessions: 2,
    availableDates: [mockDate],
    pool: STAFF_POOLS.CORE,
    sessionPattern: SESSION_PATTERNS.SINGLE_PER_DAY
  },
  {
    id: 'P04',
    name: 'คุณวิชัย (ชำนาญการ)',
    seniorityRank: SENIORITY_RANKS.SENIOR_STAFF.rank, // 4
    maxSessions: 4,
    availableDates: [mockDate],
    pool: STAFF_POOLS.CORE,
    sessionPattern: SESSION_PATTERNS.FLEXIBLE
  },
  {
    id: 'P_RESERVE',
    name: 'คุณสำรอง พรพรรณ',
    seniorityRank: SENIORITY_RANKS.PRACTITIONER_STAFF.rank, // 3
    maxSessions: 4,
    availableDates: [mockDate],
    pool: STAFF_POOLS.RESERVE,
    sessionPattern: SESSION_PATTERNS.FLEXIBLE
  },
  {
    id: 'P_INVALID_QUOTA',
    name: 'โควตาผิด',
    seniorityRank: 7,
    maxSessions: 0,
    availableDates: [mockDate],
    pool: STAFF_POOLS.CORE
  }
];

describe('M2: Rule Checker Unit Tests', () => {

  describe('H1: No Overlap', () => {
    it('ผ่านเมื่อผู้คุมสอบปฏิบัติหน้าที่คนละช่วงเวลา (เช้าและบ่าย)', () => {
      const assigns = [
        { proctorId: 'P01', sessionId: 'S1', roomCode: '17101' },
        { proctorId: 'P01', sessionId: 'S2', roomCode: '17101' }
      ];
      const violations = checkH1NoOverlap(assigns, mockSessions);
      assert.equal(violations.length, 0);
    });

    it('ตรวจพบการละเมิดเมื่อผู้คุมถูกจัดสองห้องในรอบสอบเดียวกันหรือทับซ้อน', () => {
      const assigns = [
        { proctorId: 'P01', proctorName: 'ศ.ดร.ประสิทธิ์', sessionId: 'S1', roomCode: '17101' },
        { proctorId: 'P01', proctorName: 'ศ.ดร.ประสิทธิ์', sessionId: 'S_OVERLAP', roomCode: '17201' }
      ];
      const violations = checkH1NoOverlap(assigns, mockSessions);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, 'H1');
      assert.equal(violations[0].proctorId, 'P01');
    });
  });

  describe('H2: Room Capacity & Overlap', () => {
    it('ตรวจพบเมื่อห้องเดียวกันถูกใช้งานในสองรอบที่เวลาทับซ้อนกัน', () => {
      const assigns = [
        { proctorId: 'P01', sessionId: 'S1', roomId: 'R17101', roomCode: '17101' },
        { proctorId: 'P02', sessionId: 'S_OVERLAP', roomId: 'R17101', roomCode: '17101' }
      ];
      const violations = checkH2RoomCapacityAndOverlap(assigns, mockSessions, mockRooms);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, 'H2');
    });
  });

  describe('H3: Strict Quota Limit', () => {
    it('ตรวจพบเมื่อผู้คุมสอบถูกจัดเกิน maxSessions', () => {
      const assigns = [
        { proctorId: 'P03', sessionId: 'S1' },
        { proctorId: 'P03', sessionId: 'S2' },
        { proctorId: 'P03', sessionId: 'S3' } // P03 maxSessions คือ 2 แต่จัด 3
      ];
      const testSessions = [
        ...mockSessions,
        { id: 'S3', date: '2026-11-16', startTime: '08:30', endTime: '11:30' }
      ];
      const violations = checkH3QuotaLimits(assigns, mockProctors, testSessions);
      assert.ok(violations.some(v => v.rule === 'H3' && v.proctorId === 'P03'));
    });

    it('ห้ามจัดผู้คุมที่มี maxSessions <= 0 เด็ดขาด', () => {
      const assigns = [
        { proctorId: 'P_INVALID_QUOTA', sessionId: 'S1' }
      ];
      const violations = checkH3QuotaLimits(assigns, mockProctors, mockSessions);
      assert.ok(violations.some(v => v.rule === 'H3' && v.proctorId === 'P_INVALID_QUOTA'));
    });
  });

  describe('H4: Availability & Session Pattern', () => {
    it('ตรวจพบเมื่อผู้คุมสอบถูกจัดในวันที่ไม่ได้ระบุว่าสะดวก', () => {
      const assigns = [
        { proctorId: 'P01', sessionId: 'S_OTHER_DAY' }
      ];
      const otherDaySession = [{ id: 'S_OTHER_DAY', date: '2026-11-20', startTime: '09:00', endTime: '12:00' }];
      const violations = checkH4AvailabilityAndPattern(assigns, mockProctors, otherDaySession);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, 'H4');
    });

    it('ตรวจพบเมื่อติดการลา (Unavailability)', () => {
      const assigns = [{ proctorId: 'P01', sessionId: 'S1' }];
      const unavails = [{ proctorId: 'P01', date: mockDate, reason: 'ไปราชการ' }];
      const violations = checkH4AvailabilityAndPattern(assigns, mockProctors, mockSessions, unavails);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, 'H4');
    });

    it('ตรวจพบเมื่อผู้คุม SINGLE_PER_DAY ถูกจัดมากกว่า 1 รอบในวันเดียวกัน', () => {
      const assigns = [
        { proctorId: 'P03', sessionId: 'S1' },
        { proctorId: 'P03', sessionId: 'S2' }
      ];
      const violations = checkH4AvailabilityAndPattern(assigns, mockProctors, mockSessions);
      assert.ok(violations.some(v => v.rule === 'H4' && v.proctorId === 'P03'));
    });
  });

  describe('H5: Room Staffing & Seniority Hierarchy', () => {
    it('ผ่านเมื่อห้อง 50 ที่นั่งมี 2 คน และหัวหน้าห้องอาวุโสกว่ากรรมการร่วม', () => {
      const assigns = [
        { sessionId: 'S1', roomId: 'R17101', roomCode: '17101', proctorId: 'P01', order: 1, role: 'CHIEF' }, // Rank 10
        { sessionId: 'S1', roomId: 'R17101', roomCode: '17101', proctorId: 'P02', order: 2, role: 'CO_PROCTOR' } // Rank 8
      ];
      const violations = checkH5RoomStaffingAndChiefSeniority(assigns, [mockRooms[0]], mockProctors, [mockSessions[0]]);
      assert.equal(violations.length, 0);
    });

    it('ตรวจพบเมื่อห้องขาดกรรมการ (ห้อง 80 ที่นั่ง ต้องการ 3 คน แต่มี 2 คน)', () => {
      const assigns = [
        { sessionId: 'S1', roomId: 'R17201', roomCode: '17201', proctorId: 'P01', order: 1, role: 'CHIEF' },
        { sessionId: 'S1', roomId: 'R17201', roomCode: '17201', proctorId: 'P02', order: 2, role: 'CO_PROCTOR' }
      ];
      const violations = checkH5RoomStaffingAndChiefSeniority(assigns, [mockRooms[1]], mockProctors, [mockSessions[0]]);
      assert.ok(violations.some(v => v.rule === 'H5' && v.roomId === 'R17201'));
    });

    it('ตรวจพบเมื่อหัวหน้าห้องอาวุโสน้อยกว่ากรรมการร่วมในห้องเดียวกัน', () => {
      const assigns = [
        { sessionId: 'S1', roomId: 'R17101', roomCode: '17101', proctorId: 'P04', order: 1, role: 'CHIEF' }, // Rank 4 (หัวหน้า)
        { sessionId: 'S1', roomId: 'R17101', roomCode: '17101', proctorId: 'P01', order: 2, role: 'CO_PROCTOR' } // Rank 10 (กรรมการร่วม)
      ];
      const violations = checkH5RoomStaffingAndChiefSeniority(assigns, [mockRooms[0]], mockProctors, [mockSessions[0]]);
      assert.ok(violations.some(v => v.rule === 'H5' && v.message.includes('ลำดับอาวุโสน้อยกว่า')));
    });
  });

  describe('H6: Minimum Rest Break', () => {
    it('ตรวจพบเมื่อเวลาพักระหว่างรอบน้อยกว่าเกณฑ์ (ต่ำกว่า 45 นาที)', () => {
      const tightSessions = [
        { id: 'T1', date: mockDate, startTime: '08:30', endTime: '11:30', prepMinutes: 30, wrapMinutes: 15 }, // จบ 11:45
        { id: 'T2', date: mockDate, startTime: '12:00', endTime: '15:00', prepMinutes: 30, wrapMinutes: 15 }  // เริ่มเข้าห้อง 11:30 -> พัก -15 นาที!
      ];
      const assigns = [
        { proctorId: 'P01', proctorName: 'ศ.ดร.ประสิทธิ์', sessionId: 'T1' },
        { proctorId: 'P01', proctorName: 'ศ.ดร.ประสิทธิ์', sessionId: 'T2' }
      ];
      const violations = checkH6MinimumRestBreak(assigns, tightSessions);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, 'H6');
    });
  });

  describe('H7: Special Requirements', () => {
    it('ตรวจพบเมื่อรอบสอบต้องการห้องรองรับผู้พิการ แต่ถูกจัดห้องที่ไม่รองรับ', () => {
      const specialSession = [{ id: 'SPEC', date: mockDate, requiresAccessibility: true, title: 'สอบผู้พิการ' }];
      const assigns = [{ sessionId: 'SPEC', roomId: 'R17201', roomCode: '17201', proctorId: 'P01' }];
      const violations = checkH7SpecialRequirements(assigns, specialSession, mockRooms);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, 'H7');
    });
  });

  describe('H8: Reserve Pool Usage Restriction', () => {
    it('ห้ามนำบุคลากรจาก Reserve Pool มาจัดสรรเป็นงานหลักโดยไม่มี flag ยกเว้น', () => {
      const assigns = [
        { proctorId: 'P_RESERVE', sessionId: 'S1', isSubstitute: false, isReserveCalled: false }
      ];
      const violations = checkH8ReservePoolRestriction(assigns, mockProctors);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, 'H8');
    });

    it('อนุญาตให้ใช้ Reserve Pool ได้เมื่อถูกเรียกแทน (isSubstitute = true หรือ isReserveCalled = true)', () => {
      const assigns = [
        { proctorId: 'P_RESERVE', sessionId: 'S1', isSubstitute: true }
      ];
      const violations = checkH8ReservePoolRestriction(assigns, mockProctors);
      assert.equal(violations.length, 0);
    });
  });

  describe('H9: Conflict of Interest', () => {
    it('ตรวจพบความเกี่ยวข้องเมื่อเปิดใช้งาน enableH9ConflictOfInterest', () => {
      const assigns = [{ proctorId: 'P01', proctorName: 'ศ.ดร.ประสิทธิ์', sessionId: 'S1', roomCode: '17101' }];
      const examinees = [{ sessionId: 'S1', roomCode: '17101', citizenId: '1310100012345' }];
      const conflicts = [{ proctorId: 'P01', examineeCitizenId: '1310100012345', relation: 'บุตร' }];
      const config = { enableH9ConflictOfInterest: true };

      const violations = checkH9ConflictOfInterest(assigns, examinees, conflicts, config);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, 'H9');
    });

    it('ไม่ตรวจหากปิดใช้งาน enableH9ConflictOfInterest = false', () => {
      const assigns = [{ proctorId: 'P01', sessionId: 'S1', roomCode: '17101' }];
      const examinees = [{ sessionId: 'S1', roomCode: '17101', citizenId: '1310100012345' }];
      const conflicts = [{ proctorId: 'P01', examineeCitizenId: '1310100012345' }];
      const config = { enableH9ConflictOfInterest: false };

      const violations = checkH9ConflictOfInterest(assigns, examinees, conflicts, config);
      assert.equal(violations.length, 0);
    });
  });

  describe('Soft Constraints & Jain\'s Fairness Index', () => {
    it('คำนวณ Jain\'s Index ถูกต้อง (เท่ากันหมดได้ 1.0, เหลื่อมล้ำค่าจะลดลง)', () => {
      const equalLoads = [0.5, 0.5, 0.5, 0.5];
      assert.equal(calculateJainsFairnessIndex(equalLoads), 1.0);

      const unequalLoads = [1.0, 0.0, 0.0, 0.0];
      const jainUnequal = calculateJainsFairnessIndex(unequalLoads);
      assert.equal(jainUnequal, 0.25); // 1 / 4
    });

    it('คำนวณ Soft Score รวมได้อย่างถูกต้อง (0 ถึง 100 คะแนน)', () => {
      const assigns = [
        { proctorId: 'P01', sessionId: 'S1', roomCode: '17101', roomId: 'R17101' },
        { proctorId: 'P01', sessionId: 'S2', roomCode: '17101', roomId: 'R17101' } // คุมห้องเดิมทั้งวัน (Room Stickiness)
      ];
      const result = calculateSoftScore(assigns, mockSessions, mockProctors);
      assert.ok(result.totalScore >= 0 && result.totalScore <= 100);
      assert.equal(result.breakdown.length, 5);
    });
  });

  describe('Unified Validator & Single Slot Candidate Validator', () => {
    it('validateSchedule สรุปผลตารางได้อย่างครบถ้วนและถูกต้อง', () => {
      const assigns = [
        { id: 'A1', proctorId: 'P01', sessionId: 'S1', roomId: 'R17101', roomCode: '17101', order: 1, role: 'CHIEF' },
        { id: 'A2', proctorId: 'P02', sessionId: 'S1', roomId: 'R17101', roomCode: '17101', order: 2, role: 'CO_PROCTOR' }
      ];
      const result = validateSchedule({
        assignments: assigns,
        sessions: [mockSessions[0]],
        rooms: [mockRooms[0]],
        proctors: mockProctors
      });

      assert.equal(result.isValid, true);
      assert.equal(result.hardViolationsCount, 0);
      assert.ok(result.softScore > 0);
      assert.equal(result.summary.status, 'VALID');
    });

    it('validateCandidateForSlot ตรวจสอบคุณสมบัติก่อนมอบหมายได้ถูกต้อง', () => {
      // 1. เคสผ่าน: P01 เป็นหัวหน้าห้อง (Order 1) มี rank 10
      const checkValid = validateCandidateForSlot({
        proctor: mockProctors[0],
        session: mockSessions[0],
        room: mockRooms[0],
        order: 1,
        currentAssignments: [],
        sessions: mockSessions,
        proctors: mockProctors
      });
      assert.equal(checkValid.canAssign, true);

      // 2. เคสไม่ผ่าน: P04 (Rank 4) พยายามเป็นหัวหน้าห้อง ทั้งที่มี P01 (Rank 10) อยู่ในห้องแล้ว
      const existingAssign = [
        { sessionId: 'S1', roomId: 'R17101', roomCode: '17101', proctorId: 'P01', order: 2 }
      ];
      const checkInvalidSeniority = validateCandidateForSlot({
        proctor: mockProctors[3], // P04 Rank 4
        session: mockSessions[0],
        room: mockRooms[0],
        order: 1,
        currentAssignments: existingAssign,
        sessions: mockSessions,
        proctors: mockProctors
      });
      assert.equal(checkInvalidSeniority.canAssign, false);
      assert.ok(checkInvalidSeniority.reasons[0].includes('ลำดับอาวุโส') || checkInvalidSeniority.reasons[0].includes('อาวุโสสูงสุด'));

      // 3. เคสไม่ผ่าน: โควตาเต็ม
      const quotaFullProctor = { ...mockProctors[2], maxSessions: 1 };
      const currentDuty = [{ proctorId: quotaFullProctor.id, sessionId: 'S_PREV' }];
      const checkQuotaFull = validateCandidateForSlot({
        proctor: quotaFullProctor,
        session: mockSessions[1],
        room: mockRooms[0],
        order: 2,
        currentAssignments: currentDuty,
        sessions: mockSessions,
        proctors: mockProctors
      });
      assert.equal(checkQuotaFull.canAssign, false);
      assert.ok(checkQuotaFull.reasons.some(r => r.includes('โควตาสูงสุด')));
    });
  });

});
