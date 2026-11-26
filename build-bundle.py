import re
from pathlib import Path

files = [
    "src/utils/prng.js",
    "src/utils/thai-date.js",
    "src/data/settings.js",
    "src/data/branding.js",
    "src/data/models.js",
    "src/data/seed.js",
    "src/data/csv-io.js",
    "src/data/blueprint-base64.js",
    "src/rules/hard-constraints.js",
    "src/rules/soft-constraints.js",
    "src/rules/validator.js",
    "src/rules/feasibility.js",
    "src/solver/scorer.js",
    "src/solver/explain.js",
    "src/solver/greedy-solver.js",
    "src/solver/min-proctor-calc.js",
    "src/io/excel-export.js",
    "src/io/pdf-export.js",
    "src/store/state.js",
    "tests/run-tests.js",
    "src/agent/proctor-agent.js",
    "src/ui/building-floor-plan.js",
    "src/ui/kpi-modals.js",
    "src/ui/visitor-portal.js",
    "src/features/examinees.js",
    "src/ui/app-view.js",
    "src/main.js"
]

combined_parts = []
for fpath in files:
    content = Path(fpath).read_text(encoding="utf-8")
    
    # 1. Strip import statements
    clean = re.sub(r'(?s)import\s*(\{[^}]*\}|[\w$*]+(?:\s*,\s*\{[^}]*\})?)\s*from\s*[\'"`][^\'"`]*[\'"`]\s*;?', '', content)
    clean = re.sub(r'(?m)^import\s+.*?;?\s*$', '', clean)
    
    # 2. Strip export statements
    clean = re.sub(r'(?s)export\s*\{[^}]*\}\s*(?:from\s*[\'"`][^\'"`]*[\'"`])?\s*;?', '', clean)
    clean = re.sub(r'(?m)^export\s+default\s+', '', clean)
    clean = re.sub(r'(?m)^export\s+(async\s+function|function|class|const|let|var)\s+', r'\1 ', clean)
    clean = re.sub(r'(?m)^export\s+', '', clean)
    
    combined_parts.append(f"\n// === Module: {fpath} ===\n{clean}\n")

combined_js = "".join(combined_parts)
Path("bundle.js").write_text(combined_js, encoding="utf-8")
if Path("public").exists():
    Path("public/bundle.js").write_text(combined_js, encoding="utf-8")

# Check remaining imports
remaining = re.findall(r'import\s+.*', combined_js)
if remaining:
    print("WARNING: Remaining imports:", remaining)
else:
    print("SUCCESS: Zero imports remain in bundle.js!")

# CSS Bundling: Embed examinees.css directly into app.css to ensure 100% reliability
css_main = Path("src/styles/app.css").read_text(encoding="utf-8")
if "/* === Module: src/features/examinees.css === */" in css_main:
    css_main = css_main.split("/* === Module: src/features/examinees.css === */")[0]
css_main_clean = re.sub(r"@import\s+['\"].*?examinees\.css['\"];\s*", "", css_main)
css_examinees = Path("src/features/examinees.css").read_text(encoding="utf-8")
full_css = css_main_clean.rstrip() + "\n\n/* === Module: src/features/examinees.css === */\n" + css_examinees + "\n"

Path("src/styles/app.css").write_text(full_css, encoding="utf-8")
if Path("public/styles").exists():
    Path("public/styles/app.css").write_text(full_css, encoding="utf-8")
if Path("public/features").exists():
    Path("public/features/examinees.css").write_text(css_examinees, encoding="utf-8")

# 1. Clean, concise, modular index.html (under 30 lines)
clean_html = """<!DOCTYPE html>
<html lang="th" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="ระบบจัดห้องคุมสอบ กพ. และคุรุสภา มหาวิทยาลัยราชภัฏบุรีรัมย์ และระบบจัดตารางผู้คุมสอบอัตโนมัติ ตรวจสอบที่นั่งสอบและผังห้องสอบ">
  <title>ระบบจัดห้องคุมสอบ กพ. และคุรุสภา</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="src/styles/app.css">
</head>
<body>
  <div id="app">
    <div style="display: flex; height: 100vh; align-items: center; justify-content: center; font-size: 18px; color: var(--text-muted);">
      ⏳ กำลังโหลดระบบจัดห้องคุมสอบ กพ. และคุรุสภา...
    </div>
  </div>
  <script src="bundle.js?v=5.1"></script>
</body>
</html>
"""
Path("index.html").write_text(clean_html, encoding="utf-8")
if Path("public/index.html").exists():
    Path("public/index.html").write_text(clean_html, encoding="utf-8")
print(f"Generated clean index.html: {len(clean_html.splitlines())} lines, {Path('index.html').stat().st_size} bytes")


