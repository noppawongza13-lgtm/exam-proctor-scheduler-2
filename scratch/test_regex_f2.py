from pathlib import Path
import re

text = Path("floorplan.html").read_text(encoding="utf-8")
f2_svg = re.search(r'<svg id="f2".*?</svg>', text, re.DOTALL).group(0)
f2_clean = re.sub(r'<g class="ttl"><rect x="15" y="15"[^>]*>.*?</g>', '', f2_svg, flags=re.DOTALL)

poly_matches = re.findall(r'<polygon\s+([^>]*?)data-room="([^"]+)"([^>]*?)>(.*?)<\/polygon>', f2_clean, re.DOTALL)
print(f"Matched polygons in f2: {len(poly_matches)}")
for m in poly_matches:
    print(f"  data-room={m[1]}")

text_matches = re.findall(r'<text\s+([^>]*?)data-room="([^"]+)"([^>]*?)>([^<]+)<\/text>', f2_clean, re.DOTALL)
print(f"\nMatched texts in f2: {len(text_matches)}")
for m in text_matches:
    print(f"  data-room={m[1]} -> text={m[3]}")
