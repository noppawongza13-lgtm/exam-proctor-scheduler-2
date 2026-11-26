from pathlib import Path
import re

sample = '<polygon id="room-17108" class="room room-cls floor-1" data-room="17108" tabindex="0" role="button" aria-label="17108" points="1,2"><title>test</title></polygon>'

def replace_fn(match):
    before, code, after, inner = match.groups()
    return f'<polygon {before}data-room="{code}"{after} class="room is-exam-room floor-1"><title>title</title></polygon>'

res = re.sub(r'<polygon\s+([^>]*?)data-room="([^"]+)"([^>]*?)>(.*?)<\/polygon>', replace_fn, sample, flags=re.DOTALL)
print("Result of current regex:")
print(res)
