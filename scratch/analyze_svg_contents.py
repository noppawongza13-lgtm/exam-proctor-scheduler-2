from pathlib import Path
import re

text = Path("floorplan.html").read_text(encoding="utf-8")

def analyze_svg(svg_id):
    match = re.search(rf'(<svg id="{svg_id}".*?</svg>)', text, re.DOTALL)
    if not match:
        print(f"SVG {svg_id} not found")
        return
    svg = match.group(1)
    # Strip long paths
    short_svg = re.sub(r'd="[^"]{100,}"', 'd="[PATH_DATA_TRUNCATED]"', svg)
    print(f"\n=== SVG {svg_id} Structure ===")
    # Print outer tag
    outer = re.search(rf'<svg id="{svg_id}"[^>]*>', svg).group(0)
    print("Outer tag:", outer)
    
    # List all direct children or groups
    groups = re.findall(r'<g\s+id="([^"]+)"', svg)
    print("Groups with id:", groups)
    
    # Check classes
    classes = re.findall(r'class="([^"]+)"', svg)
    print("Classes in SVG:", set(classes))

analyze_svg('f1')
analyze_svg('f2')
