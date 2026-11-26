from pathlib import Path
import re

text = Path("floorplan.html").read_text(encoding="utf-8")

# Let's inspect f1 (Floor 1) and f2 (Floor 2)
f1_match = re.search(r'(<svg id="f1".*?</svg>)', text, re.DOTALL)
f2_match = re.search(r'(<svg id="f2".*?</svg>)', text, re.DOTALL)

print("f1 length:", len(f1_match.group(1)) if f1_match else "None")
print("f2 length:", len(f2_match.group(1)) if f2_match else "None")

# Inspect room polygons in f1
f1_rooms = re.findall(r'<polygon[^>]*data-room="([^"]+)"[^>]*aria-label="([^"]+)"[^>]*points="([^"]+)"', f1_match.group(1))
print(f"\nf1 rooms ({len(f1_rooms)}):")
for r in f1_rooms:
    print(f"  Room {r[0]}: {r[1]} -> points: {r[2][:30]}...")

# Inspect room polygons in f2
f2_rooms = re.findall(r'<polygon[^>]*data-room="([^"]+)"[^>]*aria-label="([^"]+)"[^>]*points="([^"]+)"', f2_match.group(1))
print(f"\nf2 rooms ({len(f2_rooms)}):")
for r in f2_rooms:
    print(f"  Room {r[0]}: {r[1]} -> points: {r[2][:30]}...")
