/**
 * โมดูลจัดการแผนผังอาคาร 17, สารบบห้องสอบ (Directory), และหน้าต่างรายละเอียดห้องสอบ
 * (Building 17 Interactive Floor Plan & Detailed Room Modal)
 * 
 * ฟีเจอร์หลัก:
 * - แสดงภาพแผนผังอาคาร 17 ตัดเฉพาะตัวผัง คมชัด ไร้สิ่งรบกวน
 * - วาดรูปทรงตามห้องจริง 1:1 ด้วย SVG Polygon & Path
 * - เลื่อนเมาส์ไปที่ห้อง: ไฮไลต์ตามรูปทรงห้องจริง ขยายและเรืองแสงอย่างสวยงาม
 * - คลิกที่ห้องสอบ: เปิด Modal รายละเอียดห้องสอบ/ผังที่นั่งจริง
 */

import { BUILDING_17_DIRECTORY } from '../data/seed.js';
import { FLOOR1_BLUEPRINT_BASE64, FLOOR2_BLUEPRINT_BASE64, BUILDING_FLOOR1_RAW_SVG, BUILDING_FLOOR2_RAW_SVG } from '../data/blueprint-base64.js';
import { formatThaiDate, formatThaiTimeRange } from '../utils/thai-date.js';
import { renderSeatingPlanInnerDiagram } from '../io/pdf-export.js';

// =============================================================================
// พิกัดรูปทรงห้องจริง (SVG Polygons) — อิงตามพิกัดภาพพิมพ์เขียวอาคาร 17
// Floor 2 ขนาดภาพ: 605 x 392 px (viewBox="0 0 605 392")
// Floor 1 ขนาดภาพ: 605 x 350 px (viewBox="0 0 605 350")
// =============================================================================

export const FLOOR2_SVG_ROOMS = [
  // ห้องสอบที่ 8: 17211 (จิตตปัญญา 1 - 50 ที่นั่ง)
  { code: '17211', points: '237,67 291,67 291,160 237,160' },
  // ห้องสอบที่ 9: 17212 (จิตตปัญญา 2 - 52 ที่นั่ง)
  { code: '17212', points: '291,67 341,67 341,160 291,160' },
  // ห้องสอบที่ 10: 17213 (จิตตปัญญา 3 - 48 ที่นั่ง)
  { code: '17213', points: '341,67 393,67 393,160 341,160' },
  // 17214 (ห้องน้ำคนพิการ ชั้น 2)
  { code: '17214', points: '345,160 395,160 395,185 345,185' },
  // 17207 (หอประชุมใหญ่เชื่อมกลาง - หอประชุมสโลป)
  { code: '17207', points: '70,97 225,97 225,302 70,302' },
  // 17210 (ห้องรับรอง)
  { code: '17210', points: '30,167 58,167 58,195 30,195' },
  // 17209 (ห้องแต่งตัวชาย)
  { code: '17209', points: '30,195 58,195 58,224 30,224' },
  // 17208 (ห้องแต่งตัวหญิง)
  { code: '17208', points: '30,224 58,224 58,252 30,252' },
  // ห้องสอบที่ 7: 17206 (ห้องประชุมวงษ์แก้ว - 40 ที่นั่ง)
  { code: '17206', points: '237,227 291,227 291,324 237,324' },
  // ห้องสอบที่ 6: 17205 (สุตปัญญา - 40 ที่นั่ง)
  { code: '17205', points: '291,227 341,227 341,324 291,324' },
  // 17204 (ห้องควบคุม)
  { code: '17204', points: '340,337 370,337 370,377 340,377' },
  // 17203 (ห้องประชุมลักษณงาม)
  { code: '17203', points: '360,232 410,232 430,270 415,330 360,310' },
  // ห้องสอบที่ 5: 17201 (ห้องประชุมหงส์พันธ์ - สโลปใหญ่ 80 ที่นั่ง ทรงพัด)
  { code: '17201', points: '480,122 535,135 560,165 570,215 572,234 490,234 470,215 465,175 475,140' },
  // 17202 (ห้องประชุมเจริญพันธุวงศ์ - ทรงพัดล่าง)
  { code: '17202', points: '490,234 572,234 568,275 550,315 520,350 485,370 465,325 460,280 470,245' },
];

export const FLOOR1_SVG_ROOMS = [
  // ห้องสอบที่ 2: 17109 (วินิตปัญญา 6 - 60 ที่นั่ง)
  { code: '17109', points: '245,62 294,62 294,147 245,147' },
  // ห้องสอบที่ 3: 17110 (วินิตปัญญา 7 - 60 ที่นั่ง)
  { code: '17110', points: '294,62 342,62 342,147 294,147' },
  // ห้องสอบที่ 4: 17111 (วินิตปัญญา 8 - 50 ที่นั่ง)
  { code: '17111', points: '342,62 392,62 392,147 342,147' },
  // ห้องสอบที่ 1: 17108 (วินิตปัญญา 5 - 40 ที่นั่ง)
  { code: '17108', points: '182,80 225,80 225,168 182,168' },
  // 17107 (วินิตปัญญา 4)
  { code: '17107', points: '143,80 182,80 182,168 143,168' },
  // 17106 (วินิตปัญญา 3)
  { code: '17106', points: '102,80 143,80 143,168 102,168' },
  // 17105 (วินิตปัญญา 2)
  { code: '17105', points: '102,172 148,172 148,258 102,258' },
  // 17104 (วินิตปัญญา 1)
  { code: '17104', points: '178,172 225,172 225,258 178,258' },
  // 17103 (นันทนปัญญา 2 - กิจกรรม/สันทนาการใหญ่)
  { code: '17103', points: '245,200 405,200 405,268 245,268' },
  // 17101 (นิทัศนปัญญา - ทรงโค้งกลมตะวันออก)
  { code: '17101', points: '495,182 525,192 545,218 550,250 540,280 515,305 480,318 475,290 490,260 495,230 485,200' },
  // 17113 (งานเทคนิคอาคาร)
  { code: '17113', points: '445,62 495,62 495,127 445,127' },
  // 17102 (นันทนปัญญา 1)
  { code: '17102', points: '385,250 418,250 418,280 385,280' },
];

/**
 * สร้าง SVG Polygon สำหรับห้องในผัง
 * @param {Array<{code: string, points: string}>} roomList 
 * @param {import('../store/state.js').AppState} appState 
 * @returns {string}
 */
function renderSvgRoomPolygons(roomList, appState) {
  const allDir = [...(BUILDING_17_DIRECTORY.floor1 || []), ...(BUILDING_17_DIRECTORY.floor2 || [])];

  return roomList.map(r => {
    const examRoom = appState.rooms.find(rm => (rm.roomCode || rm.id) === r.code);
    const dirItem = allDir.find(d => d.code === r.code);
    const isExam = !!examRoom;
    const roomName = dirItem ? dirItem.name : (examRoom ? examRoom.name : r.code);

    let title = `${r.code} : ${roomName}`;
    let category = 'other';
    if (isExam) {
      category = 'exam';
      title = `ห้อง ${r.code} : ${roomName}\n🏫 ห้องสอบที่ ${examRoom.roomNumber} (CBT ${examRoom.capacity} ที่นั่ง)\nเลขที่นั่ง ${examRoom.seatStart}-${examRoom.seatEnd}\n👉 คลิกเพื่อดูผังที่นั่ง & รายละเอียด`;
    } else if (dirItem && (dirItem.type === 'hall' || dirItem.type === 'auditorium' || dirItem.type === 'meeting')) {
      category = 'hall';
      title = `ห้อง ${r.code} : ${roomName}\n${dirItem.desc || 'ห้องประชุม/บรรยาย'}`;
    } else if (dirItem && (dirItem.type === 'facility' || dirItem.name.includes('ห้องน้ำ'))) {
      category = 'facility';
      title = `ห้อง ${r.code} : ${roomName}\n${dirItem.desc || 'สิ่งอำนวยความสะดวก'}`;
    }

    return `
      <polygon class="blueprint-svg-room ${isExam ? 'is-exam-room' : `is-${category}-room`}"
               points="${r.points}"
               data-room-code="${r.code}"
               data-room-name="${roomName}"
               data-is-exam="${isExam}"
               ${isExam ? `data-action="view-room-detail" data-id="${examRoom.id}" role="button" tabindex="0"` : ''}
               data-exam-info="${isExam ? `ห้องสอบที่ ${examRoom.roomNumber} • ${examRoom.capacity} ที่นั่ง [${examRoom.seatStart}-${examRoom.seatEnd}]` : (dirItem ? dirItem.desc : '')}">
        <title>${title}</title>
      </polygon>
    `;
  }).join('');
}

/**
 * แผนผังอาคาร 17 ชั้น 1 — แบบรูปทรงตามห้องจริง (SVG Polygons)
 * @param {import('../store/state.js').AppState} appState 
 * @returns {string}
 */
/**
 * ประมวลผลและตกแต่ง SVG ผังอาคารตาม AppState (แยกระหว่างห้องสอบ และห้องทั่วไป)
 * @param {string} rawSvg 
 * @param {number} floorNum 
 * @param {import('../store/state.js').AppState} appState 
 * @returns {string}
 */
export function renderFloorplanSvgWithAppState(rawSvg, floorNum, appState) {
  const allDir = [
    ...(BUILDING_17_DIRECTORY.floor1 || []),
    ...(BUILDING_17_DIRECTORY.floor2 || [])
  ];

  // 1. Process room polygons cleanly without duplicate attributes
  let processedSvg = rawSvg.replace(/<polygon\s+([^>]*?)>(?:<title>.*?<\/title>)?<\/polygon>/gs, (match, attrs) => {
    const codeMatch = attrs.match(/data-room="([^"]+)"/);
    if (!codeMatch) return match;
    const code = codeMatch[1];
    const pointsMatch = attrs.match(/points="([^"]+)"/);
    const points = pointsMatch ? pointsMatch[1] : '';
    const idMatch = attrs.match(/id="([^"]+)"/);
    const rId = idMatch ? idMatch[1] : `room-${code}`;

    const examRoom = (appState.rooms || []).find(r => (r.roomCode || r.id) === code || (code.startsWith('17') && r.id === code));
    const dirItem = allDir.find(d => d.code === code);
    const roomName = dirItem ? dirItem.name : (examRoom ? examRoom.name : code);
    const desc = dirItem ? (dirItem.desc || '') : '';

    if (examRoom) {
      const examTitle = `ห้องสอบที่ ${examRoom.roomNumber} : ${examRoom.name} (${examRoom.roomCode || examRoom.id})\nศูนย์สอบ CBT อาคาร 17 • ความจุ ${examRoom.capacity} ที่นั่ง [เลขที่ ${examRoom.seatStart || 1} - ${examRoom.seatEnd || examRoom.capacity}]\n👉 คลิกเพื่อเปิดดูผังที่นั่งสอบจริง`;
      return `<polygon id="${rId}" data-room="${code}" points="${points}" class="room is-exam-room floor-${floorNum}" fill="#F3E8FF" stroke="#7C3AED" stroke-width="2" data-action="view-room-detail" data-id="${examRoom.id}" role="button" tabindex="0" style="cursor: pointer; transition: all 0.15s ease;"><title>${examTitle}</title></polygon>`;
    } else {
      const nonExamTitle = `ห้อง ${code} : ${roomName}\n(ไม่ได้ใช้เป็นห้องสอบ CBT)\n👉 คลิกเพื่อดูชื่อห้อง`;
      return `<polygon id="${rId}" data-room="${code}" points="${points}" class="room is-non-exam-room floor-${floorNum}" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2" data-action="view-non-exam-room" data-room-code="${code}" data-room-name="${roomName}" data-floor="${floorNum}" data-desc="${desc}" role="button" tabindex="0" style="cursor: pointer; transition: all 0.15s ease;"><title>${nonExamTitle}</title></polygon>`;
    }
  });

  // 2. Process text labels cleanly without duplicate attributes
  processedSvg = processedSvg.replace(/<text\s+([^>]*?)>([^<]+)<\/text>/gs, (match, attrs, textContent) => {
    const codeMatch = attrs.match(/data-room="([^"]+)"/);
    if (!codeMatch) return match;
    const code = codeMatch[1];
    const xMatch = attrs.match(/x="([^"]+)"/);
    const yMatch = attrs.match(/y="([^"]+)"/);
    const idMatch = attrs.match(/id="([^"]+)"/);
    const styleMatch = attrs.match(/style="([^"]+)"/);

    const x = xMatch ? xMatch[1] : '';
    const y = yMatch ? yMatch[1] : '';
    const id = idMatch ? idMatch[1] : `label-${code}`;
    const style = styleMatch ? styleMatch[1] : 'font-size:16px';

    const examRoom = (appState.rooms || []).find(r => (r.roomCode || r.id) === code || (code.startsWith('17') && r.id === code));
    const dirItem = allDir.find(d => d.code === code);
    const roomName = dirItem ? dirItem.name : (examRoom ? examRoom.name : code);
    const desc = dirItem ? (dirItem.desc || '') : '';

    if (examRoom) {
      return `<text id="${id}" data-room="${code}" x="${x}" y="${y}" class="rl is-exam-label" fill="#4C1D95" style="${style}; font-weight: 800; cursor: pointer; pointer-events: auto;" data-action="view-room-detail" data-id="${examRoom.id}">${textContent}</text>`;
    } else {
      return `<text id="${id}" data-room="${code}" x="${x}" y="${y}" class="rl is-non-exam-label" fill="#1E293B" style="${style}; font-weight: 700; cursor: pointer; pointer-events: auto;" data-action="view-non-exam-room" data-room-code="${code}" data-room-name="${roomName}" data-floor="${floorNum}" data-desc="${desc}">${textContent}</text>`;
    }
  });

  return `
    <div class="building17-svg-container">
      ${processedSvg}
    </div>
  `;
}

/**
 * แผนผังอาคาร 17 ชั้น 1 — แบบเวกเตอร์ SVG คมชัด (ตัดส่วนหัวเรื่องตัวหนังสือออก เอาเฉพาะผัง)
 * @param {import('../store/state.js').AppState} appState 
 * @returns {string}
 */
export function renderFloor1Blueprint(appState) {
  return renderFloorplanSvgWithAppState(BUILDING_FLOOR1_RAW_SVG, 1, appState);
}

/**
 * แผนผังอาคาร 17 ชั้น 2 — แบบเวกเตอร์ SVG คมชัด (ตัดส่วนหัวเรื่องตัวหนังสือออก เอาเฉพาะผัง)
 * @param {import('../store/state.js').AppState} appState 
 * @returns {string}
 */
export function renderFloor2Blueprint(appState) {
  return renderFloorplanSvgWithAppState(BUILDING_FLOOR2_RAW_SVG, 2, appState);
}

/**
 * ป็อปอัปแสดงเฉพาะชื่อห้องและข้อมูลพื้นฐาน (สำหรับห้องที่ไม่ได้ใช้เป็นห้องสอบ)
 * ตามข้อกำหนด: "ห้องไหนไม่ใช่ห้องสอบกดดูได้แต่เห็นแค่ชื่อห้อง ไม่เห็นรายละเอียดผังห้อง"
 * @param {object} modalData 
 * @returns {string}
 */
export function renderNonExamRoomModal(modalData) {
  const { roomCode, roomName, floor, desc } = modalData;
  return `
    <div class="modal-backdrop" data-action="close-modal" style="display: flex; align-items: center; justify-content: center; z-index: 1050; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(2px);">
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 440px; width: 90%; background: var(--bg-surface, #FFFFFF); border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25); border: 1px solid var(--border-subtle, #E2E8F0); animation: modalFadeIn 0.2s ease-out;">
        <div style="padding: 16px 20px; background: var(--bg-surface-elevated, #F8FAFC); border-bottom: 1px solid var(--border-subtle, #E2E8F0); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">🏢</span>
            <strong style="font-size: 15px; color: var(--text-main, #0F172A);">ข้อมูลห้องประจำอาคาร 17</strong>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-close-modal" data-action="close-modal" style="padding: 3px 8px; border-radius: 6px; font-weight: 700; cursor: pointer;">✕</button>
        </div>
        <div style="padding: 24px 22px; text-align: center;">
          <div style="display: inline-block; padding: 3px 10px; background: var(--brand-purple-light, #EDE9FE); color: var(--brand-purple, #3B1F54); font-size: 12px; font-weight: 700; border-radius: 20px; margin-bottom: 8px;">
            ชั้น ${floor || 1} • รหัสห้อง ${roomCode}
          </div>
          <h2 style="font-size: 22px; font-weight: 800; color: var(--brand-purple, #3B1F54); margin: 6px 0 12px 0; line-height: 1.3;">
            ${roomName}
          </h2>
          <div style="margin-bottom: 14px;">
            <span style="display: inline-block; padding: 4px 12px; background: #F1F5F9; color: #475569; font-size: 12.5px; font-weight: 600; border-radius: 6px; border: 1px solid #E2E8F0;">
              ℹ️ ไม่ได้ใช้เป็นห้องสอบ CBT (ห้องทั่วไป)
            </span>
          </div>
          ${desc ? `<p style="font-size: 13.5px; color: var(--text-muted, #64748B); line-height: 1.5; margin: 0 0 8px 0;">${desc}</p>` : ''}
          <div style="font-size: 12px; color: #94A3B8; margin-top: 14px; border-top: 1px dashed var(--border-subtle, #E2E8F0); padding-top: 10px;">
            * ห้องนี้ไม่ได้จัดเป็นสนามสอบ จึงไม่มีการจัดผังโต๊ะสอบและเลขที่นั่ง
          </div>
        </div>
        <div style="padding: 12px 20px; background: var(--bg-surface-elevated, #F8FAFC); border-top: 1px solid var(--border-subtle, #E2E8F0); display: flex; justify-content: flex-end;">
          <button class="btn btn-primary btn-sm" id="btn-close-modal" data-action="close-modal" style="background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 600; padding: 6px 18px; border-radius: 6px; cursor: pointer; border: none;">
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * สารบบอาคาร 17 ครบทุกห้อง (Floor 1 & Floor 2)
 * @param {import('../store/state.js').AppState} appState 
 * @returns {string}
 */
export function renderBuildingDirectoryTable(appState) {
  const allRooms = [
    ...(BUILDING_17_DIRECTORY.floor1 || []).map(x => ({ ...x, floor: 1 })),
    ...(BUILDING_17_DIRECTORY.floor2 || []).map(x => ({ ...x, floor: 2 }))
  ];

  return `
    <div style="background: var(--bg-surface); padding: 16px; border-radius: 8px; border: 1px solid var(--border-subtle); margin-bottom: 16px;">
      <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">📑 สารบบอาคาร 17 ครบทุกห้อง (Building 17 Directory)</div>
      <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 16px 0;">
        ถอดแบบตามป้ายบอกทางจริงของอาคาร 17 ครอบคลุมทั้งห้องสอบ CBT, ห้องประชุม, ห้องจัดกิจกรรม, และสิ่งอำนวยความสะดวก
      </p>

      <table class="data-table">
        <thead>
          <tr>
            <th>ชั้น</th>
            <th>รหัสห้อง</th>
            <th>ชื่อทางการตามป้าย</th>
            <th>การใช้งานในโครงการสอบ</th>
            <th>ความจุ / เลขที่นั่ง</th>
            <th>ประเภทสถานที่</th>
            <th style="text-align: center; width: 140px;">การจัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${allRooms.map(item => {
            const examRoom = appState.rooms.find(r => (r.roomCode || r.id) === item.code);
            return `
              <tr style="${examRoom ? 'background: rgba(124, 58, 237, 0.04);' : ''}">
                <td><span class="badge ${item.floor === 1 ? 'badge-normal' : 'badge-primary'}">ชั้น ${item.floor}</span></td>
                <td><strong>${item.code}</strong></td>
                <td><strong>${item.name}</strong></td>
                <td>
                  ${examRoom ? `
                    <span class="badge badge-primary" style="font-weight: 700;">
                      🏫 ห้องสอบที่ ${examRoom.roomNumber || examRoom.id.replace('R','')}
                    </span>
                  ` : `
                    <span style="font-size: 12px; color: var(--text-muted);">${item.desc || 'พื้นที่สนับสนุน'}</span>
                  `}
                </td>
                <td>
                  ${examRoom ? `
                    <strong>${examRoom.capacity} ที่นั่ง</strong> <span style="font-size: 11px; color: var(--text-muted);">(${examRoom.seatStart} - ${examRoom.seatEnd})</span>
                  ` : '-'}
                </td>
                <td>
                  <span class="badge badge-normal">${item.type === 'computer' ? '💻 คอมพิวเตอร์' : item.type === 'auditorium' ? '🎭 สโลปบรรยาย' : item.type === 'facility' ? '♿ อำนวยความสะดวก' : '🏢 ห้องทั่วไป'}</span>
                </td>
                <td style="text-align: center;">
                  ${examRoom ? `
                    <button class="btn btn-accent btn-sm" data-action="view-room-detail" data-id="${examRoom.id}" style="padding: 3px 8px; font-size: 12px;">
                      🏢 ดูข้อมูลห้อง
                    </button>
                  ` : `
                    <span style="font-size: 11px; color: #94a3b8;">-</span>
                  `}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * หน้าต่างแสดงรายละเอียดห้องสอบแบบเจาะลึก (Comprehensive Room Details Modal)
 * @param {Object} params
 * @param {import('../data/models.js').Room} params.room
 * @param {string} params.subTab - 'seating' | 'specs' | 'proctors'
 * @param {import('../store/state.js').AppState} params.appState
 * @param {boolean} [params.maskPDPA=false]
 * @returns {string}
 */
export function renderRoomDetailModal({ room, subTab = 'seating', appState, maskPDPA = false }) {
  if (!room) return '';

  // ดึง allocations ทั้งหมดที่ตรงกับห้องนี้ (รองรับทั้ง room.id เช่น 'R01', room.roomCode เช่น '17108', หรือ room.code)
  const roomAllocs = (appState.allocations || []).filter(al =>
    al.roomId === room.id ||
    (room.roomCode && al.roomId === room.roomCode) ||
    (room.code && al.roomId === room.code)
  );
  const sessionMap = new Map((appState.sessions || []).map(s => [s.id, s]));
  const proctorMap = new Map((appState.proctors || []).map(p => [p.id, p]));

  let tabContentHtml = '';

  if (subTab === 'seating') {
    tabContentHtml = `
      <div style="width: 100%; display: flex; flex-direction: column; gap: 12px;">
        ${renderSeatingPlanInnerDiagram(room)}
      </div>
    `;
  } else if (subTab === 'specs') {
    tabContentHtml = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- คำอธิบายและกายภาพห้อง -->
        <div style="background: var(--bg-surface); padding: 16px; border-radius: 8px; border: 1px solid var(--border-subtle);">
          <div style="font-weight: 700; font-size: 14px; color: var(--text-main); margin-bottom: 6px;">
            📝 ข้อมูลทั่วไปของห้องสอบ
          </div>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0;">
            ${room.description || `${room.name} เป็นห้องสอบมาตรฐานสำหรับรองรับการทดสอบวัดความรู้ความสามารถทั่วไป (ภาค ก) ด้วยระบบอิเล็กทรอนิกส์ (CBT) ของสำนักงาน ก.พ. ตั้งอยู่ ณ ${room.building} ชั้น ${room.floor}`}
          </p>
        </div>

        <!-- สเปกอุปกรณ์และสิ่งอำนวยความสะดวก -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
          <div style="background: var(--bg-surface-elevated); padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
            <div style="font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              ❄️ ระบบปรับอากาศ
            </div>
            <div style="font-size: 13px; color: var(--text-muted);">
              ${room.airConditioners || 4} เครื่อง แบบกระจายลมรอบทิศทาง
            </div>
          </div>

          <div style="background: var(--bg-surface-elevated); padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
            <div style="font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              📹 กล้องวงจรปิด (CCTV)
            </div>
            <div style="font-size: 13px; color: var(--text-muted);">
              ${room.cctvCount || 2} ตัว บันทึกภาพตลอดระยะเวลาการสอบ
            </div>
          </div>

          <div style="background: var(--bg-surface-elevated); padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
            <div style="font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              🚪 ประตูทางเข้า/ออก
            </div>
            <div style="font-size: 13px; color: var(--text-muted);">
              ${room.doors || 'ประตูมาตรฐาน 2 บาน'}
            </div>
          </div>

          <div style="background: var(--bg-surface-elevated); padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
            <div style="font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              ♿ การเข้าถึงสำหรับผู้พิการ
            </div>
            <div style="font-size: 13px; color: var(--text-muted);">
              ${room.accessibilityNote || (room.accessibleForDisabled ? 'มีทางลาดและลิฟต์ รองรับวีลแชร์' : 'มีลิฟต์โดยสาร')}
            </div>
          </div>
        </div>

        <!-- สถานที่ใกล้เคียง -->
        <div style="background: var(--bg-surface); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
          <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px;">📍 สถานที่ใกล้เคียง</div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${(room.nearby || ['โถงกลาง', 'ลิฟต์โดยสาร', 'ห้องน้ำ']).map(n => `<span class="badge badge-normal">${n}</span>`).join('')}
          </div>
        </div>

        <!-- คำแนะนำสำหรับผู้คุมสอบ -->
        <div style="background: #eff6ff; padding: 14px; border-radius: 8px; border: 1px solid #bfdbfe;">
          <div style="font-weight: 700; font-size: 13px; color: #1e40af; margin-bottom: 6px;">📋 คำแนะนำสำหรับผู้คุมสอบประจำห้องนี้</div>
          <ul style="font-size: 12px; color: #334155; line-height: 1.7; margin: 0; padding-left: 20px;">
            <li>เข้าประจำห้องสอบก่อนเวลาสอบอย่างน้อย 30 นาที เพื่อเปิดเครื่องและตรวจสอบระบบโปรเจคเตอร์</li>
            <li>ตรวจป้ายชื่อและเลขที่นั่งสอบให้ตรงกับใบรายชื่อผู้เข้าสอบ (${room.seatStart || 1} ถึง ${room.seatEnd || room.capacity})</li>
            <li>ห้ามผู้เข้าสอบนำเครื่องมือสื่อสารทุกชนิดเข้าห้องสอบตามระเบียบ OCSC สำนักงาน ก.พ.</li>
          </ul>
        </div>
      </div>
    `;
  } else if (subTab === 'proctors') {
    tabContentHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: var(--bg-surface); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong style="color: var(--primary-700); font-size: 14px;">📅 ตารางการใช้งานห้องสอบ & ผู้คุมสอบที่ได้รับมอบหมาย</strong>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              แสดงรอบการสอบทั้งหมดที่จัดขึ้นในห้อง ${room.roomCode || room.id} (${roomAllocs.length} รอบ)
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-modal-goto-scheduler">
            📅 ไปที่หน้าจัดตารางผู้คุม
          </button>
        </div>

        ${roomAllocs.length === 0 ? `
          <div style="text-align: center; padding: 30px; background: var(--bg-surface); border-radius: 8px; color: var(--text-muted); font-size: 13px;">
            ยังไม่มีการกำหนดรอบสอบสำหรับห้องนี้
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${roomAllocs.map(al => {
              const sess = sessionMap.get(al.sessionId);
              if (!sess) return '';

              // ดึงผู้คุมสอบทั้งหมด (real-time) แบ่งตาม role
              // ดึงผู้คุมสอบทั้งหมด (real-time จาก appState.assignments ขณะนั้น)
              const allAssigns = (appState.assignments || []).filter(a => {
                if (a.sessionId !== al.sessionId) return false;
                return a.allocationId === al.id ||
                       a.roomId === room.id ||
                       (room.roomCode && a.roomId === room.roomCode) ||
                       (room.code && a.roomId === room.code) ||
                       (al.roomId && a.roomId === al.roomId);
              });

              const chiefAssigns = allAssigns.filter(a => a.role === 'chief');
              const procAssigns = allAssigns.filter(a => a.role !== 'chief');
              const chiefP = chiefAssigns.length > 0 ? proctorMap.get(chiefAssigns[0].proctorId) : null;
              return `
                <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px; margin-bottom: 10px;">
                    <div>
                      <div style="font-weight: 700; font-size: 14px; color: var(--text-main);">
                        ${sess.name}
                      </div>
                      <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                        📅 ${formatThaiDate(sess.date)} • ⏰ เวลาสอบ: ${formatThaiTimeRange(sess.startTime, sess.endTime)}
                      </div>
                    </div>
                    <div style="text-align: right;">
                      <span class="badge badge-primary">ผู้เข้าสอบ ${al.examineesInRoom} คน</span>
                    </div>
                  </div>

                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
                    <!-- หัวหน้าห้องสอบ -->
                    <div style="background: var(--bg-surface-elevated); padding: 10px 12px; border-radius: 6px; border-left: 3px solid var(--primary-500);">
                      <div style="font-size: 11px; font-weight: 700; color: var(--primary-700); margin-bottom: 4px;">
                        👔 หัวหน้าห้องสอบ (Chief Proctor)
                      </div>
                      ${chiefP ? `
                        <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">
                          ${chiefP.academicTitle ? chiefP.academicTitle + " " : ""}${chiefP.firstName} ${chiefP.lastName}
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                          ${chiefP.department}
                        </div>
                        <div style="font-size: 11px; color: var(--primary-600); margin-top: 4px;">
                          📞 ${maskPDPA ? '08•-•••-••••' : chiefP.phone}
                        </div>
                      ` : `
                        <div style="font-size: 12px; color: var(--danger-500); font-weight: 600;">
                          ⚠️ ยังไม่ได้จัดหัวหน้าห้องสอบ
                        </div>
                      `}
                    </div>

                    <!-- กรรมการคุมสอบ (แสดงทุกคน real-time) -->
                    ${procAssigns.length > 0 ? procAssigns.map(pa => {
                      const pp = proctorMap.get(pa.proctorId);
                      if (!pp) return '';
                      return `
                        <div style="background: var(--bg-surface-elevated); padding: 10px 12px; border-radius: 6px; border-left: 3px solid #3b82f6;">
                          <div style="font-size: 11px; font-weight: 700; color: #2563eb; margin-bottom: 4px;">
                            👤 กรรมการคุมสอบ (Proctor)
                          </div>
                          <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">
                            ${pp.academicTitle ? pp.academicTitle + " " : ""}${pp.firstName} ${pp.lastName}
                          </div>
                          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                            ${pp.department}
                          </div>
                          <div style="font-size: 11px; color: #2563eb; margin-top: 4px;">
                            📞 ${maskPDPA ? '08•-•••-••••' : pp.phone}
                          </div>
                        </div>
                      `;
                    }).join('') : `
                      <div style="background: var(--bg-surface-elevated); padding: 10px 12px; border-radius: 6px; border-left: 3px solid #3b82f6;">
                        <div style="font-size: 11px; font-weight: 700; color: #2563eb; margin-bottom: 4px;">
                          👤 กรรมการคุมสอบ (Proctor)
                        </div>
                        <div style="font-size: 12px; color: var(--danger-500); font-weight: 600;">
                          ⚠️ ยังไม่ได้จัดกรรมการคุมสอบ
                        </div>
                      </div>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  return `
    <div class="modal-overlay">
      <div class="modal-content modal-room-detail-content" style="max-width: 980px; width: 95vw; max-height: calc(100vh - 48px); overflow: hidden; display: flex; flex-direction: column; margin: 0 auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
        <!-- Modal Header -->
        <div class="modal-header" style="align-items: center; flex-shrink: 0; background: var(--bg-surface); padding: 14px 20px; border-bottom: 1px solid var(--border-subtle); z-index: 10;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="badge badge-primary" style="font-size: 12px; font-weight: 700;">ห้องสอบที่ ${room.roomNumber || room.id.replace('R','')}</span>
              <span class="card-title" style="margin: 0; font-size: 18px;">
                ห้อง ${room.roomCode || room.id} : ${room.officialName || room.name}
              </span>
              <span class="badge badge-normal" style="color: #16a34a; font-weight: 700;">พร้อมใช้งาน</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
              📍 ${room.building} (ชั้น ${room.floor}) • ${room.wing || 'อาคาร 17'}
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
        </div>

        <!-- Specs Bar & Subnav Tabs (ปรับลดขนาดเพื่อให้ผังห้องเด่นชัด เต็มตา ไม่ต้องเลื่อนดู) -->
        <div style="padding: 8px 16px 0 16px; flex-shrink: 0;">
          ${subTab === 'seating' ? `
            <!-- แถบสเปกแบบ Slim ประหยัดพื้นที่ในหน้าผังที่นั่ง -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; padding: 5px 12px; background: var(--bg-surface-elevated, #F8FAFC); border-radius: 6px; border: 1px solid var(--border-subtle);">
              <div style="display: flex; align-items: center; gap: 10px; font-size: 12px; color: #475569; flex-wrap: wrap;">
                <span>👥 ความจุ: <strong style="color: var(--primary-700);">${(room.capacity || 0) - (room.disabledSeats || []).length} / ${room.capacity} ที่</strong></span>
                <span style="color: #CBD5E1;">•</span>
                <span>🔢 ช่วงเลขที่นั่ง: <strong style="color: var(--text-main);">${room.seatStart || 1} - ${room.seatEnd || room.capacity}</strong></span>
                <span style="color: #CBD5E1;">•</span>
                <span>💻 ${room.roomType === 'computer' ? 'CBT คอมพิวเตอร์' : 'บรรยาย'}</span>
                <span style="color: #CBD5E1;">•</span>
                <span>🚪 ${room.doors || '2 บาน'}</span>
              </div>
              <div style="display: flex; gap: 4px; align-items: center;">
                ${(room.disabledSeats || []).length > 0 ? `<span class="badge" style="background: #FEE2E2; color: #991B1B; font-weight: 700; font-size: 10.5px; padding: 2px 6px;">🚫 ปิด ${room.disabledSeats.length} ที่</span>` : ''}
                ${(room.accessibleSeats || []).length > 0 ? `<span class="badge" style="background: #DBEAFE; color: #1E40AF; font-weight: 700; font-size: 10.5px; padding: 2px 6px;">♿ คนพิการ ${room.accessibleSeats.length} ที่</span>` : ''}
              </div>
            </div>
          ` : `
            <div class="room-metrics-grid" style="margin-bottom: 12px;">
              <div class="room-metric-box">
                <span class="label">👥 ความจุที่นั่งสอบ</span>
                <span class="value" style="color: var(--primary-700);">${(room.disabledSeats || []).length > 0 ? `<span style="color: #15803D;">${(room.capacity || 0) - room.disabledSeats.length}</span> / ${room.capacity} ที่` : `${room.capacity} ที่นั่ง`}</span>
                <span style="font-size: 11px; color: var(--text-muted);">${(room.disabledSeats || []).length > 0 ? `<span style="color: #DC2626; font-weight: 700;">(🚫 ปิด ${room.disabledSeats.length} ที่) • </span>` : ''}${room.seatStart && room.seatEnd ? `เลขที่ ${room.seatStart} - ${room.seatEnd}` : ''}</span>
              </div>
              <div class="room-metric-box">
                <span class="label">💻 ประเภทการสอบ</span>
                <span class="value" style="font-size: 13px;">${room.roomType === 'computer' ? 'CBT คอมพิวเตอร์' : 'ห้องบรรยายสโลป'}</span>
                <span style="font-size: 11px; color: var(--text-muted);">${room.layoutType === 'trapezoid-rows' ? 'สโลปใหญ่ 6 แถว' : 'ผังจัดโต๊ะมาตรฐาน'}</span>
              </div>
              <div class="room-metric-box">
                <span class="label">🚪 ประตู & ทางเข้า</span>
                <span class="value" style="font-size: 13px;">${room.doors || (room.doorPosition === 'front-both' ? 'หน้าห้อง 2 บาน' : 'ข้างห้อง 2 บาน')}</span>
                <span style="font-size: 11px; color: var(--text-muted);">${room.doorPosition === 'right-side-two' ? 'ฝั่งขวา' : room.doorPosition === 'left-side-two' ? 'ฝั่งซ้าย' : 'ซ้าย-ขวา'}</span>
              </div>
              <div class="room-metric-box">
                <span class="label">♿ ความสะดวก & เข้าถึง</span>
                <span class="value" style="font-size: 13px;">${room.accessibleForDisabled ? '♿ รองรับผู้พิการ' : 'มีลิฟต์โดยสาร'}</span>
                <span style="font-size: 11px; color: var(--text-muted);">${room.floor === 1 ? 'ใกล้ห้องน้ำ 17112' : 'ใกล้ห้องน้ำ 17214'}</span>
              </div>
            </div>
          `}

          <!-- Subnav Tabs (กะทัดรัด สบายตา) -->
          <div class="room-detail-subnav" style="margin-bottom: 8px; padding-bottom: 6px;">
            <button class="room-detail-subnav-btn ${subTab === 'seating' ? 'active' : ''}" data-room-detail-tab="seating" style="padding: 5px 12px; font-size: 12px;">
              🗺️ แผนผังที่นั่งสอบจริง (Seating Plan)
            </button>
            <button class="room-detail-subnav-btn ${subTab === 'specs' ? 'active' : ''}" data-room-detail-tab="specs" style="padding: 5px 12px; font-size: 12px;">
              🏢 ข้อมูลห้อง & อุปกรณ์ (Facilities & Specs)
            </button>
            <button class="room-detail-subnav-btn ${subTab === 'proctors' ? 'active' : ''}" data-room-detail-tab="proctors" style="padding: 5px 12px; font-size: 12px;">
              📅 รอบการสอบ & ผู้คุมสอบ (${roomAllocs.length} รอบ)
            </button>
          </div>
        </div>

        <!-- Modal Body -->
        <div class="modal-body" style="padding: 0 16px 16px 16px; flex: 1 1 auto; min-height: 0; overflow-y: auto;">
          ${tabContentHtml}
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; flex-shrink: 0; background: var(--bg-surface); padding: 12px 16px; border-top: 1px solid var(--border-subtle); z-index: 10;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-accent btn-sm" data-action="print-room-sign" data-id="${room.id}" style="font-weight: 700;">
              🖨️ พิมพ์ชุดป้ายหน้าห้อง & ผังที่นั่ง (PDF 4 แผ่น)
            </button>
            <button class="btn btn-primary btn-sm" data-action="print-room-seat-slips" data-id="${room.id}" style="background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important;">
              🖨️ พิมพ์บัตรประจำตัวที่นั่งเฉพาะห้องนี้ (8 ที่นั่ง/A4)
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-print-room-signoff" data-id="${room.id}">
              📋 ใบเซ็นชื่อผู้คุมห้องนี้
            </button>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-close-modal">ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>
  `;
}
