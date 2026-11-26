from pathlib import Path
import re

text = Path("floorplan.html").read_text(encoding="utf-8")

# Extract SVGs
f1_svg = re.search(r'<svg id="f1".*?</svg>', text, re.DOTALL).group(0)
f2_svg = re.search(r'<svg id="f2".*?</svg>', text, re.DOTALL).group(0)

# Remove title from f1 and f2
f1_clean = re.sub(r'<g class="ttl"><path class="tb"[^>]*>.*?</g>', '', f1_svg, flags=re.DOTALL)
f2_clean = re.sub(r'<g class="ttl"><rect x="15" y="15"[^>]*>.*?</g>', '', f2_svg, flags=re.DOTALL)

# Let's inspect the polygons in f1_clean
polys_f1 = re.findall(r'<polygon[^>]*data-room="([^"]+)"[^>]*>', f1_clean)
print("f1 data-rooms:", polys_f1)

polys_f2 = re.findall(r'<polygon[^>]*data-room="([^"]+)"[^>]*>', f2_clean)
print("f2 data-rooms:", polys_f2)
