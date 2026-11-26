from pathlib import Path

text = Path("src/io/pdf-export.js").read_text(encoding="utf-8")
idx = text.find('class="seating-plan-room-box"')
if idx != -1:
    print(text[idx+1000:idx+2500])
