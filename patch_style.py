#!/usr/bin/env python3
"""Adds global style controls: text size, state radius, line width, arrow size.
Run from the repo root (~/fsm). Aborts without writing if any anchor is missing."""

import os

STYLE_JS = r"""// Global diagram style: one value for every state / arrow / label.
// nodeRadius (defined in fsm.js) is reused for the state radius.
var styleFontSize = 20;
var styleLineWidth = 1;
var styleArrowSize = 8;

var STYLE_DEFAULTS = { fontSize: 20, nodeRadius: 30, lineWidth: 1, arrowSize: 8 };
// [key, label, min, max, step]
var STYLE_FIELDS = [
  ["fontSize", "Text", 8, 72, 1],
  ["nodeRadius", "State", 12, 120, 1],
  ["lineWidth", "Line", 0.5, 8, 0.5],
  ["arrowSize", "Arrow", 4, 40, 1],
];

function getStyle() {
  return {
    fontSize: styleFontSize,
    nodeRadius: nodeRadius,
    lineWidth: styleLineWidth,
    arrowSize: styleArrowSize,
  };
}

// partial=true keeps the current value for any missing/blank field (used while typing);
// otherwise missing fields fall back to the defaults (used when loading a diagram).
function applyStyle(s, partial) {
  var base = partial ? getStyle() : STYLE_DEFAULTS;
  var out = {};
  for (var i = 0; i < STYLE_FIELDS.length; i++) {
    var f = STYLE_FIELDS[i];
    var v = s ? parseFloat(s[f[0]]) : NaN;
    out[f[0]] = isNaN(v) ? base[f[0]] : Math.min(f[3], Math.max(f[2], v));
  }
  styleFontSize = out.fontSize;
  nodeRadius = out.nodeRadius;
  styleLineWidth = out.lineWidth;
  styleArrowSize = out.arrowSize;
}

function syncStyleInputs() {
  var s = getStyle();
  for (var i = 0; i < STYLE_FIELDS.length; i++) {
    var el = document.getElementById("style-" + STYLE_FIELDS[i][0]);
    if (el) el.value = s[STYLE_FIELDS[i][0]];
  }
}

function readStyleInputs() {
  var s = {};
  for (var i = 0; i < STYLE_FIELDS.length; i++) {
    var el = document.getElementById("style-" + STYLE_FIELDS[i][0]);
    if (el) s[STYLE_FIELDS[i][0]] = el.value;
  }
  return s;
}

function wireStyleUI() {
  if (document.getElementById("style-panel")) return;
  var panel = document.createElement("div");
  panel.id = "style-panel";
  panel.style.cssText =
    "display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0;font-size:0.85rem;";

  STYLE_FIELDS.forEach(function (f) {
    var label = document.createElement("label");
    label.style.cssText = "display:flex;align-items:center;gap:4px;";
    label.appendChild(document.createTextNode(f[1]));
    var input = document.createElement("input");
    input.type = "number";
    input.id = "style-" + f[0];
    input.min = f[2];
    input.max = f[3];
    input.step = f[4];
    input.style.width = "64px";
    input.addEventListener("input", function () {
      applyStyle(readStyleInputs(), true);
      draw();
    });
    input.addEventListener("change", function () {
      applyStyle(readStyleInputs(), true);
      syncStyleInputs(); // show the clamped values
      draw();
      commitHistory();
    });
    label.appendChild(input);
    panel.appendChild(label);
  });

  var reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset sizes";
  reset.onclick = function () {
    applyStyle(null, false);
    syncStyleInputs();
    draw();
    commitHistory();
  };
  panel.appendChild(reset);

  var anchorBtn = document.getElementById("btn-typst") || document.getElementById("btn-latex");
  var host = anchorBtn ? anchorBtn.parentNode : null;
  if (host && host.parentNode) host.parentNode.insertBefore(panel, host.nextSibling);
  else canvas.parentNode.appendChild(panel);
  syncStyleInputs();
}
"""

edits = []  # (path, old, new, expected_count)


def sub(path, old, new, count=1):
    edits.append((path, old, new, count))


# ---- fsm.js: sizes come from the style globals ----
sub(
    "src/main/fsm.js",
    "  c.lineTo(x - 8 * dx + 5 * dy, y - 8 * dy - 5 * dx);\n"
    "  c.lineTo(x - 8 * dx - 5 * dy, y - 8 * dy + 5 * dx);\n",
    "  var a = styleArrowSize;\n"
    "  var b = (a * 5) / 8;\n"
    "  c.lineTo(x - a * dx + b * dy, y - a * dy - b * dx);\n"
    "  c.lineTo(x - a * dx - b * dy, y - a * dy + b * dx);\n",
)
sub(
    "src/main/fsm.js",
    """  c.font = '20px "Times New Roman", serif';\n""",
    """  c.font = styleFontSize + 'px "Times New Roman", serif';\n""",
)
sub(
    "src/main/fsm.js",
    "    var cornerPointY = (10 + 5) * (sin > 0 ? 1 : -1);\n",
    "    var cornerPointY = (styleFontSize / 2 + 5) * (sin > 0 ? 1 : -1);\n",
)
sub(
    "src/main/fsm.js",
    "    c.fillText(text, x, y + 6);\n",
    "    c.fillText(text, x, y + styleFontSize * 0.3);\n",
)
sub(
    "src/main/fsm.js",
    "      c.moveTo(x, y - 10);\n      c.lineTo(x, y + 10);\n",
    "      c.moveTo(x, y - styleFontSize / 2);\n      c.lineTo(x, y + styleFontSize / 2);\n",
)
sub("src/main/fsm.js", "    c.lineWidth = 1;\n", "    c.lineWidth = styleLineWidth;\n", count=3)

# ---- save.js: style is saved per diagram (so undo/redo and fsm-data include it) ----
sub(
    "src/main/save.js",
    "  var data = { nodes: [], links: [] };\n",
    "  var data = { nodes: [], links: [], style: getStyle() };\n",
)
sub(
    "src/main/save.js",
    "  if (!data || !data.nodes) return;\n",
    "  if (!data || !data.nodes) return;\n"
    "  applyStyle(data.style, false);\n"
    '  if (typeof syncStyleInputs === "function") syncStyleInputs();\n',
)

# ---- ui.js: build the panel ----
sub(
    "src/main/ui.js",
    "  bindExport(latexBtn, saveAsLaTeX);\n",
    "  bindExport(latexBtn, saveAsLaTeX);\n"
    '  if (typeof wireStyleUI === "function") wireStyleUI();\n',
)

# ---- typst.js: export follows the style ----
sub("src/export_as/typst.js", '  this._data = "";\n', '  this._data = "";\n  this.lineWidth = 1; // set by drawUsing()\n')
sub(
    "src/export_as/typst.js",
    r"""      "#align(center, cetz.canvas({\n" +
      "  import cetz.draw: *\n" +
      this._data +
      "}))\n"
""",
    r"""      "#align(center, text(size: " +
      fixed(styleFontSize * 0.55, 2) +
      "pt, cetz.canvas({\n" +
      "  import cetz.draw: *\n" +
      "  set-style(stroke: (thickness: " +
      fixed(this.lineWidth, 2) +
      "pt))\n" +
      this._data +
      "})))\n"
""",
)
sub(
    "src/export_as/typst.js",
    """    c.font = '20px "Times New Roman", serif';\n""",
    """    c.font = styleFontSize + 'px "Times New Roman", serif';\n""",
)
sub("src/export_as/typst.js", "          y -= 10;\n", "          y -= styleFontSize / 2;\n")
sub("src/export_as/typst.js", "          y += 10;\n", "          y += styleFontSize / 2;\n")

# ---- check everything first, then write ----
if os.path.exists("src/main/style.js"):
    raise SystemExit("ABORTED: src/main/style.js already exists (already patched?)")

contents = {}
for path, old, new, count in edits:
    text = contents.get(path)
    if text is None:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    found = text.count(old)
    if found != count:
        raise SystemExit(
            "ABORTED, nothing written. %s: expected %d match(es), found %d for:\n%s"
            % (path, count, found, old)
        )
    contents[path] = text.replace(old, new)

for path, text in contents.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
with open("src/main/style.js", "w", encoding="utf-8") as f:
    f.write(STYLE_JS)
print("patched %d files and created src/main/style.js. now run: python3 build.py" % len(contents))
