/**
 * โครงสร้างข้อมูลและคำจำกัดความโมเดลข้อมูลหลักของระบบ (Data Models & Schemas)
 * 
 * ออกแบบตามข้อกำหนดหัวข้อ 4 และ 5 ใน PROJECT BRIEF
 * เวลาทั้งหมดจัดเก็บเป็น ISO 8601 (เขตเวลา Asia/Bangkok)
 */

/**
 * บทบาทและสิทธิ์ผู้ใช้งานในระบบ (User Roles)
 */
export const USER_ROLES = {
  ADMIN: 'ADMIN',       // ผู้ดูแลระบบสูงสุด จัดการข้อมูล จัดตาราง แก้ไข ดู Audit Log
  TEACHER: 'TEACHER',   // อาจารย์ ดูตารางหน่วยงาน/ส่วนตัว แจ้งช่วงไม่ว่าง
  PROCTOR: 'PROCTOR',   // ผู้คุมสอบ ดูตารางและใบลงนามตนเอง แก้ไขข้อมูลติดต่อ แจ้งลา
  VIEWER: 'VIEWER',     // ผู้บริหาร/หน่วยงานภายนอก ดูตารางรวมและรายงาน ห้ามเห็นเบอร์ส่วนตัว
  GUEST: 'GUEST'        // ผู้เข้าชมภายนอก ค้นหาที่นั่งตนเอง ดูผังอาคาร ดูระเบียบสอบ
};

/**
 * สถานะของสล็อตการมอบหมายงาน (Assignment Status)
 */
export const ASSIGNMENT_STATUS = {
  DRAFT: 'DRAFT',         // ร่าง (ยังปรับเปลี่ยนได้)
  CONFIRMED: 'CONFIRMED', // ยืนยันแล้ว
  LOCKED: 'LOCKED'        // ล็อกไว้ (Solver ห้ามแตะ ต้องจัดเฉพาะช่องที่เหลือ)
};

/**
 * แหล่งที่มาของการจัดสรร (Assignment Origin)
 */
export const ASSIGNMENT_ORIGIN = {
  AUTO: 'AUTO',     // จัดอัตโนมัติโดย Solver
  MANUAL: 'MANUAL'  // แก้ไข/เลือกด้วยมือโดย Admin
};

/**
 * สถานะของภาพรวมตารางสอบ (Schedule Lifecycle Status)
 */
export const SCHEDULE_STATUS = {
  DRAFT: 'DRAFT',                 // ฉบับร่าง
  PENDING_REVIEW: 'PENDING_REVIEW', // รอการตรวจสอบ
  PUBLISHED: 'PUBLISHED'          // เผยแพร่แล้ว (สาธารณะและผู้คุมเห็นได้)
};

/**
 * สร้าง Object สำหรับ Room (ห้องสอบ)
 * @param {Object} data 
 * @returns {Object}
 */
export function createRoom(data) {
  return {
    id: data.id,                     // รหัสอ้างอิง เช่น 'R01'
    roomCode: data.roomCode,         // เลขห้อง เช่น '17108'
    name: data.name,                 // ชื่อห้อง เช่น 'วินิตปัญญา 5'
    building: data.building || 'อาคารนวัตปัญญา (อาคาร 17)',
    floor: Number(data.floor),       // ชั้น 1 หรือ 2
    capacity: Number(data.capacity), // ความจุที่นั่งสอบ (เช่น 40, 60, 80)
    seatStart: Number(data.seatStart), // เลขที่นั่งเริ่มต้น
    seatEnd: Number(data.seatEnd),     // เลขที่นั่งสิ้นสุด
    registrationDesk: data.registrationDesk || '', // โต๊ะลงทะเบียน (เช่น 'โต๊ะที่ 1')
    requiredProctors: Number(data.requiredProctors || (Number(data.capacity) >= 70 ? 3 : 2)),
    rowsLayout: data.rowsLayout || [],
    hasProjector: data.hasProjector !== false,
    hasAirCondition: data.hasAirCondition !== false,
    hasCCTV: data.hasCCTV !== false,
    isAccessible: data.isAccessible !== false, // รองรับผู้พิการ
    isActive: data.isActive !== false,         // สถานะพร้อมใช้งาน
    equipmentSummary: data.equipmentSummary || 'เครื่องคอมพิวเตอร์ All-in-One, จอโปรเจคเตอร์, แอร์, กล้อง CCTV'
  };
}

/**
 * สร้าง Object สำหรับ Proctor (ผู้คุมสอบ)
 * @param {Object} data 
 * @returns {Object}
 */
export function createProctor(data) {
  return {
    id: data.id,                           // เช่น 'P001'
    name: data.name,                       // เช่น 'ผศ.ดร.ประสิทธิ์ วงศ์ปัญญา'
    academicTitle: data.academicTitle || '', // เช่น 'ผศ.ดร.'
    academicType: data.academicType || 'TEACHER', // 'TEACHER' หรือ 'SUPPORT'
    faculty: data.faculty || 'คณะวิทยาศาสตร์',     // สังกัดคณะ/หน่วยงาน
    seniorityRank: Number(data.seniorityRank) || 7, // 10 ถึง 3
    pool: data.pool || 'CORE',              // 'CORE' หรือ 'RESERVE'
    sessionPattern: data.sessionPattern || 'FULL_DAY_PAIRED', // FULL_DAY_PAIRED, SINGLE_PER_DAY, FLEXIBLE
    maxSessions: Number(data.maxSessions) || 4, // โควตารอบสูงสุด (ห้ามจัดเกิน)
    availableDates: Array.isArray(data.availableDates) ? data.availableDates : [], // วันที่ระบุสะดวก เช่น ['2026-11-15']
    hasExplicitDates: Boolean(data.hasExplicitDates), // ระบุวันเจาะจงหรือไม่
    assignedCount: 0,                       // จำนวนรอบที่จัดแล้ว
    assignedSessions: [],                   // รายการ sessionId ที่จัดแล้ว
    phone: data.phone || '08X-XXX-XXXX',     // ช่องทางติดต่อ
    email: data.email || 'proctor@bru.ac.th',
    isActive: data.isActive !== false,
    notes: data.notes || ''
  };
}

/**
 * สร้าง Object สำหรับ ExamSession (รอบการสอบ)
 * @param {Object} data 
 * @returns {Object}
 */
export function createExamSession(data) {
  return {
    id: data.id,                     // เช่น 'S01'
    title: data.title,               // เช่น 'การสอบวัดความรู้ความสามารถทั่วไป (ก.พ.) รอบเช้า'
    date: data.date,                 // '2026-11-15' (YYYY-MM-DD)
    timeSlot: data.timeSlot,         // 'MORNING' หรือ 'AFTERNOON'
    startTime: data.startTime,       // '08:30'
    endTime: data.endTime,           // '11:30'
    prepMinutes: Number(data.prepMinutes || 30),
    wrapMinutes: Number(data.wrapMinutes || 15),
    organizer: data.organizer || 'สำนักงาน ก.พ. / ศูนย์สอบ มรภ.บุรีรัมย์',
    examineeCount: Number(data.examineeCount || 520),
    status: data.status || 'SCHEDULED'
  };
}

/**
 * สร้าง Object สำหรับ Examinee (ผู้เข้าสอบ)
 * @param {Object} data 
 * @returns {Object}
 */
export function createExaminee(data) {
  return {
    citizenId: data.citizenId,       // เลขบัตรประชาชน 13 หลัก (ใช้ยืนยันตัวตน)
    examSeatNumber: Number(data.examSeatNumber), // เลขที่นั่งสอบ (1 - 520)
    fullName: data.fullName,         // ชื่อ-นามสกุล
    sessionId: data.sessionId,       // รอบสอบ
    roomCode: data.roomCode,         // ห้องสอบ เช่น '17108'
    seatLabel: data.seatLabel || `ที่นั่ง ${data.examSeatNumber}`,
    registeredAt: data.registeredAt || new Date().toISOString()
  };
}

/**
 * สร้าง Object สำหรับ ProctorAssignment (การมอบหมายหน้าที่)
 * @param {Object} data 
 * @returns {Object}
 */
export function createProctorAssignment(data) {
  return {
    id: data.id || `assign-${data.sessionId}-${data.roomId}-${data.order}`,
    sessionId: data.sessionId,
    roomId: data.roomId,
    roomCode: data.roomCode,
    proctorId: data.proctorId,
    proctorName: data.proctorName,
    role: data.role || (data.order === 1 ? 'CHIEF' : 'CO_PROCTOR'), // CHIEF, CO_PROCTOR
    order: Number(data.order || 1), // 1: หัวหน้าห้อง, 2: กรรมการร่วม 1, 3: กรรมการร่วม 2
    status: data.status || ASSIGNMENT_STATUS.DRAFT, // DRAFT, CONFIRMED, LOCKED
    origin: data.origin || ASSIGNMENT_ORIGIN.AUTO,  // AUTO, MANUAL
    reason: data.reason || 'จัดสรรอัตโนมัติตามกฎ 5 ลำดับความสำคัญ ELMS',
    assignedAt: data.assignedAt || new Date().toISOString()
  };
}

/**
 * สร้าง Object สำหรับ AuditLog
 * @param {Object} data 
 * @returns {Object}
 */
export function createAuditLog(data) {
  return {
    id: data.id || `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    userId: data.userId || 'system',
    userName: data.userName || 'ระบบจัดตารางอัตโนมัติ',
    action: data.action,             // 'AUTO_SCHEDULE', 'MANUAL_EDIT', 'RESET', 'LOCK_SLOT', 'SWAP'
    description: data.description,   // คำอธิบายการเปลี่ยนแปลงภาษาไทย
    details: data.details || {}      // ค่าเดิม (oldValue), ค่าใหม่ (newValue)
  };
}
