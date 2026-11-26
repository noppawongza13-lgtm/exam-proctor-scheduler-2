/**
 * ชุดทดสอบระบบจัดตารางอัจฉริยะ M3 (Solver & Quota Engine Unit Tests)
 * รันด้วยคำสั่ง: node --test tests/m3-solver.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { REAL_EXAM_ROOMS } from '../src/data/rooms-data.js';
import { generateMockProctors } from '../src/data/seed-generator.js';
import { calculateRequiredSlots, checkFeasibility } from '../src/solver/feasibility.js';
import { calculateMinimumProctorRequirements, generateRecoveryOptions } from '../src/solver/min-staff-calc.js';
import { calculateWorkloadStatistics } from '../src/solver/jain-index.js';
import { solveProctorSchedule, generateEmptySlots } from '../src/solver/priority-engine.js';
import { explainAssignment } from '../src/explain/explanation-engine.js';
import { generateScheduleDiagnosticReport } from '../src/explain/failure-advisor.js';
import { validateSchedule } from '../src/rules/rule-checker.js';

// กำหนดรอบสอบมาตรฐาน 1 วัน (เช้า + บ่าย) สำหรับอาคาร 17
const testDate = '2026-11-15';
const standardTwoSessions = [
  {
    id: 'S_MORNING',
    title: 'รอบสอบเช้า (08:30 - 11:30 น.)',
    date: testDate,
    startTime: '08:30',
    endTime: '11:30',
    prepMinutes: 30,
    wrapMinutes: 15
  },
  {
    id: 'S_AFTERNOON',
    title: 'รอบสอบบ่าย (13:00 - 16:00 น.)',
    date: testDate,
    startTime: '13:00',
    endTime: '16:00',
    prepMinutes: 30,
    wrapMinutes: 15
  }
];

describe('M3: Solver & Quota Engine Tests', () => {

  describe('Feasibility & Minimum Staff Calculator', () => {
    it('คำนวณจำนวนตำแหน่งที่ต้องการของ 10 ห้องสอบจริงได้ 21 ตำแหน่งต่อรอบ (รวม 42 ตำแหน่งใน 2 รอบ)', () => {
      const { totalRequiredSlots, sessionRequirements } = calculateRequiredSlots(standardTwoSessions, REAL_EXAM_ROOMS);
      assert.equal(sessionRequirements[0].requiredProctors, 21);
      assert.equal(sessionRequirements[1].requiredProctors, 21);
      assert.equal(totalRequiredSlots, 42);
    });

    it('คำนวณ Minimum Proctor Requirements ได้ 21 คน (Full-Day) และ 42 คน (Single-Per-Day)', () => {
      const minReq = calculateMinimumProctorRequirements(standardTwoSessions, REAL_EXAM_ROOMS);
      assert.equal(minReq.proctorsPerSession, 21);
      assert.equal(minReq.minProctorsNeeded.idealFullDayPaired, 21);
      assert.equal(minReq.minProctorsNeeded.strictSinglePerDay, 42);
    });

    it('แจ้งเตือนสถานะขาดแคลนเมื่อบุคลากรไม่พอ (เช่น มีเพียง 10 คนสำหรับ 2 รอบ)', () => {
      const fewProctors = generateMockProctors(10, 42, [testDate]);
      const feas = checkFeasibility({
        sessions: standardTwoSessions,
        rooms: REAL_EXAM_ROOMS,
        proctors: fewProctors
      });
      assert.equal(feas.isFeasible, false);
      assert.ok(feas.deficitSlots > 0);
    });
  });

  describe('Jain\'s Fairness Statistics', () => {
    it('คำนวณ Mean, Variance, StdDev และ Rating ได้ถูกต้อง', () => {
      const stats = calculateWorkloadStatistics([2, 2, 2, 2]);
      assert.equal(stats.mean, 2);
      assert.equal(stats.variance, 0);
      assert.equal(stats.stdDev, 0);
      assert.equal(stats.jainIndex, 1.0);
      assert.equal(stats.rating, 'EXCELLENT');
    });

    it('ลดระดับ Rating เป็น UNEVEN เมื่อภาระงานไม่เท่ากันอย่างมาก', () => {
      const stats = calculateWorkloadStatistics([4, 4, 0, 0]);
      assert.ok(stats.jainIndex < 0.7);
      assert.equal(stats.rating, 'UNEVEN');
    });
  });

  describe('5-Priority Solver: 40 Proctors Benchmark (มาตรฐาน 10 ห้องจริง)', () => {
    it('จัดตารางสำเร็จครบ 42 ตำแหน่ง ใช้เวลาต่ำกว่า 1,000 ms และผ่าน Hard Constraints 100%', () => {
      const proctors40 = generateMockProctors(40, 100, [testDate]);

      const result = solveProctorSchedule({
        sessions: standardTwoSessions,
        rooms: REAL_EXAM_ROOMS,
        proctors: proctors40
      });

      // 1. ตรวจสอบความสมบูรณ์
      assert.equal(result.success, true);
      assert.equal(result.totalSlots, 42);
      assert.equal(result.solvedCount, 42);
      assert.equal(result.unfilledSlotsCount, 0);
      assert.ok(result.executionTimeMs < 1000, `Execution time ${result.executionTimeMs} ms exceeds 1000 ms`);

      // 2. นำผลลัพธ์ไปตรวจสอบด้วย Unified Rule Checker (H1 - H9)
      const validation = validateSchedule({
        assignments: result.assignments,
        sessions: standardTwoSessions,
        rooms: REAL_EXAM_ROOMS,
        proctors: proctors40
      });

      assert.equal(validation.isValid, true);
      assert.equal(validation.hardViolationsCount, 0);

      // 3. ตรวจสอบห้อง 17201 ว่าได้ผู้คุม 3 คนจริง
      const room17201Morning = result.assignments.filter(a => a.sessionId === 'S_MORNING' && a.roomCode === '17201');
      assert.equal(room17201Morning.length, 3);

      // 4. ตรวจสอบห้อง 17108 ว่าได้ผู้คุม 2 คนจริง
      const room17108Morning = result.assignments.filter(a => a.sessionId === 'S_MORNING' && a.roomCode === '17108');
      assert.equal(room17108Morning.length, 2);

      // 5. ตรวจสอบลำดับความอาวุโส (Chief Seniority >= Co-proctors)
      const chief = room17201Morning.find(a => a.order === 1);
      const co1 = room17201Morning.find(a => a.order === 2);
      const co2 = room17201Morning.find(a => a.order === 3);

      const pChief = proctors40.find(p => p.id === chief.proctorId);
      const pCo1 = proctors40.find(p => p.id === co1.proctorId);
      const pCo2 = proctors40.find(p => p.id === co2.proctorId);

      assert.ok((pChief.seniorityRank || 0) >= (pCo1.seniorityRank || 0));
      assert.ok((pChief.seniorityRank || 0) >= (pCo2.seniorityRank || 0));
    });
  });

  describe('5-Priority Solver: 80 Proctors Benchmark (บุคลากรขนาดใหญ่)', () => {
    it('จัดตารางสำเร็จได้อย่างรวดเร็วและกระจายภาระงานได้อย่างเป็นธรรม', () => {
      const proctors80 = generateMockProctors(80, 200, [testDate]);

      const result = solveProctorSchedule({
        sessions: standardTwoSessions,
        rooms: REAL_EXAM_ROOMS,
        proctors: proctors80
      });

      assert.equal(result.success, true);
      assert.equal(result.unfilledSlotsCount, 0);
      assert.ok(result.executionTimeMs < 1000);

      const validation = validateSchedule({
        assignments: result.assignments,
        sessions: standardTwoSessions,
        rooms: REAL_EXAM_ROOMS,
        proctors: proctors80
      });

      assert.equal(validation.isValid, true);
    });
  });

  describe('Explainability Engine & Failure Advisor', () => {
    it('สร้างคำอธิบายภาษาไทยพร้อมแท็กประกอบสำหรับการมอบหมายงานได้ถูกต้อง', () => {
      const proctors40 = generateMockProctors(40, 100, [testDate]);
      const result = solveProctorSchedule({
        sessions: standardTwoSessions,
        rooms: REAL_EXAM_ROOMS,
        proctors: proctors40
      });

      const firstAssign = result.assignments[0];
      const explanation = explainAssignment(firstAssign, {
        proctors: proctors40,
        sessions: standardTwoSessions,
        rooms: REAL_EXAM_ROOMS,
        allAssignments: result.assignments
      });

      assert.ok(explanation.proctorName);
      assert.ok(explanation.roleTitle);
      assert.ok(explanation.tags.length > 0);
      assert.ok(explanation.summaryThai.length > 0);
    });

    it('สร้างรายงาน Diagnostic และ Actionable Recovery Options เมื่อบุคลากรไม่เพียงพอ', () => {
      const fewProctors = generateMockProctors(15, 50, [testDate]); // 15 คน ไม่พอสำหรับ 42 slots
      const result = solveProctorSchedule({
        sessions: standardTwoSessions,
        rooms: REAL_EXAM_ROOMS,
        proctors: fewProctors
      });

      const diagnostic = generateScheduleDiagnosticReport(result, {
        proctors: fewProctors,
        rooms: REAL_EXAM_ROOMS,
        sessions: standardTwoSessions
      });

      assert.equal(diagnostic.status, 'INCOMPLETE');
      assert.ok(diagnostic.unfilledCount > 0);
      assert.ok(diagnostic.recommendations.length > 0);
    });
  });

});
