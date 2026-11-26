/**
 * โมดูลตรวจสอบความเป็นไปได้ในการจัดสรรทรัพยากร (Feasibility Checker)
 * 
 * ตรวจสอบความสมดุลระหว่างอุปสงค์ (Demand: จำนวนตำแหน่งผู้คุมที่ต้องใช้)
 * และอุปทาน (Supply: จำนวนและความพร้อมของบุคลากร) ก่อนเริ่มกระบวนการจัดตาราง
 */

import { ROOM_STAFFING_RULES, STAFF_POOLS } from '../config/elms-rules.js';

/**
 * คำนวณจำนวนผู้คุมสอบที่ต้องการทั้งหมดในแต่ละรอบและรวมทั้งโครงการ
 * @param {Array<Object>} sessions รายการรอบสอบ
 * @param {Array<Object>} rooms รายการห้องสอบ
 * @returns {{totalRequiredSlots: number, sessionRequirements: Array<Object>}}
 */
export function calculateRequiredSlots(sessions = [], rooms = []) {
  const activeRooms = rooms.filter(r => r.isActive !== false);

  const sessionRequirements = sessions.map(session => {
    let requiredInSession = 0;
    const roomBreakdown = activeRooms.map(room => {
      const needed = room.capacity >= ROOM_STAFFING_RULES.largeThreshold.minCapacity
        ? ROOM_STAFFING_RULES.largeThreshold.requiredProctors
        : ROOM_STAFFING_RULES.standardThreshold.requiredProctors;
      requiredInSession += needed;
      return {
        roomId: room.id,
        roomCode: room.roomCode,
        capacity: room.capacity,
        requiredProctors: needed
      };
    });

    return {
      sessionId: session.id,
      sessionTitle: session.title || session.id,
      date: session.date,
      requiredProctors: requiredInSession,
      roomBreakdown
    };
  });

  const totalRequiredSlots = sessionRequirements.reduce((sum, s) => sum + s.requiredProctors, 0);

  return {
    totalRequiredSlots,
    sessionRequirements
  };
}

/**
 * ตรวจสอบความเป็นไปได้ของบุคลากร (Feasibility Check)
 * @param {Object} params
 * @param {Array<Object>} params.sessions
 * @param {Array<Object>} params.rooms
 * @param {Array<Object>} params.proctors
 * @param {Array<Object>} [params.unavailabilities=[]]
 * @returns {Object} ผลการวิเคราะห์ความเป็นไปได้
 */
export function checkFeasibility({
  sessions = [],
  rooms = [],
  proctors = [],
  unavailabilities = []
} = {}) {
  const { totalRequiredSlots, sessionRequirements } = calculateRequiredSlots(sessions, rooms);

  // แยกกลุ่ม Core Pool และ Reserve Pool
  const coreProctors = proctors.filter(p => p.pool === STAFF_POOLS.CORE && (p.maxSessions || 0) > 0);
  const reserveProctors = proctors.filter(p => p.pool === STAFF_POOLS.RESERVE && (p.maxSessions || 0) > 0);

  // คำนวณความจุการทำงานรวมสูงสุด (Total Supply Capacity)
  const totalCoreCapacity = coreProctors.reduce((sum, p) => sum + p.maxSessions, 0);
  const totalReserveCapacity = reserveProctors.reduce((sum, p) => sum + p.maxSessions, 0);
  const totalSupplyCapacity = totalCoreCapacity + totalReserveCapacity;

  // ตรวจสอบความพร้อมรายวันและรายรอบสอบ (Session-by-Session Feasibility)
  const sessionFeasibility = sessionRequirements.map(req => {
    const session = sessions.find(s => s.id === req.sessionId);
    if (!session) return { ...req, isFeasible: false, availableCore: 0, availableReserve: 0 };

    // นับจำนวนบุคลากรที่สะดวกในวันนี้และไม่ติดการลา
    const isAvailable = (p) => {
      if (p.availableDates && p.availableDates.length > 0 && !p.availableDates.includes(session.date)) {
        return false;
      }
      const isAbsent = unavailabilities.some(u => u.proctorId === p.id && u.date === session.date && (!u.startTime || !u.endTime));
      return !isAbsent;
    };

    const availableCore = coreProctors.filter(isAvailable).length;
    const availableReserve = reserveProctors.filter(isAvailable).length;
    const totalAvailable = availableCore + availableReserve;

    const isFeasible = totalAvailable >= req.requiredProctors;
    const deficit = Math.max(0, req.requiredProctors - totalAvailable);

    return {
      ...req,
      isFeasible,
      availableCore,
      availableReserve,
      totalAvailable,
      deficit
    };
  });

  const hasDeficit = sessionFeasibility.some(s => !s.isFeasible) || (totalCoreCapacity < totalRequiredSlots);
  const totalDeficitSlots = sessionFeasibility.reduce((sum, s) => sum + s.deficit, 0);

  return {
    isFeasible: !hasDeficit,
    totalRequiredSlots,
    totalSupplyCapacity,
    totalCoreCapacity,
    totalReserveCapacity,
    deficitSlots: totalDeficitSlots,
    sessionFeasibility,
    coreDeficit: Math.max(0, totalRequiredSlots - totalCoreCapacity),
    status: !hasDeficit ? 'FEASIBLE' : (totalSupplyCapacity >= totalRequiredSlots ? 'FEASIBLE_WITH_RESERVE' : 'INFEASIBLE')
  };
}
