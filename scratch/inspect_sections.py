import re
from pathlib import Path

text = Path("floorplan.html").read_text(encoding="utf-8")

# Let's see the structure of sections
sections = re.findall(r'<section class="floor">(.*?)</section>', text, re.DOTALL)
print(f"Found {len(sections)} sections")

for i, sec in enumerate(sections):
    print(f"\n--- Section {i+1} ---")
    svg_header = re.search(r'<svg[^>]+>', sec)
    if svg_header:
        print("SVG:", svg_header.group(0))
    # Look for panels or non-svg content
    panel = re.search(r'<div class="panel">.*?</div>\s*</div>', sec, re.DOTALL)
    if panel:
        print("Panel preview:", panel.group(0)[:300], "...")
        print("Panel len:", len(panel.group(0)))
    else:
        print("No panel found by regex")
        # Let's find all div classes
        divs = re.findall(r'<div class="([^"]+)"', sec)
        print("Div classes in section:", set(divs))

# Check aside
aside = re.search(r'<aside.*?</aside>', text, re.DOTALL)
if aside:
    print("\n--- Aside ---")
    print(aside.group(0)[:500])
