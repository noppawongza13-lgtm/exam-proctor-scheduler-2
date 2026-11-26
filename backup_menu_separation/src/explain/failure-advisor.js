/**
 * โมดูลวิเคราะห์คอขวดและให้คำแนะนำเมื่อจัดตารางไม่สำเร็จ (Failure Advisor Engine)
 * 
 * วิเคราะห์หาสาเหตุที่แท้จริง (Root Cause Analysis) ของแต่ละช่องที่ไม่สามารถจัดสรรได้
 * และเสนอแนวทางแก้ไขอย่างเป็นรูปธรรม
 */

import { validateCandidateForSlot } from '../rules/rule-checker.js';
import { generateRecoveryOptions } from '../solver/min-staff-calc.js';

/**
 * วิเคราะห์ช่องที่ไม่สามารถจัดสรรได้ (Slot Failure Analysis)
 * @param {Object} slot ช่องที่ว่างอยู่
 * @param {Object} context บริบททั้งหมด
 * @returns {Object} สาเหตุและข้อเสนอแนะ
 */
export function analyzeSlotFailure(slot, context = {}) {
  const {
    sessions = [],
    rooms = [],
    proctors = [],
    assignments = [],
    unavailabilities = [],
    quotaSettings
  } = context;

  const session = sessions.find(s => s.id === slot.sessionId);
  const room = rooms.find(r => r.id === slot.roomId || r.roomCode === slot.roomCode);

  if (!session || !room) {
    return {
      slotId: slot.id,
      reasons: ['ข้อมูลรอบสอบหรือห้องสอบไม่ถูกต้อง'],
      candidateEvaluations: []
    };
  }

  // ทดสอบประเมิน Candidates ทุกคนเพื่อหาสาเหตุว่าทำไมถึงลงไม่ได้
  const candidateEvaluations = proctors.map(proctor => {
    const check = validateCandidateForSlot({
      proctor,
      session,
      room,
      order: slot.order,
      currentAssignments: assignments,
      sessions,
      rooms,
      proctors,
      unavailabilities,
      quotaSettings,
      isSubstitute: true // ทดลองรวมกลุ่มสำรองด้วย
    });

    return {
      proctorId: proctor.id,
      proctorName: proctor.name,
      pool: proctor.pool,
      canAssign: check.canAssign,
      reasons: check.reasons,
      violations: check.violations
    };
  });

  // สรุปสถิติต้นตอของปัญหา
  const countByReason = new Map();
  for (const c of candidateEvaluations) {
    for (const r of c.reasons) {
      countByReason.set(r, (countByReason.get(r) || 0) + 1);
    }
  }

  const topBottlenecks = Array.from(countByReason.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    slotId: slot.id,
    sessionTitle: session.title,
    date: session.date,
    roomCode: room.roomCode,
    order: slot.order,
    role: slot.role,
    totalCandidatesTested: proctors.length,
    topBottlenecks,
    candidateEvaluations: candidateEvaluations.slice(0, 10) // แสดงตัวอย่าง 10 คนแรก
  };
}

/**
 * สรุปรายงานคอขวดของตารางสอบภาพรวมและข้อเสนอแนะ
 * @param {Object} solverResult ผลลัพธ์จาก Solver
 * @param {Object} context
 * @returns {Object} รายงานภาพรวมและคำแนะนำ
 */
export function generateScheduleDiagnosticReport(solverResult, context = {}) {
  const unfilledSlots = solverResult.unfilledSlots || [];
  const { proctors = [], rooms = [] } = context;

  if (unfilledSlots.length === 0) {
    return {
      status: 'PERFECT',
      message: 'ตารางคุมสอบจัดสรรสำเร็จครบทุกตำแหน่ง 100% ไม่พบคอขวด',
      unfilledCount: 0,
      recommendations: []
    };
  }

  const slotAnalyses = unfilledSlots.map(slot => analyzeSlotFailure(slot, context));

  // ดึงข้อเสนอแนะ Actionable Recovery Options
  const recommendations = generateRecoveryOptions(solverResult.feasibility, proctors, rooms);

  return {
    status: 'INCOMPLETE',
    message: `มีตำแหน่งที่ไม่สามารถจัดสรรได้จำนวน ${unfilledSlots.length} ตำแหน่ง`,
    unfilledCount: unfilledSlots.length,
    slotAnalyses,
    recommendations
  };
}
