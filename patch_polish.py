#!/usr/bin/env python3
"""LaTeX/Typst export polish, standalone switch, footer, help text, bigger names panel.
Run from the repo root (~/fsm) after patch_subscripts.py.
Aborts without writing anything if a required anchor is missing."""

import os
import re

# ------------------------------------------------------------------ label.js (full rewrite)
LABEL_JS = r"""// Label text parsing shared by the canvas and the exporters.
//   _x       subscript one character:            s_1
//   _a_b     consecutive subscripts join:        s_1_2  =  s_{12}
//   _{...}   subscript a group (or _(...)):      s_{12}
//   \_       toggle subscript mode on/off:       s\_12\_
//   \alpha, \Sigma ... Greek letters (also work inside subscripts)

var SUB_SCALE = 0.7; // subscript font size relative to normal
var SUB_DROP = 0.25; // how far subscripts sit below the baseline (fraction of font size)

function greekAt(text, pos) {
  if (text.charAt(pos) !== "\\") return null;
  for (var i = 0; i < greekLetterNames.length; i++) {
    var name = greekLetterNames[i];
    var offset = i + (i > 16 ? 1 : 0); // skips the final-sigma slot
    if (text.substr(pos + 1, name.length) === name) {
      return {
        raw: "\\" + name,
        t: String.fromCharCode(913 + offset),
        latex: "\\" + name + " ",
        len: name.length + 1,
        greek: true,
      };
    }
    var lower = name.toLowerCase();
    if (text.substr(pos + 1, lower.length) === lower) {
      return {
        raw: "\\" + lower,
        t: String.fromCharCode(945 + offset),
        latex: "\\" + lower + " ",
        len: lower.length + 1,
        greek: true,
      };
    }
  }
  return null;
}

function labelAtomAt(text, pos) {
  var g = greekAt(text, pos);
  if (g) return g;
  var ch = text.charAt(pos);
  var esc = "%&#$".indexOf(ch) >= 0 ? "\\" + ch : ch;
  return { raw: ch, t: ch, latex: esc, len: 1, greek: false };
}

// Returns [{sub: bool, raw, t, atoms}]: raw = source text, t = display text
// (Greek converted to unicode), atoms = the individual characters.
function labelSegments(text) {
  var atoms = [];
  var i = 0;
  var toggled = false;
  var a;
  while (i < text.length) {
    var ch = text.charAt(i);
    if (ch === "\\" && text.charAt(i + 1) === "_") {
      toggled = !toggled;
      i += 2;
      continue;
    }
    if (ch === "_" && i + 1 < text.length) {
      var open = text.charAt(i + 1);
      if (open === "{" || open === "(") {
        var close = open === "{" ? "}" : ")";
        i += 2;
        while (i < text.length && text.charAt(i) !== close) {
          a = labelAtomAt(text, i);
          a.sub = true;
          atoms.push(a);
          i += a.len;
        }
        i += 1; // skip the closing bracket
        continue;
      }
      a = labelAtomAt(text, i + 1);
      a.sub = true;
      atoms.push(a);
      i += 1 + a.len;
      continue;
    }
    // (a trailing lone "_" falls through and shows as a literal underscore while typing)
    a = labelAtomAt(text, i);
    a.sub = toggled;
    atoms.push(a);
    i += a.len;
  }
  var segs = [];
  for (var k = 0; k < atoms.length; k++) {
    var at = atoms[k];
    var last = segs[segs.length - 1];
    if (last && last.sub === at.sub) {
      last.raw += at.raw;
      last.t += at.t;
      last.atoms.push(at);
    } else {
      segs.push({ sub: at.sub, raw: at.raw, t: at.t, atoms: [at] });
    }
  }
  return segs;
}

function richTextWidth(c, segs, fontSize) {
  var w = 0;
  for (var i = 0; i < segs.length; i++) {
    c.font = styleFontCSS(segs[i].sub ? fontSize * SUB_SCALE : fontSize);
    w += c.measureText(segs[i].t).width;
  }
  c.font = styleFontCSS(fontSize);
  return w;
}

function drawRichSegments(c, segs, x, baselineY, fontSize) {
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    c.font = styleFontCSS(s.sub ? fontSize * SUB_SCALE : fontSize);
    c.fillText(s.t, x, baselineY + (s.sub ? fontSize * SUB_DROP : 0));
    x += c.measureText(s.t).width;
  }
  c.font = styleFontCSS(fontSize);
}

// Words (2+ letters) come out upright like the canvas and Typst; single letters stay math italic.
function latexOfAtoms(atoms) {
  var out = "";
  var run = "";
  function flush() {
    out += run.length > 1 ? "\\mathrm{" + run + "}" : run;
    run = "";
  }
  for (var i = 0; i < atoms.length; i++) {
    var a = atoms[i];
    if (!a.greek && /^[A-Za-z]$/.test(a.raw)) {
      run += a.raw;
      continue;
    }
    flush();
    out += a.raw === " " ? "\\mbox{ }" : a.latex;
  }
  flush();
  return out;
}

function labelToLatexMath(text) {
  var segs = labelSegments(text);
  var out = "";
  for (var i = 0; i < segs.length; i++) {
    var body = latexOfAtoms(segs[i].atoms);
    if (segs[i].sub) out += (out === "" ? "{}" : "") + "_{" + body + "}";
    else out += body;
  }
  return out;
}

// TikZ node options: anchor plus a font size matching the Typst export (text px * 0.55 = pt),
// so labels no longer depend on the size of the document they are pasted into.
function latexNodeParams(nodeParams, angleOrNull) {
  var size = angleOrNull == null ? styleStateFontSize : styleLinkFontSize;
  var pt = fixed(size * 0.55, 2);
  var lead = fixed(size * 0.55 * 1.2, 2);
  var anchor = nodeParams.replace(/[\[\]\s]/g, "");
  return (
    "[" + (anchor ? anchor + ", " : "") + "font=\\fontsize{" + pt + "}{" + lead + "}\\selectfont] "
  );
}
"""

EXPORT_OPTIONS_JS = r"""// Export options row (under the export buttons).
var EXPORT_STANDALONE_KEY = "fsm-export-standalone";

// true: full LaTeX document / Typst page cropped to the diagram.
// false: only the drawing code, ready to paste into your own file.
function exportStandalone() {
  var el = document.getElementById("export-standalone");
  return el ? el.checked : true;
}

function wireExportOptionsUI() {
  if (document.getElementById("export-options")) return;
  var row = document.createElement("div");
  row.id = "export-options";
  row.style.cssText = "margin:8px 0;font-size:0.9rem;";
  var label = document.createElement("label");
  label.style.cssText = "display:inline-flex;align-items:center;gap:6px;cursor:pointer;";
  label.title =
    "On: full LaTeX document / Typst page cropped to the diagram. Off: only the drawing code, ready to paste into your own file.";
  var box = document.createElement("input");
  box.type = "checkbox";
  box.id = "export-standalone";
  box.checked = true;
  try {
    var saved = localStorage.getItem(EXPORT_STANDALONE_KEY);
    if (saved !== null) box.checked = saved === "1";
  } catch (e) {}
  box.addEventListener("change", function () {
    try {
      localStorage.setItem(EXPORT_STANDALONE_KEY, box.checked ? "1" : "0");
    } catch (e) {}
  });
  label.appendChild(box);
  label.appendChild(
    document.createTextNode("Standalone export (LaTeX preamble, Typst page cropped to the diagram)"),
  );
  row.appendChild(label);

  var anchorBtn = document.getElementById("btn-typst") || document.getElementById("btn-latex");
  var host = anchorBtn ? anchorBtn.parentNode : null;
  if (host && host.parentNode) host.parentNode.insertBefore(row, host.nextSibling);
  else canvas.parentNode.appendChild(row);
}
"""

TOLATEX_JS = r"""  // json: optional snapshot string, embedded as a comment so the diagram can be restored later.
  // standalone: full document (cropped to the diagram) vs. just the tikzpicture to paste.
  this.toLaTeX = function (json, standalone) {
    var data = json ? "% fsm-data: " + String(json).replace(/[\r\n]+/g, " ") + "\n" : "";
    var picture =
      "\\begin{tikzpicture}[scale=0.2]\n" +
      "\\tikzstyle{every node}+=[inner sep=0pt]\n" +
      this._texData +
      "\\end{tikzpicture}\n";
    if (!standalone) return data + "% needs \\usepackage{tikz}\n" + picture;
    return (
      data +
      "\\documentclass[border=6pt]{standalone}\n" +
      "\\usepackage{tikz}\n" +
      "\n" +
      "\\begin{document}\n" +
      picture +
      "\\end{document}\n"
    );
  };
"""

FOOTER = """    <footer style="text-align:center;font-size:0.85rem;opacity:0.75;padding:16px 8px;line-height:1.6;">
      Original FSM designer &copy; 2010 <a href="https://madebyevan.com/" target="_blank" rel="noopener">Evan Wallace</a>
      &middot; modernized &copy; 2026 <a href="https://github.com/MoeeinAali" target="_blank" rel="noopener">MoeeinAali</a>
      &middot; Typst/LaTeX export, subscripts &amp; style controls &copy; 2026
      <a href="https://github.com/bluelightspirit" target="_blank" rel="noopener">Gary Young</a>
    </footer>
"""

LEFT_OLD = (
    "<li><b>Subscripts:</b> <code>s_1</code> subscripts one character "
    "(<code>s_1_2</code> chains), <code>s_{12}</code> subscripts a group, or type "
    "<code>\\_</code> to start subscripting and <code>\\_</code> again to stop</li>\n"
)
LEFT_SHORT = "<li><b>Subscripts:</b> type <code>s_0</code> (full syntax under the text tips)</li>\n"

CHEAT_LI = (
    "<li><b>Cheat sheets:</b> "
    '<a href="https://wch.github.io/latexsheet/" target="_blank" rel="noopener">LaTeX cheat sheet</a> &middot; '
    '<a href="https://github.com/mewmew/typst-cheat-sheet" target="_blank" rel="noopener">Typst cheat sheet</a> &middot; '
    'official docs: <a href="https://www.latex-project.org/help/documentation/" target="_blank" rel="noopener">LaTeX</a> &middot; '
    '<a href="https://typst.app/docs/guides/for-latex-users/" target="_blank" rel="noopener">Typst for LaTeX users</a></li>'
)
RIGHT_SUBSCRIPT_LI = (
    "<li><b>Subscript:</b> <code>s_1</code> one character (<code>s_1_2</code> chains into one subscript), "
    "<code>s_{12}</code> a group, or <code>\\_</code> to start subscripting and <code>\\_</code> again to stop. "
    "Greek: <code>\\alpha</code>, <code>\\Sigma</code></li>"
)

# ------------------------------------------------------------------ prechecks
for p in ("src/main/label.js", "src/main/names.js", "src/export_as/typst.js", "src/export_as/latex.js"):
    if not os.path.exists(p):
        raise SystemExit("ABORTED: %s missing. Run the earlier patches first." % p)
with open("src/main/label.js", encoding="utf-8") as f:
    if "labelToLatexMath" not in f.read():
        raise SystemExit("ABORTED: label.js isn't the patch_subscripts.py version.")
if os.path.exists("src/main/export_options.js"):
    raise SystemExit("ABORTED: src/main/export_options.js already exists (already patched?)")

# ------------------------------------------------------------------ edits
edits = []  # (kind, path, a, b, expected_count)


def sub(path, old, new, count=1):
    edits.append(("plain", path, old, new, count))


def sub_re(path, pattern, repl):
    edits.append(("re", path, pattern, repl, 1))


L = "src/export_as/latex.js"
# stroke colour + line width in one place, so states and lines can differ
sub(L, "this.strokeStyle", "this._opts()", count=4)
sub(
    L,
    '  this._texData = "";\n',
    '  this._texData = "";\n'
    "  this.lineWidth = 1; // set by drawUsing()\n"
    '  this.strokeStyle = "black";\n'
    "  this._opts = function () {\n"
    '    return this.strokeStyle + ", line width=" + fixed(this.lineWidth, 2) + "pt";\n'
    "  };\n",
)
sub(
    L,
    '((nodeParams = "[below] "), (y -= 10));',
    '((nodeParams = "[below] "), (y -= styleLinkFontSize / 2));',
)
sub(
    L,
    '((nodeParams = "[above] "), (y += 10));',
    '((nodeParams = "[above] "), (y += styleLinkFontSize / 2));',
)
sub(
    L,
    """    c.font = '20px "Times New Romain", serif';\n""",
    "    c.font = styleFontCSS(styleLinkFontSize);\n",
)
sub(L, "        nodeParams +\n", "        latexNodeParams(nodeParams, angleOrNull) +\n")
sub_re(L, r"  this\.toLaTeX = function \(\) \{.*?\n  \};\n", TOLATEX_JS)

T = "src/export_as/typst.js"
sub(T, "  this.toTypst = function (json) {\n", "  this.toTypst = function (json, standalone) {\n")
sub(
    T,
    """      '#import "@preview/cetz:0.4.2"\\n' +\n      "\\n" +\n""",
    """      '#import "@preview/cetz:0.4.2"\\n' +\n"""
    """      (standalone ? "#set page(width: auto, height: auto, margin: 10pt)\\n" : "") +\n"""
    """      "\\n" +\n""",
)

F = "src/main/fsm.js"
sub(F, "  var texData = exporter.toLaTeX();\n", "  var texData = exporter.toLaTeX(snapshotJSON(), exportStandalone());\n")
sub(F, "  var typData = exporter.toTypst(json);\n", "  var typData = exporter.toTypst(json, exportStandalone());\n")

sub(
    "src/main/ui.js",
    '  if (typeof wireNamesUI === "function") wireNamesUI();\n',
    '  if (typeof wireNamesUI === "function") wireNamesUI();\n'
    '  if (typeof wireExportOptionsUI === "function") wireExportOptionsUI();\n',
)

# names panel: bigger text, moderately bigger boxes
N = "src/main/names.js"
sub(N, "font-size:0.85rem;width:100%", "font-size:1rem;width:100%")
sub(N, 'input.style.cssText = "flex:1;min-width:0;";\n', 'input.style.cssText = "flex:1;min-width:0;font-size:1.1rem;padding:4px 8px;";\n')
sub(N, "flex:0 0 96px", "flex:0 0 120px")
sub(N, '"font-weight:600;margin-bottom:4px;"', '"font-weight:600;font-size:1.1rem;margin-bottom:6px;"')

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

# ---- index.html: footer + help text (custom, because I haven't seen the right-hand tips) ----
notes = []
with open("www/index.html", encoding="utf-8") as f:
    html = f.read()
if html.count("</body>") != 1:
    raise SystemExit("ABORTED, nothing written. www/index.html: expected exactly one </body>.")
if html.count(LEFT_OLD) != 1:
    raise SystemExit("ABORTED, nothing written. www/index.html: the Subscripts help line from patch_subscripts.py wasn't found.")
html = html.replace("</body>", FOOTER + "  </body>")
right = re.compile(r"<li>(?:(?!</li>).)*?underscore before a digit(?:(?!</li>).)*?</li>", re.S | re.I)
m = right.search(html)
if m:
    html = html[:m.start()] + RIGHT_SUBSCRIPT_LI + "\n              " + CHEAT_LI + html[m.end():]
    html = html.replace(LEFT_OLD, LEFT_SHORT)
else:
    html = html.replace(LEFT_OLD, LEFT_OLD + "              " + CHEAT_LI + "\n")
    notes.append(
        "NOTE: couldn't find the old right-hand 'underscore before a digit' tip, so it was left alone.\n"
        "      Run: grep -n -i 'underscore' www/index.html   and send me the line."
    )
contents["www/index.html"] = html

# ------------------------------------------------------------------ write
for path, text in contents.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
with open("src/main/label.js", "w", encoding="utf-8") as f:
    f.write(LABEL_JS)
with open("src/main/export_options.js", "w", encoding="utf-8") as f:
    f.write(EXPORT_OPTIONS_JS)
print("patched %d files, rewrote label.js, created export_options.js." % len(contents))
for n in notes:
    print(n)
print("now run: python3 server.py")
