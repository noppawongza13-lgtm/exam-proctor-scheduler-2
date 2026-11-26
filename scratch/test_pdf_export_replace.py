from pathlib import Path

text = Path("src/io/pdf-export.js").read_text(encoding="utf-8")
idx = text.find('return `\n    <div class="seating-plan-room-box">')
end_idx = text.find('`;\n}', idx)
print("Return block content:")
print(text[idx:end_idx+4])
