from pathlib import Path
import re

text = Path("src/data/blueprint-base64.js").read_text(encoding="utf-8")
match = re.search(r'BUILDING_FLOOR1_RAW_SVG\s*=\s*(.*?);\n\nexport const BUILDING_FLOOR2_RAW_SVG', text, re.DOTALL)
svg_raw = eval(match.group(1))

# Test polygon parsing
exam_codes = {'17108', '17109', '17110', '17111'}

def replace_polygon(m):
    attrs = m.group(1)
    code_match = re.search(r'data-room="([^"]+)"', attrs)
    if not code_match:
        return m.group(0)
    code = code_match.group(1)
    points_match = re.search(r'points="([^"]+)"', attrs)
    points = points_match.group(1) if points_match else ""
    id_match = re.search(r'id="([^"]+)"', attrs)
    r_id = id_match.group(1) if id_match else f"room-{code}"
    
    is_exam = code in exam_codes
    if is_exam:
        return f'<polygon id="{r_id}" data-room="{code}" points="{points}" class="room is-exam-room floor-1" fill="#F3E8FF" stroke="#7C3AED" stroke-width="2" data-action="view-room-detail" data-id="{code}" role="button" tabindex="0" style="cursor: pointer; transition: all 0.15s ease;"><title>Exam room {code}</title></polygon>'
    else:
        return f'<polygon id="{r_id}" data-room="{code}" points="{points}" class="room is-non-exam-room floor-1" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2" data-action="view-non-exam-room" data-room-code="{code}" role="button" tabindex="0" style="cursor: pointer; transition: all 0.15s ease;"><title>General room {code}</title></polygon>'

processed = re.sub(r'<polygon\s+([^>]*?)>(?:<title>.*?</title>)?</polygon>', replace_polygon, svg_raw, flags=re.DOTALL)

# Check count of polygons in processed
polys = re.findall(r'<polygon[^>]*>', processed)
print(f"Total polygons in processed: {len(polys)}")
for p in polys[:5]:
    print("  ", p[:120], "...")
