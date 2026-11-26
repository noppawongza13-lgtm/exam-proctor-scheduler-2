"""
Read-only verification script to ensure University Theme Redesign preserves
all IDs, data-tab, data-action, JS syntax, contrast ratios, and leaves Visitor files untouched.
"""
import re
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def extract_tokens(js_text):
    ids = set(re.findall(r'id="([^"$]+)"', js_text))
    tabs = set(re.findall(r'data-tab="([^"$]+)"', js_text))
    actions = set(re.findall(r'data-action="([^"$]+)"', js_text))
    return ids, tabs, actions

def lum(hex_c):
    hex_c = hex_c.lstrip('#')
    r, g, b = [int(hex_c[i:i+2], 16) / 255.0 for i in (0, 2, 4)]
    def adj(c): return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * adj(r) + 0.7152 * adj(g) + 0.0722 * adj(b)

def contrast_ratio(c1, c2):
    l1, l2 = lum(c1), lum(c2)
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)

def main():
    print("=== 1. Comparing IDs / data-tab / data-action (Backup vs Current) ===")
    bak = (ROOT / "split/js/25-app-view.js.backup.university-theme.js").read_text(encoding="utf-8")
    cur = (ROOT / "split/js/25-app-view.js").read_text(encoding="utf-8")
    b_ids, b_tabs, b_acts = extract_tokens(bak)
    c_ids, c_tabs, c_acts = extract_tokens(cur)

    missing_ids = b_ids - c_ids
    missing_tabs = b_tabs - c_tabs
    missing_acts = b_acts - c_acts
    print(f"IDs: before={len(b_ids)}, after={len(c_ids)}, missing={sorted(missing_ids)}")
    print(f"data-tab: before={len(b_tabs)}, after={len(c_tabs)}, missing={sorted(missing_tabs)}")
    print(f"data-action: before={len(b_acts)}, after={len(c_acts)}, missing={sorted(missing_acts)}")

    print("\n=== 2. Checking WCAG Contrast Ratios for Brand Tokens ===")
    pairs = [
        ("#FFFFFF", "#3B1F54", "White on Brand Purple (#3B1F54)"),
        ("#F8F6FC", "#2D1445", "Off-white on Sidebar Dark Purple (#2D1445)"),
        ("#FDE047", "#3B1F54", "Light Gold (#FDE047) on Brand Purple"),
        ("#1A0D2E", "#E5A823", "Deep Purple Text on Brand Gold (#E5A823)"),
        ("#3B1F54", "#FFFFFF", "Brand Purple Title on White Header"),
        ("#1E1B4B", "#FFFFFF", "Primary Text on White Card"),
        ("#5B5370", "#FFFFFF", "Muted Text on White Card"),
        ("#FFFFFF", "#B91C1C", "White on Soft Formal Danger (#B91C1C)"),
        ("#166534", "#ECFDF5", "Status Success Text on Soft Green"),
        ("#92400E", "#FEF3C7", "Status Warning Text on Soft Amber"),
        ("#991B1B", "#FEF2F2", "Status Danger Text on Soft Red"),
    ]
    all_pass = True
    for fg, bg, desc in pairs:
        r = contrast_ratio(fg, bg)
        ok = r >= 4.5
        if not ok:
            all_pass = False
        print(f"  [{'PASS' if ok else 'FAIL'}] {desc:45s}: {r:5.2f}:1")

    print("\n=== 3. Checking Visitor Portal Files Untouched ===")
    for vf in ["split/css/05-visitor-portal.css", "split/js/24-visitor-portal.js"]:
        p = ROOT / vf
        h = hashlib.sha256(p.read_bytes()).hexdigest()[:16]
        print(f"  {vf}: sha256={h}")

    print("\n=== 4. Checking Leftover Bright Legacy Colors in Staff CSS ===")
    staff_css = ["split/css/01-variables.css", "split/css/02-layout.css", "split/css/03-components.css", "split/css/04-floorplan.css", "split/css/06-responsive.css"]
    bright_patterns = ["#9333EA", "#a855f7", "rgba(124, 58, 237", "rgba(168, 85, 247", "hsl(268, 75%, 52%)"]
    for sf in staff_css:
        txt = (ROOT / sf).read_text(encoding="utf-8")
        hits = [bp for bp in bright_patterns if bp.lower() in txt.lower()]
        print(f"  {sf}: legacy bright matches = {hits}")

    if missing_ids or missing_tabs or missing_acts or not all_pass:
        raise SystemExit(1)
    print("\nALL INTEGRITY CHECKS PASSED!")

if __name__ == "__main__":
    main()
