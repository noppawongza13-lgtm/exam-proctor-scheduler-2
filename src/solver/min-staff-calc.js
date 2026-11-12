/**
 * โมดูลคำนวณจำนวนบุคลากรขั้นต่ำ (Minimum Proctor Calculator)
 * และระบบสร้างข้อเสนอแนะเพื่อแก้ปัญหาเมื่ออัตรากำลังไม่เพียงพอ (Actionable Recovery Options)
 */

import { ELMS_CENTER_METADATA, ROOM_STAFFING_RULES, SESSION_PATTERNS } from '../config/elms-rules.js';

/**
 * คำนวณจำนวนบุคลากรขั้นต่ำที่จำเป็นต้องมีสำหรับรอบสอบที่ระบุ
 * @param {Array<Object>} sessions รายการรอบสอบ
 * @param {Array<Object>} rooms รายการห้องสอบ
 * @returns {Object} ผลการคำนวณอัตรากำลังขั้นต่ำในแต่ละสถานการณ์
 */
export function calculateMinimumProctorRequirements(sessions = [], rooms = []) {
  const activeRooms = rooms.filter(r => r.isActive !== false);

  // คำนวณความต้องการต่อ 1 รอบมาตรฐาน
  let proctorsPerStandardSession = 0;
  for (const r of activeRooms) {
    proctorsPerStandardSession += (r.capacity >= ROOM_STAFFING_RULES.largeThreshold.minCapacity ? 3 : 2);
  }

  // หากไม่มีห้องใดเลย ให้ใช้ค่ามาตรฐาน 21 คน
  if (proctorsPerStandardSession === 0) {
    proctorsPerStandardSession = ELMS_CENTER_METADATA.staffPerSession;
  }

  // จัดกลุ่มรอบสอบตามวัน
  const sessionsByDate = new Map();
  for (const s of sessions) {
    if (!sessionsByDate.has(s.date)) sessionsByDate.set(s.date, []);
    sessionsByDate.get(s.date).push(s);
  }

  let minDistinctProctorsFullDay = 0; // กรณีทุกคนเป็น FULL_DAY_PAIRED
  let minDistinctProctorsSingle = 0;  // กรณีทุกคนเป็น SINGLE_PER_DAY

  for (const [date, daySessions] of sessionsByDate.entries()) {
    const sessionCount = daySessions.length;
    // หากวันนั้นมี 2 รอบ และผู้คุมทำได้ 2 รอบ (Full-day) จำนวนคนจะเท่ากับ max ของรอบในวันนั้น
    minDistinctProctorsFullDay = Math.max(minDistinctProctorsFullDay, proctorsPerStandardSession);
    // หากทุกคนทำได้แค่วันละ 1 รอบ จะต้องใช้คนใหม่ในแต่ละรอบ
    minDistinctProctorsSingle = Math.max(minDistinctProctorsSingle, proctorsPerStandardSession * sessionCount);
  }

  return {
    proctorsPerSession: proctorsPerStandardSession,
    totalSessions: sessions.length,
    activeRoomsCount: activeRooms.length,
    minProctorsNeeded: {
      idealFullDayPaired: minDistinctProctorsFullDay,
      strictSinglePerDay: minDistinctProctorsSingle,
      recommendedCoreBuffer: Math.ceil(minDistinctProctorsFullDay * 1.15) // +15% เผื่อสำรอง
    }
  };
}

/**
 * สร้างข้อเสนอแนะเชิงปฏิบัติเมื่อเกิดปัญหาอัตรากำลังไม่เพียงพอ (Actionable Recovery Options)
 * @param {Object} deficitInfo ข้อมูลการขาดแคลนจาก checkFeasibility
 * @param {Array<Object>} proctors
 * @param {Array<Object>} rooms
 * @returns {Array<Object>} รายการทางเลือกในการแก้ไขปัญหา
 */
export function generateRecoveryOptions(deficitInfo, proctors = [], rooms = []) {
  const options = [];
  const deficit = deficitInfo?.deficitSlots || deficitInfo?.coreDeficit || 0;

  if (deficit <= 0) {
    return [{
      type: 'OPTIMAL',
      title: 'ทรัพยากรบุคคลเพียงพอสมบูรณ์',
      description: 'จำนวนบุคลากรและความพร้อมสอดคล้องกับความต้องการของทุกรอบสอบ สามารถดำเนินการจัดตารางได้ทันที',
      impact: 'ไม่มีผลกระทบด้านลบ'
    }];
  }

  // ทางเลือกที่ 1: ดึงบุคลากรจาก Reserve Pool
  const reserveCount = proctors.filter(p => p.pool === 'RESERVE').length;
  if (reserveCount > 0) {
    options.push({
      id: 'OPTION_CALL_RESERVE',
      type: 'RECOMMENDED',
      title: `เรียกบุคลากรกลุ่มสำรอง (Reserve Pool) จำนวน ${Math.min(reserveCount, deficit)} ท่าน`,
      description: `มีบุคลากรในกลุ่มสำรองที่พร้อมปฏิบัติหน้าที่ ${reserveCount} ท่าน การเปิดใช้งานจะช่วยลดการขาดแคลนได้ทันทีโดยไม่ต้องปรับเวลาหรือห้องสอบ`,
      action: 'ENABLE_RESERVE_POOL',
      solvesDeficit: reserveCount >= deficit
    });
  }

  // ทางเลือกที่ 2: ปรับเพิ่มโควตาสูงสุดของบุคลากรที่มีความพร้อม
  const availableCore = proctors.filter(p => p.pool === 'CORE' && (p.maxSessions || 0) < 4);
  if (availableCore.length > 0) {
    options.push({
      id: 'OPTION_INCREASE_QUOTA',
      type: 'ALTERNATIVE',
      title: `ขยายโควตาสูงสุดของบุคลากรหลัก (+1 ถึง +2 รอบ)`,
      description: `มีบุคลากรหลัก ${availableCore.length} ท่านที่โควตายังไม่ถึงเพดานสูงสุด การขอความร่วมมือเพิ่มภาระงานจะช่วยเติมเต็มตำแหน่งที่ขาดแคลน`,
      action: 'EXPAND_CORE_QUOTA',
      solvesDeficit: (availableCore.length * 1) >= deficit
    });
  }

  // ทางเลือกที่ 3: ปรับลดห้องสอบที่ไม่จำเป็นหรือรวมห้องสอบ
  const activeRooms = rooms.filter(r => r.isActive !== false);
  if (activeRooms.length > 5) {
    const smallestRoom = [...activeRooms].sort((a, b) => a.capacity - b.capacity)[0];
    options.push({
      id: 'OPTION_DISABLE_ROOM',
      type: 'CONTINGENCY',
      title: `พักการใช้งานห้องสอบที่มีความจุน้อย เช่น ห้อง ${smallestRoom.roomCode} (${smallestRoom.capacity} ที่นั่ง)`,
      description: `การพักใช้งานห้อง 1 ห้องจะช่วยประหยัดบุคลากรคุมสอบได้ 2 ตำแหน่งต่อรอบสอบ`,
      action: 'DEACTIVATE_ROOM',
      targetRoomCode: smallestRoom.roomCode,
      proctorSavings: 2
    });
  }

  return options;
}
