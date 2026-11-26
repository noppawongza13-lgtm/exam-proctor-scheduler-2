import sys
from pathlib import Path
import re

def update_building_floor_plan():
    bfp_path = Path("src/ui/building-floor-plan.js")
    content = bfp_path.read_text(encoding="utf-8")

    # 1. Update imports
    old_import = """import { BUILDING_17_DIRECTORY } from '../data/seed.js';
import { FLOOR1_BLUEPRINT_BASE64, FLOOR2_BLUEPRINT_BASE64 } from '../data/blueprint-base64.js';"""
    new_import = """import { BUILDING_17_DIRECTORY } from '../data/seed.js';
import { FLOOR1_BLUEPRINT_BASE64, FLOOR2_BLUEPRINT_BASE64, BUILDING_FLOOR1_RAW_SVG, BUILDING_FLOOR2_RAW_SVG } from '../data/blueprint-base64.js';"""
    
    if old_import in content:
        content = content.replace(old_import, new_import)
        print("Updated imports in building-floor-plan.js")

    # 2. Replace renderFloor1Blueprint and renderFloor2Blueprint implementation
    old_floor1_fn = re.search(r'export function renderFloor1Blueprint\(appState\) \{.*?^export function renderFloor2Blueprint\(appState\) \{.*?^\}', content, re.MULTILINE | re.DOTALL)
    if not old_floor1_fn:
        print("ERROR: old_floor1_fn regex didn't match!")
        return False

    new_floor_fns = """/**
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

  // 1. Process room polygons
  let processedSvg = rawSvg.replace(/<polygon\s+([^>]*?)data-room="([^"]+)"([^>]*?)>(.*?)<\/polygon>/gs, (match, before, code, after, inner) => {
    const examRoom = (appState.rooms || []).find(r => (r.roomCode || r.id) === code || (code.startsWith('17') && r.id === code));
    const dirItem = allDir.find(d => d.code === code);
    const roomName = dirItem ? dirItem.name : (examRoom ? examRoom.name : code);
    const desc = dirItem ? (dirItem.desc || '') : '';

    if (examRoom) {
      const examTitle = `ห้องสอบที่ ${examRoom.roomNumber} : ${examRoom.name} (${examRoom.roomCode || examRoom.id})\\nศูนย์สอบ CBT อาคาร 17 • ความจุ ${examRoom.capacity} ที่นั่ง [เลขที่ ${examRoom.seatStart || 1} - ${examRoom.seatEnd || examRoom.capacity}]\\n👉 คลิกเพื่อเปิดดูผังที่นั่งสอบจริง`;
      return `<polygon ${before}data-room="${code}"${after} class="room is-exam-room floor-${floorNum}" data-action="view-room-detail" data-id="${examRoom.id}" role="button" tabindex="0" style="cursor: pointer;"><title>${examTitle}</title></polygon>`;
    } else {
      const nonExamTitle = `ห้อง ${code} : ${roomName}\\n(ไม่ได้ใช้เป็นห้องสอบ CBT)\\n👉 คลิกเพื่อดูชื่อห้อง`;
      return `<polygon ${before}data-room="${code}"${after} class="room is-non-exam-room floor-${floorNum}" data-action="view-non-exam-room" data-room-code="${code}" data-room-name="${roomName}" data-floor="${floorNum}" data-desc="${desc}" role="button" tabindex="0" style="cursor: pointer;"><title>${nonExamTitle}</title></polygon>`;
    }
  });

  // 2. Process text labels
  processedSvg = processedSvg.replace(/<text\s+([^>]*?)data-room="([^"]+)"([^>]*?)>([^<]+)<\/text>/gs, (match, before, code, after, textContent) => {
    const examRoom = (appState.rooms || []).find(r => (r.roomCode || r.id) === code || (code.startsWith('17') && r.id === code));
    const dirItem = allDir.find(d => d.code === code);
    const roomName = dirItem ? dirItem.name : (examRoom ? examRoom.name : code);
    const desc = dirItem ? (dirItem.desc || '') : '';

    if (examRoom) {
      return `<text ${before}data-room="${code}"${after} class="rl is-exam-label" data-action="view-room-detail" data-id="${examRoom.id}" style="cursor: pointer; pointer-events: auto;">${textContent}</text>`;
    } else {
      return `<text ${before}data-room="${code}"${after} class="rl" data-action="view-non-exam-room" data-room-code="${code}" data-room-name="${roomName}" data-floor="${floorNum}" data-desc="${desc}" style="cursor: pointer; pointer-events: auto;">${textContent}</text>`;
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
}"""

    content = content[:old_floor1_fn.start()] + new_floor_fns + content[old_floor1_fn.end():]
    bfp_path.write_text(content, encoding="utf-8")
    print("Updated building-floor-plan.js with SVG vector rendering and renderNonExamRoomModal.")

    # Mirror to split
    split_bfp = Path("split/js/22-building-floor-plan.js")
    if split_bfp.exists():
        split_bfp.write_text(content, encoding="utf-8")
        print("Mirrored to split/js/22-building-floor-plan.js")

    return True

def update_app_view():
    av_path = Path("src/ui/app-view.js")
    content = av_path.read_text(encoding="utf-8")

    # 1. Add import renderNonExamRoomModal
    old_imp = "renderRoomDetailModal,"
    new_imp = "renderRoomDetailModal,\n  renderNonExamRoomModal,"
    if old_imp in content and "renderNonExamRoomModal" not in content:
        content = content.replace(old_imp, new_imp, 1)
        print("Added renderNonExamRoomModal to app-view.js imports")

    # 2. Add modal handler in renderModal()
    old_modal_check = "if (this.activeModal.type === 'modal-room-detail' || this.activeModal.type === 'modal-seating-plan')"
    new_modal_check = """if (this.activeModal.type === 'modal-non-exam-room') {
      return renderNonExamRoomModal(this.activeModal);
    }

    if (this.activeModal.type === 'modal-room-detail' || this.activeModal.type === 'modal-seating-plan')"""

    if old_modal_check in content:
        content = content.replace(old_modal_check, new_modal_check, 1)
        print("Added modal-non-exam-room to renderModal() in app-view.js")

    # 3. Add click event delegation for data-action="view-non-exam-room"
    old_delegation = """      // 2. Open Room Detail / Seating Plan Modal
      const viewRoomBtn = e.target.closest('.btn-view-room-plan, .btn-view-examinee-blueprint, [data-action="view-room-detail"], [data-action="view-seating-plan"]');"""

    new_delegation = """      // 2. Open Non-Exam Room Name Modal (สำหรับห้องทั่วไปที่ไม่ได้ใช้เป็นห้องสอบ)
      const nonExamBtn = e.target.closest('[data-action="view-non-exam-room"]');
      if (nonExamBtn) {
        e.preventDefault();
        e.stopPropagation();
        const roomCode = nonExamBtn.getAttribute('data-room-code');
        const roomName = nonExamBtn.getAttribute('data-room-name') || roomCode;
        const floor = nonExamBtn.getAttribute('data-floor') || '1';
        const desc = nonExamBtn.getAttribute('data-desc') || '';
        this.activeModal = {
          type: 'modal-non-exam-room',
          roomCode,
          roomName,
          floor,
          desc
        };
        this.render();
        return;
      }

      // 2. Open Room Detail / Seating Plan Modal
      const viewRoomBtn = e.target.closest('.btn-view-room-plan, .btn-view-examinee-blueprint, [data-action="view-room-detail"], [data-action="view-seating-plan"]');"""

    if old_delegation in content:
        content = content.replace(old_delegation, new_delegation, 1)
        print("Added view-non-exam-room click delegation in app-view.js")

    # 4. Update renderRoomsBlueprintView to be clean and elegant
    old_blueprint_view = """  // --- มุมมองที่ 2: ผังอาคาร 17 (รวมผังชั้น 1 และชั้น 2 พร้อมปุ่มสลับชั้นในตัว) ---
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
  }"""

    new_blueprint_view = """  // --- มุมมองที่ 2: ผังอาคาร 17 (เวกเตอร์ SVG คมชัด เอาเฉพาะผัง ไม่เอาตัวหนังสือหัวเรื่อง) ---
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
            <div style="font-size: 12.5px; color: var(--text-muted); display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
              <span style="display: inline-flex; align-items: center; gap: 6px;">
                <span style="display: inline-block; width: 14px; height: 14px; background: #EDE9FE; border: 1.5px solid #7C3AED; border-radius: 3px;"></span>
                <span style="color: var(--brand-purple, #3B1F54); font-weight: 600;">ห้องสอบ CBT (คลิกดูผังที่นั่ง)</span>
              </span>
              <span style="display: inline-flex; align-items: center; gap: 6px;">
                <span style="display: inline-block; width: 14px; height: 14px; background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 3px;"></span>
                <span>ห้องทั่วไป (คลิกดูชื่อห้อง)</span>
              </span>
            </div>
          </div>

          <!-- Native SVG Blueprint render (เอาแค่ผัง ไม่เอาตัวหนังสือหัวเรื่อง) -->
          ${this.blueprintFloor === 2 ? this.renderFloor2Blueprint() : this.renderFloor1Blueprint()}
        </div>
      </div>
    `;
  }"""

    if old_blueprint_view in content:
        content = content.replace(old_blueprint_view, new_blueprint_view)
        print("Updated renderRoomsBlueprintView in app-view.js")

    av_path.write_text(content, encoding="utf-8")
    print("Saved src/ui/app-view.js")

    split_av = Path("split/js/25-app-view.js")
    if split_av.exists():
        split_av.write_text(content, encoding="utf-8")
        print("Mirrored to split/js/25-app-view.js")

    return True

def update_css():
    new_css = """
/* =============================================================================
   🏢 Native Building 17 Floorplan SVG Styling (floorplan.html vector integration)
   ============================================================================= */
.building17-svg-container {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-subtle, #e2e8f0);
  padding: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
}
[data-theme="dark"] .building17-svg-container {
  background: #1e1b2e;
  border-color: #3b2d54;
}

.building17-svg-container svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 72vh;
}

/* Structural Walls & Architectural Lines */
.building17-svg-container .art {
  fill: #1e293b;
  pointer-events: none;
}
[data-theme="dark"] .building17-svg-container .art {
  fill: #cbd5e1;
}

.building17-svg-container .art.lt {
  fill: #94a3b8;
}
[data-theme="dark"] .building17-svg-container .art.lt {
  fill: #64748b;
}

/* Room Polygons - General */
.building17-svg-container .room {
  cursor: pointer;
  transition: all 0.15s ease;
}

/* Non-exam rooms: clean white/light gray background */
.building17-svg-container .room.is-non-exam-room {
  fill: #ffffff;
  stroke: #cbd5e1;
  stroke-width: 0.5;
}
[data-theme="dark"] .building17-svg-container .room.is-non-exam-room {
  fill: #1a1625;
  stroke: #475569;
}
.building17-svg-container .room.is-non-exam-room:hover {
  fill: #f1f5f9;
  stroke: #94a3b8;
  stroke-width: 1.5;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}
[data-theme="dark"] .building17-svg-container .room.is-non-exam-room:hover {
  fill: #2d2640;
  stroke: #94a3b8;
}

/* Exam Rooms: distinguished Buriram purple glow & border */
.building17-svg-container .room.is-exam-room {
  fill: #f5f3ff;
  stroke: #7c3aed;
  stroke-width: 1.8;
  filter: drop-shadow(0 1px 3px rgba(124, 58, 237, 0.2));
}
[data-theme="dark"] .building17-svg-container .room.is-exam-room {
  fill: #2e1065;
  stroke: #a78bfa;
  stroke-width: 2;
}
.building17-svg-container .room.is-exam-room:hover {
  fill: #ede9fe;
  stroke: #5b21b6;
  stroke-width: 2.5;
  filter: drop-shadow(0 4px 12px rgba(109, 40, 217, 0.45));
}
[data-theme="dark"] .building17-svg-container .room.is-exam-room:hover {
  fill: #4c1d95;
  stroke: #c4b5fd;
}

/* Room Text Labels */
.building17-svg-container .rl {
  font-family: 'Inter', 'Sarabun', sans-serif;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
  fill: #1e293b;
}
[data-theme="dark"] .building17-svg-container .rl {
  fill: #f8fafc;
}

/* Highlight label for exam rooms */
.building17-svg-container .rl.is-exam-label {
  fill: #5b21b6;
  font-weight: 800;
}
[data-theme="dark"] .building17-svg-container .rl.is-exam-label {
  fill: #e9d5ff;
}

.building17-svg-container .rl.out {
  pointer-events: auto;
  cursor: pointer;
}
"""
    app_css = Path("src/styles/app.css")
    css_content = app_css.read_text(encoding="utf-8")
    if ".building17-svg-container" not in css_content:
        css_content += new_css
        app_css.write_text(css_content, encoding="utf-8")
        print("Appended native SVG floorplan styles to src/styles/app.css")

    split_css = Path("split/css/04-floorplan.css")
    if split_css.exists():
        split_content = split_css.read_text(encoding="utf-8")
        if ".building17-svg-container" not in split_content:
            split_content += new_css
            split_css.write_text(split_content, encoding="utf-8")
            print("Appended native SVG floorplan styles to split/css/04-floorplan.css")

if __name__ == "__main__":
    if update_building_floor_plan() and update_app_view():
        update_css()
        print("All updates applied successfully!")
