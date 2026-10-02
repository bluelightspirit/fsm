#!/usr/bin/env python3
"""Two small, concrete changes:
1. Swaps which regex syntax is marked "experimental": formal/theory regex
   becomes experimental (pending the Lean-backed replacement), Python-style
   becomes the non-experimental default, in both the backend response and
   the UI selector/status text.
2. Adds a How-to-use bullet pointing to CyberZHG's nfa2dfa tool as an
   alternative regex->automaton converter.

Run from the repo root. Aborts without writing anything if an anchor is
missing (send me the current file section if so)."""

edits = []


def sub(path, old, new, count=1):
    edits.append((path, old, new, count))


# ---- backend: automata_integration.py - swap which syntax is "experimental" ----
sub(
    "automata_integration.py",
    '''    try:
        if syntax == "theory":
            nfa = formal_regex.build_formal_nfa(expression)
        else:
            nfa = glushkov_regex.build_glushkov_nfa(expression)''',
    '''    try:
        if syntax == "python":
            nfa = glushkov_regex.build_glushkov_nfa(expression)
        else:
            nfa = formal_regex.build_formal_nfa(expression)''',
)
sub(
    "automata_integration.py",
    '        "experimental": syntax == "python",',
    '        "experimental": syntax == "theory",  # pending the Lean-backed replacement',
)

# ---- frontend: automata.js - swap the UI labels/status text/default selection ----
sub(
    "src/main/automata.js",
    '[["theory", "Formal (theory) regex"], ["python", "Python-style regex (experimental)"]]',
    '[["python", "Python-style regex"], ["theory", "Formal (theory) regex (experimental)"]]',
)
sub(
    "src/main/automata.js",
    'var engineLabel = syntax === "python" ? "the experimental Python-style engine" : "the formal-theory engine";',
    'var engineLabel = syntax === "theory" ? "the experimental formal-theory engine" : "the Python-style engine";',
)
sub(
    "src/main/automata.js",
    'var tag = generated.experimental ? " [experimental Python-style]" : " [formal]";',
    'var tag = generated.experimental ? " [experimental formal-theory]" : " [python-style]";',
)

path = "www/index.html"
with open(path, encoding="utf-8") as f:
    html = f.read()
if "cyberzhg.github.io/toolbox/nfa2dfa" in html:
    print("www/index.html already mentions cyberzhg's nfa2dfa tool; leaving it alone.")
else:
    import re
    m = re.search(
        r'[ \t]*<li>(?:(?!</li>).)*?Create a new FSM from a regex(?:(?!</li>).)*?</li>[ \t]*\n?',
        html, re.S | re.I,
    )
    if not m:
        print("NOTE: couldn't find the 'Create a new FSM from a regex' help line to insert after.")
        print("      Run: grep -n -i 'regex' www/index.html   and send me the output.")
    else:
        indent = re.match(r"[ \t]*", m.group(0)).group(0)
        new_li = (
            indent
            + '<li><b>Alternative regex converter:</b> '
            + '<a href="https://cyberzhg.github.io/toolbox/nfa2dfa" target="_blank" rel="noopener">CyberZHG\'s nfa2dfa</a> '
            + 'is a useful alternative if you run into issues with the regex converter here</li>\n'
        )
        html = html[: m.end()] + new_li + html[m.end():]
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        print("added the CyberZHG reference to www/index.html's How to use section.")

# ------------------------------------------------------------------ check + write the .py/.js edits
contents = {}
for path, old, new, count in edits:
    text = contents.get(path)
    if text is None:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    found = text.count(old)
    if found != count:
        raise SystemExit(
            "ABORTED, nothing written for the remaining edits. %s: expected %d match(es), found %d for:\n%s"
            % (path, count, found, old[:200])
        )
    contents[path] = text.replace(old, new)

for path, text in contents.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
print("patched %d file(s): formal-theory is now labeled experimental, Python-style is the default." % len(contents))
print("rebuild/restart to pick this up.")
