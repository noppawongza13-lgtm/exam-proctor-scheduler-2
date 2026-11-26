/**
 * โมดูลเครื่องมืออธิบายเหตุผลการจัดตาราง (Explainability Engine)
 * 
 * แสดงเหตุผลเบื้องหลังการจัดสรรบุคลากรในแต่ละตำแหน่ง (Role Assignment Explanation)
 * เพื่อความโปร่งใส ตรวจสอบได้ และสร้างความมั่นใจให้แก่ผู้บริหารและผู้คุมสอบ
 */

import { SENIORITY_RANKS, SESSION_PATTERNS, STAFF_POOLS } from '../config/elms-rules.js';

/**
 * สร้างคำอธิบายภาษาไทยสำหรับรายการมอบหมายงาน (Assignment Explanation)
 * @param {Object} assignment ข้อมูลการมอบหมาย
 * @param {Object} context บริบทแวดล้อม
 * @param {Array<Object>} context.proctors
 * @param {Array<Object>} context.sessions
 * @param {Array<Object>} context.rooms
 * @param {Array<Object>} context.allAssignments
 * @returns {Object} คำอธิบายภาษาไทยพร้อมรายละเอียด
 */
export function explainAssignment(assignment, context = {}) {
  const { proctors = [], sessions = [], rooms = [], allAssignments = [] } = context;

  const proctor = proctors.find(p => p.id === assignment.proctorId);
  const session = sessions.find(s => s.id === assignment.sessionId);
  const room = rooms.find(r => r.id === assignment.roomId || r.roomCode === assignment.roomCode);

  if (!proctor || !session || !room) {
    return {
      title: 'ข้อมูลไม่ครบถ้วน',
      description: 'ไม่สามารถระบุรายละเอียดผู้คุมสอบ รอบสอบ หรือห้องสอบได้',
      tags: []
    };
  }

  const tags = [];
  const reasons = [];

  // 1. อธิบายตำแหน่ง (Role: Chief vs Co-proctor)
  if (assignment.order === 1 || assignment.role === 'CHIEF') {
    tags.push({ label: 'หัวหน้าห้องสอบ (Chief)', type: 'primary' });
    reasons.push(
      `ได้รับการแต่งตั้งเป็นหัวหน้าห้อง (Order 1) เนื่องจากมีลำดับความอาวุโสสูงสุดในห้องนี้ (ระดับ Rank ${proctor.seniorityRank || 'N/A'})`
    );
  } else {
    tags.push({ label: `กรรมการร่วมคนที่ ${assignment.order - 1}`, type: 'secondary' });
    reasons.push(
      `ปฏิบัติหน้าที่กรรมการร่วมคุมสอบ (Order ${assignment.order}) มีลำดับอาวุโสสอดคล้องตามเกณฑ์`
    );
  }

  // 2. อธิบายกลุ่มบุคลากร (Staff Pool)
  if (proctor.pool === STAFF_POOLS.RESERVE || assignment.isReserveCalled) {
    tags.push({ label: 'เรียกจากกลุ่มสำรอง (Reserve)', type: 'warning' });
    reasons.push('ได้รับเรียกเสริมภาระงานจากกลุ่มสำรอง (Reserve Pool) เพื่อเติมเต็มอัตรากำลังให้ครบตามเกณฑ์ความจุห้อง');
  } else {
    tags.push({ label: 'บุคลากรหลัก (Core)', type: 'success' });
  }

  // 3. ตรวจสอบ Room Stickiness ในวันเดียวกัน
  const sameDayAssigns = allAssignments.filter(a => {
    if (a.proctorId !== proctor.id || a.id === assignment.id) return false;
    const s = sessions.find(sess => sess.id === a.sessionId);
    return s && s.date === session.date;
  });

  if (sameDayAssigns.length > 0) {
    const isSameRoom = sameDayAssigns.every(a => a.roomCode === assignment.roomCode || a.roomId === assignment.roomId);
    if (isSameRoom) {
      tags.push({ label: 'คุมห้องเดิมตลอดวัน', type: 'info' });
      reasons.push(`ปฏิบัติงานในห้อง ${room.roomCode} ต่อเนื่องทั้งรอบเช้าและรอบบ่ายตามเงื่อนไขลดการเคลื่อนย้ายอุปกรณ์`);
    } else {
      tags.push({ label: 'สลับห้องระหว่างรอบ', type: 'neutral' });
      reasons.push(`มีการสลับห้องสอบในวันเดียวกันเนื่องจากข้อจำกัดในการจัดสรร`);
    }
  }

  // 4. เงื่อนไขการจัดสรร
  if (proctor.sessionPattern === SESSION_PATTERNS.FULL_DAY_PAIRED) {
    reasons.push('สอดคล้องกับความประสงค์แบบ Full-Day Paired (กะคู่เต็มวัน)');
  } else if (proctor.sessionPattern === SESSION_PATTERNS.SINGLE_PER_DAY) {
    reasons.push('สอดคล้องกับความประสงค์แบบคุมวันละ 1 รอบ (Single per Day)');
  }

  return {
    proctorId: proctor.id,
    proctorName: proctor.name,
    roomCode: room.roomCode,
    sessionTitle: session.title,
    date: session.date,
    roleTitle: assignment.order === 1 ? 'หัวหน้าห้องสอบ' : 'กรรมการร่วมคุมสอบ',
    tags,
    reasons,
    summaryThai: reasons.join(' และ ')
  };
}
