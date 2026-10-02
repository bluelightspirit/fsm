#!/usr/bin/env python3
"""Fixes the actual bug: automataGenerateRegex() never sent a "syntax" field,
so every request silently used the backend's default ("theory") no matter
what the user intended. This adds a real <select> for it (created via
document.createElement, inserted next to the existing mode dropdown - no
index.html edits needed, matching how the style/names/import panels were
built earlier), and wires it into the POST body.

Run from the repo root (where src/main/automata.js lives). Aborts without
writing anything if the expected current code isn't found exactly once."""

edits = []


def sub(path, old, new, count=1):
    edits.append((path, old, new, count))


OLD_GENERATE = '''function automataGenerateRegex() {
  var input = document.getElementById("automata-regex");
  var mode = document.getElementById("automata-regex-mode").value;
  var button = document.getElementById("automata-regex-create");
  var expression = input.value.trim();
  if (!expression) { automataStatusMessage = "Enter a regular expression first."; refreshAutomataPanel(true); return; }
  button.disabled = true;
  automataStatusMessage = "Generating an automaton with Pyformlang…"; refreshAutomataPanel(true);
  fetch("/api/automata/regex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regex: expression, mode: mode }) })
    .then(function (response) { return response.json().then(function (body) { if (!response.ok) throw new Error(body.error || "Regex conversion failed"); return body.automaton; }); })
    .then(function (generated) { automataCreateWorkspace("From regex: " + expression, generated, generated.alphabet); })
    .catch(function (error) { automataStatusMessage = error.message; refreshAutomataPanel(true); })
    .finally(function () { button.disabled = false; });
}'''

NEW_GENERATE = '''// Inserts the regex-syntax selector next to the existing mode dropdown the
// first time it's needed, since index.html doesn't define one. Mirrors how
// the style/names/import panels were built: created in JS, nothing to add
// to index.html by hand.
function ensureRegexSyntaxSelect() {
  var existing = document.getElementById("automata-regex-syntax");
  if (existing) return existing;
  var modeSelect = document.getElementById("automata-regex-mode");
  if (!modeSelect) return null;
  var select = document.createElement("select");
  select.id = "automata-regex-syntax";
  select.title = "Formal (theory): pyformlang.Regex-compatible syntax (|, +, *, 'epsilon'; multi-character symbols unless separated). Python-style: experimental Python-re-flavored sugar (\\\\d, [...], ?).";
  [["theory", "Formal (theory) regex"], ["python", "Python-style regex (experimental)"]].forEach(function (pair) {
    var opt = document.createElement("option");
    opt.value = pair[0]; opt.textContent = pair[1];
    select.appendChild(opt);
  });
  select.style.marginLeft = "6px";
  modeSelect.insertAdjacentElement("afterend", select);
  return select;
}

function automataGenerateRegex() {
  var input = document.getElementById("automata-regex");
  var mode = document.getElementById("automata-regex-mode").value;
  var syntaxSelect = ensureRegexSyntaxSelect();
  var syntax = syntaxSelect ? syntaxSelect.value : "theory";
  var button = document.getElementById("automata-regex-create");
  var expression = input.value.trim();
  if (!expression) { automataStatusMessage = "Enter a regular expression first."; refreshAutomataPanel(true); return; }
  button.disabled = true;
  var engineLabel = syntax === "python" ? "the experimental Python-style engine" : "the formal-theory engine";
  automataStatusMessage = "Generating an automaton with " + engineLabel + "…"; refreshAutomataPanel(true);
  fetch("/api/automata/regex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regex: expression, mode: mode, syntax: syntax }) })
    .then(function (response) { return response.json().then(function (body) { if (!response.ok) throw new Error(body.error || "Regex conversion failed"); return body.automaton; }); })
    .then(function (generated) {
      var tag = generated.experimental ? " [experimental Python-style]" : " [formal]";
      automataCreateWorkspace("From regex: " + expression + tag, generated, generated.alphabet);
    })
    .catch(function (error) { automataStatusMessage = error.message; refreshAutomataPanel(true); })
    .finally(function () { button.disabled = false; });
}'''

sub("src/main/automata.js", OLD_GENERATE, NEW_GENERATE)

OLD_WIRE_TAIL = '''  regexButton.addEventListener("click", automataGenerateRegex);
  grammarButton.addEventListener("click", automataShowRegularGrammar);
  refreshAutomataPanel(true);
}'''

NEW_WIRE_TAIL = '''  ensureRegexSyntaxSelect();
  regexButton.addEventListener("click", automataGenerateRegex);
  grammarButton.addEventListener("click", automataShowRegularGrammar);
  refreshAutomataPanel(true);
}'''

sub("src/main/automata.js", OLD_WIRE_TAIL, NEW_WIRE_TAIL)

# ------------------------------------------------------------------ check all, then write
contents = {}
for path, old, new, count in edits:
    text = contents.get(path)
    if text is None:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    found = text.count(old)
    if found != count:
        raise SystemExit(
            "ABORTED, nothing written. %s: expected %d match(es), found %d for a block starting:\n%s\n"
            "This usually means the file has changed since I last saw it - send me the current "
            "automataGenerateRegex() and wireAutomataUI() functions so I can re-anchor this."
            % (path, count, found, old.splitlines()[0])
        )
    contents[path] = text.replace(old, new)

for path, text in contents.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
print("patched %d file(s). The syntax selector now appears next to the mode dropdown," % len(contents))
print("defaults to 'Formal (theory) regex', and is actually sent to the backend.")
print("rebuild/restart the server to pick this up.")
