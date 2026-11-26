from pathlib import Path
import re

text = Path("floorplan.html").read_text(encoding="utf-8")

# Extract SVG f1
f1_match = re.search(r'<svg id="f1".*?</svg>', text, re.DOTALL)
f1_svg = f1_match.group(0)

# Extract SVG f2
f2_match = re.search(r'<svg id="f2".*?</svg>', text, re.DOTALL)
f2_svg = f2_match.group(0)

print(f"Original f1: {len(f1_svg)} chars")
print(f"Original f2: {len(f2_svg)} chars")

# Remove title group from f1: <g class="ttl"><path class="tb" ... /><text ...>แผนผังอาคาร ชั้น 1</text><text ...>Floor Plan 1st Floor</text></g>
f1_clean = re.sub(r'<g class="ttl"><path class="tb"[^>]*>.*?</g>', '', f1_svg, flags=re.DOTALL)
print("f1 title removed:", "แผนผังอาคาร ชั้น 1" not in f1_clean)

# Remove title group from f2: <g class="ttl"><rect x="15" y="15" ... /><text ...>แผนผังอาคาร ชั้น 2</text><text ...>Floor Plan 2nd Floor</text></g>
f2_clean = re.sub(r'<g class="ttl"><rect x="15" y="15"[^>]*>.*?</g>', '', f2_svg, flags=re.DOTALL)
print("f2 title removed:", "แผนผังอาคาร ชั้น 2" not in f2_clean)

# Keep compass rose in f2
print("f2 has compass rose:", 'text-anchor="middle" style="font-weight:700">N<' in f2_clean)

print(f"Cleaned f1: {len(f1_clean)} chars")
print(f"Cleaned f2: {len(f2_clean)} chars")
