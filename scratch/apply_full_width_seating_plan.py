import sys
from pathlib import Path

def apply_seating_plan_fix():
    # =========================================================================
    # 1. Update src/io/pdf-export.js
    # =========================================================================
    pdf_path = Path("src/io/pdf-export.js")
    pdf_content = pdf_path.read_text(encoding="utf-8")

    # 1.1 Update cell size in renderCell inside renderSeatingPlanInnerDiagram
    old_cell_style = "let extraStyle = 'position: relative; display: inline-flex; align-items: center; justify-content: center;';"
    new_cell_style = "let extraStyle = 'position: relative; display: inline-flex; align-items: center; justify-content: center; min-width: 36px; height: 28px; font-size: 12px; font-weight: 700; border-radius: 4px; box-sizing: border-box;';"
    if old_cell_style in pdf_content:
        pdf_content = pdf_content.replace(old_cell_style, new_cell_style, 1)
        print("Updated cell size in renderSeatingPlanInnerDiagram")

    # 1.2 Update block layout spacing
    old_blocks = """      <div style="display: flex; justify-content: center; gap: 14px; width: 100%; margin-top: 6px; flex-wrap: wrap;">
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

    new_blocks = """      <div style="display: flex; justify-content: center; gap: 28px; width: 100%; margin-top: 10px; flex-wrap: wrap;">
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
      </div>"""

    if old_blocks in pdf_content:
        pdf_content = pdf_content.replace(old_blocks, new_blocks, 1)
        print("Updated blocks spacing in pdf-export.js")

    # 1.3 Update outer container & non-overlapping front wall
    old_return_block = """return `
    <div class="seating-plan-room-box">
      <!-- Front Wall (จอโปรเจคเตอร์ & ประตูทางเข้า/ออก กะทัดรัดพอดีสายตา) -->
      <div class="room-wall-front" style="position: relative; display: flex; justify-content: center; align-items: center; min-height: 32px; padding: 3px 10px; margin-bottom: 2px;">
        ${isFrontBoth ? `<div class="door-badge door-left" style="position: absolute; left: 10px;">🚪 ประตูทางเข้า/ออก (ซ้าย)</div>` : ''}
        ${isLeftSide ? `<div class="door-badge door-left" style="position: absolute; left: 10px;">🚪 ประตูทางเข้า/ออก (ฝั่งซ้าย)</div>` : ''}
        <div class="projector-screen-badge">
          📽️ จอโปรเจคเตอร์
        </div>
        ${isFrontBoth ? `<div class="door-badge door-right" style="position: absolute; right: 10px;">🚪 ประตูทางเข้า/ออก (ขวา)</div>` : ''}
        ${isRightSide ? `<div class="door-badge door-right" style="position: absolute; right: 10px; background: #fffbeb; border-color: #f59e0b; color: #b45309; font-weight: 700;">🚪 ประตูทางเข้า/ออก (ฝั่งขวา)</div>` : ''}
      </div>

      <!-- Main Room Area with Full-Width Desks Container -->
      <div class="room-main-area" style="padding: 12px 6px; width: 100%; display: flex; flex-direction: column; align-items: center;">
        <div class="room-desks-container" style="width: 100%; overflow-x: auto; display: flex; justify-content: center;">
          ${desksHtml}
        </div>
        ${(disabledSet.size > 0 || accessibleSet.size > 0) ? `
          <div style="display: flex; justify-content: center; gap: 16px; margin-top: 12px; font-size: 11px; color: #64748B; flex-wrap: wrap; padding-top: 8px; border-top: 1px dashed #E2E8F0;">
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
  `;"""

    new_return_block = """return `
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
  `;"""

    if old_return_block in pdf_content:
        pdf_content = pdf_content.replace(old_return_block, new_return_block, 1)
        print("Updated return block in pdf-export.js")

    pdf_path.write_text(pdf_content, encoding="utf-8")
    split_pdf = Path("split/js/18-pdf-export.js")
    if split_pdf.exists():
        split_pdf.write_text(pdf_content, encoding="utf-8")
        print("Mirrored to split/js/18-pdf-export.js")

    # =========================================================================
    # 2. Update src/ui/building-floor-plan.js
    # =========================================================================
    bfp_path = Path("src/ui/building-floor-plan.js")
    bfp_content = bfp_path.read_text(encoding="utf-8")

    old_bfp_seating = """  if (subTab === 'seating') {
    tabContentHtml = `
      <div style="padding: 0; display: flex; flex-direction: column; align-items: center;">
        ${renderSeatingPlanInnerDiagram(room)}
      </div>
    `;
  }"""

    new_bfp_seating = """  if (subTab === 'seating') {
    tabContentHtml = `
      <div style="width: 100%; display: flex; flex-direction: column; gap: 12px;">
        ${renderSeatingPlanInnerDiagram(room)}
      </div>
    `;
  }"""

    if old_bfp_seating in bfp_content:
        bfp_content = bfp_content.replace(old_bfp_seating, new_bfp_seating, 1)
        print("Updated subTab === seating container to full-width in building-floor-plan.js")

    bfp_path.write_text(bfp_content, encoding="utf-8")
    split_bfp = Path("split/js/22-building-floor-plan.js")
    if split_bfp.exists():
        split_bfp.write_text(bfp_content, encoding="utf-8")
        print("Mirrored to split/js/22-building-floor-plan.js")

    # =========================================================================
    # 3. Update CSS rules for full-width diagram
    # =========================================================================
    css_add = """
/* Full-width Seating Plan Room Box & Non-overlapping Wall */
.seating-plan-room-box {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

.room-wall-front {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  width: 100% !important;
  box-sizing: border-box !important;
  position: static !important;
}

.room-wall-front .door-badge {
  position: static !important;
}
"""
    for css_file in [Path("src/styles/app.css"), Path("split/css/04-floorplan.css")]:
        if css_file.exists():
            c = css_file.read_text(encoding="utf-8")
            c += "\n" + css_add
            css_file.write_text(c, encoding="utf-8")
            print(f"Updated {css_file}")

    return True

if __name__ == "__main__":
    apply_seating_plan_fix()
