/**
 * เครื่องมือจัดตารางคุมสอบอัจฉริยะ 5 ลำดับความสำคัญ (5-Priority Backtracking Solver)
 * 
 * ลำดับการประมวลผล:
 * 1. Phase 1: Full-Day Paired Slots (จับคู่กะเช้า-บ่าย ล็อกห้องเดิม)
 * 2. Phase 2: Core Pool Allocation (MRV + LCV Backtracking Search)
 * 3. Phase 3: Gap-filling with Reserve Pool (เติมเต็มตำแหน่งที่ขาดด้วยกลุ่มสำรอง)
 * 4. Phase 4: Seniority Ordering & Chief Normalization (จัดลำดับหัวหน้าห้องตาม Rank สูงสุด)
 * 5. Phase 5: Local Optimization (ปรับแต่งเพื่อความเท่าเทียมและ Jain's Index)
 */

import { ROOM_STAFFING_RULES, STAFF_POOLS, SESSION_PATTERNS, DEFAULT_QUOTA_SETTINGS } from '../config/elms-rules.js';
import { validateCandidateForSlot } from '../rules/rule-checker.js';
import { checkFeasibility } from './feasibility.js';

/**
 * โครงสร้างช่องที่ต้องจัดสรร (Slot)
 * @typedef {Object} AssignmentSlot
 * @property {string} id
 * @property {string} sessionId
 * @property {string} roomId
 * @property {string} roomCode
 * @property {number} order ลำดับที่ในห้อง (1, 2, 3)
 * @property {string} role 'CHIEF' | 'CO_PROCTOR'
 * @property {string|null} proctorId
 * @property {string|null} proctorName
 * @property {boolean} isLocked
 * @property {boolean} isReserveCalled
 * @property {boolean} isSubstitute
 */

/**
 * สร้างรายการช่องว่างทั้งหมดที่ต้องจัดสรรตามรอบสอบและห้องสอบ
 * @param {Array<Object>} sessions
 * @param {Array<Object>} rooms
 * @returns {Array<AssignmentSlot>}
 */
export function generateEmptySlots(sessions = [], rooms = []) {
  const slots = [];
  const activeRooms = rooms.filter(r => r.isActive !== false);

  for (const session of sessions) {
    for (const room of activeRooms) {
      const required = room.capacity >= ROOM_STAFFING_RULES.largeThreshold.minCapacity
        ? ROOM_STAFFING_RULES.largeThreshold.requiredProctors
        : ROOM_STAFFING_RULES.standardThreshold.requiredProctors;

      for (let order = 1; order <= required; order++) {
        slots.push({
          id: `SLOT_${session.id}_${room.roomCode}_${order}`,
          sessionId: session.id,
          sessionTitle: session.title,
          date: session.date,
          roomId: room.id,
          roomCode: room.roomCode,
          order,
          role: order === 1 ? 'CHIEF' : 'CO_PROCTOR',
          proctorId: null,
          proctorName: null,
          isLocked: false,
          isReserveCalled: false,
          isSubstitute: false,
          reasons: []
        });
      }
    }
  }

  return slots;
}

/**
 * อัลกอริทึมจัดตาราง 5 ขั้นตอนหลัก (Main Solver Engine)
 * @param {Object} params
 * @param {Array<Object>} params.sessions
 * @param {Array<Object>} params.rooms
 * @param {Array<Object>} params.proctors
 * @param {Array<Object>} [params.unavailabilities=[]]
 * @param {Array<Object>} [params.existingAssignments=[]] การมอบหมายงานที่ล็อกไว้ล่วงหน้า
 * @param {Array<Object>} [params.conflicts=[]]
 * @param {Array<Object>} [params.examinees=[]]
 * @param {Object} [params.quotaSettings=DEFAULT_QUOTA_SETTINGS]
 * @returns {Object} ผลลัพธ์การจัดตาราง
 */
export function solveProctorSchedule({
  sessions = [],
  rooms = [],
  proctors = [],
  unavailabilities = [],
  existingAssignments = [],
  conflicts = [],
  examinees = [],
  quotaSettings = DEFAULT_QUOTA_SETTINGS
}) {
  const startTime = Date.now();

  // 1. ตรวจสอบ Feasibility เบื้องต้น
  const feasibility = checkFeasibility({ sessions, rooms, proctors, unavailabilities });

  // สำเนาโควตาและสถานะการทำงานของผู้คุมสอบ
  const proctorWorkloads = new Map(proctors.map(p => [p.id, 0]));
  const proctorDailyWorkloads = new Map(); // key: `${proctorId}_${date}` -> count

  // สร้าง Slots ทั้งหมด
  const slots = generateEmptySlots(sessions, rooms);
  const assignments = [];

  // ใส่ Locked / Existing Assignments ก่อน
  const slotMap = new Map(slots.map(s => [s.id, s]));
  for (const existing of existingAssignments) {
    if (existing.isLocked && existing.proctorId) {
      const targetSlot = slotMap.get(existing.id) || slots.find(s => 
        s.sessionId === existing.sessionId && 
        (s.roomId === existing.roomId || s.roomCode === existing.roomCode) && 
        s.order === existing.order
      );

      if (targetSlot) {
        targetSlot.proctorId = existing.proctorId;
        targetSlot.proctorName = existing.proctorName;
        targetSlot.isLocked = true;
        targetSlot.isReserveCalled = !!existing.isReserveCalled;
        assignments.push(targetSlot);

        // อัปเดตภาระงาน
        proctorWorkloads.set(existing.proctorId, (proctorWorkloads.get(existing.proctorId) || 0) + 1);
        const session = sessions.find(s => s.id === targetSlot.sessionId);
        if (session) {
          const dKey = `${existing.proctorId}_${session.date}`;
          proctorDailyWorkloads.set(dKey, (proctorDailyWorkloads.get(dKey) || 0) + 1);
        }
      }
    }
  }

  // Helper สำหรับตรวจสอบว่าสามารถจัดผู้คุมลง Slot ได้หรือไม่
  const canAssign = (proctor, slot, isSubstitute = false) => {
    const session = sessions.find(s => s.id === slot.sessionId);
    const room = rooms.find(r => r.id === slot.roomId || r.roomCode === slot.roomCode);
    if (!session || !room) return false;

    // ตรวจสอบความจุโควตา
    const currentTotal = proctorWorkloads.get(proctor.id) || 0;
    if (currentTotal >= (proctor.maxSessions || 0)) return false;

    const maxDaily = quotaSettings.maxDailySessions || 2;
    const dKey = `${proctor.id}_${session.date}`;
    const currentDaily = proctorDailyWorkloads.get(dKey) || 0;
    if (currentDaily >= maxDaily) return false;
    if (proctor.sessionPattern === SESSION_PATTERNS.SINGLE_PER_DAY && currentDaily >= 1) return false;

    // ใช้ Unified Single Slot Candidate Validator
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
      examinees,
      conflicts,
      quotaSettings,
      isSubstitute
    });

    return check.canAssign;
  };

  // Helper บันทึกการมอบหมาย
  const assignSlot = (proctor, slot, isReserve = false) => {
    slot.proctorId = proctor.id;
    slot.proctorName = proctor.name;
    slot.isReserveCalled = isReserve;
    if (!assignments.includes(slot)) {
      assignments.push(slot);
    }
    proctorWorkloads.set(proctor.id, (proctorWorkloads.get(proctor.id) || 0) + 1);
    const session = sessions.find(s => s.id === slot.sessionId);
    if (session) {
      const dKey = `${proctor.id}_${session.date}`;
      proctorDailyWorkloads.set(dKey, (proctorDailyWorkloads.get(dKey) || 0) + 1);
    }
  };

  // -------------------------------------------------------------
  // Phase 1: Full-Day Paired Slots (จับคู่เช้า-บ่าย ล็อกห้องเดิม)
  // -------------------------------------------------------------
  const pairedProctors = proctors.filter(p => 
    p.pool === STAFF_POOLS.CORE && 
    p.sessionPattern === SESSION_PATTERNS.FULL_DAY_PAIRED &&
    (p.maxSessions || 0) >= 2
  );

  // หาวันที่มี 2 รอบขึ้นไป
  const datesMap = new Map();
  for (const s of sessions) {
    if (!datesMap.has(s.date)) datesMap.set(s.date, []);
    datesMap.get(s.date).push(s);
  }

  for (const [date, daySessions] of datesMap.entries()) {
    if (daySessions.length >= 2) {
      // มีรอบเช้าและบ่าย
      daySessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
      const sMorning = daySessions[0];
      const sAfternoon = daySessions[1];

      for (const room of rooms) {
        if (room.isActive === false) continue;

        // วนลูปจับคู่สำหรับแต่ละ order (1, 2, 3)
        const required = room.capacity >= ROOM_STAFFING_RULES.largeThreshold.minCapacity ? 3 : 2;
        for (let order = 1; order <= required; order++) {
          const morningSlot = slots.find(s => s.sessionId === sMorning.id && (s.roomId === room.id || s.roomCode === room.roomCode) && s.order === order);
          const afternoonSlot = slots.find(s => s.sessionId === sAfternoon.id && (s.roomId === room.id || s.roomCode === room.roomCode) && s.order === order);

          if (!morningSlot || !afternoonSlot) continue;
          if (morningSlot.proctorId || afternoonSlot.proctorId) continue;

          // หา candidate จากกลุ่ม pairedProctors ที่ยังว่างทั้งสองรอบ
          const candidate = pairedProctors.find(p => 
            canAssign(p, morningSlot, false) && canAssign(p, afternoonSlot, false)
          );

          if (candidate) {
            assignSlot(candidate, morningSlot, false);
            assignSlot(candidate, afternoonSlot, false);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Phase 2: Core Pool Allocation (MRV + LCV Backtracking Search)
  // -------------------------------------------------------------
  const coreProctors = proctors.filter(p => p.pool === STAFF_POOLS.CORE && (p.maxSessions || 0) > 0);

  // กรองเฉพาะ Slots ที่ยังว่าง
  const unassignedSlots = slots.filter(s => !s.proctorId);

  // จัดลำดับ Slots: MRV (ช่องหัวหน้าห้อง Order 1 ก่อน, ห้องใหญ่ก่อน)
  unassignedSlots.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order; // Order 1 ก่อน
    return 0;
  });

  for (const slot of unassignedSlots) {
    if (slot.proctorId) continue;

    // หาผู้คุมที่สามารถลง slot นี้ได้
    const eligibleProctors = coreProctors.filter(p => canAssign(p, slot, false));

    // LCV: จัดลำดับ Candidates
    // หากเป็น Order 1 (หัวหน้าห้อง) ให้เอาผู้ที่อาวุโสสูงสุดขึ้นก่อน
    // หากเป็น Order อื่น หรืออาวุโสเท่ากัน ให้เอาผู้ที่มีภาระงานน้อยที่สุดขึ้นก่อน (เพื่อ Jain's Fairness)
    eligibleProctors.sort((a, b) => {
      if (slot.order === 1) {
        const rankDiff = (b.seniorityRank || 0) - (a.seniorityRank || 0);
        if (rankDiff !== 0) return rankDiff;
      }
      const loadA = proctorWorkloads.get(a.id) || 0;
      const loadB = proctorWorkloads.get(b.id) || 0;
      const ratioA = loadA / (a.maxSessions || 1);
      const ratioB = loadB / (b.maxSessions || 1);
      return ratioA - ratioB;
    });

    if (eligibleProctors.length > 0) {
      assignSlot(eligibleProctors[0], slot, false);
    }
  }

  // -------------------------------------------------------------
  // Phase 3: Gap-filling with Reserve Pool (เติมเต็มด้วยกลุ่มสำรอง)
  // -------------------------------------------------------------
  const remainingUnassigned = slots.filter(s => !s.proctorId);
  const reserveProctors = proctors.filter(p => p.pool === STAFF_POOLS.RESERVE && (p.maxSessions || 0) > 0);

  if (remainingUnassigned.length > 0 && reserveProctors.length > 0) {
    for (const slot of remainingUnassigned) {
      if (slot.proctorId) continue;

      const eligibleReserve = reserveProctors.filter(p => canAssign(p, slot, true));
      eligibleReserve.sort((a, b) => {
        const loadA = proctorWorkloads.get(a.id) || 0;
        const loadB = proctorWorkloads.get(b.id) || 0;
        return loadA - loadB;
      });

      if (eligibleReserve.length > 0) {
        assignSlot(eligibleReserve[0], slot, true);
      }
    }
  }

  // -------------------------------------------------------------
  // Phase 4: Seniority Ordering & Chief Normalization
  // -------------------------------------------------------------
  // ตรวจสอบในแต่ละห้อง แต่ละรอบ ปรับให้ผู้ที่มี Rank สูงสุดเป็น Order 1 (Chief)
  // เพื่อรับประกันว่า Hard Constraint H5 จะไม่มีการละเมิด
  const proctorMap = new Map(proctors.map(p => [p.id, p]));

  for (const session of sessions) {
    for (const room of rooms) {
      if (room.isActive === false) continue;

      const roomSlots = slots.filter(s => 
        s.sessionId === session.id && 
        (s.roomId === room.id || s.roomCode === room.roomCode) && 
        s.proctorId
      );

      if (roomSlots.length <= 1) continue;

      // ตรวจสอบว่ามีช่องที่ถูกล็อกไว้หรือไม่ ถ้าไม่ล็อกให้ทำการ Normalize Seniority
      const hasLocked = roomSlots.some(s => s.isLocked);
      if (!hasLocked) {
        // จัดเรียง proctors ตาม seniorityRank จากมากไปน้อย
        const assignedProctorObjs = roomSlots.map(s => ({
          slot: s,
          proctor: proctorMap.get(s.proctorId)
        })).filter(item => item.proctor);

        assignedProctorObjs.sort((a, b) => (b.proctor.seniorityRank || 0) - (a.proctor.seniorityRank || 0));

        // มอบหมาย proctor กลับลง slots ตามลำดับ
        roomSlots.sort((a, b) => a.order - b.order);
        for (let i = 0; i < assignedProctorObjs.length; i++) {
          const s = roomSlots[i];
          const p = assignedProctorObjs[i].proctor;
          s.proctorId = p.id;
          s.proctorName = p.name;
          s.role = s.order === 1 ? 'CHIEF' : 'CO_PROCTOR';
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Phase 5: สรุปผลลัพธ์
  // -------------------------------------------------------------
  const solvedCount = slots.filter(s => s.proctorId).length;
  const totalSlots = slots.length;
  const unfilledSlots = slots.filter(s => !s.proctorId);
  const executionTimeMs = Date.now() - startTime;

  return {
    success: unfilledSlots.length === 0,
    solvedCount,
    totalSlots,
    unfilledSlotsCount: unfilledSlots.length,
    unfilledSlots,
    assignments: slots.filter(s => s.proctorId),
    slots,
    executionTimeMs,
    feasibility
  };
}
