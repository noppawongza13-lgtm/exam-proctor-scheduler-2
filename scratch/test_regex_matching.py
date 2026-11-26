from pathlib import Path
import re

text = Path("floorplan.html").read_text(encoding="utf-8")
f1_svg = re.search(r'<svg id="f1".*?</svg>', text, re.DOTALL).group(0)
f1_clean = re.sub(r'<g class="ttl"><path class="tb"[^>]*>.*?</g>', '', f1_svg, flags=re.DOTALL)

# Test polygon regex
poly_matches = re.findall(r'<polygon\s+([^>]*?)data-room="([^"]+)"([^>]*?)>(.*?)<\/polygon>', f1_clean, re.DOTALL)
print(f"Matched polygons in f1: {len(poly_matches)}")
for m in poly_matches:
    print(f"  data-room={m[1]}")

# Test text regex
text_matches = re.findall(r'<text\s+([^>]*?)data-room="([^"]+)"([^>]*?)>([^<]+)<\/text>', f1_clean, re.DOTALL)
print(f"\nMatched texts in f1: {len(text_matches)}")
for m in text_matches:
    print(f"  data-room={m[1]} -> text={m[3]}")
