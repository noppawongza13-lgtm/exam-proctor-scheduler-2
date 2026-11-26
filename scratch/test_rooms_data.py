import json
from pathlib import Path

# Load room data from seed
import re
text = Path("src/data/seed.js").read_text(encoding="utf-8")
rooms_match = re.search(r'export const DEFAULT_ROOMS\s*=\s*(\[.*?\]);', text, re.DOTALL)
rooms = eval(rooms_match.group(1))

r17108 = next(r for r in rooms if r['id'] == 'R01')
print("Room 17108:", r17108['name'], "Blocks count:", len(r17108.get('blocks', [])))
r17201 = next(r for r in rooms if r['id'] == 'R05')
print("Room 17201:", r17201['name'], "Rows count:", len(r17201.get('rows', [])))
