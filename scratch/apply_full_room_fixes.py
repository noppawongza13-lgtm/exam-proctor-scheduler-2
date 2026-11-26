import re

new_render_rooms_seating = """  // --- มุมมองที่ 1: ผังห้องสอบและที่นั่ง (10 ห้องมาตรฐาน แถวละ 5 ห้อง พร้อมปุ่มจัดการและพิมพ์บัตร 8 ที่นั่ง/A4) ---
  renderRoomsSeatingGridView() {
    const activeRooms = (appState.rooms || []).filter(r => r.isActive !== false);
    const totalCapacity = activeRooms.reduce((s, r) => s + (r.capacity || 0), 0);
    const totalProctorsNeeded = activeRooms.reduce((s, r) => s + ((r.capacity || 0) >= 70 ? 3 : 2), 0);
    const minSeat = activeRooms.length > 0 ? (activeRooms[0].seatStart || 1) : 1;
    const maxSeat = activeRooms.length > 0 ? (activeRooms[activeRooms.length - 1].seatEnd || totalCapacity) : totalCapacity;

    const sortedRooms = [...(appState.rooms || [])].sort((a, b) => {
      const codeA = a.roomCode || a.code || a.id;
      const codeB = b.roomCode || b.code || b.id;
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });

    return `
      <!-- หัวข้อและปุ่มคำสั่งหลัก -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-body" style="padding: 16px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 22px;">🪑</span>
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main);">
                  ห้องสอบและผังที่นั่ง (10 ห้องสอบมาตรฐาน)
                </h2>
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์ อาคารนวัตปัญญา • รองรับการปรับเพิ่ม/ลดที่นั่งและเลื่อนลำดับเลขที่นั่งสอบอัตโนมัติ
              </div>
            </div>

            <!-- ปุ่มคำสั่ง 3 ปุ่ม -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-reset-standard-capacity" style="font-weight: 600; padding: 6px 14px; font-size: 12.5px; border-radius: 6px; cursor: pointer;">
                ↺ คืนค่าผังมาตรฐาน (520 ที่นั่ง)
              </button>
              <button type="button" class="btn btn-warning btn-sm" id="btn-open-capacity-modal" style="background-color: var(--brand-gold, #E5A823) !important; color: var(--brand-purple, #3B1F54) !important; font-weight: 700; border: 1px solid #D97706 !important; padding: 6px 14px; font-size: 12.5px; border-radius: 6px; cursor: pointer; box-shadow: 0 1px 3px rgba(217,119,6,0.25);">
                ⚙ ปรับความจุ / เลื่อนเลขที่นั่งสอบ
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-print-seat-slips" style="background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; padding: 6px 14px; font-size: 12.5px; border-radius: 6px; cursor: pointer; box-shadow: 0 1px 3px rgba(59,31,84,0.25);">
                🖨️ พิมพ์บัตรประจำตัวที่นั่งสอบ
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 4 KPI Stat Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 20px;">
        <div class="card" style="border-left: 4px solid var(--primary-700);">
          <div class="card-body" style="padding: 14px 18px;">
            <div style="font-size: 12.5px; color: var(--text-muted); font-weight: 600;">จำนวนห้องสอบที่เปิดใช้</div>
            <div style="font-size: 26px; font-weight: 800; color: var(--text-main); margin-top: 3px;">
              ${activeRooms.length} / ${appState.rooms.length} <span style="font-size: 13.5px; font-weight: 500; color: var(--text-muted);">ห้อง</span>
            </div>
          </div>
        </div>

        <div class="card" style="border-left: 4px solid #16a34a; background: rgba(22, 163, 74, 0.02);">
          <div class="card-body" style="padding: 14px 18px;">
            <div style="font-size: 12.5px; color: #16a34a; font-weight: 600;">ความจุที่นั่งสอบรวม</div>
            <div style="font-size: 26px; font-weight: 800; color: #15803d; margin-top: 3px;">
              ${totalCapacity} <span style="font-size: 13.5px; font-weight: 500; color: var(--text-muted);">ที่นั่ง</span>
            </div>
          </div>
        </div>

        <div class="card" style="border-left: 4px solid #2563eb; background: rgba(37, 99, 235, 0.02);">
          <div class="card-body" style="padding: 14px 18px;">
            <div style="font-size: 12.5px; color: #2563eb; font-weight: 600;">ช่วงเลขที่นั่งสอบทั้งหมด</div>
            <div style="font-size: 26px; font-weight: 800; color: #1d4ed8; margin-top: 3px;">
              ${minSeat} - ${maxSeat}
            </div>
          </div>
        </div>

        <div class="card" style="border-left: 4px solid #d97706; background: rgba(217, 119, 6, 0.02);">
          <div class="card-body" style="padding: 14px 18px;">
            <div style="font-size: 12.5px; color: #d97706; font-weight: 600;">กรรมการคุมสอบที่ต้องใช้</div>
            <div style="font-size: 26px; font-weight: 800; color: #b45309; margin-top: 3px;">
              ${totalProctorsNeeded} <span style="font-size: 13.5px; font-weight: 500; color: var(--text-muted);">คน</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ผังการ์ดห้องสอบ จัดแบบ แถวละ 5 ห้อง (2 แถว x 5 คอลัมน์) ตามผังเดิมและสเปกจริง -->
      <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; margin-bottom: 24px;" class="room-grid-5-col">
        ${sortedRooms.map((r, idx) => {
          const pCount = (r.capacity || 0) >= 70 ? 3 : 2;
          const isLarge = (r.capacity || 0) >= 70;
          const isActive = r.isActive !== false;
          
          let layoutDesc = 'บล็อกคอลัมน์มาตรฐาน';
          if (r.layoutType === 'trapezoid-rows' || (r.capacity || 0) >= 70) {
            layoutDesc = 'สโลปใหญ่ทรงพัด (6 แถว)';
          } else if (r.layoutType === 'staggered-rows') {
            layoutDesc = 'ผังสับหว่างแนวนอน (6 แถว)';
          } else if (r.layoutType === 'grid-rows') {
            layoutDesc = 'ผังแนวนอน (5 แถว)';
          } else if (r.blocks && r.blocks.length > 0) {
            layoutDesc = `${r.blocks.length} บล็อก (${r.blocks.map(b => b.name.replace(/\\s*\\(แถว.*?\\)/, '')).join('-')})`;
          }

          return `
            <div class="card room-card-item" data-action="view-room-detail" data-id="${r.id}" style="border: 1px solid var(--border-subtle); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; background: var(--bg-surface); transition: all 0.2s ease; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.04); ${!isActive ? 'opacity: 0.5; filter: grayscale(0.6);' : ''}">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span class="badge" style="background: #F1F5F9; color: #475569; font-weight: 700; font-size: 11px; padding: 2px 7px;">ชั้น ${r.floor || 1}</span>
                  <span class="badge" style="${pCount === 3 ? 'background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D;' : 'background: #ECFDF5; color: #15803D; border: 1px solid #A7F3D0;'} font-size: 11px; font-weight: 700; padding: 2px 7px;">กรรมการ ${pCount} คน</span>
                </div>
                <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 4px; margin-bottom: 2px;">
                  <div style="font-size: 16px; font-weight: 800; color: var(--text-main);">
                    ห้อง ${r.roomCode || r.code || r.id}
                  </div>
                  <div style="font-size: 12px; font-weight: 700; color: var(--primary-700); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${r.officialName || ''}
                  </div>
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px; line-height: 1.3;">
                  ห้องสอบที่ ${r.roomNumber || (idx + 1)} • ${r.building || 'อาคาร 17'} • โต๊ะลงทะเบียนที่ ${r.roomNumber || (idx + 1)}
                </div>
                <div style="border-top: 1px solid var(--border-subtle); padding-top: 10px; display: flex; flex-direction: column; gap: 5px;">
                  <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span style="color: var(--text-muted);">ความจุที่นั่งสอบ:</span>
                    <strong style="color: var(--text-main);">${r.capacity || 0} ที่นั่ง</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span style="color: var(--text-muted);">ช่วงเลขที่นั่ง:</span>
                    <strong style="color: var(--primary-700);">${r.seatStart || 1} - ${r.seatEnd || r.capacity}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span style="color: var(--text-muted);">รูปแบบผัง:</span>
                    <span style="color: var(--text-muted); font-size: 11px; text-align: right; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${layoutDesc}">${layoutDesc}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 11.5px;">
                    <span style="color: var(--text-muted);">ประตู & แอร์:</span>
                    <span style="color: var(--text-muted); font-size: 11px; text-align: right;">${r.doors || '2 บาน'} • แอร์ ${r.airConditioners || 4} ตัว</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 11.5px;">
                    <span style="color: var(--text-muted);">คนพิการ:</span>
                    <span style="font-size: 11px; font-weight: 600; color: ${r.accessibleForDisabled ? '#15803D' : '#64748B'};">${r.accessibleForDisabled ? '♿ รองรับ' : 'ทั่วไป'}</span>
                  </div>
                  ${isLarge ? `
                    <div style="font-size: 10px; color: #B45309; font-weight: 600; margin-top: 2px; line-height: 1.25;">
                      * ห้องขนาดใหญ่ (>= 70 ที่นั่ง) กำหนดกรรมการ 3 คน
                    </div>
                  ` : ''}
                </div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" data-action="view-room-detail" data-id="${r.id}" style="width: 100%; margin-top: 10px; justify-content: center; font-size: 12px; font-weight: 600; border-radius: 6px; padding: 6px 10px; background: #FFFFFF; border: 1px solid var(--border-subtle);">
                ⊞ ดูและปรับแต่งผังที่นั่ง
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }"""

new_render_capacity_modal = """  // --- Modal ปรับความจุและเลื่อนเลขที่นั่งสอบอัตโนมัติ (ออกแบบให้เลื่อนลงได้ง่าย ใช้ง่าย สบายตา) ---
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
      <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px; overflow-y: auto;">
        <div class="modal-content" style="background: #FFFFFF; border-radius: 12px; width: 100%; max-width: 980px; height: 90vh; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); border: 1px solid var(--border-subtle); overflow: hidden; margin: auto;">
          
          <!-- Modal Header -->
          <div class="modal-header" style="padding: 14px 22px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; flex-shrink: 0;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">⚙</span>
                <h3 style="margin: 0; font-size: 17.5px; font-weight: 800; color: var(--text-main);">
                  ปรับความจุและคำนวณเลื่อนเลขที่นั่งสอบอัตโนมัติ
                </h3>
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                ระบบคำนวณและเลื่อน (Shift) ลำดับเลขที่นั่งสอบของห้องถัดไปอัตโนมัติเมื่อปรับจำนวนที่นั่ง
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-cap-modal" style="padding: 5px 12px; border-radius: 6px; font-weight: 700; cursor: pointer;">
              ✖ ปิด
            </button>
          </div>

          <!-- Modal Body (เลื่อนลงได้อย่างราบรื่น 100%) -->
          <div class="modal-body" style="padding: 16px 22px; overflow-y: auto; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 12px;">
            
            <!-- แถบควบคุมทางลัดและเลขเริ่มต้นแบบกะทัดรัด -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: #F1F5F9; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-subtle); flex-shrink: 0;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 12px; font-weight: 700; color: #475569;">⚡ ทางลัดผังสอบ:</span>
                <button type="button" class="btn btn-secondary btn-sm btn-cap-preset" data-preset="standard" style="background: #FFFFFF; font-size: 12px; padding: 4px 10px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                  ↺ มาตรฐานเดิม (10 ห้อง 520 ที่นั่ง)
                </button>
                <button type="button" class="btn btn-secondary btn-sm btn-cap-preset" data-preset="floor1" style="background: #FFFFFF; font-size: 12px; padding: 4px 10px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                  ⊞ เฉพาะชั้น 1 (4 ห้อง 210 ที่นั่ง)
                </button>
                <button type="button" class="btn btn-secondary btn-sm btn-cap-preset" data-preset="floor2" style="background: #FFFFFF; font-size: 12px; padding: 4px 10px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                  ⊞ เฉพาะชั้น 2 (6 ห้อง 310 ที่นั่ง)
                </button>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; font-weight: 700; color: #92400E;">เลขเริ่มต้น:</span>
                <input type="number" id="input-start-seat-num" value="${minSeat || 1}" min="1" max="99999" style="width: 75px; padding: 4px 8px; font-size: 13px; font-weight: 800; text-align: center; border-radius: 6px; border: 1.5px solid #F59E0B; background: #FFFBEB; color: #78350F;">
              </div>
            </div>

            <!-- กล่องตารางห้องสอบ 10 ห้อง ที่เลื่อนดูได้อย่างชัดเจน -->
            <div class="table-wrapper" style="border: 1px solid var(--border-subtle); border-radius: 8px; overflow-y: auto; flex: 1 1 auto; min-height: 220px; background: #FFFFFF; box-shadow: inset 0 1px 3px rgba(0,0,0,0.03);">
              <table class="data-table" id="table-adjust-capacity" style="margin: 0; width: 100%; border-collapse: separate; border-spacing: 0;">
                <thead style="position: sticky; top: 0; z-index: 5; background: #F8FAFC;">
                  <tr style="border-bottom: 1.5px solid #E2E8F0;">
                    <th style="padding: 10px 14px; width: 28%; font-size: 12.5px; font-weight: 700; color: #475569; background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0;">ห้องสอบ</th>
                    <th style="padding: 10px 10px; width: 12%; text-align: center; font-size: 12.5px; font-weight: 700; color: #475569; background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0;">เปิดใช้งาน</th>
                    <th style="padding: 10px 14px; width: 22%; text-align: center; font-size: 12.5px; font-weight: 700; color: #475569; background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0;">ความจุที่นั่ง</th>
                    <th style="padding: 10px 14px; width: 18%; text-align: center; font-size: 12.5px; font-weight: 700; color: #475569; background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0;">ช่วงเลขที่นั่ง (สด)</th>
                    <th style="padding: 10px 10px; width: 10%; text-align: center; font-size: 12.5px; font-weight: 700; color: #475569; background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0;">กรรมการ</th>
                    <th style="padding: 10px 10px; width: 10%; text-align: center; font-size: 12.5px; font-weight: 700; color: #475569; background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0;">โต๊ะทะเบียน</th>
                  </tr>
                </thead>
                <tbody>
                  ${rooms.map((r, idx) => {
                    const isActive = r.isActive !== false;
                    const cap = r.capacity || 0;
                    const pCount = cap >= 70 ? 3 : 2;
                    return `
                      <tr class="room-cap-row" data-room-id="${r.id}" style="border-bottom: 1px solid #F1F5F9; transition: background 0.15s; ${!isActive ? 'opacity: 0.45; background: #F8FAFC;' : ''}">
                        <td style="padding: 9px 14px;">
                          <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-weight: 800; color: var(--text-main); font-size: 13.5px;">ห้อง ${r.roomCode || r.code || r.id}</span>
                            <span class="badge" style="font-size: 10px; padding: 1px 5px; background: #E2E8F0; color: #475569;">ชั้น ${r.floor || 1}</span>
                          </div>
                          <div style="font-size: 11px; color: var(--primary-700); font-weight: 600; margin-top: 1px;">
                            ${r.officialName || r.name}
                          </div>
                        </td>
                        <td style="text-align: center; padding: 9px 10px;">
                          <input type="checkbox" class="toggle-room-active" data-room-id="${r.id}" ${isActive ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #16A34A; cursor: pointer;">
                        </td>
                        <td style="text-align: center; padding: 9px 14px;">
                          <div style="display: inline-flex; align-items: center; gap: 4px;">
                            <button type="button" class="btn btn-secondary btn-sm btn-cap-step" data-dir="-1" data-room-id="${r.id}" style="width: 28px; height: 28px; padding: 0; font-size: 14px; font-weight: 700; line-height: 1; border-radius: 4px; cursor: pointer;">-</button>
                            <input type="number" class="form-input input-room-capacity" data-room-id="${r.id}" value="${cap}" min="1" max="500" style="width: 65px; height: 28px; text-align: center; font-weight: 800; font-size: 13.5px; padding: 2px 4px; border-radius: 4px; border: 1px solid var(--border-subtle);">
                            <button type="button" class="btn btn-secondary btn-sm btn-cap-step" data-dir="1" data-room-id="${r.id}" style="width: 28px; height: 28px; padding: 0; font-size: 14px; font-weight: 700; line-height: 1; border-radius: 4px; cursor: pointer;">+</button>
                          </div>
                        </td>
                        <td style="text-align: center; padding: 9px 14px;">
                          <span class="seat-range-display" data-room-id="${r.id}" style="font-weight: 800; font-size: 13px; color: var(--primary-700);">
                            ${isActive ? `${r.seatStart || 1} - ${r.seatEnd || cap}` : '-'}
                          </span>
                        </td>
                        <td style="text-align: center; padding: 9px 10px;">
                          <span class="badge proctors-badge-display" data-room-id="${r.id}" style="${pCount === 3 ? 'background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A;' : 'background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0;'} font-size: 11px; font-weight: 700; padding: 2px 7px;">
                            ${isActive ? `${pCount} คน` : '-'}
                          </span>
                        </td>
                        <td style="text-align: center; padding: 9px 10px;">
                          <span class="desk-display" data-room-id="${r.id}" style="font-size: 11.5px; color: var(--text-muted); font-weight: 600;">
                            ${isActive ? `โต๊ะ ${idx + 1}` : '-'}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- สรุปผลการปรับตั้งค่าแบบกะทัดรัด & ตัวเลือก Re-allocate -->
            <div id="capacity-modal-summary" style="padding: 10px 16px; background: #F8FAFC; border: 1px solid var(--border-subtle); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; flex-shrink: 0;">
              <div style="font-size: 13px;">
                <strong style="color: var(--text-main);">สรุปผล:</strong>
                <span id="summary-active-rooms" style="margin-left: 6px; color: #334155;">เปิดสอบ ${activeRooms.length} ห้อง</span> • 
                <span id="summary-total-cap" style="color: #15803D; font-weight: 800;">ความจุรวม ${totalCap} ที่นั่ง</span> • 
                <span id="summary-seat-range" style="color: #1D4ED8; font-weight: 800;">ช่วงเลขที่นั่ง: ${minSeat} - ${maxSeat}</span>
              </div>
              <div style="font-size: 13px;">
                <span style="color: var(--text-muted);">กรรมการคุมสอบรวม:</span>
                <strong id="summary-total-proctors" style="color: #B45309; font-size: 14px; margin-left: 4px;">${totalProctors} คน</strong>
              </div>
            </div>

            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text-muted); margin-top: -4px; flex-shrink: 0;">
              <input type="checkbox" id="chk-auto-reallocate" checked style="width: 15px; height: 15px; accent-color: #16A34A;">
              <span>ปรับเลื่อนเลขที่นั่งของผู้เข้าสอบที่จัดสรรไว้แล้วโดยอัตโนมัติ (Re-allocate examinees)</span>
            </label>

          </div>

          <!-- Modal Footer (ตรึงอยู่ด้านล่างเสมอ) -->
          <div class="modal-footer" style="padding: 12px 22px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; flex-shrink: 0;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-reset-cap-modal-default" style="font-weight: 600; font-size: 12px;">
              ↺ คืนค่ามาตรฐานเดิม (520 ที่นั่ง)
            </button>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-cap-modal-2" style="font-weight: 600; font-size: 12px;">
                ยกเลิก
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-save-cap-modal" style="background-color: #16A34A !important; border: 1px solid #15803D !important; font-weight: 700; font-size: 12.5px; box-shadow: 0 1px 3px rgba(22,163,74,0.3);">
                ✔ บันทึกและคำนวณเลขที่นั่งสอบใหม่ทั้งหมด
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }"""

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Replace renderRoomsSeatingGridView
    pattern_seating = r'// --- มุมมองที่ 1: ผังห้องสอบและที่นั่ง.*?\n  renderRoomsSeatingGridView\(\) \{.*?\n  \}'
    if re.search(pattern_seating, content, re.DOTALL):
        content = re.sub(pattern_seating, lambda m: new_render_rooms_seating, content, flags=re.DOTALL)
        print(f"Replaced renderRoomsSeatingGridView in {filepath}")
    else:
        print(f"Warning: pattern_seating not found in {filepath}")

    # 2. Replace renderCapacityAdjustmentModal
    pattern_cap = r'// --- Modal ปรับความจุและเลื่อนเลขที่นั่งสอบอัตโนมัติ.*?\n  renderCapacityAdjustmentModal\(\) \{.*?\n  \}'
    if re.search(pattern_cap, content, re.DOTALL):
        content = re.sub(pattern_cap, lambda m: new_render_capacity_modal, content, flags=re.DOTALL)
        print(f"Replaced renderCapacityAdjustmentModal in {filepath}")
    else:
        print(f"Warning: pattern_cap not found in {filepath}")

    # 3. In renderModal(), route 'room-floorplan' directly to renderRoomDetailModal
    target_modal = """    // Modal: ผังห้องสอบใหญ่ (ตามรูปที่ 2)
    if (this.activeModal.type === 'room-floorplan') {
      return this.renderLargeRoomFloorplanModal(this.activeModal.roomId);
    }"""
    replacement_modal = """    // Modal: ผังห้องสอบใหญ่และสเปกห้องจริง
    if (this.activeModal.type === 'room-floorplan') {
      const room = (appState.rooms || []).find(r => r.id === this.activeModal.roomId || r.roomCode === this.activeModal.roomId || r.code === this.activeModal.roomId) || appState.rooms[0];
      if (room) {
        this.roomDetailSubTab = 'seating';
        return this.renderRoomDetailModal(room);
      }
    }"""
    if target_modal in content:
        content = content.replace(target_modal, replacement_modal, 1)
        print(f"Updated room-floorplan routing in {filepath}")
    else:
        print(f"Note: target_modal not matched directly in {filepath}")

    # 4. In attachEvents(), ensure data-action="print-room-seat-slips" is handled
    if "data-action=\"print-room-seat-slips\"" not in content:
        target_event = """    this.root.querySelectorAll('[data-action="print-room-sign"]').forEach(btn => {"""
        replacement_event = """    this.root.querySelectorAll('[data-action="print-room-seat-slips"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rId = btn.getAttribute('data-id');
        openPrintableSeatSlips(appState, rId);
      });
    });

    this.root.querySelectorAll('[data-action="print-room-sign"]').forEach(btn => {"""
        if target_event in content:
            content = content.replace(target_event, replacement_event, 1)
            print(f"Added print-room-seat-slips event handler to {filepath}")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('src/ui/app-view.js')
process_file('split/js/25-app-view.js')
