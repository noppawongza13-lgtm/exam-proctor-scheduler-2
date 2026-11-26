import re

def update_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Replace renderRoomsPage()
    old_rooms_page_start = "renderRoomsPage() {"
    idx_start = content.find(old_rooms_page_start)
    assert idx_start != -1, f"renderRoomsPage() not found in {filepath}"
    
    idx_end = content.find("  // --- 7.2 หน้าข้อมูลหลัก (Master Data: รอบการสอบ & ช่วงเวลาไม่ว่าง) ---", idx_start)
    assert idx_end != -1, f"Next section not found in {filepath}"

    new_rooms_section = """renderRoomsPage() {
    this.roomsSubTab = this.roomsSubTab || 'seating-grid';
    this.blueprintFloor = this.blueprintFloor || 1;

    const totalCapacity = (appState.rooms || []).reduce((s, r) => s + (r.isActive !== false ? (r.capacity || 0) : 0), 0);

    return `
      <!-- แถบสลับหน้าย่อย 4 แท็บ สไตล์เดียวกับหน้าผู้คุมสอบและตารางผู้คุมสอบ -->
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
        <div style="display: inline-flex; flex-wrap: wrap; background-color: var(--bg-surface); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); gap: 6px; width: fit-content;">
          <button type="button" class="btn btn-sm ${this.roomsSubTab === 'seating-grid' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-rooms-seating" style="${this.roomsSubTab === 'seating-grid' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
            🪑 ผังห้องสอบและที่นั่ง
          </button>
          <button type="button" class="btn btn-sm ${this.roomsSubTab === 'table' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-rooms-table" style="${this.roomsSubTab === 'table' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
            📋 ตารางห้องสอบ (${appState.rooms.length} ห้อง)
          </button>
          <button type="button" class="btn btn-sm ${this.roomsSubTab === 'blueprint' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-rooms-blueprint" style="${this.roomsSubTab === 'blueprint' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
            🏢 ผังอาคาร 17
          </button>
          <button type="button" class="btn btn-sm ${this.roomsSubTab === 'directory' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-rooms-directory" style="${this.roomsSubTab === 'directory' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
            📑 สารบบอาคาร 17 (Directory)
          </button>
        </div>

        <!-- ลิงก์ข้อมูลระบบ -->
        <div style="font-size: 12px; color: var(--text-muted); padding-left: 2px;">
          ศูนย์สอบ CBT อาคาร 17 • ความจุรวม ${totalCapacity} ที่นั่ง • <a href="#" class="btn-link" data-goto-master="true" style="font-size: 12px; color: var(--primary-700); text-decoration: underline;">🔗 ไปหน้าข้อมูลระบบ (รอบสอบ/ช่วงเวลาไม่ว่าง)</a>
        </div>
      </div>

      ${this.renderRoomsSubTabContent()}
    `;
  }

  renderRoomsSubTabContent() {
    switch (this.roomsSubTab) {
      case 'seating-grid':
        return this.renderRoomsSeatingGridView();
      case 'table':
        return this.renderRoomsTableView();
      case 'blueprint':
        return this.renderRoomsBlueprintView();
      case 'directory':
        return this.renderBuildingDirectoryTable();
      default:
        return this.renderRoomsSeatingGridView();
    }
  }

  // --- มุมมองที่ 1: ผังห้องสอบและที่นั่ง (10 ห้องมาตรฐาน แถวละ 5 ห้อง พร้อมปุ่มจัดการและพิมพ์บัตร 8 ใบ/A4) ---
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

            <!-- ปุ่มคำสั่ง 3 ปุ่ม ตามภาพที่ 1 -->
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

      <!-- 4 KPI Stat Cards ตามภาพที่ 1 -->
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

      <!-- ผังการ์ดห้องสอบ จัดแบบ แถวละ 5 ห้อง (2 แถว x 5 คอลัมน์) ตามคำสั่งของผู้ใช้ -->
      <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; margin-bottom: 24px;" class="room-grid-5-col">
        ${sortedRooms.map((r, idx) => {
          const pCount = (r.capacity || 0) >= 70 ? 3 : 2;
          const layoutDesc = (r.layoutType === 'trapezoid-rows' || (r.capacity || 0) >= 70)
            ? 'ขั้นบันไดโรงภาพยนตร์ (Cinema)'
            : ((r.layoutType === 'horizontal' || r.roomCode === '17205') ? 'แนวนอน (Horizontal)' : 'บล็อกคอลัมน์มาตรฐาน');
          const isLarge = (r.capacity || 0) >= 70;
          const isActive = r.isActive !== false;

          return `
            <div class="card room-card-item" data-action="open-room-floorplan" data-room-id="${r.id}" style="border: 1px solid var(--border-subtle); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; background: var(--bg-surface); transition: all 0.2s ease; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.04); ${!isActive ? 'opacity: 0.6; filter: grayscale(0.5);' : ''}">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span class="badge" style="background: #F1F5F9; color: #475569; font-weight: 700; font-size: 11px; padding: 2px 7px;">ชั้น ${r.floor || 1}</span>
                  <span class="badge" style="${pCount === 3 ? 'background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D;' : 'background: #ECFDF5; color: #15803D; border: 1px solid #A7F3D0;'} font-size: 11px; font-weight: 700; padding: 2px 7px;">กรรมการ ${pCount} คน</span>
                </div>
                <div style="font-size: 17px; font-weight: 800; color: var(--text-main); margin-bottom: 2px;">
                  ห้อง ${r.roomCode || r.code || r.id}
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.3;">
                  อาคารนวัตปัญญา (อาคาร 17) • โต๊ะลงทะเบียนที่ ${idx + 1}
                </div>
                <div style="border-top: 1px solid var(--border-subtle); padding-top: 10px; display: flex; flex-direction: column; gap: 6px;">
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
                    <span style="color: var(--text-muted); font-size: 11px; text-align: right; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${layoutDesc}</span>
                  </div>
                  ${isLarge ? `
                    <div style="font-size: 10px; color: #B45309; font-weight: 600; margin-top: 3px; line-height: 1.25;">
                      * เป็นห้องขนาดใหญ่ (>= 70 ที่นั่ง) กำหนดกรรมการ 3 คน
                    </div>
                  ` : ''}
                </div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm btn-open-room-floorplan" data-room-id="${r.id}" style="width: 100%; margin-top: 12px; justify-content: center; font-size: 12px; font-weight: 600; border-radius: 6px; padding: 6px 10px;">
                ⊞ ดูและปรับแต่งผังที่นั่ง
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- มุมมองที่ 2: ผังอาคาร 17 (รวมผังชั้น 1 และชั้น 2 พร้อมปุ่มสลับชั้นในตัว) ---
  renderRoomsBlueprintView() {
    this.blueprintFloor = this.blueprintFloor || 1;
    return `
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-body" style="padding: 16px 20px;">
          <!-- Floor Switcher inside Blueprint tab -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <div style="display: inline-flex; background: var(--bg-surface-elevated, #F1F5F9); padding: 4px; border-radius: 8px; border: 1px solid var(--border-subtle); gap: 6px;">
              <button type="button" class="btn btn-sm btn-select-blueprint-floor ${this.blueprintFloor === 1 ? 'btn-primary' : 'btn-secondary'}" data-floor="1" style="${this.blueprintFloor === 1 ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700;' : 'background-color: transparent !important; color: var(--text-main); font-weight: 600; border: none;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer;">
                🏢 ผังอาคาร 17 ชั้น 1 (ห้องสอบ 1 - 4)
              </button>
              <button type="button" class="btn btn-sm btn-select-blueprint-floor ${this.blueprintFloor === 2 ? 'btn-primary' : 'btn-secondary'}" data-floor="2" style="${this.blueprintFloor === 2 ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700;' : 'background-color: transparent !important; color: var(--text-main); font-weight: 600; border: none;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer;">
                🏢 ผังอาคาร 17 ชั้น 2 (ห้องสอบ 5 - 10)
              </button>
            </div>
            <div style="font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
              <span>💡</span>
              <em>คลิกที่ห้องสอบใดก็ได้บนผังอาคาร เพื่อเปิดดูรายละเอียดผังที่นั่ง สเปกห้อง และตารางคุมสอบ</em>
            </div>
          </div>

          <!-- Blueprint render -->
          ${this.blueprintFloor === 2 ? this.renderFloor2Blueprint() : this.renderFloor1Blueprint()}
        </div>
      </div>
    `;
  }

  // --- มุมมองที่ 3: ตารางข้อมูลห้องสอบ (เครื่องมือเพิ่ม/นำเข้า/ส่งออก และตาราง) ---
  renderRoomsTableView() {
    return `
      <!-- แถบเครื่องมือจัดการห้องสอบ -->
      <div class="master-header-controls">
        <div class="master-subtabs-row">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">🏢</span>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">จัดการข้อมูลห้องสอบ (${appState.rooms.length} ห้อง)</h3>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  ศูนย์สอบ CBT อาคาร 17 • ความจุรวม ${appState.rooms.reduce((s, r) => s + (r.capacity || 0), 0)} ที่นั่ง
                </div>
              </div>
            </div>
          </div>
          <div class="master-action-buttons">
            <button class="btn btn-primary btn-sm" id="btn-add-master-item" style="font-weight: 700; box-shadow: 0 2px 8px rgba(124,58,237,0.25);">
              ➕ เพิ่มห้องสอบ
            </button>
            <div class="custom-dropdown" id="dropdown-master-csv">
              <button class="btn btn-secondary btn-sm custom-dropdown-trigger" type="button" aria-haspopup="true" aria-expanded="false" title="จัดการไฟล์ CSV">
                <span>📁 นำเข้า/ส่งออก CSV</span>
                <span style="font-size: 10px; margin-left: 2px;">▾</span>
              </button>
              <div class="custom-dropdown-menu custom-dropdown-menu-right" role="menu">
                <button class="custom-dropdown-item" id="btn-download-template" type="button" role="menuitem">
                  <span class="dropdown-item-icon">📥</span>
                  <div>
                    <div class="dropdown-item-title">ดาวน์โหลดแม่แบบ CSV</div>
                    <div class="dropdown-item-desc">ไฟล์ตัวอย่างพร้อมคอลัมน์มาตรฐาน</div>
                  </div>
                </button>
                <label class="custom-dropdown-item" style="cursor: pointer; margin: 0;" role="menuitem">
                  <span class="dropdown-item-icon">📤</span>
                  <div>
                    <div class="dropdown-item-title">นำเข้าไฟล์ CSV</div>
                    <div class="dropdown-item-desc">อัปโหลดไฟล์ข้อมูลเข้าระบบ</div>
                  </div>
                  <input type="file" id="file-import-csv" accept=".csv" style="display: none;">
                </label>
                <div class="custom-dropdown-divider"></div>
                <button class="custom-dropdown-item" id="btn-export-current-csv" type="button" role="menuitem">
                  <span class="dropdown-item-icon">💾</span>
                  <div>
                    <div class="dropdown-item-title">ส่งออกข้อมูลเป็น CSV</div>
                    <div class="dropdown-item-desc">ดาวน์โหลดข้อมูลทั้งหมดในแท็บนี้</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- เครื่องมือทดสอบระบบ & Presets (แบบพับเก็บได้ ปิดไว้เป็นค่าเริ่มต้น) -->
        <div class="test-tools-collapsible ${this.isTestToolsOpen ? 'is-open' : ''}" id="test-tools-accordion">
          <button class="test-tools-header" type="button" id="btn-toggle-test-tools" aria-expanded="${this.isTestToolsOpen ? 'true' : 'false'}">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-warning" style="font-size: 10px; padding: 2px 6px;">ทดสอบระบบ</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">🧪 เครื่องมือทดสอบระบบ & ชุดข้อมูลจำลอง</span>
            </div>
            <span class="accordion-arrow" style="font-size: 12px; color: var(--text-muted); font-weight: 600;">
              ${this.isTestToolsOpen ? '▲ ซ่อน' : '▼ เปิดดู'}
            </span>
          </button>
          <div class="test-tools-body" style="${this.isTestToolsOpen ? 'display: block;' : 'display: none;'}">
            <div style="display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 12px; padding: 10px 14px; background: rgba(245, 158, 11, 0.05); border: 1px dashed rgba(245, 158, 11, 0.35); border-radius: var(--radius-md);">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 12px; font-weight: 600; color: #92400e;">ชุดข้อมูลจำลอง:</span>
                <div class="master-presets-pills">
                  ${Object.entries(SEED_PRESETS).map(([key, p]) => `
                    <button class="btn btn-secondary btn-sm" data-action="load-preset" data-preset="${key}" style="background: var(--bg-surface); font-size: 11.5px; padding: 4px 8px;">
                      ${p.label}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ตารางข้อมูลห้องสอบ -->
      <div class="card">
        <div class="card-body" style="padding: 0;">
          <div class="table-wrapper" style="border: none;">
            <table class="data-table">
              <thead>
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
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

"""

    content = content[:idx_start] + new_rooms_section + content[idx_end:]
    print(f"Updated renderRoomsPage section in {filepath}")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

update_file('src/ui/app-view.js')
update_file('split/js/25-app-view.js')
print("Finished updating renderRoomsPage.")
