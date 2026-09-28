#!/usr/bin/env python3
"""Second style patch + names panel. Run from the repo root (~/fsm) AFTER patch_style.py.
Aborts without writing anything if any anchor is missing."""

import os
import re

# ---------------------------------------------------------------- new files
STYLE_JS = r"""// Global diagram style: one value for every state / arrow / label.
// nodeRadius (defined in fsm.js) is reused for the state radius.
var styleStateFontSize = 20; // state names
var styleLinkFontSize = 20; // arrow labels
var styleStateLineWidth = 1; // state outlines
var styleLineWidth = 1; // arrows / lines
var styleArrowSize = 8;
var styleFontName = "Times New Roman";

// [name shown in the menu (also the Typst font name), canvas CSS font stack]
var STYLE_FONTS = [
  ["Times New Roman", '"Times New Roman", Times, serif'],
  ["New Computer Modern", '"CMU Serif", "Latin Modern Roman", "Times New Roman", serif'],
  ["Arial", "Arial, Helvetica, sans-serif"],
  ["Helvetica", "Helvetica, Arial, sans-serif"],
  ["Georgia", "Georgia, serif"],
  ["Palatino Linotype", '"Palatino Linotype", Palatino, "Book Antiqua", serif'],
  ["Cambria", "Cambria, serif"],
  ["Verdana", "Verdana, Geneva, sans-serif"],
  ["Calibri", "Calibri, Carlito, sans-serif"],
  ["Trebuchet MS", '"Trebuchet MS", sans-serif'],
  ["Courier New", '"Courier New", Courier, monospace'],
];

var STYLE_DEFAULTS = {
  stateFontSize: 20,
  linkFontSize: 20,
  nodeRadius: 30,
  stateLineWidth: 1,
  lineWidth: 1,
  arrowSize: 8,
  fontName: "Times New Roman",
};

// [key, label, min, max, step]
var STYLE_FIELDS = [
  ["stateFontSize", "State text", 8, 72, 1],
  ["linkFontSize", "Line text", 8, 72, 1],
  ["nodeRadius", "State radius", 12, 120, 1],
  ["stateLineWidth", "State outline", 0.5, 8, 0.5],
  ["lineWidth", "Line width", 0.5, 8, 0.5],
  ["arrowSize", "Arrowhead", 4, 40, 1],
];

function styleFontKnown(name) {
  for (var i = 0; i < STYLE_FONTS.length; i++) {
    if (STYLE_FONTS[i][0] === name) return true;
  }
  return false;
}

function styleFontStack(name) {
  for (var i = 0; i < STYLE_FONTS.length; i++) {
    if (STYLE_FONTS[i][0] === name) return STYLE_FONTS[i][1];
  }
  return STYLE_FONTS[0][1];
}

function styleFontCSS(size) {
  return size + "px " + styleFontStack(styleFontName);
}

function getStyle() {
  return {
    stateFontSize: styleStateFontSize,
    linkFontSize: styleLinkFontSize,
    nodeRadius: nodeRadius,
    stateLineWidth: styleStateLineWidth,
    lineWidth: styleLineWidth,
    arrowSize: styleArrowSize,
    fontName: styleFontName,
  };
}

// partial=true keeps the current value for any missing/blank field (used while typing);
// otherwise missing fields fall back to the defaults (used when loading a diagram).
function applyStyle(s, partial) {
  var src = {};
  for (var k in s || {}) src[k] = s[k];
  // older saves had a single text size and a single line width
  if (src.fontSize !== undefined) {
    if (src.stateFontSize === undefined) src.stateFontSize = src.fontSize;
    if (src.linkFontSize === undefined) src.linkFontSize = src.fontSize;
  }
  if (src.stateLineWidth === undefined && src.lineWidth !== undefined) {
    src.stateLineWidth = src.lineWidth;
  }
  var base = partial ? getStyle() : STYLE_DEFAULTS;
  var out = {};
  for (var i = 0; i < STYLE_FIELDS.length; i++) {
    var f = STYLE_FIELDS[i];
    var v = parseFloat(src[f[0]]);
    out[f[0]] = isNaN(v) ? base[f[0]] : Math.min(f[3], Math.max(f[2], v));
  }
  out.fontName = styleFontKnown(src.fontName) ? src.fontName : base.fontName;
  styleStateFontSize = out.stateFontSize;
  styleLinkFontSize = out.linkFontSize;
  nodeRadius = out.nodeRadius;
  styleStateLineWidth = out.stateLineWidth;
  styleLineWidth = out.lineWidth;
  styleArrowSize = out.arrowSize;
  styleFontName = out.fontName;
}

function syncStyleInputs() {
  var s = getStyle();
  for (var i = 0; i < STYLE_FIELDS.length; i++) {
    var el = document.getElementById("style-" + STYLE_FIELDS[i][0]);
    if (el) el.value = s[STYLE_FIELDS[i][0]];
  }
  var sel = document.getElementById("style-fontName");
  if (sel) sel.value = s.fontName;
}

function readStyleInputs() {
  var s = {};
  for (var i = 0; i < STYLE_FIELDS.length; i++) {
    var el = document.getElementById("style-" + STYLE_FIELDS[i][0]);
    if (el) s[STYLE_FIELDS[i][0]] = el.value;
  }
  var sel = document.getElementById("style-fontName");
  if (sel) s.fontName = sel.value;
  return s;
}

function wireStyleUI() {
  if (document.getElementById("style-panel")) return;
  var panel = document.createElement("div");
  panel.id = "style-panel";
  panel.style.cssText =
    "display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0;font-size:0.85rem;";

  function onLive() {
    applyStyle(readStyleInputs(), true);
    draw();
  }
  function onCommit() {
    applyStyle(readStyleInputs(), true);
    syncStyleInputs(); // show the clamped values
    draw();
    commitHistory();
  }

  var fontLabel = document.createElement("label");
  fontLabel.style.cssText = "display:flex;align-items:center;gap:4px;";
  fontLabel.appendChild(document.createTextNode("Font"));
  var select = document.createElement("select");
  select.id = "style-fontName";
  STYLE_FONTS.forEach(function (f) {
    var opt = document.createElement("option");
    opt.value = f[0];
    opt.textContent = f[0];
    select.appendChild(opt);
  });
  select.addEventListener("change", onCommit);
  fontLabel.appendChild(select);
  panel.appendChild(fontLabel);

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
    input.addEventListener("input", onLive);
    input.addEventListener("change", onCommit);
    label.appendChild(input);
    panel.appendChild(label);
  });

  var reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset style";
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

NAMES_JS = r"""// Side list for renaming states and arrows by typing.
var __namesRows = [];

function nameOfNode(n) {
  var i = nodes.indexOf(n);
  if (i < 0) return "?";
  return nodes[i].text ? nodes[i].text : "#" + (i + 1);
}

function describeObject(o) {
  if (o instanceof SelfLink) return nameOfNode(o.node) + " \u21BA";
  if (o instanceof StartLink) return "start \u2192 " + nameOfNode(o.node);
  if (o instanceof Link) return nameOfNode(o.nodeA) + " \u2192 " + nameOfNode(o.nodeB);
  return "State " + (nodes.indexOf(o) + 1);
}

function buildNamesRow(obj) {
  var row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:6px;padding:2px 4px;border-radius:6px;";
  var desc = document.createElement("span");
  desc.style.cssText =
    "flex:0 0 96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.7;";
  var input = document.createElement("input");
  input.type = "text";
  input.placeholder = links.indexOf(obj) >= 0 ? "arrow label" : "state name";
  input.style.cssText = "flex:1;min-width:0;";
  input.addEventListener("focus", function () {
    selectedObject = obj;
    draw();
  });
  input.addEventListener("input", function () {
    obj.text = input.value;
    draw();
    commitHistoryDebounced();
  });
  var del = document.createElement("button");
  del.type = "button";
  del.textContent = "\u2715";
  del.title = "Delete";
  del.addEventListener("click", function () {
    selectedObject = obj;
    deleteSelected();
  });
  row.appendChild(desc);
  row.appendChild(input);
  row.appendChild(del);
  return { obj: obj, row: row, desc: desc, input: input };
}

// Called from draw(). Rebuilds the rows only when the set of objects changes,
// otherwise just syncs text, so typing in a box is never interrupted.
function refreshNamesPanel() {
  var list = document.getElementById("names-list");
  if (!list) return;
  var objs = nodes.concat(links);
  var same = objs.length === __namesRows.length;
  for (var i = 0; same && i < objs.length; i++) {
    if (__namesRows[i].obj !== objs[i]) same = false;
  }
  if (!same) {
    list.innerHTML = "";
    __namesRows = objs.map(buildNamesRow);
    if (__namesRows.length === 0) {
      var empty = document.createElement("div");
      empty.style.opacity = "0.6";
      empty.textContent = "No states yet. Double-click the canvas to add one.";
      list.appendChild(empty);
    }
    __namesRows.forEach(function (r) {
      list.appendChild(r.row);
    });
  }
  for (var j = 0; j < __namesRows.length; j++) {
    var r = __namesRows[j];
    var d = describeObject(r.obj);
    if (r.desc.textContent !== d) r.desc.textContent = d;
    if (document.activeElement !== r.input && r.input.value !== r.obj.text) {
      r.input.value = r.obj.text;
    }
    r.row.style.background = r.obj === selectedObject ? "rgba(99,102,241,0.18)" : "transparent";
  }
}

function wireNamesUI() {
  if (document.getElementById("names-panel")) return;
  var panel = document.createElement("div");
  panel.id = "names-panel";
  panel.style.cssText = "margin:10px 0;font-size:0.85rem;";
  var title = document.createElement("div");
  title.textContent = "States & arrows (type to rename)";
  title.style.cssText = "font-weight:600;margin-bottom:4px;";
  var list = document.createElement("div");
  list.id = "names-list";
  list.style.cssText = "max-height:220px;overflow:auto;";
  panel.appendChild(title);
  panel.appendChild(list);

  var anchor = document.getElementById("style-panel");
  if (!anchor) {
    var btn = document.getElementById("btn-typst") || document.getElementById("btn-latex");
    anchor = btn ? btn.parentNode : null;
  }
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
  else canvas.parentNode.appendChild(panel);
  refreshNamesPanel();
}
"""

# ---------------------------------------------------------------- prechecks
if os.path.exists("src/main/names.js"):
    raise SystemExit("ABORTED: src/main/names.js already exists (already patched?)")
if not os.path.exists("src/main/style.js"):
    raise SystemExit("ABORTED: src/main/style.js missing. Run patch_style.py first.")
with open("src/main/style.js", encoding="utf-8") as f:
    if "styleFontSize" not in f.read():
        raise SystemExit("ABORTED: src/main/style.js isn't the patch_style.py version.")
with open("src/elements/node.js", encoding="utf-8") as f:
    node_src = f.read()
if not re.search(r"drawText\(\s*c,\s*this\.text,\s*this\.x,\s*this\.y,\s*null", node_src):
    raise SystemExit(
        "ABORTED: node.js doesn't call drawText(c, this.text, this.x, this.y, null, ...) as I assumed.\n"
        "State labels are told apart from line labels by that null angle. Send me: cat src/elements/node.js"
    )

# ---------------------------------------------------------------- edits
edits = []  # (path, old, new, expected_count)


def sub(path, old, new, count=1):
    edits.append((path, old, new, count))


# ---- fsm.js ----
F = "src/main/fsm.js"
sub(
    F,
    """  c.font = styleFontSize + 'px "Times New Roman", serif';\n""",
    "  // state labels are drawn without an angle, line labels with one\n"
    "  var fontSize = angleOrNull == null ? styleStateFontSize : styleLinkFontSize;\n"
    "  c.font = styleFontCSS(fontSize);\n",
)
sub(
    F,
    "    var cornerPointY = (styleFontSize / 2 + 5) * (sin > 0 ? 1 : -1);\n",
    "    var cornerPointY = (fontSize / 2 + 5) * (sin > 0 ? 1 : -1);\n",
)
sub(
    F,
    "    c.fillText(text, x, y + styleFontSize * 0.3);\n",
    "    c.fillText(text, x, y + fontSize * 0.3);\n",
)
sub(
    F,
    "      c.moveTo(x, y - styleFontSize / 2);\n      c.lineTo(x, y + styleFontSize / 2);\n",
    "      c.moveTo(x, y - fontSize / 2);\n      c.lineTo(x, y + fontSize / 2);\n",
)
sub(
    F,
    "  for (var i = 0; i < nodes.length; i++) {\n    c.lineWidth = styleLineWidth;\n",
    "  for (var i = 0; i < nodes.length; i++) {\n    c.lineWidth = styleStateLineWidth;\n",
)
sub(
    F,
    'function draw() {\n  drawUsing(canvas.getContext("2d"));\n  saveBackup();\n}',
    'function draw() {\n  drawUsing(canvas.getContext("2d"));\n  saveBackup();\n'
    '  if (typeof refreshNamesPanel === "function") refreshNamesPanel();\n}',
)

# ---- typst.js ----
T = "src/export_as/typst.js"
sub(
    T,
    r'''      "#align(center, text(size: " +
      fixed(styleFontSize * 0.55, 2) +
      "pt, cetz.canvas({\n" +
      "  import cetz.draw: *\n" +
      "  set-style(stroke: (thickness: " +
      fixed(this.lineWidth, 2) +
      "pt))\n" +
      this._data +
      "})))\n"
''',
    r'''      "#align(center, cetz.canvas({\n" +
      "  import cetz.draw: *\n" +
      this._data +
      "}))\n"
''',
)
sub(
    T,
    r'''        fixed(radius, 3) +
        ")\n";
      return;
''',
    r'''        fixed(radius, 3) +
        ", stroke: " +
        fixed(this.lineWidth, 2) +
        "pt)\n";
      return;
''',
)
sub(
    T,
    r'''      "deg, radius: " +
      fixed(radius, 3) +
      ")\n";
''',
    r'''      "deg, radius: " +
      fixed(radius, 3) +
      ", stroke: " +
      fixed(this.lineWidth, 2) +
      "pt)\n";
''',
)
sub(
    T,
    r'''    this._data += "  line(" + this._pointList() + ")\n";
''',
    r'''    this._data +=
      "  line(" +
      this._pointList() +
      ", stroke: " +
      fixed(this.lineWidth, 2) +
      "pt)\n";
''',
)
sub(
    T,
    r'''      ", $" +
      labelToTypstMath(originalText) +
      '$, anchor: "' +
      anchor +
      '")\n';
''',
    r'''      ", text(font: " +
      JSON.stringify(styleFontName) +
      ", size: " +
      fixed((angleOrNull == null ? styleStateFontSize : styleLinkFontSize) * 0.55, 2) +
      "pt, $" +
      labelToTypstMath(originalText) +
      '$), anchor: "' +
      anchor +
      '")\n';
''',
)
sub(
    T,
    """    c.font = styleFontSize + 'px "Times New Roman", serif';\n""",
    "    c.font = styleFontCSS(styleLinkFontSize);\n",
)
sub(T, "          y -= styleFontSize / 2;\n", "          y -= styleLinkFontSize / 2;\n")
sub(T, "          y += styleFontSize / 2;\n", "          y += styleLinkFontSize / 2;\n")

# ---- ui.js ----
sub(
    "src/main/ui.js",
    '  if (typeof wireStyleUI === "function") wireStyleUI();\n',
    '  if (typeof wireStyleUI === "function") wireStyleUI();\n'
    '  if (typeof wireNamesUI === "function") wireNamesUI();\n',
)

# ---- index.html help list ----
sub(
    "www/index.html",
    "<li><b>Move something:</b> drag it around</li>\n",
    "<li><b>Move something:</b> drag it around</li>\n"
    "              <li><b>Move an arrow's label:</b> select the arrow, then alt-drag (alt-double-click resets it)</li>\n"
    "              <li><b>Rename:</b> click a state or arrow and type, or use the list below the canvas</li>\n",
)

# ---------------------------------------------------------------- check all, then write
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
with open("src/main/names.js", "w", encoding="utf-8") as f:
    f.write(NAMES_JS)
print("patched %d files, rewrote style.js, created names.js. now run: python3 build.py" % len(contents))
