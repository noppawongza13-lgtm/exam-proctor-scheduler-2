/**
 * ระบบจัดการข้อมูลผู้เข้าสอบ (Examinee Management System)
 * ศูนย์สอบคอมพิวเตอร์ (CBT) อาคาร 17 มหาวิทยาลัยราชภัฏบุรีรัมย์
 * รองรับ:
 * - เพิ่ม/แก้ไข/ลบ/ลบจำนวนมาก ข้อมูลผู้เข้าสอบ
 * - นำเข้าและส่งออก CSV รองรับทั้ง UTF-8 with BOM และ Windows-874 / TIS-620
 * - หน้าต่างตรวจทานก่อนนำเข้า (Import Preview) พร้อมระบบตรวจจับความขัดแย้ง (Conflict Resolution)
 * - ใบเซ็นชื่อเข้าสอบมาตรฐาน มรภ.บุรีรัมย์ พิมพ์ A4 แยกห้องและรอบอัตโนมัติ
 * - เครื่องมือสร้างข้อมูลจำลอง (Mock Generator) และปุ่มล้างเฉพาะข้อมูลจำลอง
 * - มาตรการความปลอดภัยข้อมูลส่วนบุคคล (PDPA Masking)
 */

import { formatThaiDate, formatThaiTimeRange } from '../utils/thai-date.js';
import { REAL_EXAM_ROOM_CONFIGS } from '../data/seed.js';
import { triggerCSVDownload } from '../data/csv-io.js';

// --- ฟังก์ชันช่วยเหลือเกี่ยวกับ PDPA และการจัดรูปแบบ ---
export function maskCitizenId(id, masked = true) {
  if (!id) return '-';
  const clean = String(id).replace(/[\s-]/g, '');
  if (!masked) {
    if (clean.length === 13) {
      return `${clean[0]}-${clean.slice(1, 5)}-${clean.slice(5, 10)}-${clean.slice(10, 12)}-${clean[12]}`;
    }
    return id;
  }
  // PDPA Format: x-xxxx-xxxxx-45-6 หรือ 1-xxxx-xxxxx-xx-6
  if (clean.length === 13) {
    return `${clean[0]}-xxxx-xxxxx-${clean.slice(10, 12)}-${clean[12]}`;
  }
  return 'x-xxxx-xxxxx-xx-x';
}

export function getStandardizedExamTrack(examinee) {
  if (!examinee) return { track: '-', major: '' };
  let track = examinee.faculty || '';
  let major = examinee.major || '';

  if (!track || track.includes('คณะ')) {
    const isTeacher = track.includes('ครุศาสตร์') || major.includes('ศึกษา');
    track = isTeacher ? 'สอบคุรุสภา (วิชาชีพครู)' : 'สอบ ก.พ. (ระดับปริญญาตรี)';
    if (!major || major.includes('วิทยาการคอมพิวเตอร์') || major.includes('คอม')) {
      major = isTeacher ? 'กลุ่มวิชาคอมพิวเตอร์ศึกษา' : 'สาขาวิชาวิทยาการคอมพิวเตอร์';
    } else if (major.includes('คณิตศาสตร์') || major.includes('คณิต')) {
      major = isTeacher ? 'กลุ่มวิชาคณิตศาสตร์' : 'สาขาวิชาคณิตศาสตร์และสถิติ';
    } else if (major.includes('ภาษาไทย')) {
      major = isTeacher ? 'กลุ่มวิชาภาษาไทย' : 'สาขาวิชาภาษาไทย';
    } else if (major.includes('ภาษาอังกฤษ')) {
      major = isTeacher ? 'กลุ่มวิชาภาษาอังกฤษ' : 'สาขาวิชาภาษาอังกฤษ';
    } else if (major.includes('การจัดการ') || major.includes('บริหาร')) {
      major = isTeacher ? 'กลุ่มวิชาการศึกษาปฐมวัย' : 'สาขาวิชาการบริหารธุรกิจ';
    } else if (major.includes('นิติ')) {
      major = 'สาขาวิชานิติศาสตร์';
    }
    examinee.faculty = track;
    examinee.major = major;
  }
  return { track, major };
}

// --- การจัดการไฟล์ CSV พร้อมตัวถอดรหัส UTF-8 และ Windows-874 ---
export function parseCSVWithEncoding(arrayBuffer) {
  let text = '';
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    text = utf8Decoder.decode(arrayBuffer);
  } catch (e) {
    // กรณีที่พบ non-UTF8 เช่น รหัสภาษาไทย ANSI/Windows-874 จาก Excel ไทย
    try {
      const thaiDecoder = new TextDecoder('windows-874');
      text = thaiDecoder.decode(arrayBuffer);
    } catch (e2) {
      const fallbackDecoder = new TextDecoder('utf-8');
      text = fallbackDecoder.decode(arrayBuffer);
    }
  }
  // ลบ BOM ถ้ามี
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  return parseCSVString(text);
}

export function parseCSVString(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const parseRow = (line) => {
    const row = [];
    let insideQuote = false;
    let currentCell = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    return row;
  };

  const rawHeaders = parseRow(lines[0]);
  const headers = rawHeaders.map(h => h.trim().toLowerCase());

  // แมปหัวตารางภาษาไทยและภาษาอังกฤษ
  const columnMap = {
    'รหัสประจำตัวสอบ': 'id',
    'รหัสนักศึกษา': 'id',
    'id': 'id',
    'เลขบัตรประชาชน': 'citizenId',
    'citizenid': 'citizenId',
    'คำนำหน้า': 'title',
    'title': 'title',
    'ชื่อ': 'firstName',
    'firstname': 'firstName',
    'นามสกุล': 'lastName',
    'lastname': 'lastName',
    'คณะ': 'faculty',
    'faculty': 'faculty',
    'สาขาวิชา': 'major',
    'major': 'major',
    'รหัสรอบสอบ': 'sessionId',
    'sessionid': 'sessionId',
    'รหัสห้องสอบ': 'roomCode',
    'roomcode': 'roomCode',
    'เลขที่นั่ง': 'seatNumber',
    'seatnumber': 'seatNumber',
    'สถานะ': 'status',
    'status': 'status',
    'ความต้องการพิเศษ': 'specialNeeds',
    'specialneeds': 'specialNeeds'
  };

  const mappedKeys = headers.map(h => columnMap[h] || h);

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const rowData = parseRow(lines[i]);
    if (rowData.length === 0 || (rowData.length === 1 && !rowData[0])) continue;
    const obj = {};
    mappedKeys.forEach((key, idx) => {
      obj[key] = rowData[idx] !== undefined ? rowData[idx] : '';
    });
    results.push(obj);
  }
  return results;
}

export function generateExamineeCSVTemplate() {
  const headers = [
    'รหัสประจำตัวสอบ',
    'เลขบัตรประชาชน',
    'คำนำหน้า',
    'ชื่อ',
    'นามสกุล',
    'คณะ',
    'สาขาวิชา',
    'รหัสรอบสอบ',
    'รหัสห้องสอบ',
    'เลขที่นั่ง',
    'สถานะ',
    'ความต้องการพิเศษ'
  ];

  const sampleRows = [
    ['69011234001', '1-3199-00123-45-1', 'นาย', 'กิตติศักดิ์', 'เจริญผล', 'คณะวิทยาศาสตร์', 'สาขาวิชาวิทยาการคอมพิวเตอร์', 's1', '17108', '1', 'confirmed', ''],
    ['69011234002', '1-3199-00123-45-2', 'นางสาว', 'ชุติมา', 'สายชล', 'คณะครุศาสตร์', 'สาขาวิชาคอมพิวเตอร์ศึกษา', 's1', '17108', '2', 'confirmed', ''],
    ['69011234003', '1-3199-00123-45-3', 'นาย', 'ธีรภัทร', 'รัตนโกสินทร์', 'คณะเทคโนโลยีอุตสาหกรรม', 'สาขาวิชาวิศวกรรมซอฟต์แวร์', 's1', '17108', '3', 'special_needs', 'ต้องการจอภาพขนาดใหญ่']
  ];

  const csvRows = [headers.join(',')];
  sampleRows.forEach(row => {
    csvRows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
  });

  return '\uFEFF' + csvRows.join('\r\n');
}

export function exportExamineesToCSV(examinees = []) {
  const headers = [
    'รหัสประจำตัวสอบ',
    'เลขบัตรประชาชน',
    'คำนำหน้า',
    'ชื่อ',
    'นามสกุล',
    'คณะ',
    'สาขาวิชา',
    'รหัสรอบสอบ',
    'รหัสห้องสอบ',
    'เลขที่นั่ง',
    'สถานะ',
    'ความต้องการพิเศษ'
  ];

  const csvRows = [headers.join(',')];
  examinees.forEach(e => {
    const row = [
      e.id || '',
      e.citizenId || '',
      e.title || '',
      e.firstName || '',
      e.lastName || '',
      e.faculty || '',
      e.major || '',
      e.sessionId || '',
      e.roomCode || '',
      e.seatNumber !== null && e.seatNumber !== undefined ? e.seatNumber : '',
      e.status || 'confirmed',
      e.specialNeeds || ''
    ];
    csvRows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
  });

  return '\uFEFF' + csvRows.join('\r\n');
}

// --- ระบบพิมพ์ใบเซ็นชื่อเข้าสอบ (A4 Portrait Print Sheet) ---
export function openPrintableExamineeAttendanceSheet({ appState, session, room = null, examinees = [], masked = false }) {
  const targetSession = session || (appState.sessions && appState.sessions[0]) || { id: 's1', name: 'รอบการสอบ', date: '2026-03-27' };
  const sessionExaminees = examinees.length > 0 ? examinees : (appState.examinees || []).filter(e => e.sessionId === targetSession.id);

  // หาห้องสอบทั้งหมดที่มีผู้เข้าสอบ
  const roomsInSheet = room ? [room] : appState.rooms.filter(r => {
    const code = r.roomCode || r.code;
    return sessionExaminees.some(e => e.roomCode === code || e.roomId === r.id);
  });

  if (roomsInSheet.length === 0) {
    alert('ไม่พบข้อมูลผู้เข้าสอบในรอบนี้สำหรับการพิมพ์');
    return;
  }

  // สร้าง DOM Container สำหรับการพิมพ์
  let container = document.getElementById('examinee-print-sheet-wrapper');
  if (!container) {
    container = document.createElement('div');
    container.id = 'examinee-print-sheet-wrapper';
    container.className = 'examinee-print-container';
    document.body.appendChild(container);
  }

  const dateStr = formatThaiDate(targetSession.date);
  const timeStr = formatThaiTimeRange(targetSession.startTime, targetSession.endTime);

  let pagesHtml = '';

  roomsInSheet.forEach((rm, rmIdx) => {
    const rmCode = rm.roomCode || rm.code;
    const roomExaminees = sessionExaminees
      .filter(e => (e.roomCode === rmCode || e.roomId === rm.id))
      .sort((a, b) => (Number(a.seatNumber) || 9999) - (Number(b.seatNumber) || 9999));

    const totalEligible = roomExaminees.length;

    // หาผู้คุมสอบของห้องนี้ในรอบนี้ (ถ้ามี)
    const alloc = (appState.allocations || []).find(a => a.sessionId === targetSession.id && (a.roomId === rm.id || a.roomCode === rmCode));
    let chiefProctor = '...................................................';
    let asstProctors = ['...................................................'];
    if (alloc) {
      const assigns = (appState.assignments || []).filter(a => a.allocationId === alloc.id);
      const chiefAssign = assigns.find(a => a.role === 'chief');
      if (chiefAssign) {
        const cp = (appState.proctors || []).find(p => p.id === chiefAssign.proctorId);
        if (cp) chiefProctor = `${cp.academicTitle || ''} ${cp.firstName} ${cp.lastName}`.trim();
      }
      const asstAssigns = assigns.filter(a => a.role === 'assistant');
      if (asstAssigns.length > 0) {
        asstProctors = asstAssigns.map(aa => {
          const ap = (appState.proctors || []).find(p => p.id === aa.proctorId);
          return ap ? `${ap.academicTitle || ''} ${ap.firstName} ${ap.lastName}`.trim() : '...................................................';
        });
      }
    }

    pagesHtml += `
      <div class="examinee-sheet-page">
        <div class="examinee-print-confidential-banner">เอกสารภายใน ห้ามเผยแพร่</div>
        <div class="examinee-print-header">
          <h2>มหาวิทยาลัยราชภัฏบุรีรัมย์</h2>
          <h3>ใบลงชื่อผู้เข้าสอบและบันทึกการเข้าห้องสอบ (CBT Attendance Sheet)</h3>
          <div style="font-size: 11pt; color: #333;">ศูนย์สอบคอมพิวเตอร์ อาคาร 17 ชั้น ${rm.floor || 1}</div>
        </div>

        <div class="examinee-print-meta-grid">
          <div>
            <div><strong>รอบการสอบ:</strong> ${targetSession.name || targetSession.id}</div>
            <div><strong>วัน/เวลา:</strong> วัน${dateStr} เวลา ${timeStr}</div>
          </div>
          <div style="text-align: right;">
            <div><strong>ห้องสอบ:</strong> ${rm.officialName ? `ห้อง ${rmCode} (${rm.officialName})` : rm.name}</div>
            <div><strong>ช่วงเลขที่นั่ง:</strong> ${rm.seatStart || 1} - ${rm.seatEnd || rm.capacity || 40} (ความจุ ${rm.capacity || 40} ที่นั่ง)</div>
          </div>
        </div>

        <table class="examinee-print-table">
          <thead>
            <tr>
              <th style="width: 40px;">ลำดับ</th>
              <th style="width: 60px;">เลขที่นั่ง</th>
              <th style="width: 110px;">รหัสประจำตัว</th>
              <th style="width: 140px;">เลขบัตรประชาชน</th>
              <th>ชื่อ - นามสกุล</th>
              <th style="width: 150px;">คณะ / สาขาวิชา</th>
              <th style="width: 120px;">ลายมือชื่อผู้เข้าสอบ</th>
              <th style="width: 90px;">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            ${roomExaminees.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align: center; padding: 20px; color: #666;">ยังไม่มีรายชื่อผู้เข้าสอบที่ระบุที่นั่งในห้องนี้</td>
              </tr>
            ` : roomExaminees.map((ex, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td style="text-align: center; font-weight: 700;">${ex.seatNumber !== null && ex.seatNumber !== undefined ? ex.seatNumber : '-'}</td>
                <td style="text-align: center; font-family: monospace;">${ex.id}</td>
                <td style="text-align: center; font-size: 9pt;">${maskCitizenId(ex.citizenId, masked)}</td>
                <td>${ex.title || ''}${ex.firstName} ${ex.lastName}</td>
                <td style="font-size: 8.5pt;">${ex.faculty || ''}<br><span style="color:#555;">${ex.major || ''}</span></td>
                <td style="text-align: center;"><div class="examinee-print-signature-line"></div></td>
                <td style="font-size: 8pt; color: #555;">${ex.specialNeeds ? `⚠️ ${ex.specialNeeds}` : (ex.notes || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="examinee-print-footer-summary">
          <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 600;">
            <span>สรุปจำนวน: ผู้มีสิทธิ์สอบทั้งหมด <u>&nbsp;${totalEligible}&nbsp;</u> คน</span>
            <span>มาสอบ ............. คน</span>
            <span>ขาดสอบ ............. คน</span>
          </div>
        </div>

        <div class="examinee-print-signatures">
          <div class="examinee-sig-box">
            <div class="examinee-sig-line"></div>
            <div>( ${chiefProctor} )</div>
            <div style="font-size: 9pt; color: #555;">หัวหน้ากรรมการกำกับการสอบ</div>
          </div>
          <div class="examinee-sig-box">
            <div class="examinee-sig-line"></div>
            <div>( ${asstProctors[0]} )</div>
            <div style="font-size: 9pt; color: #555;">กรรมการกำกับการสอบประจำห้อง</div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = pagesHtml;

  // เรียกพิมพ์
  setTimeout(() => {
    window.print();
  }, 100);
}

// --- หน้าต่างตรวจทานก่อนนำเข้าไฟล์ CSV (Import Preview Modal) ---
export function renderCSVPreviewModal(parsedRows, appState, appView) {
  const existingIds = new Set((appState.examinees || []).map(e => String(e.id)));
  const existingSessions = new Set((appState.sessions || []).map(s => s.id));
  const existingRooms = new Set((appState.rooms || []).map(r => r.roomCode || r.code || r.id));

  let validCount = 0;
  let duplicateCount = 0;
  let warningCount = 0;

  const analyzedRows = parsedRows.map((r, idx) => {
    const errors = [];
    const warnings = [];

    if (!r.id) errors.push('ขาดรหัสประจำตัว');
    if (!r.firstName) errors.push('ขาดชื่อ');
    if (!r.lastName) errors.push('ขาดนามสกุล');

    const isDuplicate = existingIds.has(String(r.id));
    if (isDuplicate) duplicateCount++;

    if (r.sessionId && !existingSessions.has(r.sessionId)) {
      warnings.push(`ไม่พบรหัสรอบ ${r.sessionId}`);
    }
    if (r.roomCode && !existingRooms.has(r.roomCode)) {
      warnings.push(`ไม่พบห้อง ${r.roomCode}`);
    }

    if (errors.length === 0) validCount++;
    if (warnings.length > 0) warningCount++;

    return {
      index: idx + 1,
      data: r,
      isDuplicate,
      errors,
      warnings,
      isValid: errors.length === 0
    };
  });

  const overlay = document.createElement('div');
  overlay.className = 'csv-preview-overlay';
  overlay.id = 'modal-csv-preview';

  overlay.innerHTML = `
    <div class="csv-preview-modal">
      <div class="csv-preview-header">
        <div style="font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 8px;">
          <span>📋 ตรวจทานข้อมูลก่อนนำเข้า CSV</span>
          <span style="font-size: 13px; font-weight: normal; opacity: 0.9;">(${parsedRows.length} รายการ)</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-csv-preview" style="color: #fff; border-color: rgba(255,255,255,0.3); background: transparent;">✕</button>
      </div>

      <div class="csv-preview-body">
        <div class="csv-stat-banner">
          <div>✅ พร้อมนำเข้า: <strong>${validCount}</strong> รายการ</div>
          ${duplicateCount > 0 ? `<div>⚠️ รหัสซ้ำในระบบ: <strong style="color: #d97706;">${duplicateCount}</strong> รายการ</div>` : ''}
          ${warningCount > 0 ? `<div>ℹ️ มีข้อสังเกต: <strong>${warningCount}</strong> รายการ</div>` : ''}
          ${(parsedRows.length - validCount) > 0 ? `<div>❌ ข้อมูลไม่สมบูรณ์: <strong style="color: #dc2626;">${parsedRows.length - validCount}</strong> รายการ</div>` : ''}
        </div>

        ${duplicateCount > 0 ? `
          <div class="csv-conflict-box">
            <div style="font-weight: 700; margin-bottom: 6px;">⚙️ การจัดการข้อมูลที่รหัสประจำตัวซ้ำ (${duplicateCount} รายการ):</div>
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; cursor: pointer;">
              <input type="radio" name="conflict-strategy" value="skip" checked>
              <span><strong>ข้ามรายการที่ซ้ำ (Skip Duplicates)</strong> - คงข้อมูลเดิมไว้ ไม่เขียนทับ</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="radio" name="conflict-strategy" value="overwrite">
              <span><strong>เขียนทับข้อมูลเดิม (Overwrite)</strong> - อัปเดตข้อมูลผู้เข้าสอบด้วยค่าใหม่จากไฟล์</span>
            </label>
          </div>
        ` : ''}

        <div class="csv-table-preview-wrapper">
          <table class="data-table" style="font-size: 12.5px; width: 100%;">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>สถานะแถว</th>
                <th>รหัสประจำตัว</th>
                <th>ชื่อ-นามสกุล</th>
                <th>คณะ / สาขาวิชา</th>
                <th>รอบสอบ</th>
                <th>ห้องสอบ</th>
                <th>เลขที่นั่ง</th>
              </tr>
            </thead>
            <tbody>
              ${analyzedRows.slice(0, 100).map(ar => `
                <tr style="${!ar.isValid ? 'background: #fef2f2;' : (ar.isDuplicate ? 'background: #fffbeb;' : '')}">
                  <td style="text-align: center;">${ar.index}</td>
                  <td>
                    ${!ar.isValid ? `
                      <span class="badge" style="background:#fee2e2; color:#991b1b; font-size:10px;">❌ ${ar.errors.join(', ')}</span>
                    ` : (ar.isDuplicate ? `
                      <span class="badge" style="background:#fef3c7; color:#92400e; font-size:10px;">⚠️ รหัสซ้ำ</span>
                    ` : `
                      <span class="badge" style="background:#dcfce7; color:#166534; font-size:10px;">✅ สมบูรณ์</span>
                    `)}
                    ${ar.warnings.length > 0 ? `<div style="font-size: 10px; color: #b45309; margin-top: 2px;">${ar.warnings.join(', ')}</div>` : ''}
                  </td>
                  <td style="font-weight: 600;">${ar.data.id || '-'}</td>
                  <td>${ar.data.title || ''}${ar.data.firstName || ''} ${ar.data.lastName || ''}</td>
                  <td>${ar.data.faculty || '-'}<br><span style="font-size: 11px; color: #666;">${ar.data.major || ''}</span></td>
                  <td>${ar.data.sessionId || '-'}</td>
                  <td>${ar.data.roomCode || '-'}</td>
                  <td style="text-align: center;">${ar.data.seatNumber || '-'}</td>
                </tr>
              `).join('')}
              ${analyzedRows.length > 100 ? `
                <tr>
                  <td colspan="8" style="text-align: center; color: #64748b; padding: 10px;">
                    ... และอีก ${analyzedRows.length - 100} รายการ (แสดง 100 รายการแรก)
                  </td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      </div>

      <div class="csv-preview-footer">
        <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-csv-import">ยกเลิก</button>
        <button type="button" class="btn btn-primary btn-sm" id="btn-confirm-csv-import" style="font-weight: 700;">
          📥 ยืนยันนำเข้าข้อมูล (${validCount} รายการ)
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeDialog = () => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };

  overlay.querySelector('#btn-close-csv-preview')?.addEventListener('click', closeDialog);
  overlay.querySelector('#btn-cancel-csv-import')?.addEventListener('click', closeDialog);

  overlay.querySelector('#btn-confirm-csv-import')?.addEventListener('click', () => {
    const strategy = overlay.querySelector('input[name="conflict-strategy"]:checked')?.value || 'skip';

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    analyzedRows.forEach(ar => {
      if (!ar.isValid) {
        skippedCount++;
        return;
      }
      if (ar.isDuplicate) {
        if (strategy === 'overwrite') {
          appState.saveExaminee(ar.data);
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        appState.saveExaminee(ar.data);
        importedCount++;
      }
    });

    closeDialog();
    appState.logAudit('ADMIN', 'IMPORT_CSV', 'EXAMINEE', null, null, null, `นำเข้าไฟล์ CSV สำเร็จ: เพิ่มใหม่ ${importedCount} คน, อัปเดตทับ ${updatedCount} คน, ข้าม ${skippedCount} คน`);
    alert(`นำเข้าข้อมูลเรียบร้อยแล้ว!\n• เพิ่มใหม่: ${importedCount} คน\n• อัปเดตทับ: ${updatedCount} คน\n• ข้าม: ${skippedCount} คน`);
    appView.render();
  });
}

// --- ฟังก์ชันหลักสำหรับเรนเดอร์แท็บข้อมูลผู้เข้าสอบใน Master Data ---
export function renderExamineesSubTab(appState, appView) {
  const examinees = appState.examinees || [];
  const sessions = appState.sessions || [];
  const rooms = appState.rooms || [];
  const roomConfigs = (REAL_EXAM_ROOM_CONFIGS || []).slice(0, 10);

  // Filter States
  const query = (appView.examineeSearchQuery || '').toLowerCase().trim();
  const sessionFilter = appView.examineeFilterSession || 'all';
  const roomFilter = appView.examineeFilterRoom || 'all';
  const unseatedOnly = Boolean(appView.examineeFilterUnseatedOnly);
  const specialNeedsOnly = Boolean(appView.examineeFilterSpecialNeedsOnly);
  const currentPage = appView.examineeCurrentPage || 1;
  const userPageSize = appView.examineePageSize || 25;

  // คำนวณสรุปสถิติ (KPIs)
  const totalCount = examinees.length;
  const seatedCount = examinees.filter(e => e.seatNumber !== null && e.seatNumber !== undefined && e.seatNumber !== '').length;
  const unseatedCount = totalCount - seatedCount;
  const mockCount = examinees.filter(e => e.isMock).length;
  const specialNeedsCount = examinees.filter(e => Boolean(e.specialNeeds)).length;

  // นับจำนวนผู้เข้าสอบรายห้องสำหรับชิปเมนูแยกห้อง
  const roomCounts = new Map();
  examinees.forEach(e => {
    const code = e.roomCode || (e.roomId ? (rooms.find(r => r.id === e.roomId)?.roomCode || e.roomId) : '');
    if (code) {
      roomCounts.set(code, (roomCounts.get(code) || 0) + 1);
    }
  });
  const unassignedCount = examinees.filter(e => !e.roomCode && !e.roomId).length;

  // ข้อมูลห้องที่กำลังเลือก (ถ้ามี)
  const selectedRoom = roomFilter !== 'all' && roomFilter !== 'unassigned'
    ? (roomConfigs.find(r => r.code === roomFilter) || rooms.find(r => (r.roomCode || r.code) === roomFilter) || { code: roomFilter, name: `ห้อง ${roomFilter}`, capacity: 40, floor: 1 })
    : null;

  // กรองข้อมูลตามเงื่อนไข
  let filtered = examinees.filter(e => {
    if (sessionFilter !== 'all' && e.sessionId !== sessionFilter) return false;
    if (roomFilter !== 'all') {
      if (roomFilter === 'unassigned') {
        if (e.roomCode || e.roomId) return false;
      } else {
        const eCode = e.roomCode || e.roomId;
        if (eCode !== roomFilter) return false;
      }
    }
    if (unseatedOnly && (e.seatNumber !== null && e.seatNumber !== undefined && e.seatNumber !== '')) return false;
    if (specialNeedsOnly && !e.specialNeeds) return false;
    if (!query) return true;

    const fullName = `${e.title || ''}${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
    const idStr = String(e.id || '').toLowerCase();
    const citStr = String(e.citizenId || '').toLowerCase();
    const facStr = (e.faculty || '').toLowerCase();
    const majStr = (e.major || '').toLowerCase();
    const roomStr = (e.roomCode || '').toLowerCase();
    const seatStr = String(e.seatNumber || '');

    return idStr.includes(query) ||
           fullName.includes(query) ||
           citStr.includes(query) ||
           facStr.includes(query) ||
           majStr.includes(query) ||
           roomStr.includes(query) ||
           seatStr === query;
  });

  // เรียงลำดับ: ถ้าเลือกห้องเฉพาะ ให้เรียงตามเลขที่นั่ง 1, 2, 3...
  if (roomFilter !== 'all') {
    filtered.sort((a, b) => {
      const sA = (a.seatNumber !== null && a.seatNumber !== undefined && a.seatNumber !== '') ? Number(a.seatNumber) : 99999;
      const sB = (b.seatNumber !== null && b.seatNumber !== undefined && b.seatNumber !== '') ? Number(b.seatNumber) : 99999;
      return sA - sB;
    });
  }

  // ขนาดหน้า: ถ้าเลือกห้องเฉพาะ ให้แสดงทั้งหมดในห้องนั้น (สูงสุด 100) ไม่ต้องแบ่งหน้ายาวๆ
  const effectivePageSize = (roomFilter !== 'all' && userPageSize < 100) ? 100 : (userPageSize === 'all' ? 9999 : Number(userPageSize));
  const totalPages = Math.ceil(filtered.length / effectivePageSize) || 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * effectivePageSize;
  const pageItems = filtered.slice(startIndex, startIndex + effectivePageSize);

  // HTML แสดงแท็บ
  return `
    <div style="display: flex; flex-direction: column; gap: 14px; padding: 16px 20px;">
      <!-- Header Title (ตามภาพต้นแบบจัดการกลุ่มบุคลากร) -->
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 2px;">
        <span style="font-size: 24px; color: var(--primary-700);">🎓</span>
        <div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: var(--text-main);">
            ข้อมูลผู้เข้าสอบ (CBT Center อาคาร 17)
          </h2>
          <p style="margin: 3px 0 0; font-size: 13px; color: var(--text-muted);">
            ข้อมูลผู้เข้าสอบรายบุคคล • จัดผังที่นั่งและห้องสอบ CBT อาคาร 17 (10 ห้องสอบมาตรฐาน) • พิมพ์ใบเซ็นชื่อและบัตรประจำตัวสอบ
          </p>
        </div>
      </div>

      <!-- 1. 4 KPI Stat Cards + Action Buttons Group (ตามภาพต้นแบบหน้าจัดการกลุ่มบุคลากร) -->
      <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 14px; flex-wrap: wrap;">
        <!-- 4 Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; flex: 1; min-width: 520px;">
          <div class="card" style="border-left: 4px solid var(--primary-700);">
            <div class="card-body" style="padding: 12px 16px;">
              <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">ผู้เข้าสอบทั้งหมด</div>
              <div style="font-size: 24px; font-weight: 800; color: var(--text-main); margin-top: 2px;">
                ${totalCount.toLocaleString()} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">คน</span>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">รองรับ 520 คน/รอบ (อาคาร 17)</div>
            </div>
          </div>

          <div class="card" style="border-left: 4px solid #16a34a; background: rgba(22, 163, 74, 0.03);">
            <div class="card-body" style="padding: 12px 16px;">
              <div style="font-size: 12px; color: #16a34a; font-weight: 600;">จัดที่นั่งสอบแล้ว</div>
              <div style="font-size: 24px; font-weight: 800; color: #15803d; margin-top: 2px;">
                ${seatedCount.toLocaleString()} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">คน</span>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">พร้อมพิมพ์ผัง & ใบเซ็นชื่อ</div>
            </div>
          </div>

          <div class="card" style="border-left: 4px solid ${unseatedCount > 0 ? '#dc2626' : '#d97706'}; background: ${unseatedCount > 0 ? 'rgba(220, 38, 38, 0.03)' : 'rgba(217, 119, 6, 0.03)'};">
            <div class="card-body" style="padding: 12px 16px;">
              <div style="font-size: 12px; color: ${unseatedCount > 0 ? '#dc2626' : '#d97706'}; font-weight: 600;">ยังไม่จัดที่นั่ง</div>
              <div style="font-size: 24px; font-weight: 800; color: ${unseatedCount > 0 ? '#b91c1c' : '#b45309'}; margin-top: 2px;">
                ${unseatedCount.toLocaleString()} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">คน</span>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ${unseatedCount > 0 ? 'คลิกจัดที่นั่งอัตโนมัติ' : 'จัดผังที่นั่งครบ 100%'}
              </div>
            </div>
          </div>

          <div class="card" style="border-left: 4px solid var(--primary-600); background: rgba(59, 31, 84, 0.03);">
            <div class="card-body" style="padding: 12px 16px;">
              <div style="font-size: 12px; color: var(--primary-700); font-weight: 600;">ข้อมูลจำลอง (Mock)</div>
              <div style="font-size: 24px; font-weight: 800; color: var(--primary-800); margin-top: 2px;">
                ${mockCount.toLocaleString()} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">คน</span>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ${mockCount > 0 ? 'โหมดทดสอบระบบ' : 'ไม่มีข้อมูลจำลอง'}
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons Group (ตามภาพต้นแบบจัดการกลุ่มบุคลากรทางขวา) -->
        <div style="display: flex; flex-direction: column; justify-content: center; gap: 8px; min-width: 290px;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn-primary btn-sm" id="btn-add-examinee-direct" style="flex: 1; font-weight: 700; box-shadow: 0 2px 8px rgba(59,31,84,0.2);">
              ➕ เพิ่มผู้เข้าสอบ
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-toggle-examinee-mock-tools" style="flex: 1; font-weight: 600;" title="เปิด/ปิด เครื่องมือสร้างข้อมูลจำลองผู้เข้าสอบ">
              ✨ จำลองข้อมูล (Mock)
            </button>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn-secondary btn-sm" id="btn-clear-all-examinees-main" style="flex: 1; font-size: 12px; color: #b91c1c; font-weight: 700;" title="ล้างข้อมูลผู้เข้าสอบทั้งหมดในระบบ (ล้างข้อมูลทดลอง)">
              🗑️ ล้างผู้เข้าสอบทั้งหมด
            </button>
            ${mockCount > 0 ? `
              <button class="btn btn-secondary btn-sm" id="btn-clear-mock-examinees-direct" style="flex: 1; font-size: 12px; color: #b45309;" title="ลบเฉพาะข้อมูลจำลอง (Mock)">
                🧹 ล้างเฉพาะ Mock
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm" id="btn-auto-allocate-seats-direct" style="font-size: 12px;" title="จัดที่นั่งอัตโนมัติ (1 - 520)">
              🪑 จัดที่นั่ง
            </button>
          </div>
        </div>
      </div>

      <!-- 2. เมนูกดดูแบบแยกห้อง (10 ห้อง CBT อาคาร 17) - จัดเป็นแถวแยกชั้น ชั้น 2 อยู่ข้างล่างชั้น 1 ตรงกันเป็นระเบียบ -->
      <div class="card" style="box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div class="card-body" style="padding: 14px 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 700; color: var(--brand-purple);">
              <span>🏢</span>
              <span>เมนูกดดูแบบแยกห้อง (10 ห้องสอบมาตรฐาน CBT อาคาร 17):</span>
            </div>
            <span style="font-size: 11.5px; color: var(--text-muted);">
              แตะเลือกห้องเพื่อดูรายชื่อ จัดการที่นั่ง และพิมพ์ใบเซ็นชื่อเฉพาะห้องนั้น
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <!-- แถวตัวเลือกหลัก: ทั้งหมด & ยังไม่มีห้อง -->
            <div style="display: flex; align-items: flex-start; gap: 10px; padding-bottom: 8px; border-bottom: 1px dashed var(--border-subtle, #e2e8f0);">
              <div style="width: 65px; min-width: 65px; padding-top: 5px;">
                <span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">ตัวเลือก:</span>
              </div>
              <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex: 1;">
                <button type="button" class="examinee-room-chip ${roomFilter === 'all' ? 'active' : ''}" data-examinee-room="all" style="cursor: pointer;">
                  <span>ทั้งหมด</span>
                  <span class="chip-count">${totalCount}</span>
                </button>
                ${unassignedCount > 0 ? `
                  <button type="button" class="examinee-room-chip ${roomFilter === 'unassigned' ? 'active' : ''}" data-examinee-room="unassigned" style="color: #b91c1c; border-color: rgba(220,38,38,0.3); background: #fef2f2; cursor: pointer;">
                    <span>⚠️ ยังไม่มีห้อง</span>
                    <span class="chip-count" style="background: #dc2626; color: #fff;">${unassignedCount}</span>
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- แถวชั้น 1 -->
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <div style="width: 65px; min-width: 65px; padding-top: 5px;">
                <span class="badge" style="background: rgba(59,31,84,0.08); color: var(--brand-purple); font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 6px; display: inline-block;">ชั้น 1:</span>
              </div>
              <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex: 1;">
                ${roomConfigs.filter(r => r.floor === 1).map(r => {
                  const count = roomCounts.get(r.code) || 0;
                  return `
                    <button type="button" class="examinee-room-chip ${roomFilter === r.code ? 'active' : ''}" data-examinee-room="${r.code}" title="${r.officialName || r.name} (ความจุ ${r.capacity} ที่นั่ง)" style="cursor: pointer;">
                      <span>ห้อง ${r.code}</span>
                      <span class="chip-count">${count}/${r.capacity}</span>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- แถวชั้น 2 (อยู่ข้างล่างชั้น 1 ตรงกันอย่างเป็นระเบียบ) -->
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <div style="width: 65px; min-width: 65px; padding-top: 5px;">
                <span class="badge" style="background: rgba(59,31,84,0.08); color: var(--brand-purple); font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 6px; display: inline-block;">ชั้น 2:</span>
              </div>
              <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex: 1;">
                ${roomConfigs.filter(r => r.floor === 2).map(r => {
                  const count = roomCounts.get(r.code) || 0;
                  return `
                    <button type="button" class="examinee-room-chip ${roomFilter === r.code ? 'active' : ''}" data-examinee-room="${r.code}" title="${r.officialName || r.name} (ความจุ ${r.capacity} ที่นั่ง)" style="cursor: pointer;">
                      <span>ห้อง ${r.code}</span>
                      <span class="chip-count">${count}/${r.capacity}</span>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            ${roomConfigs.some(r => r.floor === 3) ? `
              <!-- แถวชั้น 3 (ถ้ามี) -->
              <div style="display: flex; align-items: flex-start; gap: 10px;">
                <div style="width: 65px; min-width: 65px; padding-top: 5px;">
                  <span class="badge" style="background: rgba(59,31,84,0.08); color: var(--brand-purple); font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 6px; display: inline-block;">ชั้น 3:</span>
                </div>
                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex: 1;">
                  ${roomConfigs.filter(r => r.floor === 3).map(r => {
                    const count = roomCounts.get(r.code) || 0;
                    return `
                      <button type="button" class="examinee-room-chip ${roomFilter === r.code ? 'active' : ''}" data-examinee-room="${r.code}" title="${r.officialName || r.name} (ความจุ ${r.capacity} ที่นั่ง)" style="cursor: pointer;">
                        <span>ห้อง ${r.code}</span>
                        <span class="chip-count">${count}/${r.capacity}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- 2.1 แถบข้อมูลสรุปห้องที่กำลังเลือก (Active Room Banner) -->
      ${selectedRoom ? `
        <div style="background: linear-gradient(135deg, rgba(59,31,84,0.06), rgba(229,168,35,0.08)); border: 1.5px solid rgba(124,58,237,0.3); border-radius: 10px; padding: 12px 18px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, #3B1F54, #581C87); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 2px 6px rgba(59,31,84,0.25);">
              🏢
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--brand-purple);">ห้อง ${selectedRoom.code} ${selectedRoom.officialName ? `(${selectedRoom.officialName})` : ''}</h4>
                <span class="badge" style="background: #e0e7ff; color: #3730a3; font-size: 11px; padding: 2px 8px;">ชั้น ${selectedRoom.floor}</span>
                <span class="badge ${filtered.length >= selectedRoom.capacity ? 'badge-normal' : 'badge-warning'}" style="font-size: 11px; padding: 2px 8px;">
                  ผู้เข้าสอบ ${filtered.length} / ${selectedRoom.capacity} คน (${Math.round((filtered.length / (selectedRoom.capacity || 1)) * 100)}%)
                </span>
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
                ช่วงที่นั่ง: <strong>#${selectedRoom.seatStart || 1} - #${selectedRoom.seatEnd || selectedRoom.capacity}</strong> • ${selectedRoom.description || 'ห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17'}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" id="btn-print-this-room" data-room="${selectedRoom.code}" style="font-size: 12px; font-weight: 700; box-shadow: 0 2px 6px rgba(59,31,84,0.2);">
              🖨️ พิมพ์ใบเซ็นชื่อห้อง ${selectedRoom.code} (A4)
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-quick-goto-room-grid" data-room="${selectedRoom.code}" style="font-size: 12px;">
              🪧 ดูผังที่นั่งห้อง ${selectedRoom.code}
            </button>
          </div>
        </div>
      ` : ''}

      <!-- 3. เครื่องมือสร้างข้อมูลจำลอง (แสดงเมื่อกดปุ่ม ✨ จำลองข้อมูล (Mock)) -->
      ${appView.isExamineeTestToolsOpen ? `
        <div class="card" style="margin-bottom: 14px; border: 1.5px dashed rgba(245, 158, 11, 0.45); background: rgba(245, 158, 11, 0.03);">
          <div class="card-body" style="padding: 12px 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge badge-warning" style="font-size: 10px; padding: 2px 6px;">ทดสอบระบบ</span>
                <span style="font-weight: 700; color: var(--brand-purple); font-size: 13px;">🧪 เครื่องมือสร้างข้อมูลจำลองผู้เข้าสอบ (Mock Examinee Generator)</span>
                <span style="font-size: 11.5px; color: var(--text-muted);">สุ่มรายชื่อผู้เข้าสอบ 1-520 คน กระจายลง 10 ห้อง CBT</span>
              </div>
              <button class="btn btn-ghost btn-sm" id="btn-close-examinee-mock-tools" type="button" style="padding: 2px 8px; font-size: 12px; color: var(--text-muted); cursor: pointer;">
                ✕ ปิด
              </button>
            </div>
            <div style="font-size: 12.5px; color: var(--text-main); margin-bottom: 10px;">
              <strong>เลือกรูปแบบข้อมูลจำลอง:</strong> สุ่มชื่อ-นามสกุล ประเภทการสอบ ก.พ./คุรุสภา กลุ่มวิชา เลขบัตรประชาชน (PDPA) พร้อมจัดที่นั่งเรียง 1 ถึง 520 ลง 10 ห้องสอบของอาคาร 17
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <button class="btn btn-secondary btn-sm" id="btn-mock-gen-20" type="button" style="background: var(--bg-surface); font-size: 12px;">
                ➕ 20 คน (ห้อง 17108)
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-mock-gen-100" type="button" style="background: var(--bg-surface); font-size: 12px;">
                ➕ 100 คน (ชั้น 1 ห้อง 17108-17110)
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-mock-gen-520" type="button" style="background: var(--bg-surface); font-weight: 700; border-color: var(--brand-gold); color: #b45309; font-size: 12px;">
                🌟 520 คน (เต็มทุกห้อง CBT อาคาร 17)
              </button>
              <div style="display: inline-flex; align-items: center; gap: 6px; margin-left: 6px;">
                <span style="font-size: 12px; color: var(--text-muted);">กำหนดเอง:</span>
                <input type="number" id="input-custom-mock-count" class="form-input" style="width: 65px; padding: 4px 6px; font-size: 12px;" min="1" max="520" value="50">
                <button class="btn btn-secondary btn-sm" id="btn-mock-gen-custom" type="button" style="background: var(--bg-surface); font-size: 12px;">สร้าง</button>
              </div>
              ${mockCount > 0 ? `
                <button class="btn btn-ghost-danger btn-sm" id="btn-clear-mock-examinees-direct" type="button" style="margin-left: auto; font-size: 12px;" title="ลบเฉพาะรายการที่มีสัญลักษณ์ Mock">
                  🧹 ลบเฉพาะข้อมูลจำลอง (${mockCount} คน)
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- 4. ส่วนหัวตารางและคำสั่งจัดการข้อมูล / พิมพ์ (Table Header & Toolbar) -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--brand-purple); display: flex; align-items: center; gap: 6px;">
            <span>📋</span>
            <span>รายชื่อผู้เข้าสอบ</span>
          </h3>
          <span class="badge" style="background: rgba(59,31,84,0.08); color: var(--brand-purple); font-weight: 700; font-size: 12px; padding: 2px 8px; border-radius: 6px;">
            ${roomFilter === 'all' ? `${filtered.length.toLocaleString()} คน` : `ห้อง ${roomFilter} (${filtered.length.toLocaleString()} คน)`}
          </span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <!-- Dropdown จัดการไฟล์ CSV -->
          <div class="custom-dropdown" id="dropdown-examinees-actions">
            <button class="btn btn-secondary btn-sm custom-dropdown-trigger" type="button" aria-haspopup="true" aria-expanded="false" title="จัดการไฟล์ CSV (นำเข้า/ส่งออก/แม่แบบ)" style="white-space: nowrap; font-size: 12.5px;">
              <span>📁 จัดการข้อมูล CSV</span>
              <span style="font-size: 10px; margin-left: 2px;">▾</span>
            </button>
            <div class="custom-dropdown-menu custom-dropdown-menu-right" role="menu">
              <button class="custom-dropdown-item" id="btn-download-examinee-template" type="button" role="menuitem">
                <span class="dropdown-item-icon">📥</span>
                <div>
                  <div class="dropdown-item-title">ดาวน์โหลดแม่แบบ CSV</div>
                  <div class="dropdown-item-desc">ไฟล์ .csv ตัวอย่างพร้อมคอลัมน์มาตรฐาน</div>
                </div>
              </button>

              <label class="custom-dropdown-item" style="cursor: pointer; margin: 0;" role="menuitem">
                <span class="dropdown-item-icon">📤</span>
                <div>
                  <div class="dropdown-item-title">นำเข้าไฟล์ CSV</div>
                  <div class="dropdown-item-desc">รองรับ UTF-8 with BOM และ Windows-874</div>
                </div>
                <input type="file" id="file-import-examinees-csv" accept=".csv" style="display: none;">
              </label>

              <div class="custom-dropdown-divider"></div>

              <button class="custom-dropdown-item" id="btn-export-examinees-csv" type="button" role="menuitem">
                <span class="dropdown-item-icon">💾</span>
                <div>
                  <div class="dropdown-item-title">ส่งออกข้อมูลเป็น CSV</div>
                  <div class="dropdown-item-desc">ดาวน์โหลดรายชื่อผู้เข้าสอบที่แสดงอยู่</div>
                </div>
              </button>

              <div class="custom-dropdown-divider"></div>

              <button class="custom-dropdown-item" id="btn-print-examinees-sheet" type="button" role="menuitem">
                <span class="dropdown-item-icon">🖨️</span>
                <div>
                  <div class="dropdown-item-title">พิมพ์ใบเซ็นชื่อเข้าสอบ (A4)</div>
                  <div class="dropdown-item-desc">จัดรูปแบบแยกห้องและมีช่องเซ็นชื่อ</div>
                </div>
              </button>

              <button class="custom-dropdown-item" id="btn-auto-allocate-seats-menu" type="button" role="menuitem">
                <span class="dropdown-item-icon">🪑</span>
                <div>
                  <div class="dropdown-item-title">จัดที่นั่งอัตโนมัติ (1 - 520)</div>
                  <div class="dropdown-item-desc">จัดเรียงที่นั่งให้คนที่ยังไม่มีที่นั่ง</div>
                </div>
              </button>

              <div class="custom-dropdown-divider"></div>

              <button class="custom-dropdown-item" id="btn-clear-all-examinees-menu" type="button" role="menuitem" style="color: #dc2626;">
                <span class="dropdown-item-icon">🗑️</span>
                <div>
                  <div class="dropdown-item-title" style="color: #dc2626; font-weight: 700;">ล้างผู้เข้าสอบทั้งหมด</div>
                  <div class="dropdown-item-desc">ล้างข้อมูลผู้เข้าสอบทั้งหมดในระบบ (ล้างข้อมูลทดลอง)</div>
                </div>
              </button>

              ${sessionFilter !== 'all' ? `
                <button class="custom-dropdown-item" id="btn-clear-session-examinees-menu" type="button" role="menuitem" style="color: #dc2626;">
                  <span class="dropdown-item-icon">🗑️</span>
                  <div>
                    <div class="dropdown-item-title" style="color: #dc2626;">ล้างผู้เข้าสอบรอบนี้ทั้งหมด</div>
                    <div class="dropdown-item-desc">ลบข้อมูลผู้เข้าสอบในรอบ ${sessionFilter}</div>
                  </div>
                </button>
              ` : ''}
            </div>
          </div>

          <!-- ปุ่มพิมพ์ใบเซ็นชื่อ (A4) -->
          <button class="btn btn-secondary btn-sm" id="btn-quick-print-examinees" type="button" style="font-size: 12.5px; font-weight: 600;" title="พิมพ์ใบเซ็นชื่อเข้าสอบ (A4)">
            🖨️ พิมพ์ใบเซ็นชื่อ (A4)
          </button>
        </div>
      </div>

      <!-- 5. แถบค้นหาและตัวกรอง (Search & Filter Bar) -->
      <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg-surface-elevated, #f8fafc); border: 1px solid var(--border-subtle, #e2e8f0); border-radius: 8px; margin-bottom: 12px; flex-wrap: wrap;">
        <div style="display: flex; gap: 8px; align-items: center; flex: 1; min-width: 280px; flex-wrap: wrap;">
          <input type="text" id="input-search-examinees" class="form-input" style="max-width: 250px; font-size: 13px;" placeholder="🔍 ค้นหาชื่อ, เลขประจำตัวสอบ, กลุ่มวิชา, เลขที่นั่ง..." value="${appView.examineeSearchQuery || ''}">

          <select id="select-filter-examinee-session" class="form-input" style="width: auto; font-size: 13px;">
            <option value="all" ${sessionFilter === 'all' ? 'selected' : ''}>รอบสอบทั้งหมด (${sessions.length} รอบ)</option>
            ${sessions.map(s => `
              <option value="${s.id}" ${sessionFilter === s.id ? 'selected' : ''}>${s.name || s.id}</option>
            `).join('')}
          </select>

          <select id="select-filter-examinee-room" class="form-input" style="width: auto; font-size: 13px;">
            <option value="all" ${roomFilter === 'all' ? 'selected' : ''}>ห้องสอบทั้งหมด (10 ห้อง)</option>
            ${rooms.map(r => {
              const code = r.roomCode || r.code;
              return `
                <option value="${code}" ${roomFilter === code ? 'selected' : ''}>
                  ห้อง ${code} ${r.officialName ? `(${r.officialName})` : ''}
                </option>
              `;
            }).join('')}
            <option value="unassigned" ${roomFilter === 'unassigned' ? 'selected' : ''}>⚠️ ยังไม่มีห้อง</option>
          </select>

          <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--text-main); cursor: pointer; user-select: none;">
            <input type="checkbox" id="chk-filter-unseated" ${unseatedOnly ? 'checked' : ''}>
            <span>เฉพาะไม่มีที่นั่ง</span>
          </label>

          <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--text-main); cursor: pointer; user-select: none;">
            <input type="checkbox" id="chk-filter-special" ${specialNeedsOnly ? 'checked' : ''}>
            <span>ต้องการดูแลพิเศษ</span>
          </label>

          <label class="pdpa-toggle-switch" title="สลับการซ่อน/แสดงเลขบัตรประชาชนตามหลัก PDPA" style="margin-left: 4px;">
            <input type="checkbox" id="btn-toggle-examinee-pdpa" ${appView.maskPDPA ? 'checked' : ''}>
            <span class="pdpa-slider"></span>
            <span class="pdpa-label">${appView.maskPDPA ? '🔒 ซ่อน PDPA' : '👁️ แสดงข้อมูล'}</span>
          </label>

          ${(query || sessionFilter !== 'all' || roomFilter !== 'all' || unseatedOnly || specialNeedsOnly) ? `
            <button class="btn btn-secondary btn-sm" id="btn-clear-examinee-filters" style="font-size: 12px;">✕ ล้างตัวกรอง</button>
          ` : ''}
        </div>

        <div style="display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--text-muted); margin-left: auto;">
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <span>แสดงต่อหน้า:</span>
            <select id="select-examinee-page-size" class="form-input" style="width: auto; padding: 3px 8px; font-size: 12px;">
              <option value="25" ${userPageSize === 25 ? 'selected' : ''}>25 รายการ</option>
              <option value="50" ${userPageSize === 50 ? 'selected' : ''}>50 รายการ</option>
              <option value="100" ${userPageSize === 100 ? 'selected' : ''}>100 รายการ</option>
              <option value="all" ${userPageSize === 'all' ? 'selected' : ''}>แสดงทั้งหมด</option>
            </select>
          </div>
          <div style="font-size: 13px; color: var(--text-muted); font-weight: 500;">
            แสดง <strong>${filtered.length > 0 ? `${startIndex + 1} - ${Math.min(startIndex + effectivePageSize, filtered.length)}` : 0}</strong> จาก <strong>${filtered.length}</strong> คน
          </div>
        </div>
      </div>

      <!-- 6. ตารางข้อมูลผู้เข้าสอบ (Desktop Table View) -->
      <div class="examinee-desktop-table">
        <div class="table-wrapper" style="border: 1px solid var(--border-subtle, #e2e8f0); border-radius: 8px; overflow-x: auto; background: var(--bg-surface, #fff);">
          <table class="data-table" style="width: 100%; font-size: 13px;">
            <thead>
              <tr style="background: #faf5ff; border-bottom: 2px solid #e9d5ff;">
                <th style="width: 70px; text-align: center; color: var(--brand-purple);">ที่นั่ง</th>
                <th style="width: 130px; color: var(--brand-purple);">เลขประจำตัวสอบ</th>
                <th style="width: 145px; color: var(--brand-purple);">เลขบัตรประชาชน</th>
                <th style="min-width: 180px; color: var(--brand-purple);">ชื่อ - นามสกุล</th>
                <th style="min-width: 170px; color: var(--brand-purple);">ประเภทการสอบ / กลุ่มวิชา</th>
                <th style="width: 110px; color: var(--brand-purple);">รอบสอบ</th>
                <th style="width: 130px; color: var(--brand-purple);">ห้องสอบ</th>
                <th style="width: 100px; text-align: center; color: var(--brand-purple);">สถานะ</th>
                <th style="text-align: center; width: 95px; color: var(--brand-purple);">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${pageItems.length === 0 ? `
                <tr>
                  <td colspan="9" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <div style="font-size: 36px; margin-bottom: 8px;">🎓</div>
                    <div style="font-size: 15px; font-weight: 700; color: var(--text-main);">ไม่พบข้อมูลผู้เข้าสอบตามเงื่อนไขที่เลือก</div>
                    <div style="font-size: 13px; margin-top: 4px; color: var(--text-muted);">
                      ${roomFilter !== 'all' ? `ยังไม่มีผู้เข้าสอบถูกจัดลงห้อง ${roomFilter} หรือเงื่อนไขตัวกรองไม่ตรง` : 'คุณสามารถกด "➕ เพิ่มผู้เข้าสอบ" หรือใช้ "เครื่องมือจำลอง" ด้านบนเพื่อสร้างข้อมูล'}
                    </div>
                  </td>
                </tr>
              ` : pageItems.map(e => `
                <tr style="transition: background 0.1s ease;">
                  <td style="text-align: center;">
                    ${e.seatNumber !== null && e.seatNumber !== undefined && e.seatNumber !== '' ? `
                      <span class="badge-seat-assigned" style="font-weight: 800; font-size: 12px; background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 8px; border-radius: 4px;">#${e.seatNumber}</span>
                    ` : `
                      <span class="badge-unseated" style="font-size: 11px; background: rgba(239, 68, 68, 0.12); color: #b91c1c; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 6px; border-radius: 4px;">ยังไม่มี</span>
                    `}
                  </td>
                  <td style="font-family: monospace; font-weight: 700; color: var(--brand-purple);">
                    ${e.id}
                    ${e.isMock ? `<span class="badge-mock" style="font-size: 10px; margin-left: 3px; padding: 1px 5px; background: rgba(229, 168, 35, 0.15); color: #b45309; border: 1px solid rgba(229, 168, 35, 0.4); border-radius: 3px;" title="ข้อมูลจำลองสำหรับทดสอบระบบ">MOCK</span>` : ''}
                  </td>
                  <td style="font-family: monospace; font-size: 12px; color: var(--text-muted);">
                    ${maskCitizenId(e.citizenId, appView.maskPDPA)}
                  </td>
                  <td>
                    <div style="font-weight: 700; color: var(--text-main);">${e.title || ''}${e.firstName} ${e.lastName}</div>
                    ${e.specialNeeds ? `<div style="font-size: 11px; color: #7e22ce; font-weight: 600; margin-top: 2px;">⚠️ ${e.specialNeeds}</div>` : ''}
                  </td>
                  <td>
                    ${(() => {
                      const std = getStandardizedExamTrack(e);
                      return `
                        <div style="font-weight: 500; color: var(--text-main);">${std.track}</div>
                        <div style="font-size: 11px; color: var(--text-muted);">${std.major}</div>
                      `;
                    })()}
                  </td>
                  <td>
                    <span class="badge badge-normal" style="font-size: 11px;">${e.sessionId || '-'}</span>
                  </td>
                  <td>
                    ${e.roomCode ? `
                      <div style="font-weight: 700; color: var(--brand-purple);">ห้อง ${e.roomCode}</div>
                      <div style="font-size: 11px; color: var(--text-muted);">ชั้น ${e.floor || 1}</div>
                    ` : `
                      <span style="color: var(--text-muted); font-size: 12px;">ยังไม่ระบุ</span>
                    `}
                  </td>
                  <td style="text-align: center;">
                    ${e.status === 'special_needs' ? `
                      <span class="badge-special-needs" style="font-size: 11px; background: rgba(147, 51, 234, 0.12); color: #7e22ce; border: 1px solid rgba(147, 51, 234, 0.3); padding: 2px 7px; border-radius: 4px;">ดูแลพิเศษ</span>
                    ` : (e.status === 'absent' ? `
                      <span class="badge" style="background:#f1f5f9; color:#475569; font-size: 11px; padding: 2px 7px; border-radius: 4px;">ขาดสอบ</span>
                    ` : `
                      <span class="badge" style="background:#ecfdf5; color:#047857; font-size: 11px; padding: 2px 7px; border-radius: 4px;">ปกติ</span>
                    `)}
                  </td>
                  <td style="text-align: center; white-space: nowrap;">
                    <button class="btn btn-secondary btn-sm" data-action="edit-examinee" data-id="${e.id}" style="padding: 3px 8px; font-size: 12px;" title="แก้ไขข้อมูล">✏️</button>
                    <button class="btn btn-ghost-danger btn-sm" data-action="delete-examinee" data-id="${e.id}" style="padding: 3px 7px; font-size: 12px;" title="ลบข้อมูล">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 7. รายการแบบการ์ดสำหรับหน้าจอมือถือ (Mobile Cards View) -->
      <div class="examinee-mobile-card-list">
        ${pageItems.length === 0 ? `
          <div style="text-align: center; padding: 24px; color: var(--text-muted);">ไม่พบข้อมูลผู้เข้าสอบ</div>
        ` : pageItems.map(e => `
          <div class="examinee-mobile-card" style="background: var(--bg-surface, #fff); border: 1px solid var(--border-subtle, #e2e8f0); border-radius: 8px; padding: 12px 14px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <span style="font-weight: 700; color: var(--brand-purple); font-size: 14px;">${e.title || ''}${e.firstName} ${e.lastName}</span>
                ${e.isMock ? `<span class="badge-mock" style="font-size: 10px; margin-left: 4px; padding: 1px 4px;">MOCK</span>` : ''}
                <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">รหัส: ${e.id}</div>
              </div>
              <div>
                ${e.seatNumber !== null && e.seatNumber !== undefined && e.seatNumber !== '' ? `
                  <span class="badge-seat-assigned" style="font-size: 11.5px; font-weight: 700;">ที่นั่ง #${e.seatNumber}</span>
                ` : `
                  <span class="badge-unseated" style="font-size: 11px;">ยังไม่มีที่นั่ง</span>
                `}
              </div>
            </div>

            <div style="font-size: 12.5px; color: var(--text-body); margin-top: 4px;">
              <div>🏫 ${e.faculty || '-'} (${e.major || ''})</div>
              <div>🏢 ห้องสอบ: <strong>${e.roomCode ? `ห้อง ${e.roomCode} (ชั้น ${e.floor || 1})` : 'ยังไม่ระบุ'}</strong> • รอบ: ${e.sessionId}</div>
              <div>🪪 เลขบัตร: ${maskCitizenId(e.citizenId, appView.maskPDPA)}</div>
              ${e.specialNeeds ? `<div style="color: #7e22ce; font-size: 11.5px; margin-top: 2px;">⚠️ ${e.specialNeeds}</div>` : ''}
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; border-top: 1px solid var(--border-subtle); padding-top: 8px;">
              <button class="btn btn-secondary btn-sm" data-action="edit-examinee" data-id="${e.id}" style="font-size: 12px;">✏️ แก้ไข</button>
              <button class="btn btn-ghost-danger btn-sm" data-action="delete-examinee" data-id="${e.id}" style="font-size: 12px;">🗑️ ลบ</button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- 8. การแบ่งหน้าแบบกะทัดรัด (Compact Pagination Controls) -->
      ${totalPages > 1 ? `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; flex-wrap: wrap; gap: 10px;">
          <div style="font-size: 12.5px; color: var(--text-muted);">
            หน้า <strong>${safePage}</strong> จาก <strong>${totalPages}</strong> หน้า (ทั้งหมด ${filtered.length} คน)
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button class="btn btn-secondary btn-sm" id="btn-examinee-prev-page" ${safePage <= 1 ? 'disabled' : ''} style="padding: 4px 10px; font-size: 12px;">
              ◀ หน้าก่อน
            </button>
            <span style="padding: 0 8px; font-size: 13px; font-weight: 700; color: var(--brand-purple);">${safePage} / ${totalPages}</span>
            <button class="btn btn-secondary btn-sm" id="btn-examinee-next-page" ${safePage >= totalPages ? 'disabled' : ''} style="padding: 4px 10px; font-size: 12px;">
              หน้าถัดไป ▶
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// --- หน้าต่าง Modal เพิ่ม / แก้ไข ผู้เข้าสอบ ---
export function renderExamineeModal(data = null, appState, appView) {
  const ex = data || {};
  const isEdit = Boolean(ex.id);
  const sessions = appState.sessions || [];
  const rooms = appState.rooms || [];

  return `
    <div class="modal-overlay" id="modal-examinee-form-overlay">
      <div class="modal-content" style="max-width: 640px; width: 95vw;">
        <div class="modal-header">
          <div class="card-title">${isEdit ? `✏️ แก้ไขข้อมูลผู้เข้าสอบ (${ex.id})` : '➕ เพิ่มผู้เข้าสอบใหม่'}</div>
          <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
        </div>

        <form id="form-master-examinee" style="padding: 16px 20px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 13px;">เลขประจำตัวผู้เข้าสอบ <span style="color: red;">*</span></label>
              <input type="text" name="id" class="form-input" style="font-size: 13px;" required value="${ex.id || ''}" placeholder="เช่น 69011234001" ${isEdit ? 'readonly style="background:#f1f5f9;"' : ''}>
            </div>
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 13px;">เลขประจำตัวประชาชน (13 หลัก)</label>
              <input type="text" name="citizenId" class="form-input" style="font-size: 13px;" value="${ex.citizenId || ''}" placeholder="1-3199-00123-45-6" maxlength="17">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 100px 1fr 1fr; gap: 12px; margin-bottom: 12px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 13px;">คำนำหน้า</label>
              <select name="title" class="form-input" style="font-size: 13px;">
                <option value="นาย" ${ex.title === 'นาย' ? 'selected' : ''}>นาย</option>
                <option value="นางสาว" ${ex.title === 'นางสาว' ? 'selected' : ''}>นางสาว</option>
                <option value="นาง" ${ex.title === 'นาง' ? 'selected' : ''}>นาง</option>
                <option value="ดร." ${ex.title === 'ดร.' ? 'selected' : ''}>ดร.</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 13px;">ชื่อ <span style="color: red;">*</span></label>
              <input type="text" name="firstName" class="form-input" style="font-size: 13px;" required value="${ex.firstName || ''}" placeholder="กิตติศักดิ์">
            </div>
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 13px;">นามสกุล <span style="color: red;">*</span></label>
              <input type="text" name="lastName" class="form-input" style="font-size: 13px;" required value="${ex.lastName || ''}" placeholder="เจริญผล">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 13px;">ประเภทการสอบ / วุฒิการศึกษา</label>
              <input type="text" name="faculty" class="form-input" style="font-size: 13px;" value="${ex.faculty || 'สอบ ก.พ. (ระดับปริญญาตรี)'}" placeholder="เช่น สอบ ก.พ. (ระดับปริญญาตรี) หรือ สอบคุรุสภา (วิชาชีพครู)">
            </div>
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 13px;">สาขาวิชาเอก / กลุ่มวิชา</label>
              <input type="text" name="major" class="form-input" style="font-size: 13px;" value="${ex.major || 'สาขาวิชาวิทยาการคอมพิวเตอร์'}" placeholder="เช่น สาขาวิชานิติศาสตร์ หรือ กลุ่มวิชาคอมพิวเตอร์ศึกษา">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 100px; gap: 12px; margin-bottom: 12px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 13px;">รอบการสอบ <span style="color: red;">*</span></label>
              <select name="sessionId" class="form-input" style="font-size: 13px;" required>
                ${sessions.map(s => `
                  <option value="${s.id}" ${(ex.sessionId === s.id || (!ex.sessionId && s.id === 's1')) ? 'selected' : ''}>${s.name || s.id}</option>
                `).join('')}
              </select>
            </div>
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 13px;">ห้องสอบ</label>
              <select name="roomCode" class="form-input" style="font-size: 13px;">
                <option value="">-- ยังไม่ระบุห้อง --</option>
                ${rooms.map(r => {
                  const code = r.roomCode || r.code;
                  return `
                    <option value="${code}" ${(ex.roomCode === code || ex.roomId === r.id) ? 'selected' : ''}>
                      ห้อง ${code} ${r.officialName ? `(${r.officialName})` : ''} [1-${r.capacity}]
                    </option>
                  `;
                }).join('')}
              </select>
            </div>
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 13px;">เลขที่นั่ง</label>
              <input type="number" name="seatNumber" class="form-input" style="font-size: 13px;" min="1" max="520" value="${ex.seatNumber !== null && ex.seatNumber !== undefined ? ex.seatNumber : ''}" placeholder="1-520">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px; margin-bottom: 12px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 13px;">สถานะ</label>
              <select name="status" class="form-input" style="font-size: 13px;">
                <option value="confirmed" ${ex.status === 'confirmed' ? 'selected' : ''}>ยืนยันสิทธิ์สอบ</option>
                <option value="special_needs" ${ex.status === 'special_needs' ? 'selected' : ''}>ความต้องการพิเศษ</option>
                <option value="absent" ${ex.status === 'absent' ? 'selected' : ''}>ขาดสอบ</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 13px;">ความต้องการพิเศษ (ถ้ามี)</label>
              <input type="text" name="specialNeeds" class="form-input" style="font-size: 13px;" value="${ex.specialNeeds || ''}" placeholder="เช่น ทางลาดวิวแชร์, จอภาพขยายพิเศษ, แสงสว่างเสริม">
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <label class="form-label" style="font-weight: 600; font-size: 13px;">หมายเหตุเพิ่มเติม</label>
            <input type="text" name="notes" class="form-input" style="font-size: 13px;" value="${ex.notes || ''}" placeholder="บันทึกเพิ่มเติม...">
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-modal">ยกเลิก</button>
            <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 700;">💾 บันทึกข้อมูล</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
