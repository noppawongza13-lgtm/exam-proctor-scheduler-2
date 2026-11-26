# -*- coding: utf-8 -*-
import sys
from pathlib import Path

def apply_patch():
    file_path = Path("src/ui/app-view.js")
    content = file_path.read_text(encoding="utf-8")

    # 1. Update renderModal for 'room-floorplan'
    target_modal_check = """    // Modal: ผังห้องสอบใหญ่และสเปกห้องจริง
    if (this.activeModal.type === 'room-floorplan') {
      const room = (appState.rooms || []).find(r => r.id === this.activeModal.roomId || r.roomCode === this.activeModal.roomId || r.code === this.activeModal.roomId) || appState.rooms[0];
      if (room) {
        this.roomDetailSubTab = 'seating';
        return this.renderRoomDetailModal(room);
      }
    }"""

    replacement_modal_check = """    // Modal: ผังห้องสอบใหญ่และปรับแต่งสถานะที่นั่ง (Interactive Large Seating Plan)
    if (this.activeModal.type === 'room-floorplan') {
      const room = (appState.rooms || []).find(r => r.id === this.activeModal.roomId || r.roomCode === this.activeModal.roomId || r.code === this.activeModal.roomId) || appState.rooms[0];
      if (room) {
        return this.renderLargeRoomFloorplanModal(room.id);
      }
    }"""

    if target_modal_check in content:
        content = content.replace(target_modal_check, replacement_modal_check)
        print("Updated room-floorplan modal check in renderModal.")
    else:
        print("WARNING: target_modal_check not found directly, checking variations...")
        # fallback replace
        old_part = "this.roomDetailSubTab = 'seating';\n        return this.renderRoomDetailModal(room);"
        new_part = "return this.renderLargeRoomFloorplanModal(room.id);"
        if old_part in content:
            content = content.replace(old_part, new_part)
            print("Replaced old_part in renderModal successfully.")

    # 2. Replace renderLargeRoomFloorplanModal and generateLargeRoomDesksHtml
    # Find start: // --- ผังห้องใหญ่ (Large Room Floorplan View / Modal - ตามรูปที่ 2) ---
    # Find end: // --- Modal ปรับความจุและเลื่อนเลขที่นั่งสอบอัตโนมัติ (ออกแบบให้เลื่อนลงได้ง่าย ใช้ง่าย สบายตา) ---
    start_marker = "// --- ผังห้องใหญ่ (Large Room Floorplan View / Modal - ตามรูปที่ 2) ---"
    end_marker = "// --- Modal ปรับความจุและเลื่อนเลขที่นั่งสอบอัตโนมัติ (ออกแบบให้เลื่อนลงได้ง่าย ใช้ง่าย สบายตา) ---"

    if start_marker in content and end_marker in content:
        start_idx = content.find(start_marker)
        end_idx = content.find(end_marker)
        
        new_modal_code = """// --- ผังห้องสอบใหญ่และปรับแต่งสถานะที่นั่ง (Interactive Large Seating Plan - มีแค่ผังใหญ่สบายตา) ---
  renderLargeRoomFloorplanModal(roomId) {
    const room = (appState.rooms || []).find(r => r.id === roomId || r.roomCode === roomId || r.code === roomId) || appState.rooms[0];
    if (!room) return '';

    room.disabledSeats = room.disabledSeats || [];
    room.accessibleSeats = room.accessibleSeats || [];

    const disabledSet = new Set(room.disabledSeats);
    const accessibleSet = new Set(room.accessibleSeats);
    const totalCap = room.capacity || 0;
    const disabledCount = disabledSet.size;
    const accessibleCount = accessibleSet.size;
    const usableCount = Math.max(0, totalCap - disabledCount);

    const roomCode = room.roomCode || room.code || room.id;
    const officialName = room.officialName || room.name;
    const floor = room.floor || 1;
    const pCount = totalCap >= 70 ? 3 : 2;

    const isFrontBoth = room.doorPosition === 'front-both';
    const isRightSide = room.doorPosition === 'right-side-two' || room.doorPosition === 'right-side';
    const isLeftSide = room.doorPosition === 'left-side-two' || room.doorPosition === 'left-side';

    // Helper to calculate seat number offset if capacity or start seat was changed
    let baseMinSeat = 1;
    if (room.rows && room.rows.length > 0) {
      const allS = [];
      room.rows.forEach(r => {
        if (r.left) allS.push(...r.left);
        if (r.right) allS.push(...r.right);
      });
      if (allS.length > 0) baseMinSeat = Math.min(...allS);
    } else if (room.blocks && room.blocks.length > 0) {
      const allS = [];
      room.blocks.forEach(b => {
        if (b.columns) b.columns.forEach(col => allS.push(...col));
      });
      if (allS.length > 0) baseMinSeat = Math.min(...allS);
    }
    const curStart = room.seatStart !== undefined ? room.seatStart : baseMinSeat;
    const seatOffset = curStart - baseMinSeat;

    // Helper to render interactive seat workstation node
    const renderInteractiveSeatNode = (rawSeat) => {
      const s = rawSeat + seatOffset;
      const isDisabled = disabledSet.has(s);
      const isAccessible = accessibleSet.has(s);
      const statusCls = isDisabled ? 'seat-status-disabled' : (isAccessible ? 'seat-status-accessible' : 'seat-status-normal');
      const icon = isDisabled ? '🚫' : (isAccessible ? '♿' : '🖥️');
      const badgeText = isDisabled ? 'ปิด' : (isAccessible ? 'พิการ' : 'ปกติ');

      return `
        <div class="interactive-seat-node ${statusCls}" data-seat="${s}" data-room-id="${room.id}" title="ที่นั่ง #${s} (คลิกซ้าย: ดูรายละเอียด | คลิกขวา: เปลี่ยนสถานะ)">
          <div class="seat-node-top">
            <span class="seat-node-icon">${icon}</span>
            <span class="seat-node-badge">${badgeText}</span>
          </div>
          <div class="seat-node-num">${s}</div>
        </div>
      `;
    };

    // Render physical layout diagrams matching the room's real architecture
    let desksHtml = '';

    if (room.layoutType === 'trapezoid-rows' && room.rows) {
      // 17201: หงส์พันธ์ สโลปใหญ่ 80 ที่นั่ง (6 แถว แถวละ 8-20 ที่นั่ง)
      desksHtml = `
        <div class="trapezoid-interactive-wrapper" style="display: flex; flex-direction: column; gap: 8px; align-items: center; width: 100%; margin: 12px 0;">
          ${room.rows.map(r => `
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;">
              <div style="font-size: 11.5px; color: #64748B; width: 48px; text-align: right; font-weight: 700; white-space: nowrap;">แถว ${r.rowNum}</div>
              <div style="display: flex; gap: 4px;">
                ${r.left.map(s => renderInteractiveSeatNode(s)).join('')}
              </div>
              <div style="font-size: 10.5px; color: #94A3B8; padding: 0 6px; font-weight: 600; white-space: nowrap; writing-mode: vertical-rl; letter-spacing: 2px;">ทางเดิน</div>
              <div style="display: flex; gap: 4px;">
                ${r.right.map(s => renderInteractiveSeatNode(s)).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if ((room.layoutType === 'grid-rows' || room.layoutType === 'staggered-rows') && room.rows) {
      // 17205 (สุตปัญญา 40 ที่นั่ง สับหว่าง) / 17206 (วงษ์แก้ว 40 ที่นั่ง 5 แถว)
      desksHtml = `
        <div style="display: flex; flex-direction: column; gap: 10px; align-items: center; width: 100%; margin: 12px 0;">
          ${room.rows.map(r => `
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%;">
              <div style="font-size: 12px; color: #64748B; width: 55px; text-align: right; font-weight: 700;">แถว ${r.rowNum} ➜</div>
              ${r.left ? `
                <div style="display: flex; gap: 5px;">
                  ${r.left.map(s => renderInteractiveSeatNode(s)).join('')}
                </div>
              ` : `
                <div style="display: flex; gap: 5px; visibility: hidden;" aria-hidden="true">
                  <div style="width: 50px; height: 48px;"></div>
                  <div style="width: 50px; height: 48px;"></div>
                  <div style="width: 50px; height: 48px;"></div>
                  <div style="width: 50px; height: 48px;"></div>
                </div>
              `}
              <div style="font-size: 11px; color: #94A3B8; padding: 0 4px; font-weight: 600;">ทางเดิน</div>
              ${r.right ? `
                <div style="display: flex; gap: 5px;">
                  ${r.right.map(s => renderInteractiveSeatNode(s)).join('')}
                </div>
              ` : `
                <div style="display: flex; gap: 5px; visibility: hidden;" aria-hidden="true">
                  <div style="width: 50px; height: 48px;"></div>
                  <div style="width: 50px; height: 48px;"></div>
                  <div style="width: 50px; height: 48px;"></div>
                  <div style="width: 50px; height: 48px;"></div>
                </div>
              `}
            </div>
          `).join('')}
        </div>
      `;
    } else if (room.blocks && room.blocks.length > 0) {
      // 17108, 17109, 17110, 17111, 17211, 17212, 17213 (บล็อกคอลัมน์มาตรฐาน)
      desksHtml = `
        <div style="display: flex; justify-content: center; gap: 20px; width: 100%; margin: 12px 0; flex-wrap: wrap;">
          ${room.blocks.map(block => `
            <div style="display: flex; flex-direction: column; align-items: center; border: 1.5px dashed #CBD5E1; padding: 10px 14px; border-radius: 8px; background: #F8FAFC;">
              <div style="font-size: 11.5px; color: #475569; margin-bottom: 8px; font-weight: 700;">${block.name}</div>
              <div style="display: flex; gap: 6px;">
                ${block.columns.map((col, cIdx) => `
                  <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                    <span style="font-size: 10px; color: #94A3B8; line-height: 1;">⬇️</span>
                    ${col.map(s => renderInteractiveSeatNode(s)).join('')}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      // Fallback
      const sStart = room.seatStart || 1;
      const sEnd = room.seatEnd || (sStart + totalCap - 1);
      const seatsArr = [];
      for (let s = sStart; s <= sEnd; s++) seatsArr.push(s);
      desksHtml = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 8px; padding: 12px; max-width: 600px; margin: 0 auto;">
          ${seatsArr.map(s => renderInteractiveSeatNode(s)).join('')}
        </div>
      `;
    }

    return `
      <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px; overflow-y: auto;">
        <div class="modal-content" style="background: #FFFFFF; border-radius: 12px; width: 100%; max-width: 1040px; height: 92vh; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); border: 1px solid var(--border-subtle); overflow: hidden; margin: auto;">
          
          <!-- Modal Header -->
          <div class="modal-header" style="padding: 14px 22px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; flex-shrink: 0;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 22px;">🪑</span>
                <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main);">
                  ผังที่นั่งสอบห้อง ${roomCode} : ${officialName}
                </h3>
                <span class="badge" style="background: #E2E8F0; color: #475569; font-size: 11px; padding: 2px 7px;">ชั้น ${floor}</span>
                <span class="badge" style="${pCount === 3 ? 'background: #FEF3C7; color: #92400E;' : 'background: #DCFCE7; color: #166534;'} font-size: 11px; padding: 2px 7px;">กรรมการ ${pCount} คน</span>
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
                ความจุ ${totalCap} ที่นั่ง • ช่วงเลขที่นั่ง: <strong style="color: var(--primary-700);">${curStart} - ${room.seatEnd || (curStart + totalCap - 1)}</strong> • ${room.building || 'อาคาร 17'}
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-close-room-floorplan-modal" style="padding: 5px 12px; border-radius: 6px; font-weight: 700; cursor: pointer;">
              ✖ ปิด
            </button>
          </div>

          <!-- Modal Body (มีแค่ผังที่นั่งใหญ่ๆ สบายตา และกล่องรายละเอียดที่นั่ง) -->
          <div class="modal-body" style="padding: 16px 22px; overflow-y: auto; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
            
            <!-- กล่องแสดงรายละเอียดที่นั่งเมื่อคลิก หรือคำแนะนำเมื่อยังไม่คลิก -->
            <div id="seat-detail-container" style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 10px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; flex-shrink: 0; min-height: 48px;">
              <div style="font-size: 12.5px; color: #475569; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">💡</span>
                <span>คลิกซ้ายที่นั่งเพื่อดูรายละเอียดและเปลี่ยนสถานะ หรือ <strong>คลิกขวา</strong> เพื่อเลือก <em>"ปิดที่นั่ง"</em> หรือ <em>"ที่สำหรับคนพิการ"</em> ทันที</span>
              </div>
              <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; color: #64748B;">
                <span>🟢 ปกติ</span>
                <span>🚫 ปิดที่นั่ง</span>
                <span>♿ คนพิการ</span>
              </div>
            </div>

            <!-- กล่องผังที่นั่งใหญ่ -->
            <div style="background: #FFFFFF; border: 1.5px solid var(--border-subtle); border-radius: 10px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); overflow-x: auto; flex: 1 1 auto; display: flex; flex-direction: column; align-items: center;">
              
              <!-- จอโปรเจคเตอร์ / กระดานดำหน้าห้องสอบ & ประตูทางเข้า/ออก -->
              <div style="width: 100%; max-width: 860px; margin-bottom: 8px;">
                <div style="position: relative; display: flex; justify-content: center; align-items: center; min-height: 40px; padding: 6px 12px; border-bottom: 2px solid #E2E8F0;">
                  ${isFrontBoth ? `<div class="door-badge" style="position: absolute; left: 10px; font-size: 11px; padding: 3px 8px; background: #F1F5F9; border: 1px dashed #94A3B8; border-radius: 4px; font-weight: 600;">🚪 ประตูหน้า (ซ้าย)</div>` : ''}
                  ${isLeftSide ? `<div class="door-badge" style="position: absolute; left: 10px; font-size: 11px; padding: 3px 8px; background: #F1F5F9; border: 1px dashed #94A3B8; border-radius: 4px; font-weight: 600;">🚪 ประตูข้าง (ฝั่งซ้าย)</div>` : ''}
                  
                  <div style="background: linear-gradient(135deg, #2D1445 0%, #3B1F54 100%); color: #FFFFFF; padding: 6px 24px; border-radius: 6px; font-weight: 700; font-size: 12.5px; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(59,31,84,0.2);">
                    <span>🖥️</span>
                    <span>จอโปรเจคเตอร์ / กระดานดำหน้าห้องสอบ (โต๊ะกรรมการกำกับการสอบ)</span>
                  </div>

                  ${isFrontBoth ? `<div class="door-badge" style="position: absolute; right: 10px; font-size: 11px; padding: 3px 8px; background: #F1F5F9; border: 1px dashed #94A3B8; border-radius: 4px; font-weight: 600;">🚪 ประตูหน้า (ขวา)</div>` : ''}
                  ${isRightSide ? `<div class="door-badge" style="position: absolute; right: 10px; font-size: 11px; padding: 3px 8px; background: #FFFBEB; border: 1px dashed #F59E0B; color: #92400E; border-radius: 4px; font-weight: 600;">🚪 ประตูข้าง (ฝั่งขวา)</div>` : ''}
                </div>
              </div>

              <!-- ผังโต๊ะคอมพิวเตอร์ตามสเปกจริงของห้อง -->
              <div style="width: 100%; display: flex; justify-content: center; padding: 10px 0;">
                ${desksHtml}
              </div>

            </div>

          </div>

          <!-- Modal Footer (สรุปและปุ่มบันทึกซิงค์ข้อมูล) -->
          <div class="modal-footer" style="padding: 12px 22px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; flex-shrink: 0; flex-wrap: wrap; gap: 10px;">
            <div style="font-size: 13px;">
              <strong style="color: var(--text-main);">สถานะห้อง:</strong>
              <span style="margin-left: 6px; color: #15803D; font-weight: 700;">พร้อมใช้ <span id="summary-floorplan-usable">${usableCount}</span> / ${totalCap} ที่</span>
              <span id="summary-floorplan-badges" style="margin-left: 6px;">
                ${disabledCount > 0 ? `<span class="badge" style="background: #FEE2E2; color: #991B1B; font-weight: 700;">ปิด ${disabledCount} ที่</span>` : ''}
                ${accessibleCount > 0 ? `<span class="badge" style="background: #DBEAFE; color: #1E40AF; font-weight: 700; margin-left: 4px;">♿ พิการ ${accessibleCount} ที่</span>` : ''}
              </span>
            </div>

            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-print-room-plan-modal" data-room-id="${room.id}" style="font-size: 12px;">
                🖨️ พิมพ์ผังที่นั่งห้องนี้ (A4)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-print-room-slips-modal" data-room-id="${room.id}" style="font-size: 12px;">
                🖨️ พิมพ์บัตรประจำตัวที่นั่งเฉพาะห้องนี้
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-close-room-floorplan-modal-2" style="font-size: 12px;">
                ยกเลิก
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-save-floorplan-custom" data-room-id="${room.id}" style="background-color: #16A34A !important; border: 1px solid #15803D !important; font-weight: 700; font-size: 12.5px; box-shadow: 0 1px 3px rgba(22,163,74,0.35);">
                ✔ ยืนยันและซิงค์ข้อมูลห้อง
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  """
        content = content[:start_idx] + new_modal_code + content[end_idx:]
        print("Replaced renderLargeRoomFloorplanModal successfully.")
    else:
        print("ERROR: Start or end marker not found for renderLargeRoomFloorplanModal!")

    # 3. Update renderRoomsSeatingGridView for cards and KPI to sync with disabledSeats & accessibleSeats
    # Let's inspect target lines around renderRoomsSeatingGridView
    target_grid_start = "renderRoomsSeatingGridView() {"
    target_grid_kpi = """    const activeRooms = (appState.rooms || []).filter(r => r.isActive !== false);
    const totalCapacity = activeRooms.reduce((s, r) => s + (r.capacity || 0), 0);
    const totalProctorsNeeded = activeRooms.reduce((s, r) => s + ((r.capacity || 0) >= 70 ? 3 : 2), 0);"""

    replacement_grid_kpi = """    const activeRooms = (appState.rooms || []).filter(r => r.isActive !== false);
    const totalCapacity = activeRooms.reduce((s, r) => s + (r.capacity || 0), 0);
    const totalUsableCapacity = activeRooms.reduce((s, r) => s + Math.max(0, (r.capacity || 0) - ((r.disabledSeats || []).length)), 0);
    const totalDisabledSeats = activeRooms.reduce((s, r) => s + ((r.disabledSeats || []).length), 0);
    const totalProctorsNeeded = activeRooms.reduce((s, r) => s + ((r.capacity || 0) >= 70 ? 3 : 2), 0);"""

    if target_grid_kpi in content:
        content = content.replace(target_grid_kpi, replacement_grid_kpi)
        print("Updated KPI counters calculation in renderRoomsSeatingGridView.")

    # Update KPI Card 2 display
    old_kpi_card2 = """        <div class="card" style="border-left: 4px solid #16a34a; background: rgba(22, 163, 74, 0.02);">
          <div class="card-body" style="padding: 14px 18px;">
            <div style="font-size: 12.5px; color: #16a34a; font-weight: 600;">ความจุที่นั่งสอบรวม</div>
            <div style="font-size: 26px; font-weight: 800; color: #15803d; margin-top: 3px;">
              ${totalCapacity} <span style="font-size: 13.5px; font-weight: 500; color: var(--text-muted);">ที่นั่ง</span>
            </div>
          </div>
        </div>"""

    new_kpi_card2 = """        <div class="card" style="border-left: 4px solid #16a34a; background: rgba(22, 163, 74, 0.02);">
          <div class="card-body" style="padding: 14px 18px;">
            <div style="font-size: 12.5px; color: #16a34a; font-weight: 600;">ความจุที่นั่งสอบรวม (พร้อมใช้)</div>
            <div style="font-size: 26px; font-weight: 800; color: #15803d; margin-top: 3px;">
              ${totalDisabledSeats > 0 ? `${totalUsableCapacity} <span style="font-size: 14px; font-weight: 600; color: #64748B;">/ ${totalCapacity} ที่</span>` : `${totalCapacity} <span style="font-size: 13.5px; font-weight: 500; color: var(--text-muted);">ที่นั่ง</span>`}
            </div>
            ${totalDisabledSeats > 0 ? `<div style="font-size: 11px; color: #DC2626; font-weight: 600; margin-top: 2px;">(ปิดที่นั่ง/ชำรุด ${totalDisabledSeats} ที่นั่ง)</div>` : ''}
          </div>
        </div>"""

    if old_kpi_card2 in content:
        content = content.replace(old_kpi_card2, new_kpi_card2)
        print("Updated KPI card 2 display.")

    # Update Room Card Item in renderRoomsSeatingGridView to open-room-floorplan and display badges
    old_room_card_block = """          return `
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
          `;"""

    new_room_card_block = """          const disabledCount = (r.disabledSeats || []).length;
          const accessibleCount = (r.accessibleSeats || []).length;
          const usableCap = Math.max(0, (r.capacity || 0) - disabledCount);

          return `
            <div class="card room-card-item btn-open-room-floorplan" data-action="open-room-floorplan" data-room-id="${r.id}" style="border: 1px solid var(--border-subtle); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; background: var(--bg-surface); transition: all 0.2s ease; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.04); ${!isActive ? 'opacity: 0.5; filter: grayscale(0.6);' : ''}">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 4px;">
                  <div style="display: flex; gap: 4px; align-items: center;">
                    <span class="badge" style="background: #F1F5F9; color: #475569; font-weight: 700; font-size: 11px; padding: 2px 7px;">ชั้น ${r.floor || 1}</span>
                    <span class="badge" style="${pCount === 3 ? 'background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D;' : 'background: #ECFDF5; color: #15803D; border: 1px solid #A7F3D0;'} font-size: 11px; font-weight: 700; padding: 2px 7px;">กรรมการ ${pCount} คน</span>
                  </div>
                  <div style="display: flex; gap: 4px; align-items: center;">
                    ${disabledCount > 0 ? `<span class="badge" style="background: #FEE2E2; color: #991B1B; font-weight: 700; font-size: 10.5px; padding: 2px 6px;">🚫 ปิด ${disabledCount} ที่</span>` : ''}
                    ${accessibleCount > 0 ? `<span class="badge" style="background: #DBEAFE; color: #1E40AF; font-weight: 700; font-size: 10.5px; padding: 2px 6px;">♿ พิการ ${accessibleCount} ที่</span>` : ''}
                  </div>
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
                    <strong style="color: var(--text-main);">
                      ${usableCap} / ${r.capacity || 0} ที่นั่ง ${disabledCount > 0 ? `<span style="font-size: 11px; color: #DC2626; font-weight: 600;">(พร้อมใช้ ${usableCap} ที่)</span>` : ''}
                    </strong>
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
              <button type="button" class="btn btn-secondary btn-sm btn-open-room-floorplan" data-action="open-room-floorplan" data-room-id="${r.id}" style="width: 100%; margin-top: 10px; justify-content: center; font-size: 12px; font-weight: 600; border-radius: 6px; padding: 6px 10px; background: #FFFFFF; border: 1px solid var(--border-subtle);">
                ⊞ ดูและปรับแต่งผังที่นั่ง
              </button>
            </div>
          `;"""

    if old_room_card_block in content:
        content = content.replace(old_room_card_block, new_room_card_block)
        print("Updated room card block in renderRoomsSeatingGridView.")
    else:
        print("WARNING: old_room_card_block not found exactly!")

    # 4. Attach Events for Interactive Floorplan: Left click, Right click context menu, and Save button
    event_target = """    // ปุ่มพิมพ์บัตรประจำตัวที่นั่งเฉพาะห้องนี้ (8 ที่นั่ง/A4) ใน Large Room Floorplan Modal
    const btnPrintRoomSlips = this.root.querySelector('#btn-print-room-slips-modal');
    if (btnPrintRoomSlips) {
      btnPrintRoomSlips.addEventListener('click', () => {
        const targetRoomId = btnPrintRoomSlips.getAttribute('data-room-id');
        openPrintableSeatSlips(appState, targetRoomId);
      });
    }"""

    event_replacement = """    // ปุ่มพิมพ์บัตรประจำตัวที่นั่งเฉพาะห้องนี้ (8 ที่นั่ง/A4) ใน Large Room Floorplan Modal
    const btnPrintRoomSlips = this.root.querySelector('#btn-print-room-slips-modal');
    if (btnPrintRoomSlips) {
      btnPrintRoomSlips.addEventListener('click', () => {
        const targetRoomId = btnPrintRoomSlips.getAttribute('data-room-id');
        openPrintableSeatSlips(appState, targetRoomId);
      });
    }

    // ----------------------------------------------------
    // เหตุการณ์ใน Interactive Large Seating Plan Modal
    // 1. คลิกซ้าย: แสดงรายละเอียดที่นั่งและปุ่มเปลี่ยนสถานะ
    // 2. คลิกขวา (contextmenu): เมนูลอย ปิดที่นั่ง / ที่สำหรับคนพิการ / ปกติ
    // 3. กดยืนยัน: ซิงค์ข้อมูล disabledSeats / accessibleSeats ไปยังห้องทั้งหมด
    // ----------------------------------------------------
    const updateSeatNodeDisplay = (node, newStatus) => {
      const sNum = node.getAttribute('data-seat');
      node.classList.remove('seat-status-normal', 'seat-status-disabled', 'seat-status-accessible');
      const iconSpan = node.querySelector('.seat-node-icon');
      const badgeSpan = node.querySelector('.seat-node-badge');

      if (newStatus === 'disabled') {
        node.classList.add('seat-status-disabled');
        if (iconSpan) iconSpan.textContent = '🚫';
        if (badgeSpan) badgeSpan.textContent = 'ปิด';
      } else if (newStatus === 'accessible') {
        node.classList.add('seat-status-accessible');
        if (iconSpan) iconSpan.textContent = '♿';
        if (badgeSpan) badgeSpan.textContent = 'พิการ';
      } else {
        node.classList.add('seat-status-normal');
        if (iconSpan) iconSpan.textContent = '🖥️';
        if (badgeSpan) badgeSpan.textContent = 'ปกติ';
      }

      // อัปเดตตัวเลขสรุปใน Footer แบบ Real-time
      const totalNodes = this.root.querySelectorAll('.interactive-seat-node').length;
      const disabledCount = this.root.querySelectorAll('.interactive-seat-node.seat-status-disabled').length;
      const accessibleCount = this.root.querySelectorAll('.interactive-seat-node.seat-status-accessible').length;
      const usableCount = Math.max(0, totalNodes - disabledCount);

      const sumUsable = this.root.querySelector('#summary-floorplan-usable');
      if (sumUsable) sumUsable.textContent = usableCount;

      const sumBadges = this.root.querySelector('#summary-floorplan-badges');
      if (sumBadges) {
        sumBadges.innerHTML = `
          ${disabledCount > 0 ? `<span class="badge" style="background: #FEE2E2; color: #991B1B; font-weight: 700;">ปิด ${disabledCount} ที่</span>` : ''}
          ${accessibleCount > 0 ? `<span class="badge" style="background: #DBEAFE; color: #1E40AF; font-weight: 700; margin-left: 4px;">♿ พิการ ${accessibleCount} ที่</span>` : ''}
        `;
      }
    };

    const renderSeatDetailBox = (node) => {
      const sNum = node.getAttribute('data-seat');
      const container = this.root.querySelector('#seat-detail-container');
      if (!container) return;

      const isDisabled = node.classList.contains('seat-status-disabled');
      const isAccessible = node.classList.contains('seat-status-accessible');
      const curStatus = isDisabled ? 'disabled' : (isAccessible ? 'accessible' : 'normal');

      const icon = isDisabled ? '🚫' : (isAccessible ? '♿' : '🖥️');
      const statusTitle = isDisabled ? 'ปิดการใช้งาน (ชำรุด)' : (isAccessible ? 'ที่นั่งสำหรับผู้พิการ (♿)' : 'ใช้งานปกติ (ว่าง)');
      const badgeStyle = isDisabled
        ? 'background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;'
        : (isAccessible ? 'background: #DBEAFE; color: #1E40AF; border: 1px solid #BFDBFE;' : 'background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC;');

      container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 26px;">${icon}</span>
          <div>
            <div style="font-size: 14.5px; font-weight: 800; color: #1E293B;">
              ที่นั่งสอบ #${sNum}
              <span class="badge" style="${badgeStyle} margin-left: 6px; font-size: 11px;">${statusTitle}</span>
            </div>
            <div style="font-size: 12px; color: #64748B; margin-top: 2px;">
              เครื่องคอมพิวเตอร์ลูกข่ายทดสอบ CBT • รองรับการสอบ ก.พ. e-Exam
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 12px; font-weight: 700; color: #475569;">เปลี่ยนสถานะ:</span>
          <button type="button" class="btn btn-sm btn-quick-seat-status" data-seat="${sNum}" data-status="normal" style="background: ${curStatus === 'normal' ? '#10B981' : '#FFFFFF'}; color: ${curStatus === 'normal' ? '#FFFFFF' : '#065F46'}; border: 1.5px solid #10B981; font-weight: 700; font-size: 11.5px; padding: 4px 10px; border-radius: 4px; cursor: pointer;">
            🟢 ปกติ
          </button>
          <button type="button" class="btn btn-sm btn-quick-seat-status" data-seat="${sNum}" data-status="disabled" style="background: ${curStatus === 'disabled' ? '#EF4444' : '#FFFFFF'}; color: ${curStatus === 'disabled' ? '#FFFFFF' : '#991B1B'}; border: 1.5px solid #EF4444; font-weight: 700; font-size: 11.5px; padding: 4px 10px; border-radius: 4px; cursor: pointer;">
            🚫 ปิดที่นั่ง
          </button>
          <button type="button" class="btn btn-sm btn-quick-seat-status" data-seat="${sNum}" data-status="accessible" style="background: ${curStatus === 'accessible' ? '#3B82F6' : '#FFFFFF'}; color: ${curStatus === 'accessible' ? '#FFFFFF' : '#1E40AF'}; border: 1.5px solid #3B82F6; font-weight: 700; font-size: 11.5px; padding: 4px 10px; border-radius: 4px; cursor: pointer;">
            ♿ คนพิการ
          </button>
        </div>
      `;

      container.querySelectorAll('.btn-quick-seat-status').forEach(btn => {
        btn.addEventListener('click', () => {
          const st = btn.getAttribute('data-status');
          updateSeatNodeDisplay(node, st);
          renderSeatDetailBox(node);
        });
      });
    };

    // 1. คลิกซ้ายที่นั่ง: แสดงรายละเอียด
    this.root.querySelectorAll('.interactive-seat-node').forEach(node => {
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        this.root.querySelectorAll('.interactive-seat-node').forEach(n => n.classList.remove('seat-is-selected'));
        node.classList.add('seat-is-selected');
        renderSeatDetailBox(node);
      });
    });

    // 2. คลิกขวาที่นั่ง (Context Menu): เมนูปิดที่นั่ง / ที่คนพิการ / ปกติ
    this.root.querySelectorAll('.interactive-seat-node').forEach(node => {
      node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const oldMenu = document.getElementById('seat-context-menu');
        if (oldMenu) oldMenu.remove();

        const sNum = node.getAttribute('data-seat');
        const menu = document.createElement('div');
        menu.id = 'seat-context-menu';
        menu.style.position = 'fixed';
        menu.style.left = `${Math.min(window.innerWidth - 220, e.clientX)}px`;
        menu.style.top = `${Math.min(window.innerHeight - 170, e.clientY)}px`;
        menu.style.zIndex = '100000';
        menu.style.background = '#FFFFFF';
        menu.style.borderRadius = '8px';
        menu.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.1)';
        menu.style.padding = '6px';
        menu.style.minWidth = '200px';

        menu.innerHTML = `
          <div style="padding: 6px 10px; font-size: 11.5px; font-weight: 800; color: #64748B; border-bottom: 1px solid #E2E8F0; margin-bottom: 4px;">
            ที่นั่งสอบ #${sNum}
          </div>
          <button class="ctx-opt-btn" data-status="normal" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: none; background: none; font-size: 12.5px; font-weight: 600; color: #1E293B; border-radius: 4px; cursor: pointer; text-align: left;">
            🟢 ใช้งานปกติ (Normal)
          </button>
          <button class="ctx-opt-btn" data-status="disabled" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: none; background: none; font-size: 12.5px; font-weight: 600; color: #DC2626; border-radius: 4px; cursor: pointer; text-align: left;">
            🚫 ปิดที่นั่ง / ชำรุด (Disabled)
          </button>
          <button class="ctx-opt-btn" data-status="accessible" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: none; background: none; font-size: 12.5px; font-weight: 600; color: #2563EB; border-radius: 4px; cursor: pointer; text-align: left;">
            ♿ ที่นั่งสำหรับคนพิการ (Accessible)
          </button>
        `;

        menu.querySelectorAll('.ctx-opt-btn').forEach(btn => {
          btn.addEventListener('mouseenter', () => btn.style.background = '#F1F5F9');
          btn.addEventListener('mouseleave', () => btn.style.background = 'none');
          btn.addEventListener('click', () => {
            const st = btn.getAttribute('data-status');
            updateSeatNodeDisplay(node, st);
            renderSeatDetailBox(node);
            menu.remove();
          });
        });

        document.body.appendChild(menu);
      });
    });

    // ปิดเมนูลอยเมื่อคลิกที่อื่น
    document.addEventListener('click', () => {
      const oldMenu = document.getElementById('seat-context-menu');
      if (oldMenu) oldMenu.remove();
    });

    // 3. กดยืนยันและซิงค์ข้อมูลห้อง (ปุ่มยืนยัน)
    const btnSaveFloorplan = this.root.querySelector('#btn-save-floorplan-custom');
    if (btnSaveFloorplan) {
      btnSaveFloorplan.addEventListener('click', () => {
        const targetRoomId = btnSaveFloorplan.getAttribute('data-room-id');
        const room = (appState.rooms || []).find(r => r.id === targetRoomId);
        if (room) {
          const disabledList = [];
          const accessibleList = [];

          this.root.querySelectorAll('.interactive-seat-node').forEach(node => {
            const s = parseInt(node.getAttribute('data-seat'), 10);
            if (node.classList.contains('seat-status-disabled')) {
              disabledList.push(s);
            } else if (node.classList.contains('seat-status-accessible')) {
              accessibleList.push(s);
            }
          });

          room.disabledSeats = disabledList;
          room.accessibleSeats = accessibleList;
          room.usableCapacity = Math.max(0, (room.capacity || 0) - disabledList.length);

          appState.notify();
          this.activeModal = null;
          this.render();
          this.showToast(`บันทึกและซิงค์ผังห้อง ${room.roomCode || room.code} เรียบร้อยแล้ว (ปิด ${disabledList.length} ที่, พิการ ${accessibleList.length} ที่)`, 'success');
        }
      });
    }"""

    if event_target in content:
        content = content.replace(event_target, event_replacement)
        print("Attached event handlers for interactive floorplan successfully.")
    else:
        print("ERROR: event_target not found!")

    file_path.write_text(content, encoding="utf-8")
    print("Written updated src/ui/app-view.js.")

    # Also mirror to split/js/25-app-view.js if it exists
    split_path = Path("split/js/25-app-view.js")
    if split_path.exists():
        split_path.write_text(content, encoding="utf-8")
        print("Mirrored to split/js/25-app-view.js.")

if __name__ == "__main__":
    apply_patch()
