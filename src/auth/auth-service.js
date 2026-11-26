/**
 * โมดูลระบบความปลอดภัย การยืนยันตัวตน และการควบคุมสิทธิ์ (Auth & RBAC Service)
 * 
 * ใช้ Node.js Built-in crypto ในการเข้ารหัสรหัสผ่าน (scrypt) และสร้าง Signed Token (HMAC-SHA256)
 * รองรับ Role-Based Access Control 5 ระดับ (ADMIN, TEACHER, PROCTOR, VIEWER, GUEST)
 * พร้อมระบบลงนามดิจิทัล (Digital Signature) ที่ผูกมัดกับบัญชีผู้ใช้จริงเพื่อความโปร่งใสตาม PDPA
 */

import crypto from 'node:crypto';
import { USER_ROLES } from '../data/schema.js';

const AUTH_SECRET = process.env.AUTH_SECRET || 'BRU_ELMS_SECRET_KEY_2026_BUILDING17_SECURE';

/**
 * แฮชรหัสผ่านด้วย scrypt
 * @param {string} password 
 * @param {string} [salt] 
 * @returns {{hash: string, salt: string}}
 */
export function hashPassword(password, salt = null) {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, generatedSalt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt: generatedSalt
  };
}

/**
 * ตรวจสอบความถูกต้องของรหัสผ่าน
 * @param {string} password 
 * @param {string} hash 
 * @param {string} salt 
 * @returns {boolean}
 */
export function verifyPassword(password, hash, salt) {
  const { hash: newHash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(newHash, 'hex'), Buffer.from(hash, 'hex'));
}

/**
 * สร้าง Token สำหรับการยืนยันตัวตน (Signed HMAC Token)
 * @param {Object} payload ข้อมูลผู้ใช้ { id, username, role, proctorId }
 * @param {number} [expiresInHours=24]
 * @returns {string} Token
 */
export function createToken(payload, expiresInHours = 24) {
  const expiresAt = Date.now() + (expiresInHours * 3600 * 1000);
  const data = JSON.stringify({ ...payload, exp: expiresAt });
  const encodedData = Buffer.from(data).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(encodedData).digest('base64url');
  return `${encodedData}.${signature}`;
}

/**
 * ตรวจสอบและถอดรหัส Token
 * @param {string} token 
 * @returns {Object|null} Payload หรือ null ถ้าไม่ถูกต้องหรือหมดอายุ
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedData, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(encodedData).digest('base64url');

  if (signature !== expectedSig) return null;

  try {
    const jsonStr = Buffer.from(encodedData, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);
    if (payload.exp && Date.now() > payload.exp) {
      return null; // หมดอายุ
    }
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * เมทริกซ์สิทธิ์การใช้งาน (Permissions Matrix)
 */
export const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: [
    'SCHEDULE_VIEW', 'SCHEDULE_EDIT', 'SCHEDULE_AUTO_SOLVE', 'SCHEDULE_PUBLISH',
    'QUOTA_CONFIG', 'USER_MANAGE', 'EXPORT_DATA', 'SIGN_ATTENDANCE', 'AUDIT_VIEW'
  ],
  [USER_ROLES.TEACHER]: [
    'SCHEDULE_VIEW', 'FACULTY_SCHEDULE_VIEW', 'REQUEST_SWAP', 'EXPORT_DATA'
  ],
  [USER_ROLES.PROCTOR]: [
    'SCHEDULE_VIEW', 'MY_SCHEDULE_VIEW', 'SIGN_ATTENDANCE', 'REQUEST_SWAP', 'REQUEST_UNAVAIL'
  ],
  [USER_ROLES.VIEWER]: [
    'SCHEDULE_VIEW', 'ROOM_STATUS_VIEW'
  ],
  [USER_ROLES.GUEST]: [
    'SEARCH_SEAT_LIMITED'
  ]
};

/**
 * ตรวจสอบสิทธิ์การใช้งานของ Role
 * @param {string} role 
 * @param {string} permission 
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * บันทึกการลงนามดิจิทัล (Digital Signature Attendance Service)
 * ผูกมัดกับบัญชีผู้ใช้ที่ล็อกอินจริงอย่างเด็ดขาด
 * @param {Object} params
 * @param {DatabaseSync} params.db
 * @param {Object} params.currentUser ผู้ใช้ที่ล็อกอิน
 * @param {string} params.sessionId
 * @param {string} params.roomId
 * @param {string} params.proctorId รหัสผู้คุมสอบของช่องที่ต้องการลงนาม
 * @param {string} [params.ipAddress='127.0.0.1']
 * @param {string} [params.userAgent='System']
 * @returns {Object} ผลการลงนาม
 */
export function signAttendance({
  db,
  currentUser,
  sessionId,
  roomId,
  proctorId,
  ipAddress = '127.0.0.1',
  userAgent = 'System'
}) {
  if (!currentUser) {
    throw new Error('ต้องเข้าสู่ระบบก่อนทำการลงนาม');
  }

  // 1. ตรวจสอบสิทธิ์การลงนาม
  // หากเป็น PROCTOR ต้องเป็นบัญชีของตนเองเท่านั้น (ห้ามลงนามแทนกัน)
  if (currentUser.role === USER_ROLES.PROCTOR) {
    if (currentUser.proctorId !== proctorId) {
      throw new Error('ไม่อนุญาตให้ลงนามแทนผู้คุมสอบท่านอื่น บัญชีของคุณไม่ตรงกับตำแหน่งคุมสอบนี้');
    }
  } else if (currentUser.role !== USER_ROLES.ADMIN) {
    throw new Error('คุณไม่มีสิทธิ์ในการลงนามปฏิบัติหน้าที่');
  }

  // 2. ตรวจสอบว่าเคยลงนามไปแล้วหรือไม่
  const checkStmt = db.prepare(`
    SELECT * FROM attendance_signatures 
    WHERE session_id = ? AND room_id = ? AND proctor_id = ?
  `);
  const existing = checkStmt.get(sessionId, roomId, proctorId);
  if (existing) {
    throw new Error('ตำแหน่งนี้ได้รับการลงนามปฏิบัติหน้าที่เรียบร้อยแล้ว');
  }

  // 3. สร้าง Digital Signature Hash
  const signedAt = new Date().toISOString();
  const signatureRaw = `${sessionId}|${roomId}|${proctorId}|${currentUser.id}|${signedAt}`;
  const signatureHash = crypto.createHmac('sha256', AUTH_SECRET).update(signatureRaw).digest('hex');

  const id = `SIG_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // 4. บันทึกลงฐานข้อมูล SQLite
  const insertStmt = db.prepare(`
    INSERT INTO attendance_signatures (
      id, session_id, room_id, proctor_id, user_id, signed_at, ip_address, user_agent, signature_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(id, sessionId, roomId, proctorId, currentUser.id, signedAt, ipAddress, userAgent, signatureHash);

  // 5. บันทึกประวัติ Audit Log
  logAuditAction({
    db,
    userId: currentUser.id,
    action: 'ATTENDANCE_SIGNED',
    targetType: 'ATTENDANCE',
    targetId: id,
    details: { sessionId, roomId, proctorId, signerRole: currentUser.role },
    ipAddress
  });

  return {
    id,
    sessionId,
    roomId,
    proctorId,
    signerName: currentUser.displayName,
    signerRole: currentUser.role,
    signedAt,
    signatureHash,
    isVerified: true
  };
}

/**
 * บันทึกประวัติการกระทำของผู้ใช้ (Audit Log)
 * @param {Object} params
 * @param {DatabaseSync} params.db
 * @param {string} params.userId
 * @param {string} params.action
 * @param {string} [params.targetType]
 * @param {string} [params.targetId]
 * @param {Object} [params.details={}]
 * @param {string} [params.ipAddress='127.0.0.1']
 */
export function logAuditAction({
  db,
  userId,
  action,
  targetType = null,
  targetId = null,
  details = {},
  ipAddress = '127.0.0.1'
}) {
  const id = `LOG_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const createdAt = new Date().toISOString();
  const detailsJson = JSON.stringify(details);

  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details_json, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId || 'SYSTEM', action, targetType, targetId, detailsJson, ipAddress, createdAt);
  return id;
}

/**
 * สร้างผู้ใช้งานระบบเริ่มต้น (Seed Default Users)
 * @param {DatabaseSync} db
 * @param {Array<Object>} [mockProctors=[]]
 */
export function seedDefaultUsers(db, mockProctors = []) {
  const countStmt = db.prepare('SELECT count(*) as count FROM users');
  const { count } = countStmt.get();
  if (count > 0) return; // มีผู้ใช้แล้ว

  const now = new Date().toISOString();

  // 1. Admin Account
  const adminSalt = crypto.randomBytes(16).toString('hex');
  const adminHash = crypto.scryptSync('admin1234', adminSalt, 64).toString('hex');
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, salt, role, proctor_id, display_name, faculty, email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'U_ADMIN_01',
    'admin',
    adminHash,
    adminSalt,
    USER_ROLES.ADMIN,
    null,
    'ผู้ดูแลระบบศูนย์สอบ CBT อาคาร 17',
    'สำนักวิทยบริการและเทคโนโลยีสารสนเทศ',
    'admin@bru.ac.th',
    now
  );

  // 2. Teacher Account
  const teacherSalt = crypto.randomBytes(16).toString('hex');
  const teacherHash = crypto.scryptSync('teacher1234', teacherSalt, 64).toString('hex');
  insertUser.run(
    'U_TEACHER_01',
    'teacher',
    teacherHash,
    teacherSalt,
    USER_ROLES.TEACHER,
    null,
    'ผศ.ดร.กานดา สุวรรณฉัตร (อาจารย์ประจำ)',
    'คณะครุศาสตร์',
    'kanda@bru.ac.th',
    now
  );

  // 3. Proctor Accounts (สร้างจาก mockProctors หรือสร้างตัวอย่าง)
  const proctorList = mockProctors.length > 0 ? mockProctors.slice(0, 5) : [
    { id: 'P001', name: 'ศ.ดร.ประสิทธิ์ วงศ์ปัญญา', faculty: 'คณะครุศาสตร์', email: 'prasit@bru.ac.th' },
    { id: 'P002', name: 'ผศ.ดร.สมชาย รัตนโกสินทร์', faculty: 'คณะวิทยาศาสตร์', email: 'somchai@bru.ac.th' }
  ];

  for (let i = 0; i < proctorList.length; i++) {
    const p = proctorList[i];
    const username = `proctor${i + 1}`;
    const pSalt = crypto.randomBytes(16).toString('hex');
    const pHash = crypto.scryptSync('proctor1234', pSalt, 64).toString('hex');

    insertUser.run(
      `U_PROCTOR_${i + 1}`,
      username,
      pHash,
      pSalt,
      USER_ROLES.PROCTOR,
      p.id,
      p.name,
      p.faculty || 'ศูนย์สอบ CBT',
      p.email || `${username}@bru.ac.th`,
      now
    );
  }

  // 4. Viewer Account
  const viewerSalt = crypto.randomBytes(16).toString('hex');
  const viewerHash = crypto.scryptSync('viewer1234', viewerSalt, 64).toString('hex');
  insertUser.run(
    'U_VIEWER_01',
    'viewer',
    viewerHash,
    viewerSalt,
    USER_ROLES.VIEWER,
    null,
    'เจ้าหน้าที่ตรวจสอบทั่วไป',
    'สำนักงานอธิการบดี',
    'viewer@bru.ac.th',
    now
  );
}
