// Global diagram style: one value for every state / arrow / label.
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
