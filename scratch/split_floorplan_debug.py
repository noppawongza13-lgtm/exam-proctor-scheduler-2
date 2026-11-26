import re
from pathlib import Path

text = Path("floorplan.html").read_text(encoding="utf-8")

# Extract the script
script = re.search(r'<script>(.*?)</script>', text, re.DOTALL).group(1)
Path("scratch/floorplan_script.js").write_text(script, encoding="utf-8")
print(f"Saved floorplan_script.js ({len(script)} chars)")

# Extract the non-SVG parts of body
clean_body = re.sub(r'<path class="art.*?</path>', '<!-- PATHS TRUNCATED -->', text, flags=re.DOTALL)
Path("scratch/floorplan_preview.html").write_text(clean_body, encoding="utf-8")
print(f"Saved floorplan_preview.html ({len(clean_body)} chars)")
