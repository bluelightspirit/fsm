#!/usr/bin/env python3
"""Remove the old duplicate 'Greek letter' help entry and add Gary Young to the credit line.
Run from the repo root (~/fsm). Safe to run twice."""

import os
import re

GARY = ' and <a href="https://github.com/bluelightspirit" target="_blank" rel="noopener">Gary Young</a> in 2026'

# ---- 1) duplicate Greek entry in www/index.html ----
path = "www/index.html"
with open(path, encoding="utf-8") as f:
    html = f.read()
old_greek = re.compile(
    r"[ \t]*<li>(?:(?!</li>).)*?<b>Greek letter:</b>(?:(?!</li>).)*?</li>[ \t]*\n?", re.S
)
html, n = old_greek.subn("", html)
print("removed %d old 'Greek letter:' entr%s" % (n, "y" if n == 1 else "ies"))
with open(path, "w", encoding="utf-8") as f:
    f.write(html)

# ---- 2) credit line: find it anywhere in www/ or src/ ----
hits = []
for base, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in (".git", "node_modules")]
    for name in files:
        p = os.path.join(base, name)
        if p == "./www/fsm.js" or not name.endswith((".html", ".htm", ".js")):
            continue  # www/fsm.js is generated from src/ by build.py
        try:
            with open(p, encoding="utf-8") as f:
                text = f.read()
        except (OSError, UnicodeDecodeError):
            continue
        if re.search(r"moeein", text, re.I):
            hits.append((p, text))

if not hits:
    print("No file under www/ or src/ mentions Moeein. Run: grep -rn -i 'maintained' . --exclude-dir=.git")
for p, text in hits:
    if "Gary Young" in text:
        print("%s: already mentions Gary Young, left alone" % p)
        continue
    if not p.endswith((".html", ".htm")):
        print("%s mentions Moeein but is JavaScript; not editing it automatically. Lines:" % p)
        for i, line in enumerate(text.splitlines(), 1):
            if re.search(r"moeein|maintained", line, re.I):
                print("  %d: %s" % (i, line.strip()[:160]))
        continue
    done = False
    for pat in (
        re.compile(r"(maintained\s+by\s*<a\b[^>]*moeein[^>]*>.*?</a>)", re.S | re.I),
        re.compile(r"(<a\b[^>]*moeein[^>]*>.*?</a>)", re.S | re.I),
    ):
        new, k = pat.subn(lambda m: m.group(1) + GARY, text, count=1)
        if k:
            with open(p, "w", encoding="utf-8") as f:
                f.write(new)
            print("%s: added Gary Young to the credit line" % p)
            done = True
            break
    if not done:
        print("%s mentions Moeein but not inside a link. Lines:" % p)
        for i, line in enumerate(text.splitlines(), 1):
            if re.search(r"moeein|maintained", line, re.I):
                print("  %d: %s" % (i, line.strip()[:160]))
print("done. refresh the page (server.py rebuilds automatically).")
