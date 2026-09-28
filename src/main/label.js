// Label text parsing shared by the canvas and the exporters.
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
