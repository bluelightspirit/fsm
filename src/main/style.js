// Global diagram style: one value for every state / arrow / label.
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
