import re
from pathlib import Path

text = Path("src/ui/app-view.js").read_text(encoding="utf-8")
tabs = set(re.findall(r'data-tab=["\']([^"\']+)["\']', text))
print("All data-tabs in app-view.js:")
for t in sorted(tabs):
    print(" ", t)

# Search for building floorplan navigation or tabs
print("\nFloor plan tab search:")
for line in text.splitlines():
    if 'ผังอาคาร' in line or 'floorplan' in line or 'tab-floor' in line:
        print(" ", line.strip()[:120])
