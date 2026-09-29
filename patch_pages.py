#!/usr/bin/env python3
"""Credit line + US Letter page box (add pages downward) + true-size exports.
Run from the repo root (~/fsm) after patch_import_svg.py.
Aborts without writing anything if a required anchor is missing."""

import os
import re

# ------------------------------------------------------------------ new files
PAGES_JS = r"""// Page-sized canvas: US Letter at 96 px per inch, growing downward one page at a time.
// Only the on-screen guides (page edge, 1 in margins, page breaks) live here;
// exports never include them. Exports are true size: 96 px = 1 inch.

var PX_PER_INCH = 96;
var PAGE_MARGIN_IN = 1;
var MAX_PAGES = 20;
var PAGE_SIZES = { letter: { label: "US Letter", w: 8.5, h: 11 } }; // A4 etc. can be added here later
var pageSizeKey = "letter";
var pageCount = 1;
var __pagesLast = "";

function pageWidthPx() {
  return Math.round(PAGE_SIZES[pageSizeKey].w * PX_PER_INCH);
}

function pageHeightPx() {
  return Math.round(PAGE_SIZES[pageSizeKey].h * PX_PER_INCH);
}

function lowestContentY() {
  var y = 0;
  for (var i = 0; i < nodes.length; i++) y = Math.max(y, nodes[i].y + nodeRadius);
  return y;
}

function setPageCount(n) {
  n = Math.round(n);
  if (!(n >= 1)) n = 1;
  if (n > MAX_PAGES) n = MAX_PAGES;
  pageCount = n;
  if (typeof canvas !== "undefined" && canvas) {
    var w = pageWidthPx();
    var h = pageHeightPx() * n;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    canvas.style.width = "100%";
    canvas.style.maxWidth = w + "px";
    canvas.style.height = "auto";
  }
  __pagesLast = "";
  syncPagesUI();
}

// Drawn behind the diagram, on screen only (exports call drawUsing directly).
function drawPageGuides(c) {
  var fg = getDrawColors().fg;
  var w = pageWidthPx();
  var h = pageHeightPx();
  var m = PAGE_MARGIN_IN * PX_PER_INCH;
  c.save();
  c.globalCompositeOperation = "destination-over";
  c.strokeStyle = fg;
  c.fillStyle = fg;
  c.lineWidth = 1;
  for (var p = 0; p < pageCount; p++) {
    var top = p * h;
    c.globalAlpha = 0.35;
    c.setLineDash([]);
    c.strokeRect(0.5, top + 0.5, w - 1, h - 1);
    c.globalAlpha = 0.18;
    c.setLineDash([6, 6]);
    c.strokeRect(m + 0.5, top + m + 0.5, w - 2 * m, h - 2 * m);
    c.globalAlpha = 0.45;
    c.setLineDash([]);
    c.font = "12px sans-serif";
    c.fillText("Page " + (p + 1), 8, top + 16);
  }
  c.restore();
}

function addPage() {
  if (pageCount >= MAX_PAGES) return;
  flushHistory();
  setPageCount(pageCount + 1);
  draw();
  commitHistory();
}

function removeLastPage() {
  if (pageCount <= 1 || lowestContentY() > (pageCount - 1) * pageHeightPx()) return;
  flushHistory();
  setPageCount(pageCount - 1);
  draw();
  commitHistory();
}

function syncPagesUI() {
  var info = document.getElementById("pages-info");
  var add = document.getElementById("pages-add");
  var remove = document.getElementById("pages-remove");
  if (!info || !add || !remove) return;
  var canRemove = pageCount > 1 && lowestContentY() <= (pageCount - 1) * pageHeightPx();
  var key = pageCount + "|" + canRemove;
  if (key === __pagesLast) return;
  __pagesLast = key;
  var size = PAGE_SIZES[pageSizeKey];
  info.textContent =
    pageCount + (pageCount === 1 ? " page" : " pages") + " \u00b7 " + size.label + " " +
    size.w + "\u00d7" + size.h + " in \u00b7 dashed box = " + PAGE_MARGIN_IN + " in margins";
  remove.disabled = !canRemove;
  remove.title = canRemove || pageCount === 1 ? "" : "Move everything off the last page first";
  add.disabled = pageCount >= MAX_PAGES;
}

function wirePagesUI() {
  if (document.getElementById("pages-row")) return;
  var row = document.createElement("div");
  row.id = "pages-row";
  row.style.cssText =
    "display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:8px 0;font-size:0.95rem;width:100%;flex-basis:100%;box-sizing:border-box;";
  var add = document.createElement("button");
  add.type = "button";
  add.id = "pages-add";
  add.textContent = "+ Add page";
  add.onclick = addPage;
  var remove = document.createElement("button");
  remove.type = "button";
  remove.id = "pages-remove";
  remove.textContent = "\u2212 Remove last page";
  remove.onclick = removeLastPage;
  var info = document.createElement("span");
  info.id = "pages-info";
  info.style.opacity = "0.75";
  row.appendChild(add);
  row.appendChild(remove);
  row.appendChild(info);
  canvas.parentNode.insertBefore(row, canvas.nextSibling); // directly under the diagram
  setPageCount(pageCount); // size the canvas even when nothing was loaded
}
"""

CREDIT_JS = r"""// Makes sure the footer credit reads "... Moeein Aali and Gary Young in 2026".
// A no-op when the page source already says so.
function addCreditLine() {
  var footer = document.querySelector("footer");
  if (!footer || footer.textContent.indexOf("Gary Young") >= 0) return;
  footer.appendChild(document.createTextNode(" and "));
  var a = document.createElement("a");
  a.href = "https://github.com/bluelightspirit";
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = "Gary Young";
  footer.appendChild(a);
  footer.appendChild(document.createTextNode(" in 2026"));
}
"""

GARY = ' and <a href="https://github.com/bluelightspirit" target="_blank" rel="noopener">Gary Young</a> in 2026'

# ------------------------------------------------------------------ prechecks
for p in ("src/main/import_ui.js", "src/main/ui.js", "src/main/save.js", "src/export_as/typst.js", "src/export_as/latex.js", "src/main/label.js", "www/index.html"):
    if not os.path.exists(p):
        raise SystemExit("ABORTED: %s missing. Run the earlier patches first." % p)
for p in ("src/main/pages.js", "src/main/credit.js"):
    if os.path.exists(p):
        raise SystemExit("ABORTED: %s already exists (already patched?)" % p)

# ------------------------------------------------------------------ edits
edits = []  # (kind, path, a, b, expected_count)


def sub(path, old, new, count=1):
    edits.append(("plain", path, old, new, count))


def sub_re(path, pattern, repl):
    edits.append(("re", path, pattern, repl, 1))


sub(
    "src/main/ui.js",
    '  if (typeof wireImportUI === "function") wireImportUI();\n',
    '  if (typeof wireImportUI === "function") wireImportUI();\n'
    '  if (typeof wirePagesUI === "function") wirePagesUI();\n'
    '  if (typeof addCreditLine === "function") addCreditLine();\n',
)

# on-screen guides + button state
sub(
    "src/main/fsm.js",
    'function draw() {\n  drawUsing(canvas.getContext("2d"));\n',
    'function draw() {\n  drawUsing(canvas.getContext("2d"));\n  drawPageGuides(canvas.getContext("2d"));\n',
)
sub(
    "src/main/fsm.js",
    '  if (typeof refreshNamesPanel === "function") refreshNamesPanel();\n}',
    '  if (typeof refreshNamesPanel === "function") refreshNamesPanel();\n'
    '  if (typeof syncPagesUI === "function") syncPagesUI();\n}',
)

# page count is saved with the diagram (undo/redo, localStorage, fsm-data)
sub(
    "src/main/save.js",
    "  var data = { nodes: [], links: [], style: getStyle() };\n",
    "  var data = { nodes: [], links: [], style: getStyle(), pages: pageCount };\n",
)
sub(
    "src/main/save.js",
    "  applyStyle(data.style, false);\n",
    "  applyStyle(data.style, false);\n  setPageCount(data.pages || 1);\n",
)

# true-size exports: 96 px = 1 inch = 2.54 cm; 1 px = 0.75 pt
T = "src/export_as/typst.js"
sub_re(T, r"  this\._scale = 0\.02;[^\n]*\n", "  this._scale = 2.54 / 96; // true size: 96 px = 1 inch (CeTZ units are cm)\n")
sub(T, "fixed(this.lineWidth, 2)", "fixed(this.lineWidth * 0.75, 2)", count=3)
sub(T, "styleLinkFontSize) * 0.55, 2)", "styleLinkFontSize) * 0.75, 2)")
L = "src/export_as/latex.js"
sub(L, "fixed(this.lineWidth, 2)", "fixed(this.lineWidth * 0.75, 2)")
sub(L, "[scale=0.2]", "[scale=0.264583]")  # 0.1 (px scale in latex.js) * 0.264583 = 2.54/96 cm per px
sub("src/main/label.js", "fixed(size * 0.55, 2)", "fixed(size * 0.75, 2)")
sub("src/main/label.js", "fixed(size * 0.55 * 1.2, 2)", "fixed(size * 0.75 * 1.2, 2)")

# ------------------------------------------------------------------ check all
contents = {}
for kind, path, a, b, count in edits:
    text = contents.get(path)
    if text is None:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    if kind == "plain":
        found = text.count(a)
        if found != count:
            raise SystemExit(
                "ABORTED, nothing written. %s: expected %d match(es), found %d for:\n%s"
                % (path, count, found, a)
            )
        text = text.replace(a, b)
    else:
        text, found = re.subn(a, lambda m: b, text, flags=re.S)
        if found != count:
            raise SystemExit(
                "ABORTED, nothing written. %s: expected %d match(es), found %d for pattern:\n%s"
                % (path, count, found, a)
            )
    contents[path] = text

# ---- footer: edit the visible text if it can be found (the runtime fallback covers the rest) ----
notes = []
with open("www/index.html", encoding="utf-8") as f:
    html = f.read()
if re.search(r"Moeein\s+Aali\s*</a\s*>\s*and\s*<a[^>]*bluelightspirit", html):
    notes.append("footer source already has Gary Young")
else:
    new_html, n = re.subn(r"(Moeein\s+Aali\s*</a\s*>)", lambda m: m.group(1) + GARY, html, count=1)
    if n:
        contents["www/index.html"] = new_html
        notes.append("footer: added Gary Young to www/index.html")
    else:
        notes.append("footer text not found in www/index.html; the page will add it when it loads instead")

# ------------------------------------------------------------------ write
for path, text in contents.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
with open("src/main/pages.js", "w", encoding="utf-8") as f:
    f.write(PAGES_JS)
with open("src/main/credit.js", "w", encoding="utf-8") as f:
    f.write(CREDIT_JS)
print("done: created pages.js and credit.js, patched %d files." % len(contents))
for n in notes:
    print("  - " + n)
print("refresh the page (server.py rebuilds automatically).")
