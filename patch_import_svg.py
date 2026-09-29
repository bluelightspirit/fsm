#!/usr/bin/env python3
"""Import from .typ/.tex, SVG exporter fix, help-text and footer cleanup.
Run from the repo root (~/fsm) after patch_polish.py.
Aborts without writing anything if a required anchor is missing."""

import os
import re

# ------------------------------------------------------------------ new files
IMPORT_JS = r"""// Import a diagram from a .typ / .tex export (or pasted text).
// The exporters write the whole diagram as one comment line:
//   // fsm-data: {...}    (Typst)        % fsm-data: {...}    (LaTeX)

function extractFsmData(text) {
  var m = /^[ \t]*(?:\/\/|%)[ \t]*fsm-data:[ \t]*(\{.*\})[ \t]*$/m.exec(text);
  return m ? m[1] : null;
}

function fsmDataProblem(d) {
  if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.links)) {
    return "That data doesn't look like a diagram";
  }
  var n = d.nodes.length;
  function ok(i) {
    return typeof i === "number" && i >= 0 && i < n;
  }
  for (var i = 0; i < d.links.length; i++) {
    var l = d.links[i];
    var fine = l.type === "Link" ? ok(l.nodeA) && ok(l.nodeB) : ok(l.node);
    if (!fine) return "A link points at a state that doesn't exist";
  }
  return null;
}

function importDiagramFromText(text) {
  var json = extractFsmData(text);
  if (!json) {
    showToast("No fsm-data line found. Was this file exported from this tool?", "error");
    return false;
  }
  var data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    showToast("The fsm-data line is damaged (invalid JSON)", "error");
    return false;
  }
  var problem = fsmDataProblem(data);
  if (problem) {
    showToast(problem, "error");
    return false;
  }
  if (
    (nodes.length || links.length) &&
    !confirm("Replace the current diagram with the imported one? (Undo brings it back.)")
  ) {
    return false;
  }
  flushHistory();
  deserializeState(data);
  saveBackup();
  draw();
  commitHistory();
  showToast("Diagram imported");
  return true;
}

function importDiagramFromFile(file) {
  if (!file) return;
  file.text().then(
    function (t) {
      importDiagramFromText(t);
    },
    function () {
      showToast("Could not read that file", "error");
    },
  );
}

function wireImportUI() {
  if (document.getElementById("import-panel")) return;
  var box = document.createElement("details");
  box.id = "import-panel";
  box.style.cssText = "margin:8px 0;font-size:0.9rem;";
  var summary = document.createElement("summary");
  summary.textContent = "Import from .typ / .tex";
  summary.style.cursor = "pointer";
  box.appendChild(summary);

  var hint = document.createElement("div");
  hint.style.cssText = "margin:6px 0;opacity:0.75;";
  hint.textContent =
    "Choose a file this tool exported, drop it on the canvas, or paste its text. The diagram is read from the fsm-data comment line.";
  box.appendChild(hint);

  var file = document.createElement("input");
  file.type = "file";
  file.accept = ".typ,.tex,.txt";
  file.addEventListener("change", function () {
    importDiagramFromFile(file.files[0]);
    file.value = "";
  });
  box.appendChild(file);

  var area = document.createElement("textarea");
  area.rows = 4;
  area.placeholder = "...or paste the .typ / .tex text here";
  area.style.cssText = "display:block;width:100%;box-sizing:border-box;margin:6px 0;font-family:monospace;";
  box.appendChild(area);

  var btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Load pasted text";
  btn.onclick = function () {
    if (importDiagramFromText(area.value)) area.value = "";
  };
  box.appendChild(btn);

  var anchor = document.getElementById("export-options");
  if (!anchor) {
    var b = document.getElementById("btn-typst") || document.getElementById("btn-latex");
    anchor = b ? b.parentNode : null;
  }
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
  else canvas.parentNode.appendChild(box);

  // drop a .typ / .tex file onto the canvas
  canvas.addEventListener("dragover", function (e) {
    e.preventDefault();
  });
  canvas.addEventListener("drop", function (e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) importDiagramFromFile(e.dataTransfer.files[0]);
  });
}
"""

SVG_JS = r"""// draw using this instead of a canvas and call toSVG() afterward
// Honors c.font (size and family), so state labels, line labels and subscripts
// keep the sizes they have on screen.
function ExportAsSVG() {
  this.fillStyle = "black";
  this.strokeStyle = "black";
  this.lineWidth = 1;
  this.font = '20px "Times New Roman", serif';
  this._points = [];
  this._svgData = "";
  this._transX = 0;
  this._transY = 0;

  this.toSVG = function () {
    var w = (typeof canvas !== "undefined" && canvas.width) || 800;
    var h = (typeof canvas !== "undefined" && canvas.height) || 600;
    return (
      '<?xml version="1.0" standalone="no"?>\n' +
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n\n' +
      '<svg width="' + w + '" height="' + h + '" version="1.1" xmlns="http://www.w3.org/2000/svg">\n' +
      this._svgData +
      "</svg>\n"
    );
  };

  this._strokeAttrs = function () {
    return 'stroke="' + this.strokeStyle + '" stroke-width="' + this.lineWidth + '" fill="none"';
  };

  this.beginPath = function () {
    this._points = [];
  };

  this.arc = function (x, y, radius, startAngle, endAngle, isReversed) {
    x += this._transX;
    y += this._transY;
    if (endAngle - startAngle == Math.PI * 2) {
      this._svgData +=
        "\t<ellipse " + this._strokeAttrs() +
        ' cx="' + fixed(x, 3) + '" cy="' + fixed(y, 3) +
        '" rx="' + fixed(radius, 3) + '" ry="' + fixed(radius, 3) + '"/>\n';
      return;
    }
    if (isReversed) {
      var temp = startAngle;
      startAngle = endAngle;
      endAngle = temp;
    }
    if (endAngle < startAngle) {
      endAngle += Math.PI * 2;
    }
    var startX = x + radius * Math.cos(startAngle);
    var startY = y + radius * Math.sin(startAngle);
    var endX = x + radius * Math.cos(endAngle);
    var endY = y + radius * Math.sin(endAngle);
    var large = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
    this._svgData +=
      "\t<path " + this._strokeAttrs() + ' d="' +
      "M " + fixed(startX, 3) + "," + fixed(startY, 3) + " " +
      "A " + fixed(radius, 3) + "," + fixed(radius, 3) + " 0 " + large + " 1 " +
      fixed(endX, 3) + "," + fixed(endY, 3) + '"/>\n';
  };

  this.moveTo = this.lineTo = function (x, y) {
    this._points.push({ x: x + this._transX, y: y + this._transY });
  };

  this.stroke = function () {
    if (this._points.length == 0) return;
    var d = "";
    for (var i = 0; i < this._points.length; i++) {
      d += (i == 0 ? "M" : "L") + " " + fixed(this._points[i].x, 3) + "," + fixed(this._points[i].y, 3) + " ";
    }
    this._svgData += "\t<path " + this._strokeAttrs() + ' d="' + d + '"/>\n';
  };

  this.fill = function () {
    if (this._points.length == 0) return;
    var pts = [];
    for (var i = 0; i < this._points.length; i++) {
      pts.push(fixed(this._points[i].x, 3) + "," + fixed(this._points[i].y, 3));
    }
    this._svgData +=
      '\t<polygon fill="' + this.fillStyle + '" stroke-width="' + this.lineWidth +
      '" points="' + pts.join(" ") + '"/>\n';
  };

  this.measureText = function (text) {
    var c = canvas.getContext("2d");
    c.font = this.font;
    return c.measureText(text);
  };

  this.fillText = function (text, x, y) {
    x += this._transX;
    y += this._transY;
    text = textToXML(text);
    if (text.replace(/ /g, "").length == 0) return;
    var m = /^([\d.]+)px\s+(.*)$/.exec(this.font);
    var size = m ? parseFloat(m[1]) : 20;
    var family = (m ? m[2] : "Times New Roman").replace(/"/g, "'");
    this._svgData +=
      '\t<text x="' + fixed(x, 3) + '" y="' + fixed(y, 3) +
      '" font-family="' + family + '" font-size="' + fixed(size, 2) +
      '" fill="' + this.fillStyle + '">' + text + "</text>\n";
  };

  this.translate = function (x, y) {
    this._transX = x;
    this._transY = y;
  };
  this.save = this.restore = this.clearRect = function () {};
}
"""

# ------------------------------------------------------------------ help + footer text
HELP_LIS = [
    r"<li><b>Subscript:</b> <kbd>s_1</kbd> subscripts one character, <kbd>s_1_2</kbd> chains into one subscript, "
    r"<kbd>s_{12}</kbd> subscripts a group, <kbd>\_</kbd> starts subscripting and <kbd>\_</kbd> again stops</li>",
    r"<li><b>Greek letters:</b> <kbd>\alpha</kbd>, <kbd>\Sigma</kbd>, ... (also inside subscripts, e.g. <kbd>s_\alpha</kbd>)</li>",
    r'<li><b>Cheat sheets:</b> <a href="https://wch.github.io/latexsheet/" target="_blank" rel="noopener">LaTeX</a> &middot; '
    r'<a href="https://github.com/mewmew/typst-cheat-sheet" target="_blank" rel="noopener">Typst</a></li>',
    r'<li><b>Official docs:</b> <a href="https://www.latex-project.org/help/documentation/" target="_blank" rel="noopener">LaTeX</a> &middot; '
    r'<a href="https://typst.app/docs/guides/for-latex-users/" target="_blank" rel="noopener">Typst for LaTeX users</a></li>',
]
GARY = ' and <a href="https://github.com/bluelightspirit" target="_blank" rel="noopener">Gary Young</a> in 2026'

# ------------------------------------------------------------------ prechecks
for p in ("src/main/export_options.js", "src/main/ui.js", "src/export_as/svg.js", "www/index.html"):
    if not os.path.exists(p):
        raise SystemExit("ABORTED: %s missing. Run the earlier patches first." % p)
with open("src/export_as/svg.js", encoding="utf-8") as f:
    if "function ExportAsSVG" not in f.read():
        raise SystemExit("ABORTED: src/export_as/svg.js doesn't define ExportAsSVG as expected. Send me: cat src/export_as/svg.js")
if os.path.exists("src/main/import_ui.js"):
    raise SystemExit("ABORTED: src/main/import_ui.js already exists (already patched?)")

with open("src/main/ui.js", encoding="utf-8") as f:
    ui = f.read()
hook = '  if (typeof wireExportOptionsUI === "function") wireExportOptionsUI();\n'
if ui.count(hook) != 1:
    raise SystemExit("ABORTED: the wireExportOptionsUI line in src/main/ui.js wasn't found exactly once.")
ui = ui.replace(hook, hook + '  if (typeof wireImportUI === "function") wireImportUI();\n')

# ------------------------------------------------------------------ index.html
with open("www/index.html", encoding="utf-8") as f:
    html = f.read()
notes = []

# 1) drop the duplicate footer I added; extend the page's own credit line instead
mine = re.compile(r"[ \t]*<footer\b(?:(?!</footer>).)*?Original FSM designer(?:(?!</footer>).)*?</footer>[ \t]*\n?", re.S)
html, removed = mine.subn("", html)
if "Gary Young" in html:
    notes.append("The credit line already mentions Gary Young; left alone.")
else:
    done = False
    for pat in (
        re.compile(r"(maintained\s+by\s*<a\b[^>]*MoeeinAali[^>]*>.*?</a>)", re.S | re.I),
        re.compile(r"(<a\b[^>]*github\.com/MoeeinAali[^>]*>.*?</a>)", re.S | re.I),
    ):
        html, n = pat.subn(lambda m: m.group(1) + GARY, html, count=1)
        if n:
            done = True
            break
    if not done:
        notes.append("Couldn't find the 'Improved & maintained by ...' credit line. Run: grep -n -i maintained www/index.html")

# 2) help text: one Subscript entry (right side only), Greek separate, two link bullets
cheat = re.compile(r"[ \t]*<li>(?:(?!</li>).)*?Cheat sheets(?:(?!</li>).)*?</li>[ \t]*\n?", re.S | re.I)
html, _ = cheat.subn("", html)
subpat = re.compile(
    r"[ \t]*<li>(?:(?!</li>).)*?(?:ubscript|underscore before a digit)(?:(?!</li>).)*?</li>[ \t]*\n?", re.S | re.I
)
ms = list(subpat.finditer(html))
if ms:
    last = ms[-1]
    indent = re.match(r"[ \t]*", last.group(0)).group(0)
    block = "".join(indent + line + "\n" for line in HELP_LIS)
    for m in reversed(ms):
        gone = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(0))).strip()
        notes.append("removed help entry: " + gone[:110])
        html = html[: m.start()] + (block if m is last else "") + html[m.end():]
else:
    notes.append("Found no Subscript help entries, so the help text was not changed. Run: grep -n -i 'subscript\\|underscore' www/index.html")

# ------------------------------------------------------------------ write
with open("src/main/ui.js", "w", encoding="utf-8") as f:
    f.write(ui)
with open("www/index.html", "w", encoding="utf-8") as f:
    f.write(html)
with open("src/main/import_ui.js", "w", encoding="utf-8") as f:
    f.write(IMPORT_JS)
with open("src/export_as/svg.js", "w", encoding="utf-8") as f:
    f.write(SVG_JS)
print("done: created import_ui.js, rewrote svg.js, updated ui.js and index.html.")
for n in notes:
    print("  - " + n)
print("check the HTML changes with: git diff www/index.html")
print("then run: python3 server.py")
