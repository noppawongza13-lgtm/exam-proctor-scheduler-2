# -*- coding: utf-8 -*-
import sys
from pathlib import Path

def apply_refinements():
    # =========================================================================
    # 1. Update src/ui/app-view.js
    # =========================================================================
    app_view_path = Path("src/ui/app-view.js")
    content = app_view_path.read_text(encoding="utf-8")

    # 1.1 In renderRoomsTableView: update table header width & hint
    old_hint = """                <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">จัดการข้อมูลห้องสอบ (${appState.rooms.length} ห้อง)</h3>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  ศูนย์สอบ CBT อาคาร 17 • ความจุรวม ${appState.rooms.reduce((s, r) => s + (r.capacity || 0), 0)} ที่นั่ง
                </div>"""

    new_hint = """                <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">จัดการข้อมูลห้องสอบ (${appState.rooms.length} ห้อง)</h3>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  ศูนย์สอบ CBT อาคาร 17 • ความจุรวม ${appState.rooms.reduce((s, r) => s + (r.capacity || 0), 0)} ที่นั่ง • 💡 <span style="color: var(--primary-700); font-weight: 600;">ดับเบิ้ลคลิกที่แถวห้องสอบเพื่อดูรายละเอียดได้ทันที</span>
                </div>"""

    if old_hint in content:
        content = content.replace(old_hint, new_hint)
        print("Updated table header subtitle hint in renderRoomsTableView.")

    # 1.2 In renderRoomsTableView: update columns and rows
    old_table_body = """              <thead>
                <tr>
                  <th>รหัสห้อง</th>
                  <th>ชื่อห้องสอบ / ชื่อทางการ</th>
                  <th>อาคาร / ชั้น</th>
                  <th>ความจุ</th>
                  <th>เลขที่นั่งสอบ</th>
                  <th>ประเภทห้อง</th>
                  <th>รองรับคนพิการ</th>
                  <th>สถานะ</th>
                  <th style="text-align: center; width: 270px;">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${appState.rooms.map(r => `
                  <tr>
                    <td>
                      <button class="btn btn-link btn-sm" data-action="view-room-detail" data-id="${r.id}" style="font-weight: 800; padding: 0; text-decoration: underline;" title="คลิกเพื่อดูรายละเอียดห้องสอบ">
                        ${r.roomCode || r.id}
                      </button>
                    </td>
                    <td>
                      <div style="cursor: pointer;" data-action="view-room-detail" data-id="${r.id}">
                        <strong>${r.name}</strong>
                        ${r.officialName && !r.name.includes(r.officialName) ? `<div style="font-size: 11px; color: var(--text-muted);">${r.officialName}</div>` : ''}
                      </div>
                    </td>
                    <td>${r.building} (ชั้น ${r.floor})</td>
                    <td><strong>${r.capacity}</strong> ที่นั่ง</td>
                    <td><span class="badge badge-normal" style="font-weight: 700; color: var(--primary-700);">${r.seatStart && r.seatEnd ? `${r.seatStart} - ${r.seatEnd}` : `${r.capacity} ที่`}</span></td>
                    <td><span class="badge ${r.roomType === 'computer' ? 'badge-primary' : 'badge-normal'}">${r.roomType === 'computer' ? '💻 CBT คอมพิวเตอร์' : '📝 บรรยาย'}</span></td>
                    <td><span class="badge ${r.accessibleForDisabled ? 'badge-success' : 'badge-normal'}">${r.accessibleForDisabled ? '♿ รองรับ' : '❌ ไม่รองรับ'}</span></td>
                    <td><span class="badge ${r.isActive !== false ? 'badge-success' : 'badge-danger'}">${r.isActive !== false ? 'เปิดสอบ' : 'ปิด'}</span></td>
                    <td style="text-align: center; white-space: nowrap;">
                      <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: center;">
                        <button class="btn btn-secondary btn-sm" data-action="view-room-detail" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px;" title="ดูข้อมูลผังและสเปกห้อง">🔍 รายละเอียด</button>
                        <button class="btn btn-secondary btn-sm" data-action="print-room-plan" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px;" title="พิมพ์ผังที่นั่งห้องนี้">🖨️ ผังที่นั่ง</button>
                        <button class="btn btn-secondary btn-sm" data-action="print-room-sign" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px;" title="พิมพ์ป้ายติดหน้าห้องสอบ">📄 ป้ายห้อง</button>
                        <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="rooms" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px;">✏️ แก้ไข</button>
                        <button class="btn btn-danger btn-sm" data-action="delete-master" data-type="rooms" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px;">🗑️ ลบ</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>"""

    new_table_body = """              <thead>
                <tr>
                  <th style="white-space: nowrap;">รหัสห้อง</th>
                  <th>ชื่อห้องสอบ / ชื่อทางการ</th>
                  <th style="white-space: nowrap;">ชั้น</th>
                  <th style="white-space: nowrap;">ความจุ</th>
                  <th style="white-space: nowrap;">เลขที่นั่งสอบ</th>
                  <th style="white-space: nowrap;">ประเภทห้อง</th>
                  <th style="white-space: nowrap;">คนพิการ</th>
                  <th style="white-space: nowrap;">สถานะ</th>
                  <th style="text-align: center; width: 185px; white-space: nowrap;">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${appState.rooms.map(r => `
                  <tr class="room-table-row" data-id="${r.id}" style="cursor: pointer;" title="ดับเบิ้ลคลิกเพื่อเปิดดูรายละเอียดและผังที่นั่งห้องนี้">
                    <td style="white-space: nowrap;">
                      <button class="btn btn-link btn-sm" data-action="view-room-detail" data-id="${r.id}" style="font-weight: 800; padding: 0; text-decoration: underline;" title="คลิกเพื่อดูรายละเอียดห้องสอบ">
                        ${r.roomCode || r.id}
                      </button>
                    </td>
                    <td>
                      <div style="cursor: pointer;" data-action="view-room-detail" data-id="${r.id}">
                        <strong>${r.name}</strong>
                        ${r.officialName && !r.name.includes(r.officialName) ? `<div style="font-size: 11px; color: var(--text-muted);">${r.officialName}</div>` : ''}
                      </div>
                    </td>
                    <td style="white-space: nowrap;">ชั้น ${r.floor || 1}</td>
                    <td style="white-space: nowrap;"><strong>${r.capacity}</strong> ที่นั่ง</td>
                    <td style="white-space: nowrap;"><span class="badge badge-normal" style="font-weight: 700; color: var(--primary-700);">${r.seatStart && r.seatEnd ? `${r.seatStart} - ${r.seatEnd}` : `${r.capacity} ที่`}</span></td>
                    <td style="white-space: nowrap;"><span class="badge ${r.roomType === 'computer' ? 'badge-primary' : 'badge-normal'}">${r.roomType === 'computer' ? '💻 CBT' : '📝 บรรยาย'}</span></td>
                    <td style="white-space: nowrap;"><span class="badge ${r.accessibleForDisabled ? 'badge-success' : 'badge-normal'}">${r.accessibleForDisabled ? '♿ รองรับ' : '❌ ไม่รองรับ'}</span></td>
                    <td style="white-space: nowrap;"><span class="badge ${r.isActive !== false ? 'badge-success' : 'badge-danger'}">${r.isActive !== false ? 'เปิดสอบ' : 'ปิด'}</span></td>
                    <td style="text-align: center; white-space: nowrap;">
                      <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: center;">
                        <button class="btn btn-secondary btn-sm" data-action="view-room-detail" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px; font-weight: 600;" title="ดูข้อมูลผังและสเปกห้อง">🔍 รายละเอียด</button>
                        <button class="btn btn-secondary btn-sm" data-action="print-room-sign" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px;" title="พิมพ์ป้ายติดหน้าห้องสอบ">📄 ป้ายห้อง</button>
                        <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="rooms" data-id="${r.id}" style="padding: 3px 7px; font-size: 12px;" title="แก้ไขข้อมูลห้อง">✏️</button>
                        <button class="btn btn-danger btn-sm" data-action="delete-master" data-type="rooms" data-id="${r.id}" style="padding: 3px 7px; font-size: 12px;" title="ลบห้องสอบ">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>"""

    if old_table_body in content:
        content = content.replace(old_table_body, new_table_body)
        print("Updated table rows and removed redundant print-room-plan button in renderRoomsTableView.")
    else:
        print("WARNING: old_table_body not found exactly in app-view.js!")

    # 1.3 Add dblclick event listener for .room-table-row
    old_event_anchor = """    // ปุ่มคืนค่าผังมาตรฐาน (520 ที่นั่ง)
    const btnResetStdCap = this.root.querySelector('#btn-reset-standard-capacity');"""

    new_dblclick_event = """    // ดับเบิ้ลคลิกแถวในตารางห้องสอบเพื่อเปิดดูรายละเอียดและผังที่นั่ง
    this.root.querySelectorAll('.room-table-row').forEach(tr => {
      tr.addEventListener('dblclick', (e) => {
        if (e.target.closest('button, a, input, select')) return;
        const rId = tr.getAttribute('data-id');
        const room = (appState.rooms || []).find(x => x.id === rId);
        if (room) {
          this.roomDetailSubTab = 'seating';
          this.activeModal = { type: 'modal-room-detail', room };
          this.render();
        }
      });
    });

    // ปุ่มคืนค่าผังมาตรฐาน (520 ที่นั่ง)
    const btnResetStdCap = this.root.querySelector('#btn-reset-standard-capacity');"""

    if old_event_anchor in content:
        content = content.replace(old_event_anchor, new_dblclick_event)
        print("Added dblclick handler for room-table-row.")

    app_view_path.write_text(content, encoding="utf-8")
    print("Saved src/ui/app-view.js.")

    split_app_view = Path("split/js/25-app-view.js")
    if split_app_view.exists():
        split_app_view.write_text(content, encoding="utf-8")
        print("Mirrored to split/js/25-app-view.js.")

    # =========================================================================
    # 2. Update src/ui/building-floor-plan.js (Make Seating Plan prominent & no scroll needed)
    # =========================================================================
    bfp_path = Path("src/ui/building-floor-plan.js")
    bfp_content = bfp_path.read_text(encoding="utf-8")

    # 2.1 Replace subTab === 'seating' inner container
    old_bfp_seating_tab = """  if (subTab === 'seating') {
    const disabledCount = (room.disabledSeats || []).length;
    const accessibleCount = (room.accessibleSeats || []).length;

    tabContentHtml = `
      <div style="background: var(--bg-surface); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle); margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong style="color: var(--primary-700); font-size: 14px;">🗺️ แผนผังโต๊ะสอบและเลขที่นั่งจริง</strong>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              จำลองตำแหน่งโต๊ะสอบ, เลขที่นั่งสอบ, จอโปรเจคเตอร์ และประตูทางเข้าออกตามสภาพจริงของห้อง ${room.roomCode || room.id}
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <span class="badge badge-primary">ความจุ ${room.capacity} ที่นั่ง</span>
            ${disabledCount > 0 ? `<span class="badge" style="background: #FEE2E2; color: #991B1B; font-weight: 700;">🚫 ปิด ${disabledCount} ที่</span>` : ''}
            ${accessibleCount > 0 ? `<span class="badge" style="background: #DBEAFE; color: #1E40AF; font-weight: 700;">♿ คนพิการ ${accessibleCount} ที่</span>` : ''}
            <span class="badge badge-normal" style="font-weight: 700;">เลขที่ ${room.seatStart || 1} - ${room.seatEnd || room.capacity}</span>
          </div>
        </div>
      </div>

      <div style="max-height: 60vh; overflow-y: auto; padding: 4px;">
        ${renderSeatingPlanInnerDiagram(room)}
      </div>
    `;"""

    new_bfp_seating_tab = """  if (subTab === 'seating') {
    tabContentHtml = `
      <div style="padding: 0; display: flex; flex-direction: column; align-items: center;">
        ${renderSeatingPlanInnerDiagram(room)}
      </div>
    `;"""

    if old_bfp_seating_tab in bfp_content:
        bfp_content = bfp_content.replace(old_bfp_seating_tab, new_bfp_seating_tab)
        print("Compacted subTab === 'seating' in building-floor-plan.js.")
    else:
        print("WARNING: old_bfp_seating_tab not found directly in building-floor-plan.js!")

    # 2.2 Compact the header & metrics section in renderRoomDetailModal
    old_modal_shell = """        <!-- 4 Summary Metrics Cards -->
        <div style="padding: 12px 16px 0 16px; flex-shrink: 0;">
          <div class="room-metrics-grid">
            <div class="room-metric-box">
              <span class="label">👥 ความจุที่นั่งสอบ</span>
              <span class="value" style="color: var(--primary-700);">${room.capacity} ที่นั่ง</span>
              <span style="font-size: 11px; color: var(--text-muted);">${room.seatStart && room.seatEnd ? `เลขที่ ${room.seatStart} - ${room.seatEnd}` : ''}</span>
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

          <!-- Subnav Tabs -->
          <div class="room-detail-subnav">
            <button class="room-detail-subnav-btn ${subTab === 'seating' ? 'active' : ''}" data-room-detail-tab="seating">
              🗺️ แผนผังที่นั่งสอบจริง (Seating Plan)
            </button>
            <button class="room-detail-subnav-btn ${subTab === 'specs' ? 'active' : ''}" data-room-detail-tab="specs">
              🏢 ข้อมูลห้อง & อุปกรณ์ (Facilities & Specs)
            </button>
            <button class="room-detail-subnav-btn ${subTab === 'proctors' ? 'active' : ''}" data-room-detail-tab="proctors">
              📅 รอบการสอบ & ผู้คุมสอบ (${roomAllocs.length} รอบ)
            </button>
          </div>
        </div>"""

    new_modal_shell = """        <!-- Specs Bar & Subnav Tabs (ปรับลดขนาดเพื่อให้ผังห้องเด่นชัด เต็มตา ไม่ต้องเลื่อนดู) -->
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
                <span class="value" style="color: var(--primary-700);">${room.capacity} ที่นั่ง</span>
                <span style="font-size: 11px; color: var(--text-muted);">${room.seatStart && room.seatEnd ? `เลขที่ ${room.seatStart} - ${room.seatEnd}` : ''}</span>
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
        </div>"""

    if old_modal_shell in bfp_content:
        bfp_content = bfp_content.replace(old_modal_shell, new_modal_shell)
        print("Updated metrics cards and subnav tabs in building-floor-plan.js.")
    else:
        print("WARNING: old_modal_shell not found in building-floor-plan.js!")

    bfp_path.write_text(bfp_content, encoding="utf-8")
    print("Saved src/ui/building-floor-plan.js.")

    split_bfp = Path("split/js/22-building-floor-plan.js")
    if split_bfp.exists():
        split_bfp.write_text(bfp_content, encoding="utf-8")
        print("Mirrored to split/js/22-building-floor-plan.js.")

    # =========================================================================
    # 3. Compact renderSeatingPlanInnerDiagram in src/io/pdf-export.js
    # =========================================================================
    pdf_path = Path("src/io/pdf-export.js")
    pdf_content = pdf_path.read_text(encoding="utf-8")

    # Front screen styling compact
    old_front_wall = """      <!-- Front Wall (จอโปรเจคเตอร์ & ประตูทางเข้า/ออก ตามสภาพจริง) -->
      <div class="room-wall-front" style="position: relative; display: flex; justify-content: center; align-items: center; min-height: 40px; padding: 6px 12px;">"""

    new_front_wall = """      <!-- Front Wall (จอโปรเจคเตอร์ & ประตูทางเข้า/ออก กะทัดรัดพอดีสายตา) -->
      <div class="room-wall-front" style="position: relative; display: flex; justify-content: center; align-items: center; min-height: 32px; padding: 3px 10px; margin-bottom: 2px;">"""

    if old_front_wall in pdf_content:
        pdf_content = pdf_content.replace(old_front_wall, new_front_wall)
        print("Compacted front wall in pdf-export.js.")

    # Blocks gap & padding compact
    old_blocks = """      <div style="display: flex; justify-content: center; gap: 20px; width: 100%; margin-top: 14px; flex-wrap: wrap;">
        ${room.blocks.map(block => `
          <div style="display: flex; flex-direction: column; align-items: center; border: 1px dashed #cbd5e1; padding: 8px 10px; border-radius: 6px; background: rgba(248,250,252,0.6);">
            <div style="font-size: 10px; color: #64748b; margin-bottom: 6px; font-weight: 600;">${block.name}</div>
            <div style="display: flex; gap: 4px;">
              ${block.columns.map((col, cIdx) => `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                  <span style="font-size: 10px; color: #64748b; line-height: 1;">⬇️</span>
                  ${col.map(s => renderCell(s)).join('')}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>"""

    new_blocks = """      <div style="display: flex; justify-content: center; gap: 14px; width: 100%; margin-top: 6px; flex-wrap: wrap;">
        ${room.blocks.map(block => `
          <div style="display: flex; flex-direction: column; align-items: center; border: 1.5px dashed #CBD5E1; padding: 5px 8px; border-radius: 6px; background: #F8FAFC;">
            <div style="font-size: 10px; color: #64748B; margin-bottom: 4px; font-weight: 700;">${block.name}</div>
            <div style="display: flex; gap: 3.5px;">
              ${block.columns.map((col, cIdx) => `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
                  <span style="font-size: 9px; color: #94A3B8; line-height: 1;">⬇️</span>
                  ${col.map(s => renderCell(s)).join('')}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>"""

    if old_blocks in pdf_content:
        pdf_content = pdf_content.replace(old_blocks, new_blocks)
        print("Compacted blocks layout in pdf-export.js.")

    pdf_path.write_text(pdf_content, encoding="utf-8")
    print("Saved src/io/pdf-export.js.")

    split_pdf = Path("split/js/18-pdf-export.js")
    if split_pdf.exists():
        split_pdf_content = split_pdf.read_text(encoding="utf-8")
        if old_front_wall in split_pdf_content:
            split_pdf_content = split_pdf_content.replace(old_front_wall, new_front_wall)
        if old_blocks in split_pdf_content:
            split_pdf_content = split_pdf_content.replace(old_blocks, new_blocks)
        split_pdf.write_text(split_pdf_content, encoding="utf-8")
        print("Mirrored to split/js/18-pdf-export.js.")

if __name__ == "__main__":
    apply_refinements()
