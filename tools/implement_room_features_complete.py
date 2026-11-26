import re

def get_modal_methods_code():
    return '''
  // --- ผังห้องใหญ่ (Large Room Floorplan View / Modal - ตามรูปที่ 2) ---
  renderLargeRoomFloorplanModal(roomId) {
    const room = (appState.rooms || []).find(r => r.id === roomId || r.roomCode === roomId || r.code === roomId) || appState.rooms[0];
    if (!room) return '';

    const pCount = (room.capacity || 0) >= 70 ? 3 : 2;
    const startSeat = room.seatStart || 1;
    const endSeat = room.seatEnd || (startSeat + (room.capacity || 0) - 1);
    const roomCode = room.roomCode || room.code || room.id;
    const officialName = room.officialName || room.name;
    const floor = room.floor || 1;

    // สร้างตารางโต๊ะคอมพิวเตอร์ตามรูปที่ 2 (คอลัมน์ซ้าย / ทางเดิน / คอลัมน์ขวา)
    const desksDiagramHtml = this.generateLargeRoomDesksHtml(room);

    return `
      <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;">
        <div class="modal-content" style="background: #FFFFFF; border-radius: 12px; width: 100%; max-width: 960px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25); border: 1px solid var(--border-subtle); overflow: hidden;">
          
          <!-- Modal Header -->
          <div class="modal-header" style="padding: 16px 24px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface-elevated, #F8FAFC);">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background: #F1F5F9; color: #475569; font-weight: 700; font-size: 12px; padding: 3px 8px;">ชั้น ${floor}</span>
                <span class="badge" style="${pCount === 3 ? 'background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D;' : 'background: #ECFDF5; color: #15803D; border: 1px solid #A7F3D0;'} font-size: 12px; font-weight: 700; padding: 3px 8px;">กรรมการ ${pCount} คน</span>
                <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main);">
                  ผังที่นั่งสอบห้อง ${roomCode} (${officialName})
                </h3>
              </div>
              <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">
                อาคารนวัตปัญญา (อาคาร 17) • ความจุ ${room.capacity} ที่นั่ง • ช่วงเลขที่นั่ง: <strong style="color: var(--primary-700);">${startSeat} - ${endSeat}</strong>
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-close-room-floorplan-modal" style="padding: 6px 12px; border-radius: 6px; font-weight: 700; cursor: pointer;">
              ✖ ปิด
            </button>
          </div>

          <!-- Modal Body (เลื่อนดูได้) -->
          <div class="modal-body" style="padding: 24px; overflow-y: auto; flex: 1; background: #F8FAFC;">
            <div style="max-width: 820px; margin: 0 auto; background: #FFFFFF; padding: 24px; border-radius: 12px; border: 1px solid var(--border-subtle); box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
              
              <!-- จอโปรเจคเตอร์ / กระดานดำหน้าห้องสอบ ตามรูปที่ 2 -->
              <div style="background: linear-gradient(135deg, #2D1445 0%, #3B1F54 100%); color: #FFFFFF; padding: 14px 20px; border-radius: 8px; text-align: center; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(45,20,69,0.25); border: 1px solid #4C1D95;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 15px;">
                  <span>🖥️</span>
                  <span>จอโปรเจคเตอร์ / กระดานดำหน้าห้องสอบ</span>
                </div>
                <div style="font-size: 12px; color: #E9D5FF; margin-top: 2px;">
                  (โต๊ะกรรมการกำกับการสอบ • ด้านหน้าห้อง)
                </div>
              </div>

              <!-- ผังโต๊ะคอมพิวเตอร์ -->
              <div style="overflow-x: auto; padding: 10px 0;">
                ${desksDiagramHtml}
              </div>

            </div>
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer" style="padding: 14px 24px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-print-room-plan-modal" data-room-id="${room.id}" style="font-weight: 600;">
                🖨️ พิมพ์ผังที่นั่งห้องนี้ (A4)
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-print-room-slips-modal" data-room-id="${room.id}" style="background-color: var(--brand-purple, #3B1F54) !important; color: white !important; font-weight: 700;">
                🖨️ พิมพ์บัตรประจำตัวที่นั่งเฉพาะห้องนี้ (8 ที่นั่ง/A4)
              </button>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-close-room-floorplan-modal-2" style="font-weight: 600;">
              ปิดหน้าต่าง
            </button>
          </div>

        </div>
      </div>
    `;
  }

  // ตัวช่วยสร้างผังโต๊ะคอมพิวเตอร์แยกคอลัมน์และทางเดินตรงกลาง (ตามรูปที่ 2)
  generateLargeRoomDesksHtml(room) {
    const cap = room.capacity || 40;
    const start = room.seatStart || 1;
    const end = room.seatEnd || (start + cap - 1);

    // กรณีห้องสโลปโรงภาพยนตร์ 17201 (80 ที่นั่ง)
    if (room.layoutType === 'trapezoid-rows' || cap >= 70) {
      const rowsCount = 10;
      const seatsPerRow = Math.ceil(cap / rowsCount);
      const halfRow = Math.ceil(seatsPerRow / 2);

      let rowsHtml = '';
      let curSeat = start;
      for (let rIdx = 1; rIdx <= rowsCount; rIdx++) {
        const leftSeats = [];
        const rightSeats = [];
        for (let i = 0; i < halfRow && curSeat <= end; i++) {
          leftSeats.push(curSeat++);
        }
        for (let i = 0; i < halfRow && curSeat <= end; i++) {
          rightSeats.push(curSeat++);
        }

        rowsHtml += `
          <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748B; width: 48px; text-align: right;">แถว ${rIdx}</div>
            <div style="display: flex; gap: 6px;">
              ${leftSeats.map(sNum => `
                <div style="width: 52px; height: 50px; border: 1.5px solid #10B981; border-radius: 6px; background: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                  <span style="font-size: 11px; line-height: 1;">🖥️</span>
                  <div style="font-size: 11.5px; font-weight: 800; color: #1E293B;">${sNum}</div>
                  <div style="font-size: 8.5px; color: #10B981; font-weight: 600;">ว่าง</div>
                </div>
              `).join('')}
            </div>
            <div style="font-size: 10px; color: #94A3B8; font-weight: 600; padding: 0 6px;">ทางเดิน</div>
            <div style="display: flex; gap: 6px;">
              ${rightSeats.map(sNum => `
                <div style="width: 52px; height: 50px; border: 1.5px solid #10B981; border-radius: 6px; background: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                  <span style="font-size: 11px; line-height: 1;">🖥️</span>
                  <div style="font-size: 11.5px; font-weight: 800; color: #1E293B;">${sNum}</div>
                  <div style="font-size: 8.5px; color: #10B981; font-weight: 600;">ว่าง</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      return `<div style="display: flex; flex-direction: column; align-items: center;">${rowsHtml}</div>`;
    }

    // กรณีห้องมาตรฐาน 4 คอลัมน์ (เช่น 40 ที่นั่ง: แถว 1, แถว 2, ทางเดิน, แถว 3, แถว 4 ตามรูปที่ 2)
    // หรือ 6 คอลัมน์ (เช่น 60 ที่นั่ง)
    let numCols = cap >= 60 ? 6 : (cap >= 50 ? 5 : 4);
    const rowsPerCol = Math.ceil(cap / numCols);

    // สร้างข้อมูลแต่ละคอลัมน์
    const columns = [];
    let cur = start;
    for (let c = 0; c < numCols; c++) {
      const colSeats = [];
      for (let r = 0; r < rowsPerCol && cur <= end; r++) {
        colSeats.push(cur++);
      }
      columns.push(colSeats);
    }

    const halfCols = Math.ceil(numCols / 2);
    const leftCols = columns.slice(0, halfCols);
    const rightCols = columns.slice(halfCols);

    const renderColumnGroup = (colGroup, startColIdx) => {
      return `
        <div style="display: flex; gap: 16px; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px; background: #FFFFFF;">
          ${colGroup.map((colSeats, idx) => `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 2px;">แถวที่ ${startColIdx + idx + 1}</div>
              ${colSeats.map(sNum => `
                <div class="desk-workstation" style="width: 58px; height: 56px; border: 1.5px solid #10B981; border-radius: 8px; background: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.15s ease;">
                  <span style="font-size: 13px; line-height: 1;">🖥️</span>
                  <div style="font-size: 13px; font-weight: 800; color: #1E293B; line-height: 1.1; margin-top: 1px;">${sNum}</div>
                  <div style="font-size: 9px; color: #10B981; font-weight: 600;">ว่าง</div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      `;
    };

    return `
      <div style="display: flex; align-items: stretch; justify-content: center; gap: 16px; margin: 0 auto; width: fit-content;">
        <!-- คอลัมน์ซ้าย -->
        ${renderColumnGroup(leftCols, 0)}

        <!-- ทางเดินตรงกลาง (ตามรูปที่ 2) -->
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 0 8px; border-left: 2px dashed #CBD5E1; border-right: 2px dashed #CBD5E1;">
          <span style="writing-mode: vertical-rl; text-orientation: upright; font-size: 11px; font-weight: 600; color: #94A3B8; letter-spacing: 6px;">ทางเดิน</span>
        </div>

        <!-- คอลัมน์ขวา -->
        ${renderColumnGroup(rightCols, halfCols)}
      </div>
    `;
  }

  // --- Modal ปรับความจุและเลื่อนเลขที่นั่งสอบอัตโนมัติ (ตามรูปที่ 3) ---
  renderCapacityAdjustmentModal() {
    const rooms = (appState.rooms || []).slice().sort((a, b) => {
      const codeA = a.roomCode || a.code || a.id;
      const codeB = b.roomCode || b.code || b.id;
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });

    const activeRooms = rooms.filter(r => r.isActive !== false);
    const totalCap = activeRooms.reduce((s, r) => s + (r.capacity || 0), 0);
    const totalProctors = activeRooms.reduce((s, r) => s + ((r.capacity || 0) >= 70 ? 3 : 2), 0);
    const minSeat = activeRooms.length > 0 ? (activeRooms[0].seatStart || 1) : 1;
    const maxSeat = activeRooms.length > 0 ? (activeRooms[activeRooms.length - 1].seatEnd || totalCap) : totalCap;

    return `
      <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;">
        <div class="modal-content" style="background: #FFFFFF; border-radius: 12px; width: 100%; max-width: 980px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25); border: 1px solid var(--border-subtle); overflow: hidden;">
          
          <!-- Modal Header -->
          <div class="modal-header" style="padding: 16px 24px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface-elevated, #F8FAFC);">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">⚙</span>
                <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main);">
                  ปรับความจุและคำนวณเลื่อนเลขที่นั่งสอบอัตโนมัติ
                </h3>
              </div>
              <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 3px;">
                เมื่อปรับเพิ่มหรือลดจำนวนที่นั่งในห้องใด ระบบจะทำการคำนวณและเลื่อน (Shift) ลำดับเลขที่นั่งสอบของห้องถัดไปโดยอัตโนมัติแบบเรียงลำดับต่อเนื่อง
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-cap-modal" style="padding: 6px 12px; border-radius: 6px; font-weight: 700; cursor: pointer;">
              ✖ ปิด
            </button>
          </div>

          <!-- Modal Body -->
          <div class="modal-body" style="padding: 20px 24px; overflow-y: auto; flex: 1;">
            
            <!-- ทางลัดตั้งค่าผังห้องสอบ / Presets ตามรูปที่ 3 -->
            <div style="margin-bottom: 16px; padding: 12px 16px; background: #F8FAFC; border: 1px solid var(--border-subtle); border-radius: 8px;">
              <div style="font-size: 12.5px; font-weight: 700; color: var(--text-main); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <span>⚡</span>
                <span>ทางลัดตั้งค่าผังห้องสอบ / คัดลอกจากก่อนหน้า:</span>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="btn btn-secondary btn-sm btn-cap-preset" data-preset="standard" style="background: #FFFFFF; font-size: 12px; padding: 5px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                  ↺ พิมพ์เขียวมาตรฐาน (10 ห้อง 520 ที่นั่ง)
                </button>
                <button type="button" class="btn btn-secondary btn-sm btn-cap-preset" data-preset="floor1" style="background: #FFFFFF; font-size: 12px; padding: 5px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                  ⊞ เฉพาะชั้น 1 (4 ห้อง 210 ที่นั่ง)
                </button>
                <button type="button" class="btn btn-secondary btn-sm btn-cap-preset" data-preset="floor2" style="background: #FFFFFF; font-size: 12px; padding: 5px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                  ⊞ เฉพาะชั้น 2 (6 ห้อง 310 ที่นั่ง)
                </button>
              </div>
            </div>

            <!-- ช่องระบุเลขที่นั่งเริ่มต้น -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding: 10px 14px; background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px;">
              <div>
                <strong style="color: #92400E; font-size: 13px;">เลขที่นั่งสอบเริ่มต้นของศูนย์สอบ:</strong>
                <span style="font-size: 12px; color: #78350F; margin-left: 6px;">ปกติเริ่มต้นที่ 1 (หรือระบุเลขอื่นตามประกาศการสอบรอบนั้นๆ)</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 12.5px; font-weight: 700; color: #92400E;">เริ่มที่:</span>
                <input type="number" id="input-start-seat-num" value="1" min="1" max="99999" style="width: 80px; padding: 4px 8px; font-size: 13px; font-weight: 800; text-align: center; border: 1px solid #D97706; border-radius: 6px; background: #FFFFFF;">
              </div>
            </div>

            <!-- ตารางห้องสอบ 10 ห้อง ปรับได้สดๆ ตามรูปที่ 3 -->
            <div class="table-wrapper" style="border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden;">
              <table class="data-table" id="table-adjust-capacity" style="margin: 0; width: 100%;">
                <thead style="background: #F1F5F9;">
                  <tr>
                    <th style="width: 24%;">ห้องสอบ</th>
                    <th style="width: 10%; text-align: center;">ใช้งาน</th>
                    <th style="width: 22%; text-align: center;">ความจุ (ที่นั่ง)</th>
                    <th style="width: 20%; text-align: center;">ช่วงเลขที่นั่ง (คำนวณสด)</th>
                    <th style="width: 12%; text-align: center;">กรรมการ</th>
                    <th style="width: 12%; text-align: center;">โต๊ะลงทะเบียน</th>
                  </tr>
                </thead>
                <tbody>
                  ${rooms.map((r, idx) => {
                    const isActive = r.isActive !== false;
                    const cap = r.capacity || 0;
                    const pCount = cap >= 70 ? 3 : 2;
                    return `
                      <tr class="room-cap-row" data-room-id="${r.id}" style="border-bottom: 1px solid var(--border-subtle); ${!isActive ? 'opacity: 0.55; background: #F8FAFC;' : ''}">
                        <td style="padding: 10px 14px;">
                          <div style="font-weight: 800; color: var(--text-main); font-size: 13.5px;">ห้อง ${r.roomCode || r.code || r.id}</div>
                          <div style="font-size: 11px; color: var(--text-muted); margin-top: 1px;">ห้องสอบที่ ${idx + 1} (${r.officialName || r.name})</div>
                        </td>
                        <td style="text-align: center; padding: 10px 14px;">
                          <input type="checkbox" class="toggle-room-active" data-room-id="${r.id}" ${isActive ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: #10B981;">
                        </td>
                        <td style="text-align: center; padding: 10px 14px;">
                          <div style="display: inline-flex; align-items: center; gap: 4px;">
                            <button type="button" class="btn btn-secondary btn-sm btn-cap-step" data-dir="-1" data-room-id="${r.id}" style="padding: 3px 10px; font-weight: 800; font-size: 13px; border-radius: 4px; cursor: pointer;">-</button>
                            <input type="number" class="form-input input-room-capacity" data-room-id="${r.id}" value="${cap}" min="0" max="250" style="width: 60px; text-align: center; font-weight: 800; font-size: 13.5px; padding: 4px; border: 1px solid var(--border); border-radius: 6px;">
                            <button type="button" class="btn btn-secondary btn-sm btn-cap-step" data-dir="1" data-room-id="${r.id}" style="padding: 3px 10px; font-weight: 800; font-size: 13px; border-radius: 4px; cursor: pointer;">+</button>
                          </div>
                        </td>
                        <td style="text-align: center; padding: 10px 14px;">
                          <span class="seat-range-display" data-room-id="${r.id}" style="font-weight: 800; color: var(--primary-700); font-size: 13px;">
                            ${isActive ? `${r.seatStart || 1} - ${r.seatEnd || cap}` : '-'}
                          </span>
                        </td>
                        <td style="text-align: center; padding: 10px 14px;">
                          <span class="badge proctors-badge-display" data-room-id="${r.id}" style="${pCount === 3 ? 'background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D;' : 'background: #ECFDF5; color: #15803D; border: 1px solid #A7F3D0;'} font-size: 11px; font-weight: 700; padding: 2px 7px;">
                            ${isActive ? `${pCount} คน` : '-'}
                          </span>
                        </td>
                        <td style="text-align: center; padding: 10px 14px;">
                          <span class="desk-display" data-room-id="${r.id}" style="font-size: 12px; color: var(--text-muted); font-weight: 600;">
                            ${isActive ? `โต๊ะ ${idx + 1}` : '-'}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- สรุปผลการปรับตั้งค่าแบบ Real-time -->
            <div id="capacity-modal-summary" style="padding: 14px 18px; background: #F8FAFC; border: 1px solid var(--border-subtle); border-radius: 8px; margin-top: 14px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div>
                <strong style="color: var(--text-main);">สรุปผลการปรับตั้งค่า:</strong>
                <span id="summary-active-rooms" style="margin-left: 6px; color: #334155;">เปิดสอบ ${activeRooms.length} ห้อง</span> •
                <span id="summary-total-cap" style="color: #15803D; font-weight: 700;">ความจุรวม ${totalCap} ที่นั่ง</span> •
                <span id="summary-seat-range" style="color: #1D4ED8; font-weight: 700;">ช่วงเลขที่นั่ง: ${minSeat} - ${maxSeat}</span>
              </div>
              <div>
                <span style="color: var(--text-muted);">กรรมการคุมสอบรวม:</span>
                <strong id="summary-total-proctors" style="color: #B45309; font-size: 14px; margin-left: 4px;">${totalProctors} คน</strong>
              </div>
            </div>

            <!-- ตัวเลือกการปรับเลื่อนเลขที่นั่งของผู้เข้าสอบ -->
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; margin-top: 12px; color: var(--text-main);">
              <input type="checkbox" id="chk-auto-reallocate" checked style="width: 16px; height: 16px; accent-color: #10B981;">
              <span>ปรับเลื่อนเลขที่นั่งของผู้เข้าสอบที่จัดสรรไว้แล้วโดยอัตโนมัติ (Re-allocate examinees)</span>
            </label>

          </div>

          <!-- Modal Footer -->
          <div class="modal-footer" style="padding: 14px 24px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; flex-wrap: wrap; gap: 10px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-reset-cap-modal-default" style="font-weight: 600;">
              คืนค่ามาตรฐานเดิม (520 ที่นั่ง)
            </button>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-cap-modal-2" style="font-weight: 600;">
                ยกเลิก
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-save-cap-modal" style="background-color: #10B981 !important; color: white !important; font-weight: 700; border: 1px solid #059669; padding: 6px 16px; box-shadow: 0 1px 3px rgba(16,185,129,0.3);">
                ✔ บันทึกและคำนวณเลขที่นั่งสอบใหม่ทั้งหมด
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }
'''

def update_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add hook into renderModal()
    target_modal_hook = """    // Modal: KPI 4 - รายงานการตรวจสอบกฎ (Rules Audit)
    if (this.activeModal.type === 'modal-kpi-rules-audit') {
      return renderKpiRulesAuditModal(appState, this.activeModal.data?.valResult || {});
    }"""

    replacement_modal_hook = """    // Modal: KPI 4 - รายงานการตรวจสอบกฎ (Rules Audit)
    if (this.activeModal.type === 'modal-kpi-rules-audit') {
      return renderKpiRulesAuditModal(appState, this.activeModal.data?.valResult || {});
    }

    // Modal: ผังห้องสอบใหญ่ (ตามรูปที่ 2)
    if (this.activeModal.type === 'room-floorplan') {
      return this.renderLargeRoomFloorplanModal(this.activeModal.roomId);
    }

    // Modal: ปรับความจุและเลื่อนเลขที่นั่งสอบอัตโนมัติ (ตามรูปที่ 3)
    if (this.activeModal.type === 'capacity-adjustment') {
      return this.renderCapacityAdjustmentModal();
    }"""

    if target_modal_hook in content:
        content = content.replace(target_modal_hook, replacement_modal_hook, 1)
        print(f"Added modal hooks in {filepath}")
    else:
        print(f"target_modal_hook not found in {filepath} (already added?)")

    # 2. Add modal methods right after renderModal()
    target_after_render_modal = """    return '';
  }

  // --- ผูก Event Handlers ทั้งหมด ---"""

    replacement_after_render_modal = """    return '';
  }
""" + get_modal_methods_code() + """
  // --- ผูก Event Handlers ทั้งหมด ---"""

    if target_after_render_modal in content:
        content = content.replace(target_after_render_modal, replacement_after_render_modal, 1)
        print(f"Added modal methods in {filepath}")
    else:
        print(f"target_after_render_modal not found in {filepath} (already added?)")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

update_file('src/ui/app-view.js')
update_file('split/js/25-app-view.js')
print("Finished updating modal methods.")
