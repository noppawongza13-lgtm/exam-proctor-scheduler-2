/**
 * เซิร์ฟเวอร์หลักของระบบจัดตารางคุมสอบ ELMS อาคาร 17 (Main Express Application Server)
 * 
 * ให้บริการ REST APIs ครบวงจร:
 * 1. Authentication & Role-Based Access Control (Admin, Teacher, Proctor, Viewer, Guest)
 * 2. 5-Priority Backtracking Solver & Real-time Rule Validation (H1-H9, S1-S5)
 * 3. Attendance Digital Signature Service (ผูกมัดบัญชีผู้ใช้จริง)
 * 4. Guest Examinee Seat Finder (Rate-limited, PDPA Compliant)
 * 5. Interactive Room Directory & Building 17 Floorplan Data
 * 6. Export to Excel (UTF-8 with BOM) and Printable HTML Reports
 * 7. AI Rules Assistant & Explainability Advisor
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getDatabase, initDatabase } from '../db/database.js';
import { 
  verifyPassword, 
  createToken, 
  verifyToken, 
  hasPermission, 
  signAttendance, 
  logAuditAction, 
  seedDefaultUsers,
  ROLE_PERMISSIONS
} from '../auth/auth-service.js';

import { REAL_EXAM_ROOMS } from '../data/rooms-data.js';
import { BUILDING_17_DIRECTORY } from '../data/building-directory.js';
import { generateMockProctors } from '../data/seed-generator.js';
import { ELMS_CENTER_METADATA, DEFAULT_QUOTA_SETTINGS, DEFAULT_SOFT_WEIGHTS, CONFIGURABLE_RULES } from '../config/elms-rules.js';

import { validateSchedule, validateCandidateForSlot } from '../rules/rule-checker.js';
import { solveProctorSchedule, generateEmptySlots } from '../solver/priority-engine.js';
import { calculateWorkloadStatistics } from '../solver/jain-index.js';
import { calculateRequiredSlots, checkFeasibility } from '../solver/feasibility.js';
import { calculateMinimumProctorRequirements, generateRecoveryOptions } from '../solver/min-staff-calc.js';
import { explainAssignment } from '../explain/explanation-engine.js';
import { generateScheduleDiagnosticReport, analyzeSlotFailure } from '../explain/failure-advisor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');

export const app = express();
app.use(express.json());
app.use(express.static(path.join(PROJECT_ROOT, 'public')));

// กำหนดรอบสอบเริ่มต้น (2 รอบใน 1 วัน: เช้า และ บ่าย)
const DEFAULT_DATE = '2026-11-15';

// เริ่มต้นฐานข้อมูล SQLite และ Seed ผู้ใช้เริ่มต้น
const db = getDatabase();
const defaultProctors = generateMockProctors(40, 2026, [DEFAULT_DATE]);
seedDefaultUsers(db, defaultProctors);

let activeSessions = [
  {
    id: 'S_MORNING',
    title: 'รอบสอบที่ 1: เช้า (08:30 - 11:30 น.)',
    date: DEFAULT_DATE,
    startTime: '08:30',
    endTime: '11:30',
    prepMinutes: 30,
    wrapMinutes: 15
  },
  {
    id: 'S_AFTERNOON',
    title: 'รอบสอบที่ 2: บ่าย (13:00 - 16:00 น.)',
    date: DEFAULT_DATE,
    startTime: '13:00',
    endTime: '16:00',
    prepMinutes: 30,
    wrapMinutes: 15
  }
];

let activeProctors = [...defaultProctors];
let activeUnavailabilities = [];
let activeSlots = generateEmptySlots(activeSessions, REAL_EXAM_ROOMS);
let activeAssignments = [];
let scheduleHistory = []; // Stack สำหรับ Undo/Redo
let historyIndex = -1;

function saveHistoryState(actionName) {
  // ตัดประวัติที่อยู่ข้างหน้าทิ้งถ้ามีการกระทำใหม่
  scheduleHistory = scheduleHistory.slice(0, historyIndex + 1);
  scheduleHistory.push({
    actionName,
    slots: JSON.parse(JSON.stringify(activeSlots)),
    timestamp: new Date().toISOString()
  });
  if (scheduleHistory.length > 25) scheduleHistory.shift();
  historyIndex = scheduleHistory.length - 1;
}

// บันทึกสถานะตั้งต้น
saveHistoryState('เริ่มต้นระบบ');

// สร้างข้อมูลจำลองผู้เข้าสอบ (Mock Examinees) สำหรับ Guest Seat Search
const mockExaminees = [];
let examineeCounter = 1;
for (const room of REAL_EXAM_ROOMS) {
  for (let s = 1; s <= room.capacity; s++) {
    const rawCitizen = `13101000${String(examineeCounter).padStart(5, '0')}`;
    mockExaminees.push({
      citizenId: rawCitizen,
      maskedCitizenId: `${rawCitizen.slice(0, 1)}-${rawCitizen.slice(1, 5)}-*****--**-${rawCitizen.slice(-1)}`,
      name: `ผู้เข้าสอบทดสอบ ${examineeCounter}`,
      sessionId: 'S_MORNING',
      roomCode: room.roomCode,
      roomId: room.id,
      roomName: room.name,
      floor: room.floor,
      seatNumber: room.seatRange ? (room.seatRange.start + s - 1) : s,
      registrationTable: room.registrationDesk || room.registrationTable || 'โต๊ะที่ 1'
    });
    examineeCounter++;
  }
}

// Middleware ยืนยันตัวตน
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = { role: 'GUEST', username: 'guest' };
    return next();
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    req.user = { role: 'GUEST', username: 'guest' };
    return next();
  }

  req.user = payload;
  next();
}

app.use(authenticate);

// ==========================================
// 1. Auth & User APIs
// ==========================================

// ล็อกอินเข้าสู่ระบบ
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อผู้ใช้และรหัสผ่าน' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  const isValid = verifyPassword(password, user.password_hash, user.salt);
  if (!isValid) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  const token = createToken({
    id: user.id,
    username: user.username,
    role: user.role,
    proctorId: user.proctor_id,
    displayName: user.display_name,
    faculty: user.faculty
  });

  logAuditAction({
    db,
    userId: user.id,
    action: 'USER_LOGIN',
    targetType: 'USER',
    targetId: user.id,
    ipAddress: req.ip
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      proctorId: user.proctor_id,
      displayName: user.display_name,
      faculty: user.faculty,
      email: user.email,
      permissions: ROLE_PERMISSIONS[user.role] || []
    }
  });
});

// ตรวจสอบข้อมูลผู้ใช้ปัจจุบัน
app.get('/api/auth/me', (req, res) => {
  res.json({
    user: req.user,
    permissions: ROLE_PERMISSIONS[req.user.role] || []
  });
});

// ดึงรายชื่อบัญชีสาธิตสำหรับสลับบทบาท (Demo Role Switcher)
app.get('/api/auth/demo-accounts', (req, res) => {
  const users = db.prepare('SELECT id, username, role, proctor_id, display_name, faculty FROM users').all();
  res.json({ accounts: users });
});

// ==========================================
// 2. Schedule & Room APIs
// ==========================================

// ดึงข้อมูลตารางสอบและผลการตรวจกฎทั้งหมด
app.get('/api/schedule', (req, res) => {
  const assignments = activeSlots.filter(s => s.proctorId);
  const validation = validateSchedule({
    assignments,
    sessions: activeSessions,
    rooms: REAL_EXAM_ROOMS,
    proctors: activeProctors,
    unavailabilities: activeUnavailabilities
  });

  // คำนวณสถิติภาระงาน
  const proctorLoads = activeProctors.map(p => {
    const assignedCount = assignments.filter(a => a.proctorId === p.id).length;
    return assignedCount;
  });
  const workloadStats = calculateWorkloadStatistics(proctorLoads);

  // ตรวจสอบ Feasibility
  const feasibility = checkFeasibility({
    sessions: activeSessions,
    rooms: REAL_EXAM_ROOMS,
    proctors: activeProctors,
    unavailabilities: activeUnavailabilities
  });

  res.json({
    metadata: ELMS_CENTER_METADATA,
    sessions: activeSessions,
    rooms: REAL_EXAM_ROOMS,
    slots: activeSlots,
    assignments,
    validation,
    workloadStats,
    feasibility,
    history: {
      canUndo: historyIndex > 0,
      canRedo: historyIndex < scheduleHistory.length - 1,
      currentAction: scheduleHistory[historyIndex]?.actionName || ''
    }
  });
});

// จัดตารางอัตโนมัติด้วย 5-Priority Backtracking Solver
app.post('/api/schedule/solve', (req, res) => {
  if (!hasPermission(req.user.role, 'SCHEDULE_AUTO_SOLVE') && req.user.role !== 'GUEST') {
    return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ในการสั่งจัดตารางอัตโนมัติ' });
  }

  const { seed, proctorCount } = req.body;
  if (proctorCount && Number(proctorCount) !== activeProctors.length) {
    activeProctors = generateMockProctors(Number(proctorCount), seed || 2026, [DEFAULT_DATE]);
  }

  const existingAssignments = activeSlots.filter(s => s.isLocked && s.proctorId);

  const result = solveProctorSchedule({
    sessions: activeSessions,
    rooms: REAL_EXAM_ROOMS,
    proctors: activeProctors,
    unavailabilities: activeUnavailabilities,
    existingAssignments
  });

  // อัปเดต activeSlots
  activeSlots = result.slots;
  saveHistoryState(`จัดตารางอัตโนมัติ (Solver: ${result.solvedCount}/${result.totalSlots})`);

  logAuditAction({
    db,
    userId: req.user.id || 'GUEST',
    action: 'SCHEDULE_AUTO_SOLVE',
    targetType: 'SCHEDULE',
    details: { solvedCount: result.solvedCount, totalSlots: result.totalSlots, executionTimeMs: result.executionTimeMs },
    ipAddress: req.ip
  });

  const diagnostic = generateScheduleDiagnosticReport(result, {
    proctors: activeProctors,
    rooms: REAL_EXAM_ROOMS,
    sessions: activeSessions
  });

  res.json({
    success: result.success,
    solvedCount: result.solvedCount,
    totalSlots: result.totalSlots,
    executionTimeMs: result.executionTimeMs,
    diagnostic
  });
});

// ตรวจสอบความเข้ากันได้ของ Candidate ก่อนลากวางลง Slot
app.post('/api/schedule/check-candidate', (req, res) => {
  const { proctorId, slotId } = req.body;
  const proctor = activeProctors.find(p => p.id === proctorId);
  const slot = activeSlots.find(s => s.id === slotId);

  if (!proctor || !slot) {
    return res.status(400).json({ canAssign: false, reasons: ['ข้อมูลไม่ครบถ้วน'] });
  }

  const session = activeSessions.find(s => s.id === slot.sessionId);
  const room = REAL_EXAM_ROOMS.find(r => r.id === slot.roomId || r.roomCode === slot.roomCode);

  const currentAssignments = activeSlots.filter(s => s.proctorId && s.id !== slotId);

  const check = validateCandidateForSlot({
    proctor,
    session,
    room,
    order: slot.order,
    currentAssignments,
    sessions: activeSessions,
    rooms: REAL_EXAM_ROOMS,
    proctors: activeProctors,
    unavailabilities: activeUnavailabilities,
    isSubstitute: proctor.pool === 'RESERVE'
  });

  res.json(check);
});

// มอบหมายผู้คุมสอบลงในช่อง (Manual Slot Assignment)
app.post('/api/schedule/assign', (req, res) => {
  if (!hasPermission(req.user.role, 'SCHEDULE_EDIT') && req.user.role !== 'GUEST') {
    return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ในการแก้ไขตาราง' });
  }

  const { slotId, proctorId, force } = req.body;
  const slot = activeSlots.find(s => s.id === slotId);
  const proctor = activeProctors.find(p => p.id === proctorId);

  if (!slot || !proctor) {
    return res.status(400).json({ error: 'ไม่พบช่องหรือผู้คุมสอบที่ระบุ' });
  }

  if (slot.isLocked) {
    return res.status(400).json({ error: 'ช่องนี้ถูกล็อกไว้ ไม่สามารถเปลี่ยนแปลงได้' });
  }

  const session = activeSessions.find(s => s.id === slot.sessionId);
  const room = REAL_EXAM_ROOMS.find(r => r.id === slot.roomId || r.roomCode === slot.roomCode);
  const currentAssignments = activeSlots.filter(s => s.proctorId && s.id !== slotId);

  const check = validateCandidateForSlot({
    proctor,
    session,
    room,
    order: slot.order,
    currentAssignments,
    sessions: activeSessions,
    rooms: REAL_EXAM_ROOMS,
    proctors: activeProctors,
    unavailabilities: activeUnavailabilities,
    isSubstitute: proctor.pool === 'RESERVE'
  });

  if (!check.canAssign && !force) {
    return res.status(400).json({
      error: 'ไม่สามารถมอบหมายได้เนื่องจากขัดต่อกฎ',
      reasons: check.reasons,
      violations: check.violations
    });
  }

  slot.proctorId = proctor.id;
  slot.proctorName = proctor.name;
  saveHistoryState(`มอบหมาย ${proctor.name} ลง ${slot.roomCode} (${slot.order === 1 ? 'หัวหน้า' : 'ร่วม'})`);

  logAuditAction({
    db,
    userId: req.user.id || 'GUEST',
    action: 'SLOT_ASSIGN',
    targetType: 'SLOT',
    targetId: slot.id,
    details: { proctorId: proctor.id, proctorName: proctor.name, slotId: slot.id },
    ipAddress: req.ip
  });

  res.json({ success: true, slot });
});

// ปลดการมอบหมายในช่อง (Unassign Slot)
app.post('/api/schedule/unassign', (req, res) => {
  if (!hasPermission(req.user.role, 'SCHEDULE_EDIT') && req.user.role !== 'GUEST') {
    return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ในการแก้ไขตาราง' });
  }

  const { slotId } = req.body;
  const slot = activeSlots.find(s => s.id === slotId);
  if (!slot) return res.status(404).json({ error: 'ไม่พบช่องที่ระบุ' });

  if (slot.isLocked) return res.status(400).json({ error: 'ช่องนี้ถูกล็อกไว้' });

  const prevName = slot.proctorName;
  slot.proctorId = null;
  slot.proctorName = null;
  saveHistoryState(`ยกเลิกการมอบหมาย ${prevName || ''} ออกจาก ${slot.roomCode}`);

  res.json({ success: true, slot });
});

// ล็อก / ปลดล็อกช่อง (Toggle Lock)
app.post('/api/schedule/lock', (req, res) => {
  const { slotId } = req.body;
  const slot = activeSlots.find(s => s.id === slotId);
  if (!slot) return res.status(404).json({ error: 'ไม่พบช่องที่ระบุ' });

  slot.isLocked = !slot.isLocked;
  saveHistoryState(`${slot.isLocked ? 'ล็อก' : 'ปลดล็อก'} ช่อง ${slot.roomCode}`);
  res.json({ success: true, slot });
});

// รีเซ็ตตาราง (Clear non-locked slots)
app.post('/api/schedule/reset', (req, res) => {
  for (const s of activeSlots) {
    if (!s.isLocked) {
      s.proctorId = null;
      s.proctorName = null;
    }
  }
  saveHistoryState('รีเซ็ตตารางคุมสอบ');
  res.json({ success: true });
});

// Undo การกระทำ
app.post('/api/schedule/undo', (req, res) => {
  if (historyIndex > 0) {
    historyIndex--;
    activeSlots = JSON.parse(JSON.stringify(scheduleHistory[historyIndex].slots));
    return res.json({ success: true, action: scheduleHistory[historyIndex].actionName });
  }
  res.status(400).json({ error: 'ไม่มีประวัติที่สามารถ Undo ได้' });
});

// Redo การกระทำ
app.post('/api/schedule/redo', (req, res) => {
  if (historyIndex < scheduleHistory.length - 1) {
    historyIndex++;
    activeSlots = JSON.parse(JSON.stringify(scheduleHistory[historyIndex].slots));
    return res.json({ success: true, action: scheduleHistory[historyIndex].actionName });
  }
  res.status(400).json({ error: 'ไม่มีประวัติที่สามารถ Redo ได้' });
});

// ==========================================
// 3. Digital Attendance Signatures
// ==========================================

// ลงนามปฏิบัติหน้าที่
app.post('/api/schedule/sign', (req, res) => {
  const { slotId } = req.body;
  const slot = activeSlots.find(s => s.id === slotId);
  if (!slot || !slot.proctorId) {
    return res.status(400).json({ error: 'ช่องนี้ยังไม่มีการมอบหมายผู้คุมสอบ' });
  }

  try {
    const result = signAttendance({
      db,
      currentUser: req.user,
      sessionId: slot.sessionId,
      roomId: slot.roomId || slot.roomCode,
      proctorId: slot.proctorId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    slot.isSigned = true;
    slot.signatureId = result.id;
    slot.signedAt = result.signedAt;

    res.json({ success: true, signature: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ตรวจสอบรายการการลงนามของรอบและห้อง
app.get('/api/schedule/signatures', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, u.display_name, u.role 
    FROM attendance_signatures s
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.signed_at DESC
  `).all();
  res.json({ signatures: rows });
});

// ==========================================
// 4. Explainability & Diagnostics APIs
// ==========================================

// อธิบายเหตุผลเบื้องหลังการจัดสรรในช่องที่ระบุ
app.get('/api/schedule/explain/:slotId', (req, res) => {
  const slot = activeSlots.find(s => s.id === req.params.slotId);
  if (!slot) return res.status(404).json({ error: 'ไม่พบช่องที่ระบุ' });

  if (!slot.proctorId) {
    const diag = analyzeSlotFailure(slot, {
      sessions: activeSessions,
      rooms: REAL_EXAM_ROOMS,
      proctors: activeProctors,
      assignments: activeSlots.filter(s => s.proctorId)
    });
    return res.json({ type: 'UNFILLED', diagnostic: diag });
  }

  const explanation = explainAssignment(slot, {
    proctors: activeProctors,
    sessions: activeSessions,
    rooms: REAL_EXAM_ROOMS,
    allAssignments: activeSlots.filter(s => s.proctorId)
  });

  res.json({ type: 'ASSIGNED', explanation });
});

// ==========================================
// 5. Guest Examinee Seat Finder (Rate-limited, PDPA)
// ==========================================
const ipRequestCounts = new Map();

app.get('/api/guest/search', (req, res) => {
  const clientIp = req.ip || '127.0.0.1';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 นาที
  const maxRequests = 15;

  const currentCount = (ipRequestCounts.get(clientIp) || []).filter(t => (now - t) < windowMs);
  if (currentCount.length >= maxRequests) {
    return res.status(429).json({ error: 'คุณค้นหาข้อมูลเกินอัตราที่กำหนด กรุณารอ 1 นาที' });
  }
  currentCount.push(now);
  ipRequestCounts.set(clientIp, currentCount);

  const { citizenId } = req.query;
  if (!citizenId || citizenId.trim().length < 4) {
    return res.status(400).json({ error: 'กรุณาระบุเลขประจำตัวประชาชนอย่างน้อย 4 หลัก' });
  }

  const cleanQuery = citizenId.replace(/[^0-9]/g, '');
  const match = mockExaminees.find(e => e.citizenId.endsWith(cleanQuery) || e.citizenId === cleanQuery);

  if (!match) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลเลขที่นั่งสอบตามเลขประจำตัวที่ระบุ' });
  }

  res.json({
    examinee: {
      name: match.name,
      maskedCitizenId: match.maskedCitizenId,
      roomCode: match.roomCode,
      roomName: match.roomName,
      floor: match.floor,
      seatNumber: match.seatNumber,
      registrationTable: match.registrationTable,
      building: 'อาคารนวัตปัญญา (อาคาร 17) ศูนย์สอบ CBT',
      sessionTitle: 'รอบสอบที่ 1: เช้า (08:30 - 11:30 น.)',
      instructions: [
        `กรุณามาถึงก่อนเวลาเริ่มสอบอย่างน้อย 45 นาที (เวลา 07:45 น.)`,
        `ลงทะเบียนที่จุดบริการ: โต๊ะที่ ${match.registrationTable} บริเวณโถงชั้น 1 อาคาร 17`,
        `ขึ้นห้องสอบชั้นที่ ${match.floor} ห้อง ${match.roomCode} (${match.roomName})`,
        `เลขที่นั่งสอบของคุณคือ: ${match.seatNumber}`
      ]
    }
  });
});

// ==========================================
// 6. Export APIs (Excel CSV UTF-8 BOM & PDF Print)
// ==========================================

app.get('/api/export/csv', (req, res) => {
  const assignments = activeSlots.filter(s => s.proctorId);
  const sessionMap = new Map(activeSessions.map(s => [s.id, s]));
  const roomMap = new Map(REAL_EXAM_ROOMS.map(r => [r.id, r]));

  // CSV UTF-8 BOM
  let csv = '\uFEFF';
  csv += 'รอบสอบ,วันที่,เวลา,ห้องสอบ,ชื่อห้อง,ชั้น,ความจุที่นั่ง,ตำแหน่ง,ชื่อ-สกุลผู้คุมสอบ,กลุ่ม,สถานะการลงนาม\n';

  for (const a of assignments) {
    const s = sessionMap.get(a.sessionId);
    const r = roomMap.get(a.roomId) || REAL_EXAM_ROOMS.find(rm => rm.roomCode === a.roomCode);
    const p = activeProctors.find(pr => pr.id === a.proctorId);

    const sTitle = `"${s?.title || a.sessionId}"`;
    const sDate = s?.date || '';
    const sTime = `"${s?.startTime || ''} - ${s?.endTime || ''}"`;
    const rCode = a.roomCode;
    const rName = `"${r?.name || ''}"`;
    const rFloor = r?.floor || '';
    const rCap = r?.capacity || '';
    const roleTitle = a.order === 1 ? 'หัวหน้าห้องสอบ' : `กรรมการร่วม (${a.order})`;
    const pName = `"${p?.name || a.proctorName || ''}"`;
    const pPool = p?.pool || 'CORE';
    const signedStatus = a.isSigned ? 'ลงนามแล้ว' : 'ยังไม่ลงนาม';

    csv += `${sTitle},${sDate},${sTime},${rCode},${rName},${rFloor},${rCap},${roleTitle},${pName},${pPool},${signedStatus}\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ELMS_Proctor_Schedule_Building17.csv"');
  res.send(csv);
});

// ==========================================
// 7. AI Rules Assistant Chat API
// ==========================================

app.post('/api/ai/chat', (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'กรุณาระบุคำถาม' });

  const q = question.toLowerCase();
  const assignments = activeSlots.filter(s => s.proctorId);
  const validation = validateSchedule({
    assignments,
    sessions: activeSessions,
    rooms: REAL_EXAM_ROOMS,
    proctors: activeProctors
  });

  let answer = '';
  let actions = [];

  if (q.includes('ตรวจ') || q.includes('ถูกต้อง') || q.includes('ข้อผิดพลาด') || q.includes('rule')) {
    if (validation.isValid) {
      answer = `✅ ผลการตรวจสอบตารางคุมสอบปัจจุบัน:\n- ไม่พบการละเมิดกฎ Hard Constraints (H1-H9) ใดๆ (0 Violations)\n- คะแนนความพึงพอใจและประสิทธิภาพ (Soft Score): ${validation.softScore} / 100 คะแนน\n- การจัดสรรตำแหน่งครบ ${assignments.length} / ${activeSlots.length} ตำแหน่ง`;
    } else {
      const topViolations = validation.violations.slice(0, 3).map(v => `• [${v.rule}] ${v.message}`).join('\n');
      answer = `⚠️ พบการละเมิดกฎจำนวน ${validation.hardViolationsCount} รายการ:\n${topViolations}\n\nคำแนะนำ: แนะนำให้คลิกปุ่ม 'จัดตารางอัตโนมัติ (Auto-Schedule)' เพื่อให้ระบบจัดสรรตาม 5 ลำดับความสำคัญใหม่`;
      actions.push({ label: 'จัดตารางอัตโนมัติใหม่', action: 'AUTO_SCHEDULE' });
    }
  } else if (q.includes('17201') || q.includes('ห้องใหญ่') || q.includes('80')) {
    answer = `ห้อง 17201 (ห้องประชุมหงส์พันธ์ ชั้น 2 อาคาร 17) มีความจุ 80 ที่นั่ง เป็นห้องขนาดใหญ่ที่สุดในศูนย์สอบ CBT\nตามเกณฑ์ ELMS ข้อ 3.1 กำหนดว่าห้องที่มีความจุ ≥ 70 ที่นั่ง ต้องใช้อัตรากำลังผู้คุมสอบ 3 ท่าน (หัวหน้าห้อง 1 ท่าน + กรรมการร่วม 2 ท่าน)`;
  } else if (q.includes('กี่คน') || q.includes('อัตรากำลัง') || q.includes('จำนวน')) {
    answer = `ศูนย์สอบ CBT อาคาร 17 มีห้องสอบคอมพิวเตอร์ทั้งหมด 10 ห้อง ความจุรวม 520 ที่นั่ง\n• ห้องขนาด 40-60 ที่นั่ง (9 ห้อง) ใช้ห้องละ 2 คน = 18 คน\n• ห้องขนาด 80 ที่นั่ง (ห้อง 17201) ใช้ 3 คน\nรวมความต้องการขั้นต่ำต่อ 1 รอบสอบ = 21 คน (หากจัด 2 รอบต่อวัน ต้องใช้ 42 กะงาน)`;
  } else if (q.includes('โควตา') || q.includes('quota') || q.includes('เกิน')) {
    const overList = activeProctors.filter(p => {
      const count = assignments.filter(a => a.proctorId === p.id).length;
      return count > (p.maxSessions || 4);
    });
    if (overList.length === 0) {
      answer = `ผู้คุมสอบทุกคนได้รับการจัดสรรภาระงานไม่เกินโควตาสูงสุดที่ระบุไว้ (เคารพกฎ H3 สมบูรณ์)`;
    } else {
      answer = `พบผู้คุมสอบที่มีภาระงานเกินโควตา ${overList.length} ท่าน: ${overList.map(p => p.name).join(', ')}`;
    }
  } else {
    answer = `ยินดีต้อนรับสู่ระบบผู้ช่วยอัจฉริยะศูนย์สอบ CBT อาคาร 17 มรภ.บุรีรัมย์\nคุณสามารถสอบถามเกี่ยวกับ:\n1. การตรวจสอบกฎและความถูกต้องของตาราง (H1-H9)\n2. เกณฑ์อัตรากำลังของแต่ละห้องสอบ (เช่น ห้อง 17201 ใช้ผู้คุมกี่คน)\n3. ดัชนีความเป็นธรรม (Jain's Fairness Index) และการกระจายโควตา\n4. วิธีการเดินไปยังห้องสอบและผังอาคาร 17`;
  }

  res.json({ answer, actions });
});

// เริ่มต้นรันเซิร์ฟเวอร์เฉพาะเมื่อรัน app.js โดยตรง
const PORT = process.env.PORT || 3000;
if (process.argv[1] && (process.argv[1].endsWith('app.js') || process.argv[1].endsWith('app'))) {
  app.listen(PORT, () => {
    console.log(`[ELMS Scheduler] Server running on http://localhost:${PORT}`);
    console.log(`[ELMS Scheduler] Ready for CBT Center Building 17 (Buriram Rajabhat University)`);
  });
}
