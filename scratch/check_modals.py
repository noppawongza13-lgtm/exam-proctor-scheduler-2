from pathlib import Path
import re

text = Path("src/ui/app-view.js").read_text(encoding="utf-8")
modals = re.findall(r"activeModal\.type\s*===\s*['\"]([^'\"]+)['\"]", text)
print("Modals found:")
for m in sorted(set(modals)):
    print(" ", m)

# Find where renderModal is called or activeModal is handled
for line in text.splitlines():
    if "activeModal" in line and ("render" in line or "function" in line or "if" in line):
        print(" ", line.strip()[:100])
