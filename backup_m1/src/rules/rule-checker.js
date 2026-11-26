/**
 * โมดูลตรวจสอบความถูกต้องของตารางคุมสอบแบบบูรณาการ (Unified Rule Checker)
 * 
 * รวมการตรวจสอบเงื่อนไขบังคับเด็ดขาด (Hard Constraints H1 - H9)
 * และเงื่อนไขความพึงพอใจ (Soft Constraints S1 - S5)
 * พร้อมระบบประเมินความเข้ากันได้ของช่องจัดสรรเดี่ยว (Single Slot Candidate Validator)
 */

import {
  checkH1NoOverlap,
  checkH2RoomCapacityAndOverlap,
  checkH3QuotaLimits,
  checkH4AvailabilityAndPattern,
  checkH5RoomStaffingAndChiefSeniority,
  checkH6MinimumRestBreak,
  checkH7SpecialRequirements,
  checkH8ReservePoolRestriction,
  checkH9ConflictOfInterest,
  isSessionOverlapping,
  timeToMinutes
} from './hard-constraints.js';

import {
  calculateSoftScore,
  evaluateS1Fairness,
  evaluateS2RoomStickiness
} from './soft-constraints.js';

import { 
  DEFAULT_QUOTA_SETTINGS, 
  DEFAULT_SOFT_WEIGHTS, 
  CONFIGURABLE_RULES,
  STAFF_POOLS
} from '../config/elms-rules.js';

/**
 * ตรวจสอบความถูกต้องสมบูรณ์ของตารางคุมสอบทั้งระบบ (Full Schedule Validation)
 * @param {Object} params ข้อมูลตารางสอบและบริบท
 * @param {Array<Object>} params.assignments รายการการมอบหมายงาน
 * @param {Array<Object>} params.sessions รายการรอบสอบทั้งหมด
 * @param {Array<Object>} params.rooms รายการห้องสอบทั้งหมด
 * @param {Array<Object>} params.proctors รายการผู้คุมสอบทั้งหมด
 * @param {Array<Object>} [params.examinees] รายการผู้เข้าสอบ
 * @param {Array<Object>} [params.unavailabilities] รายการช่วงเวลาลา
 * @param {Array<Object>} [params.conflicts] รายการความเกี่ยวข้อง
 * @param {Object} [params.quotaSettings] การตั้งค่าโควตา
 * @param {Object} [params.config] การตั้งค่ากฎเพิ่มเติม
 * @param {Object} [params.weights] ค่าน้ำหนัก Soft Constraints
 * @returns {Object} ผลลัพธ์การประเมิน
 */
export function validateSchedule({
  assignments = [],
  sessions = [],
  rooms = [],
  proctors = [],
  examinees = [],
  unavailabilities = [],
  conflicts = [],
  quotaSettings = DEFAULT_QUOTA_SETTINGS,
  config = CONFIGURABLE_RULES,
  weights = DEFAULT_SOFT_WEIGHTS
} = {}) {
  // 1. ตรวจสอบ Hard Constraints H1 - H9
  const h1 = checkH1NoOverlap(assignments, sessions);
  const h2 = checkH2RoomCapacityAndOverlap(assignments, sessions, rooms);
  const h3 = checkH3QuotaLimits(assignments, proctors, sessions, quotaSettings);
  const h4 = checkH4AvailabilityAndPattern(assignments, proctors, sessions, unavailabilities);
  const h5 = checkH5RoomStaffingAndChiefSeniority(assignments, rooms, proctors, sessions);
  const h6 = checkH6MinimumRestBreak(assignments, sessions, quotaSettings);
  const h7 = checkH7SpecialRequirements(assignments, sessions, rooms);
  const h8 = checkH8ReservePoolRestriction(assignments, proctors);
  const h9 = checkH9ConflictOfInterest(assignments, examinees, conflicts, config);

  const allViolations = [
    ...h1, ...h2, ...h3, ...h4, ...h5, ...h6, ...h7, ...h8, ...h9
  ];

  const violationsByRule = {
    H1: h1,
    H2: h2,
    H3: h3,
    H4: h4,
    H5: h5,
    H6: h6,
    H7: h7,
    H8: h8,
    H9: h9
  };

  const isValid = allViolations.length === 0;

  // 2. ประเมิน Soft Constraints S1 - S5
  const softResult = calculateSoftScore(assignments, sessions, proctors, weights);

  // 3. รวบรวมสถิติสรุป
  const assignedProctors = new Set(assignments.filter(a => a.proctorId).map(a => a.proctorId));
  const activeRooms = rooms.filter(r => r.isActive !== false);
  const totalSeats = activeRooms.reduce((sum, r) => sum + (r.capacity || 0), 0);

  return {
    isValid,
    hardViolationsCount: allViolations.length,
    violations: allViolations,
    violationsByRule,
    softScore: softResult.totalScore,
    maxSoftScore: softResult.maxTotalScore,
    softBreakdown: softResult.breakdown,
    summary: {
      totalAssignments: assignments.length,
      assignedProctorsCount: assignedProctors.size,
      totalProctorsCount: proctors.length,
      totalSessionsCount: sessions.length,
      activeRoomsCount: activeRooms.length,
      totalSeatsCapacity: totalSeats,
      status: isValid ? 'VALID' : 'INVALID'
    }
  };
}

/**
 * ตรวจสอบคุณสมบัติของผู้คุมสอบสำหรับช่องที่ต้องการจัดสรรเดี่ยว (Single Slot Candidate Validator)
 * ใช้สำหรับการตรวจสอบแบบ Real-time เมื่อลากวาง (Drag & Drop) หรือระหว่างการทำงานของ Solver
 * @param {Object} params
 * @param {Object} params.proctor ผู้คุมสอบที่กำลังพิจารณา
 * @param {Object} params.session รอบสอบที่ต้องการมอบหมาย
 * @param {Object} params.room ห้องสอบที่ต้องการมอบหมาย
 * @param {number} [params.order=1] ลำดับกรรมการในห้อง (1 = หัวหน้าห้อง, 2 หรือ 3 = กรรมการร่วม)
 * @param {Array<Object>} [params.currentAssignments=[]] รายการการมอบหมายปัจจุบันทั้งหมด
 * @param {Array<Object>} [params.sessions=[]] รอบสอบทั้งหมด
 * @param {Array<Object>} [params.proctors=[]] ผู้คุมสอบทั้งหมด
 * @param {Array<Object>} [params.unavailabilities=[]] การลา
 * @param {Array<Object>} [params.examinees=[]] ผู้เข้าสอบ
 * @param {Array<Object>} [params.conflicts=[]] ความเกี่ยวข้อง
 * @param {Object} [params.quotaSettings=DEFAULT_QUOTA_SETTINGS] การตั้งค่าโควตา
 * @param {boolean} [params.isSubstitute=false] กำลังเรียกแทนหรือกรณีฉุกเฉิน
 * @returns {{canAssign: boolean, reasons: Array<string>, violations: Array<Object>}}
 */
export function validateCandidateForSlot({
  proctor,
  session,
  room,
  order = 1,
  currentAssignments = [],
  sessions = [],
  proctors = [],
  unavailabilities = [],
  examinees = [],
  conflicts = [],
  quotaSettings = DEFAULT_QUOTA_SETTINGS,
  isSubstitute = false
}) {
  const reasons = [];
  const violations = [];

  if (!proctor) {
    return { canAssign: false, reasons: ['ไม่ได้ระบุข้อมูลผู้คุมสอบ'], violations: [] };
  }

  // 1. ตรวจสอบโควตาสูงสุดและค่า <= 0 (H3)
  if (proctor.maxSessions == null || proctor.maxSessions <= 0) {
    reasons.push(`โควตาสูงสุดของผู้คุมสอบไม่ถูกต้อง (${proctor.maxSessions} รอบ)`);
    violations.push({ rule: 'H3', field: 'maxSessions' });
  }

  const existingProctorAssigns = currentAssignments.filter(a => a.proctorId === proctor.id);
  if (existingProctorAssigns.length >= (proctor.maxSessions || 0)) {
    reasons.push(`ผู้คุมสอบได้รับการจัดครบตามโควตาสูงสุดแล้ว (${proctor.maxSessions} รอบ)`);
    violations.push({ rule: 'H3', field: 'quotaReached' });
  }

  // โควตาสูงสุดต่อวัน
  const maxDaily = quotaSettings.maxDailySessions ?? DEFAULT_QUOTA_SETTINGS.maxDailySessions;
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const dailyAssigns = existingProctorAssigns.filter(a => {
    const s = sessionMap.get(a.sessionId);
    return s && s.date === session.date;
  });

  if (dailyAssigns.length >= maxDaily) {
    reasons.push(`เกินโควตาทำงานสูงสุดต่อวัน (${maxDaily} รอบต่อวัน)`);
    violations.push({ rule: 'H3', field: 'maxDailySessions' });
  }

  // เงื่อนไขกะทำงาน SINGLE_PER_DAY
  if (proctor.sessionPattern === 'SINGLE_PER_DAY' && dailyAssigns.length >= 1) {
    reasons.push(`ผู้คุมสอบมีเงื่อนไข SINGLE_PER_DAY ปฏิบัติงานได้ไม่เกิน 1 รอบในวันเดียวกัน`);
    violations.push({ rule: 'H4', field: 'sessionPatternSingle' });
  }

  // 2. ตรวจสอบเวลาทับซ้อน (H1)
  for (const assign of existingProctorAssigns) {
    const existingSession = sessionMap.get(assign.sessionId);
    if (existingSession && isSessionOverlapping(session, existingSession)) {
      reasons.push(`ผู้คุมสอบมีหน้าที่ในรอบ ${existingSession.title || existingSession.id} ซึ่งเวลาทับซ้อนกัน`);
      violations.push({ rule: 'H1', overlappingSession: existingSession });
    }
  }

  // 3. ตรวจสอบวันที่สะดวกและการลา (H4)
  if (proctor.availableDates && proctor.availableDates.length > 0) {
    if (!proctor.availableDates.includes(session.date)) {
      reasons.push(`วันที่ ${session.date} ไม่อยู่ในรายการวันที่ระบุว่าสะดวก`);
      violations.push({ rule: 'H4', field: 'availableDates' });
    }
  }

  for (const unavail of unavailabilities) {
    if (unavail.proctorId === proctor.id && unavail.date === session.date) {
      if (!unavail.startTime || !unavail.endTime) {
        reasons.push(`ผู้คุมสอบแจ้งลาทั้งวัน (${unavail.reason || 'ติดภารกิจ'})`);
        violations.push({ rule: 'H4', field: 'unavailabilityAllDay' });
      } else {
        const unavailStart = timeToMinutes(unavail.startTime);
        const unavailEnd = timeToMinutes(unavail.endTime);
        const sStart = timeToMinutes(session.startTime) - (session.prepMinutes || 30);
        const sEnd = timeToMinutes(session.endTime) + (session.wrapMinutes || 15);

        if (Math.max(unavailStart, sStart) < Math.min(unavailEnd, sEnd)) {
          reasons.push(`ผู้คุมสอบแจ้งลาช่วงเวลา ${unavail.startTime} - ${unavail.endTime} น.`);
          violations.push({ rule: 'H4', field: 'unavailabilityPartial' });
        }
      }
    }
  }

  // 4. ตรวจสอบลำดับความอาวุโส (H5 Seniority Rule)
  // ดึงกรรมการที่ถูกจัดอยู่ในห้องเดียวกันในรอบเดียวกัน
  const currentRoomAssigns = currentAssignments.filter(a => 
    a.sessionId === session.id && (a.roomId === room.id || a.roomCode === room.roomCode)
  );

  const proctorMap = new Map(proctors.map(p => [p.id, p]));
  const myRank = proctor.seniorityRank || 0;

  if (order === 1) {
    // ถ้าผู้คุมคนนี้กำลังจะเป็นหัวหน้าห้อง (Order 1) ต้องอาวุโส >= กรรมการร่วมทุกคนที่อยู่ในห้องแล้ว
    for (const otherAssign of currentRoomAssigns) {
      if (!otherAssign.proctorId || otherAssign.order === 1) continue;
      const other = proctorMap.get(otherAssign.proctorId);
      if (other && (other.seniorityRank || 0) > myRank) {
        reasons.push(`ตำแหน่งหัวหน้าห้องต้องการผู้อาวุโสสูงสุด แต่มีกรรมการร่วม ${other.name} (Rank ${other.seniorityRank}) อาวุโสกว่า (คุณ Rank ${myRank})`);
        violations.push({ rule: 'H5', field: 'seniorityOrder1' });
      }
    }
  } else {
    // ถ้าผู้คุมคนนี้เป็นกรรมการร่วม (Order > 1) ต้องอาวุโส <= หัวหน้าห้อง
    const chiefAssign = currentRoomAssigns.find(a => a.order === 1 || a.role === 'CHIEF');
    if (chiefAssign && chiefAssign.proctorId) {
      const chief = proctorMap.get(chiefAssign.proctorId);
      if (chief && myRank > (chief.seniorityRank || 0)) {
        reasons.push(`กรรมการร่วมมีความอาวุโส (Rank ${myRank}) สูงกว่าหัวหน้าห้อง ${chief.name} (Rank ${chief.seniorityRank})`);
        violations.push({ rule: 'H5', field: 'seniorityOrderCo' });
      }
    }
  }

  // 5. ตรวจสอบเวลาพักระหว่างรอบ (H6)
  const minRest = quotaSettings.minRestMinutesBetweenSessions ?? DEFAULT_QUOTA_SETTINGS.minRestMinutesBetweenSessions;
  for (const assign of existingProctorAssigns) {
    const otherSession = sessionMap.get(assign.sessionId);
    if (!otherSession || otherSession.date !== session.date) continue;

    // คำนวณช่วงเวลาพัก
    const sStart = timeToMinutes(session.startTime) - (session.prepMinutes || 30);
    const sEnd = timeToMinutes(session.endTime) + (session.wrapMinutes || 15);
    const oStart = timeToMinutes(otherSession.startTime) - (otherSession.prepMinutes || 30);
    const oEnd = timeToMinutes(otherSession.endTime) + (otherSession.wrapMinutes || 15);

    if (sStart >= oEnd && (sStart - oEnd) < minRest) {
      reasons.push(`เวลาพักหลังจบรอบก่อนหน้า (${sStart - oEnd} นาที) ต่ำกว่าเกณฑ์ขั้นต่ำ ${minRest} นาที`);
      violations.push({ rule: 'H6', field: 'minRestBefore' });
    }
    if (oStart >= sEnd && (oStart - sEnd) < minRest) {
      reasons.push(`เวลาพักก่อนเริ่มรอบถัดไป (${oStart - sEnd} นาที) ต่ำกว่าเกณฑ์ขั้นต่ำ ${minRest} นาที`);
      violations.push({ rule: 'H6', field: 'minRestAfter' });
    }
  }

  // 6. ตรวจสอบ Reserve Pool (H8)
  if (proctor.pool === STAFF_POOLS.RESERVE && !isSubstitute) {
    reasons.push('ผู้คุมสอบอยู่ใน Reserve Pool ห้ามจัดเป็นผู้คุมหลัก เว้นแต่เรียกแทนหรือกรณีฉุกเฉิน');
    violations.push({ rule: 'H8', field: 'reservePool' });
  }

  // 7. ตรวจสอบความขัดแย้งทางผลประโยชน์ / ญาติ (H9)
  if (CONFIGURABLE_RULES.enableH9ConflictOfInterest && conflicts.length > 0 && examinees.length > 0) {
    const roomExamineeIds = examinees
      .filter(e => e.sessionId === session.id && (e.roomId === room.id || e.roomCode === room.roomCode))
      .map(e => e.citizenId);

    for (const conf of conflicts) {
      if (conf.proctorId === proctor.id && roomExamineeIds.includes(conf.examineeCitizenId)) {
        reasons.push(`ผู้คุมสอบมีความเกี่ยวข้องกับผู้เข้าสอบในห้อง ${room.roomCode}`);
        violations.push({ rule: 'H9', field: 'conflictOfInterest' });
      }
    }
  }

  return {
    canAssign: reasons.length === 0,
    reasons,
    violations
  };
}
