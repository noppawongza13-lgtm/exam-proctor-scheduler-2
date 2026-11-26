import sys
from pathlib import Path
import re

def fix_floorplan_colors():
    # 1. Update src/ui/building-floor-plan.js
    bfp_path = Path("src/ui/building-floor-plan.js")
    content = bfp_path.read_text(encoding="utf-8")

    # Replace renderFloorplanSvgWithAppState
    old_fn_match = re.search(r'export function renderFloorplanSvgWithAppState\(rawSvg, floorNum, appState\) \{.*?\n\}\n', content, re.DOTALL)
    if not old_fn_match:
        print("ERROR: renderFloorplanSvgWithAppState not found!")
        return False

    new_fn = """export function renderFloorplanSvgWithAppState(rawSvg, floorNum, appState) {
  const allDir = [
    ...(BUILDING_17_DIRECTORY.floor1 || []),
    ...(BUILDING_17_DIRECTORY.floor2 || [])
  ];

  // 1. Process room polygons cleanly without duplicate attributes
  let processedSvg = rawSvg.replace(/<polygon\\s+([^>]*?)>(?:<title>.*?<\\/title>)?<\\/polygon>/gs, (match, attrs) => {
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
      const examTitle = `ห้องสอบที่ ${examRoom.roomNumber} : ${examRoom.name} (${examRoom.roomCode || examRoom.id})\\nศูนย์สอบ CBT อาคาร 17 • ความจุ ${examRoom.capacity} ที่นั่ง [เลขที่ ${examRoom.seatStart || 1} - ${examRoom.seatEnd || examRoom.capacity}]\\n👉 คลิกเพื่อเปิดดูผังที่นั่งสอบจริง`;
      return `<polygon id="${rId}" data-room="${code}" points="${points}" class="room is-exam-room floor-${floorNum}" fill="#F3E8FF" stroke="#7C3AED" stroke-width="2" data-action="view-room-detail" data-id="${examRoom.id}" role="button" tabindex="0" style="cursor: pointer; transition: all 0.15s ease;"><title>${examTitle}</title></polygon>`;
    } else {
      const nonExamTitle = `ห้อง ${code} : ${roomName}\\n(ไม่ได้ใช้เป็นห้องสอบ CBT)\\n👉 คลิกเพื่อดูชื่อห้อง`;
      return `<polygon id="${rId}" data-room="${code}" points="${points}" class="room is-non-exam-room floor-${floorNum}" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2" data-action="view-non-exam-room" data-room-code="${code}" data-room-name="${roomName}" data-floor="${floorNum}" data-desc="${desc}" role="button" tabindex="0" style="cursor: pointer; transition: all 0.15s ease;"><title>${nonExamTitle}</title></polygon>`;
    }
  });

  // 2. Process text labels cleanly without duplicate attributes
  processedSvg = processedSvg.replace(/<text\\s+([^>]*?)>([^<]+)<\\/text>/gs, (match, attrs, textContent) => {
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
"""

    content = content[:old_fn_match.start()] + new_fn + content[old_fn_match.end():]
    bfp_path.write_text(content, encoding="utf-8")
    print("Fixed renderFloorplanSvgWithAppState in src/ui/building-floor-plan.js")

    split_bfp = Path("split/js/22-building-floor-plan.js")
    if split_bfp.exists():
        split_bfp.write_text(content, encoding="utf-8")
        print("Mirrored to split/js/22-building-floor-plan.js")

    # 2. Update CSS in src/styles/app.css & split/css/04-floorplan.css
    css_to_add = """
/* Explicit room colors for Building 17 Floorplan */
.building17-svg-container .room {
  fill: #ffffff !important;
  stroke: #94a3b8 !important;
  stroke-width: 1.2 !important;
  cursor: pointer;
  transition: all 0.15s ease;
}

.building17-svg-container .room.is-non-exam-room {
  fill: #ffffff !important;
  stroke: #94a3b8 !important;
  stroke-width: 1.2 !important;
}
[data-theme="dark"] .building17-svg-container .room.is-non-exam-room {
  fill: #1e1b2e !important;
  stroke: #64748b !important;
}
.building17-svg-container .room.is-non-exam-room:hover {
  fill: #e2e8f0 !important;
  stroke: #475569 !important;
  stroke-width: 2 !important;
}
[data-theme="dark"] .building17-svg-container .room.is-non-exam-room:hover {
  fill: #2d2640 !important;
  stroke: #94a3b8 !important;
}

.building17-svg-container .room.is-exam-room {
  fill: #f3e8ff !important;
  stroke: #7c3aed !important;
  stroke-width: 2.2 !important;
}
[data-theme="dark"] .building17-svg-container .room.is-exam-room {
  fill: #3b1f54 !important;
  stroke: #c4b5fd !important;
  stroke-width: 2.2 !important;
}
.building17-svg-container .room.is-exam-room:hover {
  fill: #ddd6fe !important;
  stroke: #5b21b6 !important;
  stroke-width: 3 !important;
  filter: drop-shadow(0 0 8px rgba(124, 58, 237, 0.45));
}
[data-theme="dark"] .building17-svg-container .room.is-exam-room:hover {
  fill: #581c87 !important;
  stroke: #e9d5ff !important;
}

.building17-svg-container .rl {
  fill: #1e293b !important;
}
[data-theme="dark"] .building17-svg-container .rl {
  fill: #f8fafc !important;
}

.building17-svg-container .rl.is-exam-label {
  fill: #4c1d95 !important;
}
[data-theme="dark"] .building17-svg-container .rl.is-exam-label {
  fill: #ede9fe !important;
}
"""

    for css_file in [Path("src/styles/app.css"), Path("split/css/04-floorplan.css")]:
        if css_file.exists():
            c = css_file.read_text(encoding="utf-8")
            c += "\n" + css_to_add
            css_file.write_text(c, encoding="utf-8")
            print(f"Updated {css_file}")

    return True

if __name__ == "__main__":
    fix_floorplan_colors()
