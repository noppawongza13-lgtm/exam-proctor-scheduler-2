/**
 * โมดูลส่งออก PDF และใบลงนามผู้คุมสอบ (PDF & Sign-off Sheet Exporter)
 * ตามข้อกำหนด 7.10:
 * "ส่งออก PDF สำหรับพิมพ์ ใช้ฟอนต์ไทย Sarabun ให้แสดงถูกต้อง
 *  มีใบลงนามผู้คุมสอบ (รายห้อง/รายรอบ) พร้อมช่องลายมือชื่อและเวลามา-กลับ"
 */

import { formatThaiDate, formatThaiTimeRange, formatThaiTime } from '../utils/thai-date.js';
import { getSessionDutyTime } from '../data/models.js';
import { BRU_LOGO_DATA_URI, THAI_GARUDA_LOGO_DATA_URI } from '../data/branding.js';

/**
 * เปิดหน้าต่างใบลงนามผู้คุมสอบพร้อมพิมพ์ (Printable Sign-off Sheets)
 * @param {Object} params
 * @param {import('../data/models.js').ProctorAssignment[]} params.assignments
 * @param {import('../data/models.js').ExamSession[]} params.sessions
 * @param {import('../data/models.js').Proctor[]} params.proctors
 * @param {import('../data/models.js').Room[]} params.rooms
 * @param {import('../data/models.js').RoomAllocation[]} params.allocations
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} params.settings
 */
export function openPrintableSignoffSheets({ assignments, sessions, proctors, rooms, allocations, settings }) {
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const proctorMap = new Map(proctors.map(p => [p.id, p]));
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  // สร้าง HTML Document สำหรับพิมพ์
  let html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>ใบลงนามและบัญชีรายชื่อผู้คุมสอบ</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Sarabun', sans-serif;
    }
    body {
      margin: 0;
      color: #1e293b;
      background: #f8fafc;
      font-size: 13pt;
      line-height: 1.4;
    }
    .page-sheet {
      background: white;
      padding: 20px;
      margin: 20px auto;
      max-width: 210mm;
      min-height: 297mm;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      page-break-after: always;
    }
    @media print {
      body { background: white; }
      .page-sheet {
        margin: 0;
        padding: 0;
        box-shadow: none;
        page-break-after: always;
      }
      .no-print { display: none !important; }
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #334155;
      padding-bottom: 12px;
    }
    .header h2 { margin: 0 0 6px 0; font-size: 17pt; font-weight: 700; }
    .header h3 { margin: 0 0 6px 0; font-size: 14pt; font-weight: 600; color: #334155; }
    .header p { margin: 0; font-size: 12pt; color: #475569; }
    .meta-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      background: #f1f5f9;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 16px;
      font-size: 12pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #475569;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #e2e8f0;
      font-weight: 600;
      text-align: center;
      font-size: 12pt;
    }
    td.center { text-align: center; }
    .sig-cell {
      height: 48px;
      vertical-align: bottom;
      text-align: center;
      color: #94a3b8;
      font-size: 10pt;
    }
    .notes-section {
      margin-top: 24px;
      border: 1px dashed #94a3b8;
      padding: 12px;
      border-radius: 4px;
      font-size: 11pt;
    }
    .sign-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 36px;
      padding-right: 20px;
      font-size: 12pt;
      text-align: center;
    }
    .print-bar {
      position: sticky;
      top: 0;
      background: #1e40af;
      color: white;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }
    .btn-print {
      background: #22c55e;
      color: white;
      border: none;
      padding: 8px 20px;
      font-size: 14pt;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-print:hover { background: #16a34a; }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <div style="font-size: 14pt; font-weight: 600;">🖨️ แสดงตัวอย่างเอกสารสำหรับพิมพ์ / บันทึกเป็น PDF</div>
    <button class="btn-print" onclick="window.print()">กดพิมพ์หน้านี้ (Print / Save as PDF)</button>
  </div>
`;

  // สร้างใบลงนามแยกตามรอบสอบและห้อง
  for (const session of sessions) {
    const duty = getSessionDutyTime(session);
    const sessionAllocs = allocations.filter(al => al.sessionId === session.id);

    for (const alloc of sessionAllocs) {
      const room = roomMap.get(alloc.roomId);
      const roomAssigns = assignments.filter(a => a.allocationId === alloc.id);

      html += `
  <div class="page-sheet">
    <div class="header">
      <h2>ใบลงนามปฏิบัติหน้าที่ผู้คุมสอบ</h2>
      <h3>${settings.project.universityName}</h3>
      <p>${settings.project.name} (${settings.project.clientOrganization})</p>
    </div>

    <div class="meta-box">
      <div><strong>การสอบ:</strong> ${session.name}</div>
      <div><strong>วันที่:</strong> ${formatThaiDate(session.date, true)}</div>
      <div><strong>เวลาสอบจริง:</strong> ${formatThaiTimeRange(session.startTime, session.endTime)}</div>
      <div><strong>เวลาปฏิบัติงาน:</strong> ${formatThaiTimeRange(duty.dutyStart, duty.dutyEnd)}</div>
      <div><strong>ห้องสอบ:</strong> ${room ? room.name : alloc.roomId} (${room ? room.building : ''})</div>
      <div><strong>จำนวนผู้เข้าสอบในห้อง:</strong> ${alloc.examineesInRoom} คน</div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 8%;">ลำดับ</th>
          <th style="width: 15%;">บทบาท</th>
          <th style="width: 25%;">ชื่อ - นามสกุล</th>
          <th style="width: 20%;">สังกัด / คณะ</th>
          <th style="width: 12%;">เวลามา</th>
          <th style="width: 12%;">เวลากลับ</th>
          <th style="width: 18%;">ลายมือชื่อ</th>
        </tr>
      </thead>
      <tbody>
`;

      if (roomAssigns.length === 0) {
        html += `<tr><td colspan="7" class="center" style="padding: 20px; color: #ef4444;">-- ยังไม่ได้จัดผู้คุมสอบในห้องนี้ --</td></tr>`;
      } else {
        // เรียงให้ chief อยู่ลำดับแรก
        const sorted = [...roomAssigns].sort((x, y) => (x.role === 'chief' ? -1 : 1));
        sorted.forEach((a, idx) => {
          const p = proctorMap.get(a.proctorId);
          const roleBadge = a.role === 'chief' ? 'หัวหน้าห้องสอบ' : 'ผู้คุมร่วม';
          html += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="center"><strong>${roleBadge}</strong></td>
          <td>${p ? `${p.firstName} ${p.lastName}` : a.proctorId}</td>
          <td>${p ? p.department : '-'}</td>
          <td class="center">.... : ....</td>
          <td class="center">.... : ....</td>
          <td class="sig-cell">ลงชื่อ ...............................</td>
        </tr>`;
        });
      }

      html += `
      </tbody>
    </table>

    <div class="notes-section">
      <strong>ข้อปฏิบัติสำหรับผู้คุมสอบ:</strong><br>
      1. กรุณามารายงานตัวและรับแบบทดสอบก่อนเวลาสอบอย่างน้อย ${session.prepMinutes} นาที (${formatThaiTime(duty.dutyStart)})<br>
      2. ตรวจสอบบัตรประจำตัวผู้เข้าสอบ และห้ามนำอุปกรณ์สื่อสารทุกชนิดเข้าห้องสอบโดยเด็ดขาด<br>
      3. เมื่อหมดเวลาสอบ กรุณานับจำนวนกระดาษคำตอบให้ครบถ้วนก่อนปล่อยผู้เข้าสอบ และส่งคืน ณ กองกลาง
    </div>

    <div class="sign-footer">
      <div>
        ลงชื่อ ..............................................................<br>
        (..............................................................)<br>
        หัวหน้ากองอำนวยการประสานงานสอบ
      </div>
    </div>
  </div>`;
    }

    // สร้างใบรายชื่อผู้คุมสำรองประจำรอบ
    const reserves = assignments.filter(a => a.sessionId === session.id && a.role === 'reserve');
    if (reserves.length > 0) {
      html += `
  <div class="page-sheet">
    <div class="header">
      <h2>บัญชีรายชื่อผู้คุมสอบสำรอง (Reserve Proctors)</h2>
      <h3>${settings.project.universityName}</h3>
      <p>${session.name} | วันที่ ${formatThaiDate(session.date, true)} (${formatThaiTimeRange(session.startTime, session.endTime)})</p>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 8%;">ลำดับ</th>
          <th style="width: 25%;">ชื่อ - นามสกุล</th>
          <th style="width: 22%;">สังกัด / คณะ</th>
          <th style="width: 15%;">เบอร์โทรศัพท์</th>
          <th style="width: 15%;">เวลามาถึง</th>
          <th style="width: 15%;">ลายมือชื่อ</th>
        </tr>
      </thead>
      <tbody>
`;
      reserves.forEach((r, idx) => {
        const p = proctorMap.get(r.proctorId);
        html += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td>${p ? `${p.firstName} ${p.lastName}` : r.proctorId}</td>
          <td>${p ? p.department : '-'}</td>
          <td class="center">${p ? p.phone : '-'}</td>
          <td class="center">.... : ....</td>
          <td class="sig-cell">ลงชื่อ .......................</td>
        </tr>`;
      });
      html += `
      </tbody>
    </table>
    <div class="notes-section" style="margin-top: 30px;">
      * ผู้คุมสอบสำรองกรุณาพร้อมปฏิบัติหน้าที่ ณ ห้องกองกลาง หากมีห้องสอบใดเกิดเหตุขัดข้อง ผู้ประสานงานจะมอบหมายให้เข้าปฏิบัติหน้าที่แทนทันที
    </div>
  </div>`;
    }
  }

  html += `
</body>
</html>`;

  renderAndPrintHTML(html);
}

/**
 * เปิดหน้าต่างใบแจ้งตารางปฏิบัติหน้าที่คุมสอบเฉพาะบุคคล (Personal Duty Schedule & Sign-off Sheet)
 * @param {Object} params
 * @param {import('../data/models.js').Proctor} params.proctor
 * @param {import('../data/models.js').ProctorAssignment[]} params.assignments
 * @param {import('../data/models.js').ExamSession[]} params.sessions
 * @param {import('../data/models.js').Room[]} params.rooms
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} params.settings
 */
export function openPersonalDutySheet({ proctor, assignments, sessions, rooms, settings }) {
  if (!proctor) return;
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  // ดึงเฉพาะรอบสอบของ proctor คนนี้
  const myAssigns = assignments.filter(a => a.proctorId === proctor.id);

  let html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>ตารางปฏิบัติหน้าที่คุมสอบ - ${proctor.firstName} ${proctor.lastName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Sarabun', sans-serif;
    }
    body {
      margin: 0;
      color: #1e293b;
      background: #f8fafc;
      font-size: 13pt;
      line-height: 1.4;
    }
    .page-sheet {
      background: white;
      padding: 24px;
      margin: 20px auto;
      max-width: 210mm;
      min-height: 297mm;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    @media print {
      body { background: white; }
      .page-sheet {
        margin: 0;
        padding: 0;
        box-shadow: none;
      }
      .no-print { display: none !important; }
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #334155;
      padding-bottom: 12px;
    }
    .header h2 { margin: 0 0 6px 0; font-size: 17pt; font-weight: 700; }
    .header h3 { margin: 0 0 6px 0; font-size: 14pt; font-weight: 600; color: #334155; }
    .header p { margin: 0; font-size: 12pt; color: #475569; }
    .meta-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      background: #f1f5f9;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 18px;
      font-size: 12pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #475569;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #e2e8f0;
      font-weight: 600;
      text-align: center;
      font-size: 12pt;
    }
    td.center { text-align: center; }
    .notes-section {
      margin-top: 24px;
      border: 1px dashed #94a3b8;
      padding: 12px;
      border-radius: 4px;
      font-size: 11pt;
    }
    .sign-footer {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      text-align: center;
      font-size: 12pt;
    }
    .print-bar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: white;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 1000;
    }
    .btn-print {
      background: #22c55e;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12pt;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-print:hover { background: #16a34a; }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <div style="font-size: 14pt; font-weight: 600;">🖨️ ตารางคุมสอบส่วนบุคคล: ${proctor.firstName} ${proctor.lastName}</div>
    <button class="btn-print" onclick="window.print()">กดพิมพ์หน้านี้ (Print / Save as PDF)</button>
  </div>

  <div class="page-sheet">
    <div class="header">
      <h2>ใบแจ้งตารางและคำสั่งปฏิบัติหน้าที่คุมสอบ (รายบุคคล)</h2>
      <h3>${settings.project.universityName}</h3>
      <p>${settings.project.name} (${settings.project.clientOrganization})</p>
    </div>

    <div class="meta-box">
      <div><strong>ชื่อ - สกุล:</strong> ${proctor.firstName} ${proctor.lastName}</div>
      <div><strong>รหัสผู้คุมสอบ:</strong> ${proctor.id}</div>
      <div><strong>สังกัด / ส่วนงาน:</strong> ${proctor.department || '-'}</div>
      <div><strong>ประเภท:</strong> ${proctor.role === 'teacher' ? 'อาจารย์ / ผู้คุมหลัก' : 'เจ้าหน้าที่ / ผู้คุมสอบ'}</div>
      <div><strong>เบอร์โทรศัพท์:</strong> ${proctor.phone || '-'}</div>
      <div><strong>อีเมล:</strong> ${proctor.email || '-'}</div>
    </div>

    <div style="font-weight: 600; font-size: 13pt; margin-bottom: 6px;">
      📋 รายการรอบสอบและห้องที่ได้รับมอบหมาย (รวม ${myAssigns.length} รอบ):
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 6%;">ลำดับ</th>
          <th style="width: 14%;">วันที่</th>
          <th style="width: 22%;">เวลาปฏิบัติงาน</th>
          <th style="width: 24%;">วิชา / การสอบ</th>
          <th style="width: 18%;">ห้องสอบ / อาคาร</th>
          <th style="width: 16%;">หน้าที่</th>
        </tr>
      </thead>
      <tbody>
`;

  if (myAssigns.length === 0) {
    html += `<tr><td colspan="6" class="center" style="padding: 24px; color: #64748b;">-- ยังไม่มีรอบสอบที่ได้รับมอบหมายในขณะนี้ --</td></tr>`;
  } else {
    // เรียงตามเวลาเริ่มสอบ
    const sorted = [...myAssigns].sort((a, b) => {
      const sa = sessionMap.get(a.sessionId);
      const sb = sessionMap.get(b.sessionId);
      if (!sa || !sb) return 0;
      return new Date(sa.startTime) - new Date(sb.startTime);
    });

    sorted.forEach((a, idx) => {
      const s = sessionMap.get(a.sessionId);
      const r = roomMap.get(a.roomId);
      if (!s) return;
      const duty = getSessionDutyTime(s);
      const roleText = a.role === 'chief' ? 'หัวหน้าห้องสอบ' : (a.role === 'reserve' ? 'ผู้คุมสอบสำรอง' : 'ผู้ช่วยคุมสอบ');
      const roomText = a.role === 'reserve' ? 'ห้องกองกลาง' : (r ? `${r.name} (${r.building})` : a.roomId);

      html += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="center">${formatThaiDate(s.date)}</td>
          <td class="center">
            <strong>${formatThaiTimeRange(duty.dutyStart, duty.dutyEnd)}</strong><br>
            <span style="font-size: 10pt; color: #475569;">(เวลาสอบ: ${formatThaiTimeRange(s.startTime, s.endTime)})</span>
          </td>
          <td><strong>${s.name}</strong></td>
          <td class="center">${roomText}</td>
          <td class="center"><strong>${roleText}</strong></td>
        </tr>`;
    });
  }

  html += `
      </tbody>
    </table>

    <div class="notes-section">
      <strong>คำชี้แจงและแนวปฏิบัติสำหรับกรรมการคุมสอบ:</strong><br>
      1. กรุณาเข้ารายงานตัวและรับอุปกรณ์การสอบก่อนเริ่มเวลาสอบจริงอย่างน้อย 30 นาที ณ กองอำนวยการประสานงานสอบ<br>
      2. หากมีเหตุจำเป็นสุดวิสัยไม่สามารถมาปฏิบัติหน้าที่ได้ กรุณาติดต่อกองกลางล่วงหน้าเพื่อจัดผู้คุมสอบสำรองเข้าแทน<br>
      3. ปฏิบัติตามระเบียบการจัดสอบและรักษาความลับของข้อสอบอย่างเคร่งครัด
    </div>

    <div class="sign-footer">
      <div>
        ลงชื่อ ..............................................................<br>
        ( ${proctor.firstName} ${proctor.lastName} )<br>
        ผู้ปฏิบัติหน้าที่คุมสอบ
      </div>
      <div>
        ลงชื่อ ..............................................................<br>
        (..............................................................)<br>
        หัวหน้ากองอำนวยการประสานงานสอบ
      </div>
    </div>
  </div>
</body>
</html>`;

  renderAndPrintHTML(html);
}

/**
 * ฟังก์ชันเปิดหน้าต่างและสั่งพิมพ์เอกสารอย่างปลอดภัย (ป้องกัน about:blank#blocked ใน Chrome)
 * @param {string} html 
 */
function renderAndPrintHTML(html) {
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, '_blank');
    if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
      printViaHiddenIframe(html);
    }
  } catch (e) {
    printViaHiddenIframe(html);
  }
}

/**
 * สำรอง: พิมพ์ผ่าน iframe ซ่อนในหน้าเดิมกรณีบราวเซอร์บล็อกป๊อปอัป
 * @param {string} html 
 */
function printViaHiddenIframe(html) {
  let iframe = document.getElementById('print-service-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'print-service-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
  }
  const frameDoc = iframe.contentWindow.document;
  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 250);
}

/**
 * สร้าง HTML Diagram ของผังห้องสอบ (Seating Chart Diagram) สำหรับแสดงใน UI หรือพิมพ์ PDF
 * @param {import('../data/models.js').Room} room
 * @returns {string}
 */
export function renderSeatingPlanInnerDiagram(room) {
  const isFrontBoth = room.doorPosition === 'front-both';
  const isRightSide = room.doorPosition === 'right-side-two' || room.doorPosition === 'right-side';
  const isLeftSide = room.doorPosition === 'left-side-two' || room.doorPosition === 'left-side';

  const disabledSet = new Set(room.disabledSeats || []);
  const accessibleSet = new Set(room.accessibleSeats || []);

  // Helper to render seat cell with synced status (closed/disabled or accessible)
  const renderCell = (s, compact = false) => {
    const isDisabled = disabledSet.has(s);
    const isAcc = accessibleSet.has(s);
    let cls = compact ? 'seat-cell seat-cell-compact' : 'seat-cell';
    let title = `ที่นั่งสอบ ${s}`;
    let extraStyle = 'position: relative; display: inline-flex; align-items: center; justify-content: center; min-width: 36px; height: 28px; font-size: 12px; font-weight: 700; border-radius: 4px; box-sizing: border-box;';

    if (isDisabled) {
      cls += ' seat-cell-disabled';
      title += ' (🚫 ปิดที่นั่ง / ชำรุด)';
      extraStyle += ' background: #FEE2E2 !important; border-color: #EF4444 !important; color: #DC2626 !important; text-decoration: line-through;';
    } else if (isAcc) {
      cls += ' seat-cell-accessible';
      title += ' (♿ ที่นั่งสำหรับคนพิการ)';
      extraStyle += ' background: #EFF6FF !important; border-color: #3B82F6 !important; color: #1E40AF !important; font-weight: 800;';
    }

    const badge = isDisabled
      ? `<span style="position: absolute; top: -5px; right: -5px; background: #EF4444; color: white; border-radius: 50%; width: 11px; height: 11px; font-size: 7.5px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; font-weight: 800; line-height: 1;">✕</span>`
      : (isAcc ? `<span style="position: absolute; top: -6px; right: -5px; font-size: 9px; line-height: 1;">♿</span>` : '');

    return `<div class="${cls}" title="${title}" style="${extraStyle}">${s}${badge}</div>`;
  };

  let desksHtml = '';

  if (room.layoutType === 'trapezoid-rows' && room.rows) {
    // ห้องสโลปใหญ่ 80 ที่นั่ง (ห้อง 17201 - ห้องประชุมหงส์พันธ์)
    desksHtml = `
      <div class="trapezoid-rows-wrapper" style="display: flex; flex-direction: column; gap: 7px; align-items: center; width: 100%; margin-top: 12px;">
        ${room.rows.map(r => `
          <div class="trapezoid-row" style="display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%;">
            <div class="trapezoid-row-label" style="font-size: 11px; color: #64748b; width: 44px; text-align: right; font-weight: 600; white-space: nowrap;">แถวที่ ${r.rowNum}</div>
            <div style="display: flex; gap: 3px;">
              ${r.left.map(s => renderCell(s, true)).join('')}
            </div>
            <div class="trapezoid-aisle" style="font-size: 10.5px; color: #94a3b8; padding: 0 4px; font-weight: 500; white-space: nowrap;">ทางเดิน</div>
            <div style="display: flex; gap: 3px;">
              ${r.right.map(s => renderCell(s, true)).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if ((room.layoutType === 'grid-rows' || room.layoutType === 'staggered-rows') && room.rows) {
    // ห้องแถวแนวนอน เช่น ห้อง 6 (สับหว่าง 40 ที่นั่ง) หรือ ห้อง 7 (5 แถว 40 ที่นั่ง)
    desksHtml = `
      <div style="display: flex; flex-direction: column; gap: 9px; align-items: center; width: 100%; margin-top: 14px;">
        ${room.rows.map(r => `
          <div style="display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%;">
            <div style="font-size: 11px; color: #64748b; width: 55px; text-align: right; font-weight: 600;">แถวที่ ${r.rowNum} ➜</div>
            ${r.left ? `
              <div style="display: flex; gap: 4px;">
                ${r.left.map(s => renderCell(s)).join('')}
              </div>
            ` : `
              <div style="display: flex; gap: 4px; visibility: hidden;" aria-hidden="true">
                <div class="seat-cell">000</div>
                <div class="seat-cell">000</div>
                <div class="seat-cell">000</div>
                <div class="seat-cell">000</div>
              </div>
            `}
            <div style="font-size: 12px; color: #94a3b8; padding: 0 4px;">➜</div>
            ${r.right ? `
              <div style="display: flex; gap: 4px;">
                ${r.right.map(s => renderCell(s)).join('')}
              </div>
            ` : `
              <div style="display: flex; gap: 4px; visibility: hidden;" aria-hidden="true">
                <div class="seat-cell">000</div>
                <div class="seat-cell">000</div>
                <div class="seat-cell">000</div>
                <div class="seat-cell">000</div>
              </div>
            `}
          </div>
        `).join('')}
      </div>
    `;
  } else if (room.blocks) {
    // คอลัมน์บล็อก (ห้อง 1, 2, 3, 4, 6, 8, 9)
    desksHtml = `
      <div style="display: flex; justify-content: center; gap: 28px; width: 100%; margin-top: 10px; flex-wrap: wrap;">
        ${room.blocks.map(block => `
          <div style="display: flex; flex-direction: column; align-items: center; border: 1.5px dashed #CBD5E1; padding: 10px 14px; border-radius: 8px; background: #F8FAFC; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
            <div style="font-size: 11.5px; color: #475569; margin-bottom: 6px; font-weight: 700;">${block.name}</div>
            <div style="display: flex; gap: 6px;">
              ${block.columns.map((col, cIdx) => `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                  <span style="font-size: 10px; color: #94A3B8; line-height: 1;">⬇️</span>
                  ${col.map(s => renderCell(s)).join('')}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    // Fallback Grid
    const sStart = room.seatStart || 1;
    const sEnd = room.seatEnd || (sStart + (room.capacity || 40) - 1);
    const seatsArr = [];
    for (let s = sStart; s <= sEnd; s++) seatsArr.push(s);
    desksHtml = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); gap: 6px; padding: 10px; max-width: 500px; margin: 0 auto;">
        ${seatsArr.map(s => renderCell(s)).join('')}
      </div>
    `;
  }

  return `
    <div class="seating-plan-room-box" style="width: 100%; box-sizing: border-box; border: 1.5px solid var(--border-subtle, #E2E8F0); border-radius: 10px; background: var(--bg-surface, #FFFFFF); box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden;">
      <!-- Front Wall (จอโปรเจคเตอร์ & ประตูทางเข้า/ออก จัดวาง 3 ส่วน สวยงาม ไม่ซ้อนทับกันเด็ดขาด) -->
      <div class="room-wall-front" style="display: flex; justify-content: space-between; align-items: center; width: 100%; min-height: 42px; padding: 6px 16px; border-bottom: 2px solid var(--border-subtle, #E2E8F0); background: var(--bg-surface-elevated, #F8FAFC); gap: 12px; box-sizing: border-box;">
        <!-- ประตูซ้าย -->
        <div style="flex: 1 1 0%; display: flex; justify-content: flex-start; align-items: center; min-width: 0;">
          ${(isFrontBoth || isLeftSide) ? `<div class="door-badge door-left" style="white-space: nowrap; font-size: 11.5px; padding: 4px 10px; border-radius: 5px; background: #FEF3C7; border: 1px solid #F59E0B; color: #92400E; font-weight: 700;">🚪 ประตูทางเข้า/ออก (${isLeftSide ? 'ฝั่งซ้าย' : 'ซ้าย'})</div>` : '<div style="visibility: hidden;">🚪</div>'}
        </div>

        <!-- จอโปรเจคเตอร์ตรงกลาง -->
        <div style="flex: 2 1 auto; display: flex; justify-content: center; align-items: center; min-width: 0;">
          <div class="projector-screen-badge" style="white-space: nowrap; font-size: 12.5px; font-weight: 800; background: #EDE9FE; border: 1.5px solid #7C3AED; color: #5B21B6; padding: 5px 18px; border-radius: 6px; box-shadow: 0 1px 3px rgba(124,58,237,0.18);">
            📽️ จอโปรเจคเตอร์ & บอร์ดหน้าห้องสอบ
          </div>
        </div>

        <!-- ประตูขวา -->
        <div style="flex: 1 1 0%; display: flex; justify-content: flex-end; align-items: center; min-width: 0;">
          ${(isFrontBoth || isRightSide) ? `<div class="door-badge door-right" style="white-space: nowrap; font-size: 11.5px; padding: 4px 10px; border-radius: 5px; background: #FEF3C7; border: 1px solid #F59E0B; color: #92400E; font-weight: 700;">🚪 ประตูทางเข้า/ออก (${isRightSide ? 'ฝั่งขวา' : 'ขวา'})</div>` : '<div style="visibility: hidden;">🚪</div>'}
        </div>
      </div>

      <!-- Main Room Area with Full-Width Desks Container -->
      <div class="room-main-area" style="padding: 18px 16px; width: 100%; display: flex; flex-direction: column; align-items: center; box-sizing: border-box; background: var(--bg-surface, #FFFFFF);">
        <div class="room-desks-container" style="width: 100%; overflow-x: auto; display: flex; justify-content: center; padding: 4px 0;">
          ${desksHtml}
        </div>
        ${(disabledSet.size > 0 || accessibleSet.size > 0) ? `
          <div style="display: flex; justify-content: center; gap: 18px; margin-top: 14px; font-size: 11.5px; color: #64748B; flex-wrap: wrap; padding-top: 10px; border-top: 1px dashed #E2E8F0; width: 100%;">
            <span style="display: flex; align-items: center; gap: 5px;">
              <span style="width: 14px; height: 12px; border: 1.5px solid var(--primary-300, #CBD5E1); border-radius: 2px; display: inline-block; background: #FFFFFF;"></span> ใช้งานปกติ
            </span>
            ${disabledSet.size > 0 ? `
              <span style="display: flex; align-items: center; gap: 5px;">
                <span style="width: 14px; height: 12px; border: 1.5px solid #EF4444; border-radius: 2px; display: inline-block; background: #FEE2E2;"></span> 🚫 ปิดที่นั่ง (${disabledSet.size} ที่)
              </span>
            ` : ''}
            ${accessibleSet.size > 0 ? `
              <span style="display: flex; align-items: center; gap: 5px;">
                <span style="width: 14px; height: 12px; border: 1.5px solid #3B82F6; border-radius: 2px; display: inline-block; background: #EFF6FF;"></span> ♿ คนพิการ (${accessibleSet.size} ที่)
              </span>
            ` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * พิมพ์ชุดป้ายติดบอร์ดหน้าห้องสอบจริง (Door Signs & Seating Charts & Regulations)
 * ตามภาพถ่ายหน้าห้องสอบจริงของ สำนักงาน ก.พ. / มหาวิทยาลัย:
 * 1. ป้ายหัวห้องสอบตัวโต (ห้องสอบที่ X, เลขที่นั่งสอบที่ Y - Z)
 * 2. แผนผังห้องสอบ (Seating Plan แสดงโต๊ะและเลขที่นั่ง)
 * 3. ป้ายห้ามนำเข้าห้องสอบ (สำนักงาน ก.พ.)
 * 4. ป้ายสิ่งที่อนุญาตให้นำเข้าห้องสอบได้ (สำนักงาน ก.พ.)
 * @param {Object} params
 * @param {import('../data/models.js').Room[]} params.rooms
 * @param {import('../data/models.js').ExamSession[]} params.sessions
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} params.settings
 * @param {string} [params.targetRoomId] - พิมพ์เฉพาะห้องที่ระบุ หรือทั้งหมด
 */
export function openPrintableDoorSignsAndSeatingPlan({ rooms, sessions, settings, targetRoomId = null }) {
  const targetRooms = targetRoomId
    ? rooms.filter(r => r.id === targetRoomId)
    : rooms.filter(r => r.isActive !== false);

  if (targetRooms.length === 0) {
    alert('ไม่พบห้องสอบที่ต้องการพิมพ์');
    return;
  }

  let html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>ชุดป้ายติดบอร์ดหน้าห้องสอบและผังที่นั่งสอบ (สำนักงาน ก.พ.)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Sarabun', sans-serif;
    }
    body {
      margin: 0;
      color: #0f172a;
      background: #f1f5f9;
      font-size: 13pt;
      line-height: 1.4;
    }
    .page-sheet {
      background: white;
      padding: 30px;
      margin: 20px auto;
      max-width: 210mm;
      min-height: 297mm;
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
      page-break-after: always;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    @media print {
      body { background: white; }
      .page-sheet {
        margin: 0;
        padding: 20px;
        box-shadow: none;
        page-break-after: always;
      }
      .no-print { display: none !important; }
    }

    /* แผ่นที่ 1: ป้ายหัวห้องสอบขนาดใหญ่ (Room Header Sign) */
    .door-sign-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      text-align: center;
      padding: 40px 20px;
    }
    .door-sign-room-title {
      font-size: 58pt;
      font-weight: 800;
      color: #000;
      letter-spacing: -1px;
      margin-bottom: 50px;
      line-height: 1.1;
    }
    .door-sign-seat-range {
      font-size: 42pt;
      font-weight: 800;
      color: #000;
      letter-spacing: -0.5px;
      line-height: 1.2;
    }
    .door-sign-meta {
      margin-top: 70px;
      font-size: 15pt;
      color: #475569;
      font-weight: 600;
    }

    /* แผ่นที่ 2: แผนผังห้องสอบ (Room Seating Plan) */
    .plan-header {
      text-align: center;
      margin-bottom: 12px;
    }
    .plan-header h2 {
      margin: 0;
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
    }
    .plan-header p {
      margin: 3px 0 0 0;
      font-size: 12pt;
      color: #475569;
      font-weight: 600;
    }
    .seating-plan-room-box {
      border: 2px solid #0f172a;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .room-wall-front {
      border-bottom: 2px solid #334155;
      padding-bottom: 8px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      position: relative;
    }
    .projector-screen-badge {
      background: #f1f5f9;
      border: 1px solid #94a3b8;
      border-radius: 6px;
      padding: 4px 16px;
      font-size: 11pt;
      font-weight: 700;
      color: #1e293b;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .door-badge {
      font-size: 9.5pt;
      color: #475569;
      font-weight: 600;
      border: 1px dashed #94a3b8;
      padding: 2px 8px;
      border-radius: 4px;
      background: #f8fafc;
      white-space: nowrap;
    }
    .room-main-area {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .side-doors {
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      height: 70%;
      padding: 0 4px;
    }
    .room-desks-container {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .seat-cell {
      width: 32px;
      height: 22px;
      border: 1px solid #1e293b;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
      border-radius: 2px;
    }
    .seat-cell.seat-cell-compact {
      width: 25px;
      height: 20px;
      font-size: 8.5pt;
    }

    /* แผ่นที่ 3 & 4: ป้ายระเบียบ ก.พ. (ห้ามนำเข้า / สิ่งที่อนุญาต) */
    .reg-poster {
      border: 3px solid #dc2626;
      border-radius: 12px;
      padding: 24px;
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      background: #ffffff;
    }
    .reg-poster.allowed {
      border-color: #16a34a;
    }
    .reg-title-box {
      border: 2px solid #dc2626;
      border-radius: 8px;
      padding: 10px 20px;
      text-align: center;
      margin-bottom: 24px;
    }
    .reg-poster.allowed .reg-title-box {
      border-color: #16a34a;
    }
    .reg-title-box h1 {
      margin: 0;
      font-size: 30pt;
      font-weight: 800;
      color: #dc2626;
      letter-spacing: 0.5px;
    }
    .reg-poster.allowed .reg-title-box h1 {
      color: #16a34a;
    }
    .reg-body-grid {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 24px;
      align-items: center;
      flex: 1;
    }
    .reg-icon-box {
      border: 2px solid #cbd5e1;
      border-radius: 10px;
      padding: 16px;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f8fafc;
    }
    .reg-cross-line {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .reg-desc-text {
      font-size: 15.5pt;
      line-height: 1.6;
      color: #1e293b;
      font-weight: 600;
    }
    .reg-allowed-list {
      font-size: 16pt;
      line-height: 1.8;
      color: #0f172a;
      font-weight: 700;
      padding-left: 0;
      list-style-type: none;
    }
    .reg-allowed-list li {
      margin-bottom: 12px;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .ocsc-badge {
      position: absolute;
      bottom: 20px;
      right: 24px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12pt;
      font-weight: 700;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="no-print" style="position: fixed; top: 12px; right: 12px; background: white; padding: 12px 18px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; display: flex; gap: 10px; align-items: center;">
    <span style="font-weight: 700; font-size: 14px;">🪧 เอกสารพร้อมพิมพ์ (${targetRooms.length} ห้อง)</span>
    <button onclick="window.print()" style="padding: 8px 16px; background: #7c3aed; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 14px;">🖨️ สั่งพิมพ์เอกสารทั้งหมด</button>
  </div>
`;

  // วนลูปสร้างเอกสารของแต่ละห้อง (แผ่นที่ 1: ป้ายหัวห้อง, แผ่นที่ 2: แผนผังที่นั่งสอบ)
  targetRooms.forEach(room => {
    // แผ่นที่ 1: ป้ายหัวห้องสอบตัวโต
    html += `
  <div class="page-sheet">
    <div class="door-sign-container">
      <div class="door-sign-room-title">
        ห้องสอบที่ ${room.roomNumber || room.id.replace('R', '')}
      </div>
      <div class="door-sign-seat-range">
        เลขที่นั่งสอบที่ ${room.seatStart || 1} - ${room.seatEnd || room.capacity}
      </div>
      <div class="door-sign-meta">
        ${room.name} • ${room.building} (ชั้น ${room.floor}) • ความจุ ${room.capacity} ที่นั่ง
      </div>
    </div>
  </div>
`;

    // แผ่นที่ 2: แผนผังห้องสอบ (Seating Plan)
    html += `
  <div class="page-sheet">
    <div class="plan-header">
      <h2>แผนผังห้องสอบที่ ${room.roomNumber || room.id.replace('R', '')} (ห้อง ${room.roomCode || room.name})</h2>
      <p>จำนวน ${room.capacity} ที่นั่ง เริ่มที่ ${room.seatStart || 1} ถึง ${room.seatEnd || room.capacity}</p>
    </div>
    ${renderSeatingPlanInnerDiagram(room)}
    <div style="margin-top: 10px; font-size: 10.5pt; color: #64748b; text-align: center;">
      * หมายเหตุ: กรรมการคุมสอบกรุณาตรวจสอบผู้เข้าสอบให้นั่งตรงตามเลขที่นั่งสอบที่กำหนดไว้ในผังห้องสอบนี้
    </div>
  </div>
`;
  });

  // แผ่นที่ 3: ป้ายห้ามนำเข้าห้องสอบ (สำนักงาน ก.พ.)
  html += `
  <div class="page-sheet">
    <div class="reg-poster">
      <div class="reg-title-box">
        <h1>ห้ามนำเข้าห้องสอบ</h1>
      </div>
      <div class="reg-body-grid">
        <div class="reg-icon-box">
          <svg class="reg-cross-line" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1="0" x2="100" y2="100" stroke="#dc2626" stroke-width="3" />
            <line x1="100" y1="0" x2="0" y2="100" stroke="#dc2626" stroke-width="3" />
          </svg>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: center; font-size: 12pt; font-weight: 700; color: #475569; position: relative; z-index: 1;">
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">📱 โทรศัพท์มือถือ</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">⌚ นาฬิกาทุกชนิด</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">📷 กล้องถ่ายภาพ</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">🎙️ เครื่องบันทึกเสียง</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">🧮 เครื่องคำนวณ</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">📚 หนังสือ / ตำรา</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">👜 กระเป๋า / เป้</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">📻 วิทยุสื่อสาร</div>
          </div>
        </div>
        <div>
          <div class="reg-desc-text">
            เครื่องมือสื่อสาร เครื่องบันทึกภาพ<br>
            เครื่องบันทึกเสียง อุปกรณ์ที่ใช้คำนวณได้<br>
            อุปกรณ์อิเล็กทรอนิกส์ นาฬิกาทุกชนิด<br>
            รวมทั้งเอกสาร ตำรา หนังสือ<br>
            บันทึกข้อความ กระเป๋า หรืออุปกรณ์อื่นใด<br>
            นอกเหนือจากที่กำหนดในระเบียบฯ
          </div>
        </div>
      </div>
      <div class="ocsc-badge">
        🏛️ สำนักงาน ก.พ. (Office of the Civil Service Commission)
      </div>
    </div>
  </div>
`;

  // แผ่นที่ 4: ป้ายสิ่งที่อนุญาตให้นำเข้าห้องสอบได้ (สำนักงาน ก.พ.)
  html += `
  <div class="page-sheet">
    <div class="reg-poster allowed">
      <div class="reg-title-box">
        <h1>สิ่งที่อนุญาตให้นำเข้าห้องสอบได้</h1>
      </div>
      <div class="reg-body-grid">
        <div style="display: flex; flex-direction: column; gap: 10px; background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 10px; padding: 16px;">
          <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #86efac; font-weight: 700; color: #166534;">
            <span style="color: #16a34a; font-size: 18pt;">✔️</span> 🪪 บัตรประจำตัวประชาชน
          </div>
          <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #86efac; font-weight: 700; color: #166534;">
            <span style="color: #16a34a; font-size: 18pt;">✔️</span> 📄 บัตรประจำตัวสอบ
          </div>
          <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #86efac; font-weight: 700; color: #166534;">
            <span style="color: #16a34a; font-size: 18pt;">✔️</span> 🏷️ บัตรหมายเลขที่นั่งสอบ
          </div>
          <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #86efac; font-weight: 700; color: #166534;">
            <span style="color: #16a34a; font-size: 18pt;">✔️</span> ✏️ ปากกา ดินสอ ยางลบ
          </div>
          <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #86efac; font-weight: 700; color: #166534;">
            <span style="color: #16a34a; font-size: 18pt;">✔️</span> 🔑 กุญแจตู้เก็บของ (ถ้ามี)
          </div>
        </div>
        <div>
          <ol class="reg-allowed-list">
            <li><span>1.</span> <div><strong>บัตรประจำตัวประชาชน</strong><br><span style="font-size: 13pt; font-weight: 500; color: #475569;">หรือบัตรอื่นตามระเบียบฯ</span></div></li>
            <li><span>2.</span> <div><strong>บัตรประจำตัวสอบ</strong></div></li>
            <li><span>3.</span> <div><strong>บัตรหมายเลขที่นั่งสอบ</strong></div></li>
            <li><span>4.</span> <div><strong>ปากกา ดินสอ ยางลบ</strong> <span style="font-size: 13pt; font-weight: 500; color: #475569;">(สำหรับทด)</span></div></li>
            <li><span>5.</span> <div><strong>กุญแจตู้เก็บของ</strong> <span style="font-size: 13pt; font-weight: 500; color: #475569;">(ถ้ามี)</span></div></li>
          </ol>
        </div>
      </div>
      <div class="ocsc-badge" style="background: #dcfce7; border-color: #22c55e; color: #166534;">
        🏛️ สำนักงาน ก.พ. (Office of the Civil Service Commission)
      </div>
    </div>
  </div>
`;

  html += `
</body>
</html>`;

  renderAndPrintHTML(html);
}

/**
 * สร้างเนื้อหาเอกสารบันทึกข้อความขออนุมัติเปลี่ยนตัว / สลับหน้าที่กรรมการกำกับการสอบ
 * ออกเอกสารในนาม: ผศ.ดร.ณัฐพล แสนคำ (ผู้ช่วยศาสตราจารย์ ดร.ณัฐพล แสนคำ)
 */
export function renderSwapMemoDocumentHtml({ swaps = [], docNumber = 'บส. 001/2569', issuedDate = null, note = '', settings = null } = {}) {
  const escHtml = (val) => String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const uniName = settings?.project?.universityName || 'มหาวิทยาลัยราชภัฏบุรีรัมย์';
  const campusLoc = settings?.project?.campusLocation || 'ศูนย์ทดสอบด้วยระบบคอมพิวเตอร์ (CBT) อาคาร 17 มหาวิทยาลัยราชภัฏบุรีรัมย์';
  const dateIso = issuedDate ? String(issuedDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const thaiDateStr = formatThaiDate(dateIso, true);
  const roleLabel = (role) => role === 'chief' ? 'หัวหน้าห้องสอบ' : (role === 'reserve' ? 'ผู้คุมสอบสำรอง' : 'กรรมการกำกับการสอบ');
  const typeLabel = (t) => t === 'SWAP' ? 'สลับตัว' : (t === 'MOVE' ? 'ย้ายตำแหน่ง' : 'เปลี่ยนตัว');

  const involvedNames = [];
  const seenNames = new Set();
  const addInvolved = (name) => {
    const clean = (name || '').trim();
    if (clean && !seenNames.has(clean)) {
      seenNames.add(clean);
      involvedNames.push(clean);
    }
  };
  for (const sw of swaps) {
    addInvolved(sw.fromProctorName);
    addInvolved(sw.toProctorName);
  }

  const rowsHtml = swaps.map((sw, idx) => {
    const sessionDateText = sw.sessionDate ? formatThaiDate(sw.sessionDate) : '-';
    const sessionTimeText = (sw.sessionStartTime && sw.sessionEndTime)
      ? formatThaiTimeRange(sw.sessionStartTime, sw.sessionEndTime)
      : '';
    const sessionBlock = `
      <div style="font-weight: 700; color: #1e293b;">${escHtml(sw.sessionId || '')}${sw.sessionName ? ': ' + escHtml(sw.sessionName) : ''}</div>
      <div style="font-size: 11px; color: #475569;">${escHtml(sessionDateText)}${sessionTimeText ? ' (' + escHtml(sessionTimeText) + ')' : ''}</div>
    `;

    let detailHtml = '';
    if (sw.type === 'SWAP') {
      const targetSessionDiff = sw.targetSessionId && sw.targetSessionId !== sw.sessionId;
      detailHtml = `
        <div style="line-height: 1.55;">
          <div><strong>1) ${escHtml(sw.fromProctorName)}</strong> <span style="color:#475569;">(${escHtml(sw.fromRoomLabel)} • ${escHtml(roleLabel(sw.fromRole))})</span></div>
          <div style="color: #3B1F54; font-weight: 700; margin: 2px 0;">⇄ สลับหน้าที่กับ</div>
          <div><strong>2) ${escHtml(sw.toProctorName)}</strong> <span style="color:#475569;">(${targetSessionDiff ? escHtml(sw.targetSessionId) + ' • ' : ''}${escHtml(sw.toRoomLabel)} • ${escHtml(roleLabel(sw.toRole))})</span></div>
        </div>
      `;
    } else if (sw.type === 'MOVE') {
      const targetSessionDiff = sw.targetSessionId && sw.targetSessionId !== sw.sessionId;
      detailHtml = `
        <div style="line-height: 1.55;">
          <div><strong>${escHtml(sw.fromProctorName)}</strong></div>
          <div style="font-size: 12px; color: #475569;">
            เดิม: ${escHtml(sw.fromRoomLabel)} (${escHtml(roleLabel(sw.fromRole))})<br>
            <strong style="color: #3B1F54;">ย้ายไป:</strong> ${targetSessionDiff ? escHtml(sw.targetSessionId) + ' • ' : ''}${escHtml(sw.toRoomLabel)} (${escHtml(roleLabel(sw.toRole))})
          </div>
        </div>
      `;
    } else {
      detailHtml = `
        <div style="line-height: 1.55;">
          <div><span style="color:#64748b;">ผู้คุมเดิม:</span> ${escHtml(sw.fromProctorName || '-')}</div>
          <div><strong style="color: #3B1F54;">ผู้ปฏิบัติหน้าที่แทน:</strong> <strong>${escHtml(sw.toProctorName || '-')}</strong></div>
          <div style="font-size: 11.5px; color: #475569;">${escHtml(sw.toRoomLabel || sw.fromRoomLabel || '-')} • ${escHtml(roleLabel(sw.toRole || sw.fromRole))}</div>
        </div>
      `;
    }

    return `
      <tr>
        <td style="text-align: center; vertical-align: top; font-weight: 600;">${idx + 1}</td>
        <td style="text-align: center; vertical-align: top;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 700; background: #f3eff7; color: #3B1F54; border: 1px solid #d9cce8;">
            ${escHtml(typeLabel(sw.type))}
          </span>
        </td>
        <td style="vertical-align: top;">${sessionBlock}</td>
        <td style="vertical-align: top;">${detailHtml}</td>
        <td style="vertical-align: top; font-size: 12px; color: #334155;">${escHtml(sw.reason || 'ปรับเปลี่ยนเพื่อความเหมาะสม')}</td>
      </tr>
    `;
  }).join('');

  const logoHtml = (typeof BRU_LOGO_DATA_URI !== 'undefined' && BRU_LOGO_DATA_URI)
    ? `<img src="${BRU_LOGO_DATA_URI}" alt="ตราประจำมหาวิทยาลัยราชภัฏบุรีรัมย์" style="height: 58px; width: auto; object-fit: contain; flex-shrink: 0;" />`
    : `<div style="width: 48px; height: 48px; border-radius: 50%; background: #3B1F54; color: #E5A823; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; border: 2px solid #E5A823; flex-shrink: 0;">BRU</div>`;

  return `
    <div class="swap-memo-sheet" style="font-family: 'Sarabun', sans-serif; color: #0f172a; background: #ffffff; padding: 28px 32px; border: 1px solid #cbd5e1; border-radius: 4px; line-height: 1.65; font-size: 14px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #3B1F54; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${logoHtml}
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #3B1F54; letter-spacing: 0.5px;">บันทึกข้อความ</div>
            <div style="font-size: 12px; color: #475569;">${escHtml(uniName)} &bull; ศูนย์สอบคอมพิวเตอร์ (CBT) อาคาร 17</div>
          </div>
        </div>
        <div style="text-align: right; font-size: 12px; color: #475569;">
          <div><strong>เลขที่เอกสาร:</strong> <span style="color: #3B1F54; font-weight: 700;">${escHtml(docNumber)}</span></div>
          <div>แบบฟอร์มขอเปลี่ยนตัว/สลับหน้าที่ผู้คุมสอบ</div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 16px; font-size: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 12px;">
        <div><strong>ส่วนราชการ</strong>&nbsp;&nbsp;${escHtml(campusLoc)}</div>
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div><strong>ที่</strong>&nbsp;&nbsp;${escHtml(docNumber)}</div>
          <div><strong>วันที่</strong>&nbsp;&nbsp;${escHtml(thaiDateStr)}</div>
        </div>
        <div><strong>เรื่อง</strong>&nbsp;&nbsp;ขออนุมัติเปลี่ยนตัว / สลับหน้าที่กรรมการกำกับการสอบด้วยระบบคอมพิวเตอร์ (CBT)</div>
        <div><strong>เรียน</strong>&nbsp;&nbsp;<strong>ผศ.ดร.ณัฐพล แสนคำ</strong> <span style="color: #475569;">(ผู้ช่วยศาสตราจารย์ ดร.ณัฐพล แสนคำ — ผู้อนุมัติ)</span></div>
        <div><strong>จาก</strong>&nbsp;&nbsp;เจ้าหน้าที่ผู้รับผิดชอบจัดตารางกรรมการกำกับการสอบ ศูนย์สอบคอมพิวเตอร์ (CBT) อาคาร 17</div>
      </div>

      <p style="text-indent: 36px; margin: 0 0 14px 0; text-align: justify;">
        ตามที่ศูนย์ทดสอบด้วยระบบคอมพิวเตอร์ (CBT) ${escHtml(uniName)} ได้ดำเนินการจัดตารางกรรมการกำกับการสอบประจำห้องสอบนั้น
        เพื่อให้การปฏิบัติหน้าที่กำกับการสอบเป็นไปด้วยความเรียบร้อย ครบถ้วน และเป็นไปตามกฎเกณฑ์ของศูนย์สอบ
        จึงขอเสนอขออนุมัติเปลี่ยนตัว / สลับหน้าที่กรรมการกำกับการสอบ จำนวน <strong>${swaps.length}</strong> รายการ
        ดังรายละเอียดปรากฏตามตารางด้านล่างนี้
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 13px;">
        <thead>
          <tr style="background: #f3eff7; color: #3B1F54;">
            <th style="border: 1px solid #94a3b8; padding: 7px 6px; width: 44px; text-align: center;">ลำดับ</th>
            <th style="border: 1px solid #94a3b8; padding: 7px 6px; width: 82px; text-align: center;">ประเภท</th>
            <th style="border: 1px solid #94a3b8; padding: 7px 8px; width: 175px; text-align: left;">รอบสอบและวันเวลา</th>
            <th style="border: 1px solid #94a3b8; padding: 7px 8px; text-align: left;">รายละเอียดการเปลี่ยนตัว / สลับหน้าที่</th>
            <th style="border: 1px solid #94a3b8; padding: 7px 8px; width: 150px; text-align: left;">หมายเหตุ / เหตุผล</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `
            <tr>
              <td colspan="5" style="border: 1px solid #94a3b8; padding: 14px; text-align: center; color: #64748b;">
                ไม่มีรายการเปลี่ยนตัว / สลับหน้าที่
              </td>
            </tr>
          `}
        </tbody>
      </table>

      ${note ? `
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-left: 3px solid #3B1F54; padding: 8px 12px; margin-bottom: 14px; font-size: 13px;">
          <strong>หมายเหตุเพิ่มเติม:</strong> ${escHtml(note)}
        </div>
      ` : ''}

      <p style="text-indent: 36px; margin: 0 0 18px 0;">
        จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ และขอให้กรรมการกำกับการสอบผู้เกี่ยวข้องลงลายมือชื่อรับทราบการเปลี่ยนแปลงหน้าที่ดังกล่าว
      </p>

      ${involvedNames.length > 0 ? `
        <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 12px 16px; margin-bottom: 22px; background: #fafafa;">
          <div style="font-weight: 700; color: #3B1F54; font-size: 13px; margin-bottom: 10px;">
            ส่วนที่ 1: ลงนามรับทราบและยินยอมการเปลี่ยนตัว / สลับหน้าที่ (กรรมการกำกับการสอบ)
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 20px;">
            ${involvedNames.slice(0, 8).map((name, i) => `
              <div style="font-size: 12.5px; text-align: center; padding-top: 8px;">
                <div>(ลงชื่อ) ..................................................</div>
                <div style="margin-top: 3px; font-weight: 600;">(${escHtml(name)})</div>
                <div style="font-size: 11px; color: #64748b;">กรรมการผู้เกี่ยวข้องลำดับที่ ${i + 1} &nbsp; วันที่ ......./......./.......</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 12px;">
        <div style="text-align: center; padding: 12px 10px; border: 1px dashed #cbd5e1; border-radius: 4px;">
          <div style="font-weight: 700; font-size: 13px; color: #3B1F54; margin-bottom: 18px;">ส่วนที่ 2: ผู้เสนอขอเปลี่ยนตัว / สลับหน้าที่</div>
          <div>(ลงชื่อ) ........................................................</div>
          <div style="margin-top: 4px;">(........................................................)</div>
          <div style="font-size: 12px; color: #475569;">ผู้รับผิดชอบจัดตารางกรรมการกำกับการสอบ</div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">วันที่ ${escHtml(thaiDateStr)}</div>
        </div>

        <div style="text-align: center; padding: 12px 10px; border: 1px dashed #cbd5e1; border-radius: 4px;">
          <div style="font-weight: 700; font-size: 13px; color: #3B1F54; margin-bottom: 6px;">ส่วนที่ 3: ความเห็นผู้อนุมัติ</div>
          <div style="font-size: 12.5px; margin-bottom: 12px;">&#9744; อนุมัติ &nbsp;&nbsp;&nbsp;&nbsp; &#9744; ไม่อนุมัติ</div>
          <div>(ลงชื่อ) ........................................................</div>
          <div style="font-weight: 700; margin-top: 4px;">(ผู้ช่วยศาสตราจารย์ ดร.ณัฐพล แสนคำ)</div>
          <div style="font-size: 12px; color: #475569;">ผศ.ดร.ณัฐพล แสนคำ &bull; ผู้อนุมัติ</div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">วันที่ ......./......./.............</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * เปิดหน้าต่างพิมพ์ / บันทึก PDF เอกสารบันทึกข้อความเปลี่ยนตัว-สลับหน้าที่ผู้คุมสอบ
 */
export function openPrintableSwapMemo({ swaps = [], docNumber = 'บส. 001/2569', issuedDate = null, note = '', settings = null } = {}) {
  const innerHtml = renderSwapMemoDocumentHtml({ swaps, docNumber, issuedDate, note, settings });
  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>บันทึกข้อความขอเปลี่ยนตัว/สลับหน้าที่ผู้คุมสอบ (${docNumber})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; font-family: 'Sarabun', sans-serif; }
    body { margin: 0; background: #f1f5f9; padding: 16px; color: #0f172a; }
    .print-wrap { max-width: 210mm; margin: 0 auto; }
    .no-print-bar {
      max-width: 210mm;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #3B1F54;
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13px;
    }
    .no-print-bar button {
      background: #E5A823;
      color: #1F1230;
      border: none;
      padding: 7px 16px;
      border-radius: 6px;
      font-weight: 700;
      font-family: 'Sarabun', sans-serif;
      cursor: pointer;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .no-print-bar { display: none !important; }
      .swap-memo-sheet { border: none !important; padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span>เอกสารบันทึกข้อความขอเปลี่ยนตัว / สลับหน้าที่ผู้คุมสอบ — เลขที่ ${docNumber} (ผู้อนุมัติ: ผศ.ดร.ณัฐพล แสนคำ)</span>
    <button onclick="window.print()">🖨️ พิมพ์ / บันทึกเป็น PDF</button>
  </div>
  <div class="print-wrap">
    ${innerHtml}
  </div>
</body>
</html>`;

  renderAndPrintHTML(html);
}

/**
 * แปลงตัวเลขเป็นเลขไทย ๐-๙
 * @param {string|number} val
 * @returns {string}
 */
export function toThaiDigits(val) {
  if (val == null) return '';
  const digits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  return String(val).replace(/[0-9]/g, (d) => digits[+d]);
}

/**
 * สร้าง HTML สำหรับพิมพ์คำสั่งแต่งตั้งคณะกรรมการกำกับการสอบภาคความรู้ความสามารถทั่วไป (ก.พ.)
 * อ้างอิงตามแบบฟอร์มทางการของ มหาวิทยาลัยราชภัฏบุรีรัมย์ ฉบับตราครุฑ
 * @param {Object} params
 * @param {import('../data/models.js').ProctorAssignment[]} params.assignments
 * @param {import('../data/models.js').ExamSession[]} params.sessions
 * @param {import('../data/models.js').Proctor[]} params.proctors
 * @param {import('../data/models.js').Room[]} params.rooms
 * @param {import('../data/models.js').RoomAllocation[]} [params.allocations]
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} [params.settings]
 * @param {string} [params.orderNumber]
 * @param {string|Date} [params.issueDate]
 * @param {string} [params.approverName]
 * @param {string} [params.approverRole]
 * @returns {string}
 */
export function renderAppointmentOrderHtml({
  assignments = [],
  sessions = [],
  proctors = [],
  rooms = [],
  allocations = [],
  settings = null,
  orderNumber = '',
  issueDate = null,
  approverName = '',
  approverRole = ''
}) {
  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));
  const proctorMap = new Map((proctors || []).map(p => [p.id, p]));
  const roomMap = new Map((rooms || []).map(r => [r.id, r]));
  const allocMap = new Map((allocations || []).map(a => [a.id, a]));

  const escHtml = (val) => String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // กำหนดปี พ.ศ. และช่วงวันที่สอบ
  const dates = [...new Set((sessions || []).map(s => s.date).filter(Boolean))].sort();
  let examYearBE = 2569;
  if (dates.length > 0) {
    const dObj = new Date(dates[0]);
    if (!isNaN(dObj.getTime())) {
      examYearBE = dObj.getFullYear() + 543;
    }
  }

  // คำนวณช่วงวันที่สอบ เช่น "๒๗ - ๒๙ มีนาคม พ.ศ. ๒๕๖๙"
  let dateRangeText = `๒๗ - ๒๙ มีนาคม พ.ศ. ${toThaiDigits(examYearBE)}`;
  if (dates.length > 0) {
    const dStart = new Date(dates[0]);
    const dEnd = new Date(dates[dates.length - 1]);
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const sDay = dStart.getDate();
    const eDay = dEnd.getDate();
    const sMonth = thaiMonths[dStart.getMonth()] || 'มีนาคม';
    const eMonth = thaiMonths[dEnd.getMonth()] || 'มีนาคม';
    const sYear = dStart.getFullYear() + 543;
    const eYear = dEnd.getFullYear() + 543;

    if (dates.length === 1) {
      dateRangeText = `${toThaiDigits(sDay)} ${sMonth} พ.ศ. ${toThaiDigits(sYear)}`;
    } else if (sMonth === eMonth && sYear === eYear) {
      dateRangeText = `${toThaiDigits(sDay)} - ${toThaiDigits(eDay)} ${sMonth} พ.ศ. ${toThaiDigits(sYear)}`;
    } else {
      dateRangeText = `${toThaiDigits(sDay)} ${sMonth} พ.ศ. ${toThaiDigits(sYear)} - ${toThaiDigits(eDay)} ${eMonth} พ.ศ. ${toThaiDigits(eYear)}`;
    }
  }

  // จำนวนห้องสอบ
  const activeRooms = [...(rooms || [])].filter(r => r.isActive !== false).sort((a, b) => {
    const codeA = a.roomCode || a.code || a.id;
    const codeB = b.roomCode || b.code || b.id;
    return codeA.localeCompare(codeB, undefined, { numeric: true });
  });
  const roomCountNum = activeRooms.length || 10;
  const roomCountText = `${toThaiDigits(roomCountNum)} ห้องสอบ`;

  // ผู้อนุมัติ / อธิการบดี
  const finalApproverName = approverName || settings?.project?.presidentName || settings?.project?.approverName || 'รองศาสตราจารย์ ดร.ศิราณี  จุโฑปะมา';
  const finalApproverRole = approverRole || settings?.project?.presidentRole || 'อธิการบดีมหาวิทยาลัยราชภัฏบุรีรัมย์';

  // เลขที่คำสั่ง
  const orderNumberSlot = orderNumber ? `ที่ ${toThaiDigits(orderNumber)}/${toThaiDigits(examYearBE)}` : `ที่ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/${toThaiDigits(examYearBE)}`;

  // วันที่ลงนามคำสั่ง (ตามต้นฉบับ ๑๒ กุมภาพันธ์ พ.ศ. ๒๕๖๙)
  let signDateHtml = `สั่ง ณ วันที่ ๑๒ กุมภาพันธ์ พ.ศ. ${toThaiDigits(examYearBE)}`;
  if (issueDate) {
    const dSign = new Date(issueDate);
    if (!isNaN(dSign.getTime())) {
      const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      const signDay = toThaiDigits(dSign.getDate());
      const signMonth = thaiMonths[dSign.getMonth()];
      const signYear = toThaiDigits(dSign.getFullYear() + 543);
      signDateHtml = `สั่ง ณ วันที่ ${signDay} ${signMonth} พ.ศ. ${signYear}`;
    }
  }

  // รูปแบบเวลา
  const formatTimeRangeThai = (session) => {
    let sTime = '08.00';
    let eTime = '12.30';
    if (session.startTime) {
      const m = String(session.startTime).match(/(\d{1,2}):(\d{2})/);
      if (m) sTime = `${m[1].padStart(2, '0')}.${m[2]}`;
    }
    if (session.endTime) {
      const m = String(session.endTime).match(/(\d{1,2}):(\d{2})/);
      if (m) eTime = `${m[1].padStart(2, '0')}.${m[2]}`;
    }
    return `${toThaiDigits(sTime)} น. - ${toThaiDigits(eTime)} น.`;
  };

  const formatRoundName = (session) => {
    if (session.name.includes('เช้า')) return 'รอบเช้า';
    if (session.name.includes('บ่าย')) return 'รอบบ่าย';
    return session.name;
  };

  // จัดกลุ่มรอบสอบตามวันที่
  const dateSessionMap = new Map();
  for (const s of (sessions || [])) {
    if (!dateSessionMap.has(s.date)) dateSessionMap.set(s.date, []);
    dateSessionMap.get(s.date).push(s);
  }

  // สร้างแถวตาราง
  let tableRowsHtml = '';

  for (const [date, dateSessions] of dateSessionMap.entries()) {
    dateSessions.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));

    const roomRows = [];
    for (const room of activeRooms) {
      const validSessions = dateSessions.filter(s => {
        return assignments.some(a => a.sessionId === s.id && (a.roomId === room.id || (a.allocationId && allocMap.get(a.allocationId)?.roomId === room.id)));
      });
      if (validSessions.length > 0) {
        roomRows.push({ room, sessions: validSessions });
      }
    }

    const reserveSessions = dateSessions.filter(s => {
      return assignments.some(a => a.sessionId === s.id && a.role === 'reserve');
    });

    const dateTotalRows = roomRows.reduce((sum, item) => sum + item.sessions.length, 0) + reserveSessions.length;
    let isFirstRowOfDate = true;

    const dObj = new Date(date);
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const dayVal = !isNaN(dObj.getTime()) ? dObj.getDate() : '';
    const dayStr = toThaiDigits(dayVal);
    const monthStr = !isNaN(dObj.getTime()) ? thaiMonths[dObj.getMonth()] : '';
    const yearStr = toThaiDigits(examYearBE);
    const thaiDateLabel = `${dayStr} ${monthStr} ${yearStr}`;

    for (const { room, sessions: rSessions } of roomRows) {
      const roomCode = room.roomCode || room.code || (room.name.match(/\d{5}/) ? room.name.match(/\d{5}/)[0] : room.name);
      let isFirstRowOfRoom = true;

      for (const s of rSessions) {
        const roomAssigns = assignments.filter(a => {
          return a.sessionId === s.id && (a.roomId === room.id || (a.allocationId && allocMap.get(a.allocationId)?.roomId === room.id));
        });

        roomAssigns.sort((x, y) => {
          if (x.role === 'chief' && y.role !== 'chief') return -1;
          if (x.role !== 'chief' && y.role === 'chief') return 1;
          return (x.orderIndex || 0) - (y.orderIndex || 0);
        });

        const proctorNamesList = roomAssigns.map((a, pIdx) => {
          const p = proctorMap.get(a.proctorId);
          let pName = '-';
          if (p) {
            const title = p.academicTitle ? `${p.academicTitle} ` : (p.title ? `${p.title} ` : '');
            pName = `${title}${p.firstName || ''} ${p.lastName || ''}`.trim();
          }
          const numLabel = toThaiDigits(pIdx + 1);
          return `<div class="proctor-name-item">${numLabel}. ${escHtml(pName)}</div>`;
        }).join('');

        tableRowsHtml += '<tr>';

        if (isFirstRowOfDate) {
          tableRowsHtml += `<td class="cell-center cell-date" rowspan="${dateTotalRows}">${thaiDateLabel}</td>`;
          isFirstRowOfDate = false;
        }

        if (isFirstRowOfRoom) {
          tableRowsHtml += `<td class="cell-center cell-room" rowspan="${rSessions.length}">${escHtml(toThaiDigits(roomCode))}</td>`;
          isFirstRowOfRoom = false;
        }

        tableRowsHtml += `<td class="cell-center cell-round">${escHtml(formatRoundName(s))}</td>`;
        tableRowsHtml += `<td class="cell-center cell-time">${formatTimeRangeThai(s)}</td>`;
        tableRowsHtml += `<td class="cell-left cell-proctors">${proctorNamesList || '-'}</td>`;
        tableRowsHtml += '</tr>\n';
      }
    }

    for (const s of reserveSessions) {
      const reserveAssigns = assignments.filter(a => a.sessionId === s.id && a.role === 'reserve');
      const reserveNamesList = reserveAssigns.map((a, pIdx) => {
        const p = proctorMap.get(a.proctorId);
        let pName = '-';
        if (p) {
          const title = p.academicTitle ? `${p.academicTitle} ` : (p.title ? `${p.title} ` : '');
          pName = `${title}${p.firstName || ''} ${p.lastName || ''}`.trim();
        }
        const numLabel = toThaiDigits(pIdx + 1);
        return `<div class="proctor-name-item">${numLabel}. ${escHtml(pName)} (สำรอง)</div>`;
      }).join('');

      tableRowsHtml += '<tr>';
      if (isFirstRowOfDate) {
        tableRowsHtml += `<td class="cell-center cell-date" rowspan="${dateTotalRows}">${thaiDateLabel}</td>`;
        isFirstRowOfDate = false;
      }
      tableRowsHtml += `<td class="cell-center cell-room">ห้องกองกลาง</td>`;
      tableRowsHtml += `<td class="cell-center cell-round">${escHtml(formatRoundName(s))}</td>`;
      tableRowsHtml += `<td class="cell-center cell-time">${formatTimeRangeThai(s)}</td>`;
      tableRowsHtml += `<td class="cell-left cell-proctors">${reserveNamesList || '-'}</td>`;
      tableRowsHtml += '</tr>\n';
    }
  }

  const garudaUri = (typeof THAI_GARUDA_LOGO_DATA_URI !== 'undefined' && THAI_GARUDA_LOGO_DATA_URI)
    ? THAI_GARUDA_LOGO_DATA_URI
    : '';

  const garudaHtml = garudaUri
    ? `<img src="${garudaUri}" alt="ตราครุฑ" class="garuda-logo" />`
    : `<div style="text-align: center; font-size: 26px; font-weight: bold; margin-bottom: 8px;">[ ตราครุฑ ]</div>`;

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>คำสั่งแต่งตั้งคณะกรรมการกำกับการสอบภาคความรู้ความสามารถทั่วไป (ก.พ.)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 15mm 18mm 15mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Sarabun', sans-serif;
    }
    body {
      margin: 0;
      padding: 0;
      color: #000000;
      background: #f1f5f9;
      font-size: 15px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print-bar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #1e293b;
      color: #ffffff;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      font-size: 14px;
    }
    .no-print-bar .bar-title {
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .no-print-bar .bar-actions {
      display: flex;
      gap: 10px;
    }
    .no-print-bar button {
      cursor: pointer;
      font-family: 'Sarabun', sans-serif;
      font-size: 13.5px;
      font-weight: 700;
      padding: 7px 18px;
      border-radius: 6px;
      border: none;
      transition: all 0.15s;
    }
    .btn-print-order {
      background: #3B1F54;
      color: #ffffff;
      border: 1px solid #7c3aed !important;
    }
    .btn-print-order:hover {
      background: #4c286d;
    }
    .btn-close-order {
      background: #475569;
      color: #ffffff;
    }
    .btn-close-order:hover {
      background: #64748b;
    }

    .document-page-wrap {
      max-width: 210mm;
      margin: 24px auto;
      background: #ffffff;
      padding: 24mm 20mm 24mm 20mm;
      box-shadow: 0 4px 18px rgba(0,0,0,0.1);
      box-sizing: border-box;
    }

    .garuda-logo {
      display: block;
      margin: 0 auto 10px auto;
      height: 96px;
      width: auto;
      object-fit: contain;
    }

    .order-title {
      text-align: center;
      font-size: 19px;
      font-weight: 700;
      line-height: 1.35;
      margin-bottom: 2px;
    }
    .order-number {
      text-align: center;
      font-size: 16px;
      line-height: 1.4;
      margin-bottom: 6px;
    }
    .order-subject {
      text-align: center;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.45;
      max-width: 95%;
      margin: 0 auto;
    }
    .order-divider {
      text-align: center;
      letter-spacing: 2px;
      margin: 6px 0 14px 0;
      font-size: 14px;
    }

    .order-preamble {
      text-align: justify;
      text-justify: inter-cluster;
      text-indent: 52px;
      font-size: 15.5px;
      line-height: 1.6;
      margin-bottom: 16px;
    }

    table.order-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 14.5px;
      line-height: 1.4;
    }
    table.order-table th, table.order-table td {
      border: 1px solid #000000;
      padding: 6px 8px;
      vertical-align: top;
      color: #000000;
    }
    table.order-table th {
      font-weight: 700;
      text-align: center;
      background: #ffffff;
    }
    table.order-table thead {
      display: table-header-group;
    }
    table.order-table tr {
      page-break-inside: avoid;
    }

    .cell-center {
      text-align: center;
    }
    .cell-left {
      text-align: left;
    }
    .cell-date {
      width: 18%;
      vertical-align: top;
      font-weight: 500;
    }
    .cell-room {
      width: 13%;
      vertical-align: top;
      font-weight: 600;
    }
    .cell-round {
      width: 13%;
      vertical-align: top;
    }
    .cell-time {
      width: 21%;
      vertical-align: top;
      white-space: nowrap;
    }
    .cell-proctors {
      width: 35%;
      vertical-align: top;
    }
    .proctor-name-item {
      margin-bottom: 4px;
    }
    .proctor-name-item:last-child {
      margin-bottom: 0;
    }

    .order-duties-block {
      margin-top: 20px;
      font-size: 15.5px;
      line-height: 1.65;
      text-align: justify;
      text-justify: inter-cluster;
      page-break-inside: avoid;
    }
    .order-duties-block p {
      text-indent: 52px;
      margin: 0 0 12px 0;
    }

    .order-signature-block {
      margin-top: 26px;
      page-break-inside: avoid;
      font-size: 15.5px;
      line-height: 1.6;
    }
    .order-date-row {
      text-align: right;
      padding-right: 40px;
      margin-bottom: 30px;
    }
    .order-sign-box {
      width: 340px;
      margin-left: auto;
      text-align: center;
    }

    @media print {
      body {
        background: #ffffff !important;
        font-size: 14.5px;
      }
      .no-print-bar {
        display: none !important;
      }
      .document-page-wrap {
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
        box-shadow: none !important;
        border: none !important;
      }
      table.order-table th {
        background: #ffffff !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div class="bar-title">
      <span>📜 คำสั่งแต่งตั้งคณะกรรมการกำกับการสอบภาคความรู้ความสามารถทั่วไป (ก.พ.) ฉบับทางการ</span>
    </div>
    <div class="bar-actions">
      <button class="btn-print-order" onclick="window.print()">🖨️ สั่งพิมพ์เอกสาร (Print / Save PDF)</button>
      <button class="btn-close-order" onclick="window.close()">✕ ปิดหน้าต่าง</button>
    </div>
  </div>

  <div class="document-page-wrap">
    <!-- ตราครุฑ -->
    ${garudaHtml}

    <!-- หัวเรื่องคำสั่ง -->
    <div class="order-title">คำสั่งมหาวิทยาลัยราชภัฏบุรีรัมย์</div>
    <div class="order-number">${orderNumberSlot}</div>
    <div class="order-subject">
      เรื่อง แต่งตั้งคณะกรรมการกำกับการสอบภาคความรู้ความสามารถทั่วไป ด้วยระบบอิเล็กทรอนิกส์<br>
      ของสำนักงาน ก.พ. ประจำปี ${toThaiDigits(examYearBE)} ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์ ครั้งที่ ๑
    </div>
    <div class="order-divider">------------------------------------------------</div>

    <!-- ข้อความเกริ่นนำ -->
    <div class="order-preamble">
      ด้วย มหาวิทยาลัยราชภัฏบุรีรัมย์ ได้ร่วมกับสำนักงาน ก.พ. ดำเนินงานบริหารการจัดสอบ ภาคความรู้ความสามารถทั่วไป ด้วยระบบอิเล็กทรอนิกส์ของสำนักงาน ก.พ. ประจำปี ${toThaiDigits(examYearBE)} ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์ ครั้งที่ ๑ ระหว่างวันที่ ${dateRangeText} จำนวน ${roomCountText} ณ อาคารนวัตปัญญา มหาวิทยาลัยราชภัฏบุรีรัมย์ ดังนั้น เพื่อให้การกำกับการสอบความรู้ ความสามารถทั่วไป ด้วยระบบอิเล็กทรอนิกส์ของสำนักงาน ก.พ. ประจำปี ${toThaiDigits(examYearBE)} ดำเนินไปด้วยความเรียบร้อย มหาวิทยาลัยฯ จึงแต่งตั้งคณะกรรมการกำกับการสอบภาคความรู้ความสามารถทั่วไป ด้วยระบบอิเล็กทรอนิกส์ของสำนักงาน ก.พ. ประจำปี ${toThaiDigits(examYearBE)} ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์ ดังรายชื่อต่อไปนี้
    </div>

    <!-- ตารางรายชื่ออาจารย์คุมสอบ -->
    <table class="order-table">
      <thead>
        <tr>
          <th style="width: 18%;">วัน/เดือน/ปี<br>ที่สอบ</th>
          <th style="width: 14%;">หมายเลข<br>ห้องสอบ</th>
          <th style="width: 14%;">รอบ<br>การสอบ</th>
          <th style="width: 20%;">เวลา</th>
          <th style="width: 34%;">รายชื่ออาจารย์คุมสอบ</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <!-- ส่วนท้าย: หน้าที่ความรับผิดชอบ -->
    <div class="order-duties-block">
      <p>
        <strong>มีหน้าที่ :</strong> ควบคุม ดูแล และกำกับการสอบห้องสอบในการสอบภาคความรู้ความสามารถทั่วไป ด้วยระบบอิเล็กทรอนิกส์ของสำนักงาน ก.พ. ประจำปี ${toThaiDigits(examYearBE)} ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์ ครั้งที่ ๑ ระหว่างวันที่ ${dateRangeText} ตั้งแต่เวลา ๐๘.๐๐ น. - ๑๗.๓๐ น. ณ ชั้น ๑ และชั้น ๒ อาคารนวัตปัญญา (อาคาร ๑๗) มหาวิทยาลัยราชภัฏบุรีรัมย์ ตามวัน เวลา และสถานที่ที่กำหนดในตารางสอบ เพื่อให้การดำเนินการสอบเป็นไปด้วยความเรียบร้อย รวมถึงแก้ไขปัญหาที่เกิดขึ้นในระหว่างการสอบ
      </p>
      <p>
        ทั้งนี้ ขอให้ผู้ที่ได้รับมอบหมายปฏิบัติหน้าที่อย่างสุดความสามารถ เพื่อให้การดำเนินการกำกับการสอบภาคความรู้ความสามารถทั่วไป ด้วยระบบอิเล็กทรอนิกส์ของสำนักงาน ก.พ. ประจำปี ${toThaiDigits(examYearBE)} ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์ เกิดประสิทธิภาพสูงสุด เพื่อให้เกิดผลดีต่อทางราชการ
      </p>
    </div>

    <!-- ส่วนลงนาม -->
    <div class="order-signature-block">
      <div class="order-date-row">
        ${signDateHtml}
      </div>
      <div class="order-sign-box">
        <div style="height: 48px;"></div>
        <div>(${escHtml(finalApproverName)})</div>
        <div style="font-weight: 600;">${escHtml(finalApproverRole)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function openPrintableAppointmentOrder({
  assignments = [],
  sessions = [],
  proctors = [],
  rooms = [],
  allocations = [],
  settings = null,
  orderNumber = '',
  issueDate = null,
  approverName = '',
  approverRole = ''
}) {
  const html = renderAppointmentOrderHtml({
    assignments,
    sessions,
    proctors,
    rooms,
    allocations,
    settings,
    orderNumber,
    issueDate,
    approverName,
    approverRole
  });
  renderAndPrintHTML(html);
}

/**
 * เปิดหน้าต่างพิมพ์บัตรประจำตัวที่นั่งสอบ (Seat Slips / Desk Cards)
 * วางผังตัด 8 ที่นั่งต่อ 1 หน้ากระดาษ A4 (2 คอลัมน์ x 4 แถว) มีเส้นประสำหรับตัด
 * @param {Object} appState
 * @param {string|null} filterRoomId - ระบุ id ห้องสอบเฉพาะเจาะจง หรือ null เพื่อพิมพ์ทุกห้อง
 */
export function openPrintableSeatSlips(appState, filterRoomId = null) {
  const rooms = filterRoomId
    ? (appState.rooms || []).filter(r => r.id === filterRoomId)
    : (appState.rooms || []).filter(r => r.isActive !== false);

  if (!rooms || rooms.length === 0) {
    alert('ไม่พบห้องสอบที่ต้องการพิมพ์บัตรที่นั่งสอบ');
    return;
  }

  // กำหนดปี พ.ศ. จากรอบสอบ
  let examYear = 2569;
  if (appState.sessions && appState.sessions.length > 0 && appState.sessions[0].date) {
    const d = new Date(appState.sessions[0].date);
    if (!isNaN(d.getTime())) {
      examYear = d.getFullYear() + 543;
    }
  }

  const examTitle = `การจัดสอบภาคความรู้ความสามารถทั่วไป ด้วยระบบอิเล็กทรอนิกส์ (e-Exam) สำนักงาน ก.พ. ประจำปี ${examYear} ครั้งที่ 1`;

  // สร้างรายการบัตรทั้งหมด (นับเลขต่อเนื่อง 1..N บนโต๊ะที่พร้อมใช้จริง ไม่แหว่ง ไม่ข้ามเลข)
  const sortedActiveRooms = (appState.rooms || []).filter(r => r.isActive !== false).sort((a, b) => {
    const codeA = a.roomCode || a.code || a.id;
    const codeB = b.roomCode || b.code || b.id;
    return codeA.localeCompare(codeB, undefined, { numeric: true });
  });

  // คำนวณลำดับเลขที่นั่งเริ่มต้นของแต่ละห้อง โดยนับเฉพาะโต๊ะที่พร้อมใช้จริงอย่างต่อเนื่อง
  let nextCardSeq = sortedActiveRooms.length > 0 && sortedActiveRooms[0].seatStart ? sortedActiveRooms[0].seatStart : 1;
  const roomCardStartMap = new Map();
  sortedActiveRooms.forEach(r => {
    roomCardStartMap.set(r.id, nextCardSeq);
    const usableCount = Math.max(0, (r.capacity || 0) - (r.disabledSeats || []).length);
    nextCardSeq += usableCount;
  });

  const allCards = [];
  for (const r of rooms) {
    const curStartSeat = roomCardStartMap.get(r.id) || (r.seatStart || 1);
    const usableCount = Math.max(0, (r.capacity || 0) - (r.disabledSeats || []).length);
    const roomCode = r.roomCode || r.code || r.name;
    const floor = r.floor || 1;
    const building = r.building || 'อาคาร 17';
    const buildingFull = building.includes('อาคาร') ? (building.includes('นวัตปัญญา') ? building : `อาคารนวัตปัญญา (${building})`) : `อาคารนวัตปัญญา (อาคาร ${building})`;
    const accCount = (r.accessibleSeats || []).length;

    // รันเลขที่นั่งต่อเนื่องบนโต๊ะที่พร้อมใช้จริง เริ่มต้นที่ 1 (หรือเลขเริ่มต้นของห้องนั้น)
    for (let i = 0; i < usableCount; i++) {
      const assignedSeatNum = curStartSeat + i;
      const isAcc = i < accCount;
      allCards.push({
        seatNum: assignedSeatNum,
        roomCode,
        floor,
        building: isAcc ? `${buildingFull} • ♿ ที่นั่งสำหรับคนพิการ` : buildingFull
      });
    }
  }

  if (allCards.length === 0) {
    alert('ไม่พบข้อมูลที่นั่งสอบสำหรับพิมพ์บัตร');
    return;
  }

  // แบ่งออกเป็นหน้าละ 8 ใบ (2 คอลัมน์ x 4 แถว)
  const pageSize = 8;
  const totalPages = Math.ceil(allCards.length / pageSize);

  let pagesHtml = '';
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const pageCards = allCards.slice(pIdx * pageSize, (pIdx + 1) * pageSize);
    const cardsHtml = pageCards.map(card => `
      <div class="seat-slip-card">
        <div class="slip-label">เลขที่นั่ง</div>
        <div class="slip-seat-num">${card.seatNum}</div>
        <div class="slip-footer">ห้อง ${card.roomCode} ชั้น ${card.floor} ${card.building}</div>
      </div>
    `).join('');

    pagesHtml += `
      <div class="a4-page">
        <div class="cards-grid">
          ${cardsHtml}
        </div>
        <div class="page-footer">แผ่นที่ ${pIdx + 1} / ${totalPages}</div>
      </div>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>บัตรประจำตัวที่นั่งสอบ (8 ที่นั่งต่อแผ่น A4) — ศูนย์สอบ CBT อาคาร 17 มรภ.บุรีรัมย์</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 6mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Sarabun', 'Inter', -apple-system, sans-serif;
    }
    body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-toolbar {
      position: sticky;
      top: 0;
      background: #1e293b;
      color: white;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 1000;
    }
    .print-btn {
      background: #3B1F54;
      color: #FFFFFF;
      border: 1px solid #7c3aed;
      padding: 8px 20px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s;
    }
    .print-btn:hover {
      background: #4c286d;
    }
    .close-btn {
      background: #475569;
      color: white;
      border: none;
      padding: 8px 16px;
      font-size: 13.5px;
      border-radius: 6px;
      cursor: pointer;
    }
    .close-btn:hover {
      background: #64748b;
    }
    .a4-page {
      width: 198mm;
      height: 278mm;
      max-height: 278mm;
      margin: 18px auto;
      background: #ffffff;
      padding: 4mm 3mm 2mm 3mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 4px 14px rgba(0,0,0,0.1);
      page-break-after: always;
      page-break-inside: avoid;
    }
    .a4-page:last-child {
      page-break-after: auto;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: repeat(4, 1fr);
      gap: 5mm;
      height: 268mm;
    }
    .seat-slip-card {
      border: 1.5px dashed #475569;
      border-radius: 6px;
      padding: 12px 14px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: #ffffff;
      position: relative;
      gap: 6px;
    }
    .slip-label {
      font-size: 16px;
      font-weight: 700;
      color: #334155;
      letter-spacing: 0.5px;
    }
    .slip-seat-num {
      font-size: 52px;
      font-weight: 900;
      color: #000000;
      line-height: 1;
      margin: 4px 0;
      font-family: 'Inter', 'Sarabun', sans-serif;
      letter-spacing: -1px;
    }
    .slip-footer {
      font-size: 12px;
      color: #1e293b;
      font-weight: 600;
      line-height: 1.3;
      margin-top: 4px;
    }
    .page-footer {
      text-align: center;
      font-size: 9.5px;
      color: #94a3b8;
      height: 4mm;
      line-height: 4mm;
    }
    @media print {
      body {
        background: #ffffff;
      }
      .no-print {
        display: none !important;
      }
      .a4-page {
        margin: 0 !important;
        padding: 4mm 3mm 2mm 3mm !important;
        box-shadow: none !important;
        width: 100% !important;
        height: 278mm !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar no-print">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 18px;">🖨️</span>
      <div>
        <div style="font-weight: 700; font-size: 15px;">พิมพ์บัตรประจำตัวที่นั่งสอบ (สำหรับตัดแจก/ติดโต๊ะผู้เข้าสอบ)</div>
        <div style="font-size: 12px; color: #94a3b8;">รวมทั้งหมด ${allCards.length} ที่นั่ง (${totalPages} แผ่น A4 • 8 ที่นั่งต่อ 1 แผ่น)</div>
      </div>
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="print-btn" onclick="window.print()">
        <span>🖨️ สั่งพิมพ์ออกเครื่องพิมพ์ (A4)</span>
      </button>
      <button class="close-btn" onclick="window.close()">ปิดหน้าต่าง</button>
    </div>
  </div>

  ${pagesHtml}
</body>
</html>`;

  renderAndPrintHTML(html);
}


