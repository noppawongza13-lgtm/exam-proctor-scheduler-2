/**
 * ตัวสร้างชุดข้อมูลจำลองผู้คุมสอบ (Proctor Mock Seed Data Generator)
 * 
 * ห้ามใช้ข้อมูลบุคคลจริงใน Demo เด็ดขาดตามระเบียบ PDPA
 * ใช้ชื่อ-นามสกุลสมมุติทั้งหมด รองรับการปรับขนาด 20, 40, 80 คน หรือกำหนดเอง
 * มีฟังก์ชัน Deterministic PRNG เพื่อให้ผลลัพธ์การทดสอบสามารถทำซ้ำได้ (Deterministic Tests)
 */

import { SENIORITY_RANKS, STAFF_POOLS, SESSION_PATTERNS } from '../config/elms-rules.js';
import { createProctor } from './schema.js';

// รายชื่อสมมุติภาษาไทย
const MOCK_FIRST_NAMES = [
  'กิตติพงษ์', 'ประสิทธิ์', 'จิราภรณ์', 'วรพจน์', 'สุดารัตน์', 'ธนพล', 'อนุชา', 'พิมลพรรณ',
  'ชัยวัฒน์', 'ศิริพร', 'ธีรยุทธ', 'วิภาดา', 'นภดล', 'สุมาลี', 'ปิยะวัฒน์', 'ดวงใจ',
  'ณัฐวุฒิ', 'อภิสิทธิ์', 'ชลธิชา', 'วีระศักดิ์', 'พรทิพย์', 'สมเกียรติ', 'อังคณา', 'ธวัชชัย',
  'กัญญารัตน์', 'เมธาสิทธิ์', 'วิชญ์', 'อัครเดช', 'ภัทราพร', 'จิรศักดิ์', 'รัตนาภรณ์', 'กิตติศักดิ์'
];

const MOCK_LAST_NAMES = [
  'วงศ์ปัญญา', 'รัตนโกสินทร์', 'ศรีสุวรรณ', 'พัฒนกิจ', 'สุขเกษม', 'ทองมี', 'บุญชู', 'เจริญผล',
  'วัฒนศิริ', 'ประกายเพชร', 'มงคลชัย', 'เรืองเดช', 'จันทร์กระจ่าง', 'เกียรติไพบูลย์', 'อุดมโชค',
  'มั่นคง', 'บวรวิเชียร', 'สัจจะกุล', 'ชัยประดิษฐ์', 'ธนวัฒนากุล', 'แสงสุริยันต์', 'ปัญญาวงศ์'
];

const MOCK_FACULTIES = [
  'คณะครุศาสตร์',
  'คณะวิทยาศาสตร์และเทคโนโลยี',
  'คณะมนุษยศาสตร์และสังคมศาสตร์',
  'คณะวิทยาการจัดการ',
  'คณะเทคโนโลยีการเกษตร',
  'คณะเทคโนโลยีอุตสาหกรรม',
  'คณะพยาบาลศาสตร์',
  'สำนักวิทยบริการและเทคโนโลยีสารสนเทศ',
  'สำนักงานอธิการบดี'
];

/**
 * เครื่องกำเนิดตัวเลขสุ่มแบบ Deterministic (Linear Congruential Generator: LCG)
 * @param {number} seed 
 * @returns {function(): number}
 */
export function createRNG(seed = 12345) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * สร้างชุดข้อมูลผู้คุมสอบจำลอง
 * @param {number} count จำนวนผู้คุมสอบที่ต้องการสร้าง (เช่น 20, 40, 80)
 * @param {number} seed เลข Seed สำหรับสร้างผลลัพธ์ที่ทำซ้ำได้
 * @param {Array<string>} defaultDates รายการวันที่ของโครงการสอบ เช่น ['2026-11-15', '2026-11-16']
 * @returns {Array<Object>}
 */
export function generateMockProctors(count = 40, seed = 2026, defaultDates = ['2026-11-15', '2026-11-16']) {
  const rng = createRNG(seed);
  const proctors = [];

  // สัดส่วนกลุ่มอาวุโส (Seniority): อาจารย์ Rank 10-7 ประมาณ 60%, สายสนับสนุน Rank 5-3 ประมาณ 40%
  const seniorityKeys = [
    'PROFESSOR', 'ASSOCIATE_PROFESSOR', 'ASSISTANT_PROFESSOR', 'LECTURER',
    'SENIOR_SPECIALIST_STAFF', 'SENIOR_STAFF', 'PRACTITIONER_STAFF'
  ];

  for (let i = 1; i <= count; i++) {
    const id = `P${String(i).padStart(3, '0')}`;
    const firstName = MOCK_FIRST_NAMES[Math.floor(rng() * MOCK_FIRST_NAMES.length)];
    const lastName = MOCK_LAST_NAMES[Math.floor(rng() * MOCK_LAST_NAMES.length)];
    const faculty = MOCK_FACULTIES[Math.floor(rng() * MOCK_FACULTIES.length)];

    // สุ่ม Seniority Rank ตามสัดส่วน
    const roll = rng();
    let seniorityDef;
    if (roll < 0.05) seniorityDef = SENIORITY_RANKS.PROFESSOR; // 5% ศ.
    else if (roll < 0.15) seniorityDef = SENIORITY_RANKS.ASSOCIATE_PROFESSOR; // 10% รศ.
    else if (roll < 0.35) seniorityDef = SENIORITY_RANKS.ASSISTANT_PROFESSOR; // 20% ผศ.
    else if (roll < 0.60) seniorityDef = SENIORITY_RANKS.LECTURER; // 25% อ.
    else if (roll < 0.75) seniorityDef = SENIORITY_RANKS.SENIOR_SPECIALIST_STAFF; // 15% ชำนาญการพิเศษ
    else if (roll < 0.90) seniorityDef = SENIORITY_RANKS.SENIOR_STAFF; // 15% ชำนาญการ
    else seniorityDef = SENIORITY_RANKS.PRACTITIONER_STAFF; // 10% ปฏิบัติการ

    const title = seniorityDef.shortTitles[0];
    const fullName = `${title} ${firstName} ${lastName}`;

    // สัดส่วน Core Pool (80%) vs Reserve Pool (20%)
    const pool = rng() < 0.80 ? STAFF_POOLS.CORE : STAFF_POOLS.RESERVE;

    // รูปแบบกะการทำงาน (Session Pattern)
    const patternRoll = rng();
    let sessionPattern;
    if (patternRoll < 0.65) sessionPattern = SESSION_PATTERNS.FULL_DAY_PAIRED;
    else if (patternRoll < 0.85) sessionPattern = SESSION_PATTERNS.SINGLE_PER_DAY;
    else sessionPattern = SESSION_PATTERNS.FLEXIBLE;

    // โควตารอบสอบสูงสุด (maxSessions): สุ่ม 2, 4, 6 รอบ
    const quotaRoll = rng();
    let maxSessions;
    if (quotaRoll < 0.25) maxSessions = 2; // คนที่โควต้าน้อย (ทดสอบ Rule 1)
    else if (quotaRoll < 0.80) maxSessions = 4;
    else maxSessions = 6;

    // การระบุวันสะดวกเจาะจง (Explicit Date Availability: 30% ระบุวันชัดเจน)
    const hasExplicit = rng() < 0.30;
    const availableDates = hasExplicit && defaultDates.length > 0 
      ? [defaultDates[Math.floor(rng() * defaultDates.length)]] 
      : [...defaultDates];

    proctors.push(createProctor({
      id,
      name: fullName,
      academicTitle: title,
      academicType: seniorityDef.academicType,
      faculty,
      seniorityRank: seniorityDef.rank,
      pool,
      sessionPattern,
      maxSessions,
      availableDates,
      hasExplicitDates: hasExplicit,
      phone: `08${Math.floor(10000000 + rng() * 90000000)}`,
      email: `${firstName.toLowerCase()}@bru.ac.th`,
      isActive: true
    }));
  }

  return proctors;
}
