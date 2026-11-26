from pathlib import Path
import re

text = Path("floorplan.html").read_text(encoding="utf-8")

def inspect_svg(svg_id):
    svg_match = re.search(rf'<svg id="{svg_id}".*?</svg>', text, re.DOTALL)
    if not svg_match:
        return
    svg = svg_match.group(0)
    print(f"=== {svg_id} ===")
    # Print viewBox and attributes
    start_tag = re.search(rf'<svg id="{svg_id}"[^>]*>', svg).group(0)
    print("Start tag:", start_tag)
    
    # Check elements inside
    # Find all polygon id and data-room
    polys = re.findall(r'<polygon\s+id="([^"]+)"\s+class="([^"]+)"\s+data-room="([^"]+)"[^>]*points="([^"]+)"', svg)
    print(f"Polygons count: {len(polys)}")
    for p in polys:
        print(f"  id={p[0]}, class={p[1]}, data-room={p[2]}")
        
    # Check text elements
    texts = re.findall(r'<text\s+id="([^"]+)"\s+class="([^"]+)"\s+data-room="([^"]+)"[^>]*>([^<]+)</text>', svg)
    print(f"Texts with data-room count: {len(texts)}")
    for t in texts:
        print(f"  id={t[0]}, data-room={t[2]}, text={t[3]}")

inspect_svg('f1')
inspect_svg('f2')
