from pathlib import Path
import re

text = Path("floorplan.html").read_text(encoding="utf-8")

for m in re.finditer(r'<g class="ttl">.*?</g>', text, re.DOTALL):
    print("Found ttl:", m.group(0))
