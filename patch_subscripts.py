#!/usr/bin/env python3
"""Subscript syntax (canvas + Typst + LaTeX) and names panel below the diagram.
Run from the repo root (~/fsm) after patch_names_fonts.py.
Aborts without writing anything if any anchor is missing."""

import os
import re

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
      };
    }
    var lower = name.toLowerCase();
    if (text.substr(pos + 1, lower.length) === lower) {
      return {
        raw: "\\" + lower,
        t: String.fromCharCode(945 + offset),
        latex: "\\" + lower + " ",
        len: lower.length + 1,
      };
    }
  }
  return null;
}

function labelAtomAt(text, pos) {
  var g = greekAt(text, pos);
  if (g) return g;
  var ch = text.charAt(pos);
  return { raw: ch, t: ch, latex: ch, len: 1 };
}

// Returns [{sub: bool, raw, t, latex}]: raw = source text, t = display text
// (Greek converted to unicode), latex = LaTeX math text.
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
      last.latex += at.latex;
    } else {
      segs.push({ sub: at.sub, raw: at.raw, t: at.t, latex: at.latex });
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

function labelToLatexMath(text) {
  var segs = labelSegments(text);
  var out = "";
  for (var i = 0; i < segs.length; i++) {
    var body = segs[i].latex.replace(/ /g, "\\mbox{ }");
    if (segs[i].sub) out += (out === "" ? "{}" : "") + "_{" + body + "}";
    else out += body;
  }
  return out;
}
"""

TYPST_FUNCS = r"""// Convert one plain run (no subscripts) of display text into Typst math.
// Multi-letter runs must be quoted in Typst math or they parse as variables.
function typstMathRun(text) {
  var out = [];
  var i = 0;
  while (i < text.length) {
    var ch = text.charAt(i);
    var rest = text.slice(i);
    var m;
    if ((m = /^[A-Za-z]+/.exec(rest))) {
      out.push(m[0].length === 1 ? m[0] : '"' + m[0] + '"');
      i += m[0].length;
      continue;
    }
    if ((m = /^\d+/.exec(rest))) {
      out.push(m[0]);
      i += m[0].length;
      continue;
    }
    if (ch === " ") {
      out.push('" "');
    } else if (ch === ",") {
      out.push(",");
    } else if (ch.charCodeAt(0) > 0x7f) {
      out.push(ch); // unicode symbols (including Greek) are valid in Typst math
    } else {
      out.push('"' + ch.replace(/["\\]/g, "\\$&") + '"');
    }
    i++;
  }
  return out.join(" ");
}

// Subscripts become one _(...) attached to what came before, so they never nest.
function labelToTypstMath(text) {
  var segs = labelSegments(text);
  var out = "";
  for (var i = 0; i < segs.length; i++) {
    var body = typstMathRun(segs[i].t);
    if (segs[i].sub) out += (out === "" ? '""' : "") + "_(" + body + ")";
    else out += (out === "" ? "" : " ") + body;
  }
  return out;
}
"""

# ---------------------------------------------------------------- prechecks
for p in ("src/main/names.js", "src/export_as/typst.js", "src/export_as/latex.js"):
    if not os.path.exists(p):
        raise SystemExit("ABORTED: %s missing. Run the earlier patches first." % p)
if os.path.exists("src/main/label.js"):
    raise SystemExit("ABORTED: src/main/label.js already exists (already patched?)")

# ---------------------------------------------------------------- edits
edits = []  # (kind, path, a, b, expected_count)


def sub(path, old, new, count=1):
    edits.append(("plain", path, old, new, count))


def sub_re(path, pattern, repl):
    edits.append(("re", path, pattern, repl, 1))


# ---- fsm.js: draw real subscripts on the canvas ----
sub(
    "src/main/fsm.js",
    "  var width = c.measureText(text).width;\n",
    "  var segs = labelSegments(originalText);\n"
    '  text = segs.map(function (s) { return s.t; }).join("");\n'
    "  var width = richTextWidth(c, segs, fontSize);\n",
)
sub(
    "src/main/fsm.js",
    "    c.fillText(text, x, y + fontSize * 0.3);\n",
    "    drawRichSegments(c, segs, x, y + fontSize * 0.3, fontSize);\n",
)

# ---- typst.js: replace the label converter ----
sub_re(
    "src/export_as/typst.js",
    r"function labelToTypstMath\(text\) \{.*?\n\}\n\nfunction ExportAsTypst",
    TYPST_FUNCS + "\nfunction ExportAsTypst",
)

# ---- latex.js: same subscript rules ----
sub(
    "src/export_as/latex.js",
    r'''        originalText.replace(/ /g, "\\mbox{ }") +
''',
    "        labelToLatexMath(originalText) +\n",
)

# ---- names.js: panel goes right below the diagram ----
sub(
    "src/main/names.js",
    '  panel.style.cssText = "margin:10px 0;font-size:0.85rem;";\n',
    '  panel.style.cssText =\n'
    '    "margin:10px 0;font-size:0.85rem;width:100%;flex-basis:100%;box-sizing:border-box;";\n',
)
sub(
    "src/main/names.js",
    '''  var anchor = document.getElementById("style-panel");
  if (!anchor) {
    var btn = document.getElementById("btn-typst") || document.getElementById("btn-latex");
    anchor = btn ? btn.parentNode : null;
  }
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
  else canvas.parentNode.appendChild(panel);
''',
    "  // directly below the diagram\n"
    "  canvas.parentNode.insertBefore(panel, canvas.nextSibling);\n",
)

# ---- index.html help ----
sub(
    "www/index.html",
    "<li><b>Rename:</b> click a state or arrow and type, or use the list below the canvas</li>\n",
    "<li><b>Rename:</b> click a state or arrow and type, or use the list below the canvas</li>\n"
    "              <li><b>Subscripts:</b> <code>s_1</code> subscripts one character "
    "(<code>s_1_2</code> chains), <code>s_{12}</code> subscripts a group, or type "
    "<code>\\_</code> to start subscripting and <code>\\_</code> again to stop</li>\n",
)

# ---------------------------------------------------------------- check all, then write
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

for path, text in contents.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
with open("src/main/label.js", "w", encoding="utf-8") as f:
    f.write(LABEL_JS)
print("patched %d files, created label.js. now run: python3 build.py" % len(contents))
