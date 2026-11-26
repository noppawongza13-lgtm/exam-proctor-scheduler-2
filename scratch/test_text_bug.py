from pathlib import Path
import re

sample = '<text id="label-17108" class="rl" data-room="17108" x="308.5" y="749.5" style="font-size:16px">17108</text>'

def replace_text(m):
    attrs, textContent = m.group(1), m.group(2)
    code_match = re.search(r'data-room="([^"]+)"', attrs)
    if not code_match:
        return m.group(0)
    code = code_match.group(1)
    x = re.search(r'x="([^"]+)"', attrs).group(1)
    y = re.search(r'y="([^"]+)"', attrs).group(1)
    return f'<text id="label-{code}" data-room="{code}" x="{x}" y="{y}" class="rl is-exam-label" fill="#4C1D95" style="font-size:16px; font-weight: 800; cursor: pointer; pointer-events: auto;" data-action="view-room-detail" data-id="{code}">{textContent}</text>'

res = re.sub(r'<text\s+([^>]*?)>([^<]+)<\/text>', replace_text, sample, flags=re.DOTALL)
print("Result of text replacement:")
print(res)
