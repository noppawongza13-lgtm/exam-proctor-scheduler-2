import re
from pathlib import Path

text = Path("floorplan.html").read_text(encoding="utf-8")
print(f"Length of file: {len(text)} characters, {len(text.splitlines())} lines")

svg_tags = re.findall(r'<svg[^>]*>', text)
for s in svg_tags:
    print("SVG tag:", s[:100])

sections = re.findall(r'<section[^>]*class=["\']([^"\']+)["\'][^>]*>', text)
print("Sections:", sections)

# Find room polygons/rects
rooms = re.findall(r'<polygon[^>]*data-room=["\']([^"\']+)["\'][^>]*aria-label=["\']([^"\']+)["\']', text)
print(f"Polygons with data-room: {len(rooms)}")
for r in rooms:
    print("  Room:", r)

# Check script tag or data in floorplan.html
scripts = re.findall(r'<script>(.*?)</script>', text, re.DOTALL)
print(f"Scripts count: {len(scripts)}")
for sc in scripts:
    print("Script preview:", sc[:500])
    print("Script ending:", sc[-500:])
