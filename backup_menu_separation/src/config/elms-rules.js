/**
 * ค่าคงที่และการตั้งค่ากฎระเบียบการจัดตารางคุมสอบตามมาตรฐาน ELMS
 * (ELMS Proctor Scheduling Rules & Quota Management Configuration)
 * 
 * ห้ามฝังตัวเลข (Hardcode) ในส่วนอื่นๆ ของระบบ ค่าและเกณฑ์ทั้งหมดต้องอ้างอิงจากโมดูลนี้
 */

export const ELMS_CENTER_METADATA = {
  university: 'มหาวิทยาลัยราชภัฏบุรีรัมย์ (Buriram Rajabhat University)',
  building: 'อาคารนวัตปัญญา (อาคาร 17)',
  roomCount: 10,
  totalSeats: 520,
  staffPerSession: 21,
  timezone: 'Asia/Bangkok'
};

/**
 * เกณฑ์อัตรากำลังประจำห้องสอบ (Room Staffing Threshold)
 */
export const ROOM_STAFFING_RULES = {
  standardThreshold: {
    minCapacity: 1,
    maxCapacity: 69,
    requiredProctors: 2,
    composition: { chief: 1, coProctor: 1 }
  },
  largeThreshold: {
    minCapacity: 70,
    requiredProctors: 3,
    composition: { chief: 1, coProctor: 2 }
  }
};

/**
 * คำนวณจำนวนผู้คุมสอบที่ต้องมีตามความจุที่นั่งของห้องสอบ
 * @param {number} capacity ความจุที่นั่งของห้องสอบ
 * @returns {{requiredProctors: number, composition: {chief: number, coProctor: number}}}
 */
export function getRequiredProctorCount(capacity) {
  if (capacity >= ROOM_STAFFING_RULES.largeThreshold.minCapacity) {
    return ROOM_STAFFING_RULES.largeThreshold;
  }
  return ROOM_STAFFING_RULES.standardThreshold;
}

/**
 * ลำดับความอาวุโส (Seniority Ranks) ตามมาตรฐาน ELMS ข้อ 3.2
 */
export const SENIORITY_RANKS = {
  PROFESSOR: {
    rank: 10,
    academicType: 'TEACHER',
    titleThai: 'ศาสตราจารย์',
    shortTitles: ['ศ.', 'ศ.ดร.']
  },
  ASSOCIATE_PROFESSOR: {
    rank: 9,
    academicType: 'TEACHER',
    titleThai: 'รองศาสตราจารย์',
    shortTitles: ['รศ.', 'รศ.ดร.']
  },
  ASSISTANT_PROFESSOR: {
    rank: 8,
    academicType: 'TEACHER',
    titleThai: 'ผู้ช่วยศาสตราจารย์',
    shortTitles: ['ผศ.', 'ผศ.ดร.']
  },
  LECTURER: {
    rank: 7,
    academicType: 'TEACHER',
    titleThai: 'อาจารย์',
    shortTitles: ['อาจารย์', 'อาจารย์ ดร.', 'อ.']
  },
  SENIOR_SPECIALIST_STAFF: {
    rank: 5,
    academicType: 'SUPPORT',
    titleThai: 'สายสนับสนุน ระดับชำนาญการพิเศษ',
    shortTitles: ['ชำนาญการพิเศษ']
  },
  SENIOR_STAFF: {
    rank: 4,
    academicType: 'SUPPORT',
    titleThai: 'สายสนับสนุน ระดับชำนาญการ',
    shortTitles: ['ชำนาญการ']
  },
  PRACTITIONER_STAFF: {
    rank: 3,
    academicType: 'SUPPORT',
    titleThai: 'สายสนับสนุน ระดับปฏิบัติการ / ทั่วไป',
    shortTitles: ['ปฏิบัติการ', 'ทั่วไป']
  }
};

/**
 * กลุ่มบุคลากร (Staff Pools)
 */
export const STAFF_POOLS = {
  CORE: 'CORE',       // กลุ่มบุคลากรหลัก จัดลงใน Phase 1 และ 2
  RESERVE: 'RESERVE'  // กลุ่มบุคลากรสำรอง เติมเต็มใน Phase 3 หรือกรณีลาฉุกเฉิน
};

/**
 * รูปแบบกะการทำงาน (Session Patterns)
 */
export const SESSION_PATTERNS = {
  FULL_DAY_PAIRED: 'FULL_DAY_PAIRED', // คุมเช้า + บ่าย และล็อกห้องเดิม (Room Stickiness)
  SINGLE_PER_DAY: 'SINGLE_PER_DAY',   // คุมไม่เกิน 1 รอบต่อวัน
  FLEXIBLE: 'FLEXIBLE'                // ยืดหยุ่นตามความเหมาะสม
};

/**
 * เกณฑ์โควตาสูงสุดและข้อจำกัดเวลาทำงาน
 */
export const DEFAULT_QUOTA_SETTINGS = {
  maxDailySessions: 2,
  maxWeeklySessions: 6,
  maxProjectSessions: 6,
  maxAccumulatedHours: 24,
  minRestMinutesBetweenSessions: 45, // เวลาพักขั้นต่ำระหว่างรอบ (นาที)
  prepMinutes: 30,                   // เวลามาก่อนสอบ (นาที)
  wrapMinutes: 15                    // เวลาอยู่สรุปงานหลังสอบ (นาที)
};

/**
 * ค่าน้ำหนักความพึงพอใจสำหรับ Soft Constraints (รวม 100 คะแนน)
 */
export const DEFAULT_SOFT_WEIGHTS = {
  fairnessJainIndex: 30,             // การกระจายภาระงานเป็นธรรม (Jain's Index)
  roomStickiness: 25,                // คุมห้องเดิมตลอดวันสำหรับคน Full-Day Paired
  daySpread: 20,                     // ลดจำนวนวันที่ต้องเดินทางมามหาวิทยาลัย
  consecutiveAvoidance: 15,          // หลีกเลี่ยงรอบติดกันเกินจำเป็น
  individualPreference: 10          // เคารพความต้องการที่สะดวก
};

/**
 * ตัวเลือกเปิด/ปิดกฎ Hard Constraints ที่กำหนดให้ปรับแต่งได้
 */
export const CONFIGURABLE_RULES = {
  enableH9ConflictOfInterest: false, // H9: กฎญาติ/ผู้เกี่ยวข้อง (ค่าเริ่มต้น ปิด)
  enableEnforceSingleRoomPerDay: true // ตรึงห้องเดิมทั้งวัน
};
