from pathlib import Path
import re

text = Path("floorplan.html").read_text(encoding="utf-8")

# Extract SVGs
f1_svg = re.search(r'<svg id="f1".*?</svg>', text, re.DOTALL).group(0)
f2_svg = re.search(r'<svg id="f2".*?</svg>', text, re.DOTALL).group(0)

# Remove title group from f1: <g class="ttl"><path class="tb" ... /><text ...>แผนผังอาคาร ชั้น 1</text><text ...>Floor Plan 1st Floor</text></g>
f1_clean = re.sub(r'<g class="ttl"><path class="tb"[^>]*>.*?</g>', '', f1_svg, flags=re.DOTALL)

# Remove title group from f2: <g class="ttl"><rect x="15" y="15"[^>]*>.*?</g>', '', f2_svg, flags=re.DOTALL)
f2_clean = re.sub(r'<g class="ttl"><rect x="15" y="15"[^>]*>.*?</g>', '', f2_svg, flags=re.DOTALL)

# In f1, fix label-17112 text from 17114 to 17112
f1_clean = f1_clean.replace('>17114</text>', '>17112</text>')

output_js = f'''// ผังอาคาร 17 เวกเตอร์ SVG คมชัดระดับสถาปัตยกรรม (Floor 1 & Floor 2)
// สกัดจาก floorplan.html ตัดส่วนหัวเรื่องตัวหนังสือ "แผนผังอาคาร ชั้น 1/2" ออกตามคำขอ
// รองรับ Interactive hover และ click สำหรับดูผังห้องสอบและชื่อห้อง

export const BUILDING_FLOOR1_RAW_SVG = {repr(f1_clean)};

export const BUILDING_FLOOR2_RAW_SVG = {repr(f2_clean)};

// Legacy placeholders for backward compatibility
export const FLOOR1_BLUEPRINT_BASE64 = "";
export const FLOOR2_BLUEPRINT_BASE64 = "";
'''

Path("src/data/blueprint-base64.js").write_text(output_js, encoding="utf-8")
print(f"Wrote src/data/blueprint-base64.js ({len(output_js)} chars)")

# Also mirror to split/js/08-blueprint-base64.js
split_path = Path("split/js/08-blueprint-base64.js")
if split_path.parent.exists():
    split_path.write_text(output_js, encoding="utf-8")
    print(f"Mirrored to split/js/08-blueprint-base64.js")
