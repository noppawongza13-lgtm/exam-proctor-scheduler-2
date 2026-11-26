from pathlib import Path
import re

text = Path("floorplan.html").read_text(encoding="utf-8")

matches = re.findall(r'<text[^>]*>.*?</text>', text, re.DOTALL)
print(f"Total <text> elements: {len(matches)}")
for m in matches:
    print("  Text:", m.strip())

# Check title elements or any other text
titles = re.findall(r'<title[^>]*>.*?</title>', text)
print(f"Total <title> elements: {len(titles)}")
for t in titles[:10]:
    print("  Title:", t)
