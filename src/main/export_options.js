// Export options row (under the export buttons).
var EXPORT_STANDALONE_KEY = "fsm-export-standalone";
var EXPORT_LAYOUT_KEY = "fsm-export-layout";
var EXPORT_COPY_KEY = "fsm-export-copy";
var EXPORT_DOWNLOAD_KEY = "fsm-export-download";
var EXPORT_FLOW_TEXT_KEY = "fsm-export-flow-text";
var EXPORT_FLOW_BEFORE_TEXT_KEY = "fsm-export-before-text";
var EXPORT_DIAGRAM_GAP_KEY = "fsm-export-diagram-gap-inches";
var exportLayoutMode = "paged";
var exportPpi = 300;
var exportFlowText = "";
var exportFlowBeforeText = "";
var exportDiagramGap = 0.25;
function selectedExportPpi() { return exportPpi; }

function exportPaged() { return exportLayoutMode === "paged"; }
function exportFollowingText() { var el = document.getElementById("export-flow-text"); return el ? el.value : exportFlowText; }
function exportBeforeText() { var el = document.getElementById("export-flow-before-text"); return el ? el.value : exportFlowBeforeText; }
// Entering continuation text opts LaTeX and Typst into flowing layout directly,
// so users do not have to find or change the layout selector first.
function exportFlow() { return exportLayoutMode === "flow" || !!String(exportFollowingText() || "").trim() || !!String(exportBeforeText() || "").trim(); }
function exportDiagramGapInches() { return exportDiagramGap; }
function exportCopyEnabled() { var el = document.getElementById("export-copy"); return el ? el.checked : true; }
function exportDownloadEnabled() { var el = document.getElementById("export-download"); return el ? el.checked : true; }

// true: full page-sized LaTeX document / Typst document.
// false: only the drawing code, ready to paste into your own file.
function exportStandalone() {
  var el = document.getElementById("export-standalone");
  return el ? el.checked : true;
}

function wireExportOptionsUI() {
  if (document.getElementById("export-options")) return;
  var row = document.createElement("div");
  row.id = "export-options";
  row.style.cssText = "margin:8px 0;font-size:0.9rem;display:flex;flex-direction:column;gap:8px;";
  var checksRow = document.createElement("div");
  checksRow.style.cssText = "display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;";
  var settingsRow = document.createElement("div");
  settingsRow.style.cssText = "display:flex;align-items:center;flex-wrap:wrap;gap:8px 18px;";
  var marginLabel = document.createElement("label");
  marginLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin-right:14px;";
  marginLabel.title = "Keep states inside the left and right margins. States and arrows may cross margins or page seams, but each page preview/export clips their visible parts to its printable area.";
  var marginBox = document.createElement("input");
  marginBox.type = "checkbox";
  marginBox.id = "page-constrain-margins";
  marginBox.checked = constrainToMargins;
  marginBox.addEventListener("change", function () { setConstrainToMargins(marginBox.checked, true); commitHistory(); });
  marginLabel.appendChild(marginBox);
  marginLabel.appendChild(document.createTextNode("Clip diagram to printable areas"));
  checksRow.appendChild(marginLabel);

  var curveLabel = document.createElement("label");
  curveLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin-right:14px;";
  curveLabel.title = "Show the two draggable control dots for each page segment of a curved arrow. This only changes the editor view.";
  var curveBox = document.createElement("input");
  curveBox.type = "checkbox";
  curveBox.id = "show-curve-handles";
  try { var showSaved = localStorage.getItem("fsm-show-curve-handles-v2"); showCurveHandles = showSaved === null || showSaved === "1"; } catch (e) { showCurveHandles = true; }
  curveBox.checked = showCurveHandles;
  curveBox.addEventListener("change", function () {
    showCurveHandles = curveBox.checked;
    try { localStorage.setItem("fsm-show-curve-handles-v2", showCurveHandles ? "1" : "0"); } catch (e) {}
    if (typeof draw === "function") draw();
  });
  curveLabel.appendChild(curveBox);
  curveLabel.appendChild(document.createTextNode("Show curve handles"));
  checksRow.appendChild(curveLabel);

  var exportCurveLabel = document.createElement("label");
  exportCurveLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;cursor:pointer;";
  exportCurveLabel.title = "Add the curve control dots to PNG, SVG, LaTeX, and Typst exports for inspection.";
  var exportCurveBox = document.createElement("input");
  exportCurveBox.type = "checkbox";
  exportCurveBox.id = "export-curve-handles";
  try { includeCurveHandlesInExports = localStorage.getItem("fsm-export-curve-handles") === "1"; } catch (e) { includeCurveHandlesInExports = false; }
  exportCurveBox.checked = includeCurveHandlesInExports;
  exportCurveBox.addEventListener("change", function () {
    includeCurveHandlesInExports = exportCurveBox.checked;
    try { localStorage.setItem("fsm-export-curve-handles", includeCurveHandlesInExports ? "1" : "0"); } catch (e) {}
    if (typeof draw === "function") draw();
  });
  exportCurveLabel.appendChild(exportCurveBox);
  exportCurveLabel.appendChild(document.createTextNode("Include curve handles in exports"));
  checksRow.appendChild(exportCurveLabel);

  [["export-copy", EXPORT_COPY_KEY, "Copy export", "Copy source text for SVG, LaTeX, and Typst; copy PNG as an image. For paged PNG/SVG, copy the first page."],
    ["export-download", EXPORT_DOWNLOAD_KEY, "Download export", "Download the selected format. Paged PNG and SVG create one file per page."]].forEach(function (item) {
    var actionLabel = document.createElement("label");
    actionLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;cursor:pointer;";
    var actionBox = document.createElement("input");
    actionBox.type = "checkbox";
    actionBox.id = item[0];
    actionBox.title = item[3];
    try { var savedAction = localStorage.getItem(item[1]); actionBox.checked = savedAction === null || savedAction === "1"; }
    catch (e) { actionBox.checked = true; }
    actionBox.addEventListener("change", function () {
      try { localStorage.setItem(item[1], actionBox.checked ? "1" : "0"); } catch (e) {}
    });
    actionLabel.appendChild(actionBox);
    actionLabel.appendChild(document.createTextNode(item[2]));
    checksRow.appendChild(actionLabel);
  });
  var label = document.createElement("label");
  label.style.cssText = "display:inline-flex;align-items:center;gap:6px;cursor:pointer;";
  label.title = exportFlow()
    ? "Checked: export a complete LaTeX or Typst document. Unchecked: export source to insert into an existing document."
    : "Controls whether LaTeX includes its document preamble.";
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
  var standaloneCaption = document.createTextNode(exportFlow() ? "Full document (LaTeX / Typst)" : "Standalone LaTeX document");
  label.appendChild(standaloneCaption);
  checksRow.appendChild(label);

  var layoutLabel = document.createElement("label");
  layoutLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
  layoutLabel.appendChild(document.createTextNode("Export layout"));
  var layout = document.createElement("select");
  layout.id = "export-layout";
  [["paged", "Paper pages (page size and selected margins)"], ["full", "Full diagram (one uncropped tall export)"], ["flow", "Fit to content (FSM + text)"]].forEach(function (item) {
    var option = document.createElement("option"); option.value = item[0]; option.textContent = item[1]; layout.appendChild(option);
  });
  try { exportLayoutMode = localStorage.getItem(EXPORT_LAYOUT_KEY) || "paged"; } catch (e) { exportLayoutMode = "paged"; }
  if (["full", "flow"].indexOf(exportLayoutMode) < 0) exportLayoutMode = "paged";
  layout.value = exportLayoutMode;
  standaloneCaption.nodeValue = exportFlow() ? "Full document (LaTeX / Typst)" : "Standalone LaTeX document";
  label.title = exportFlow()
    ? "Checked: export a complete LaTeX or Typst document. Unchecked: export source to insert into an existing document."
    : "Controls whether LaTeX includes its document preamble.";
  layout.addEventListener("change", function () {
    exportLayoutMode = layout.value;
    try { localStorage.setItem(EXPORT_LAYOUT_KEY, exportLayoutMode); } catch (e) {}
    flowTextLabel.hidden = false;
    standaloneCaption.nodeValue = exportFlow() ? "Full document (LaTeX / Typst)" : "Standalone LaTeX document";
    label.title = exportFlow()
      ? "Checked: export a complete LaTeX or Typst document. Unchecked: export source to insert into an existing document."
      : "Controls whether LaTeX includes its document preamble.";
  });
  layoutLabel.appendChild(layout);
  settingsRow.appendChild(layoutLabel);

  var beforeTextLabel = document.createElement("label");
  beforeTextLabel.style.cssText = "display:flex;flex-direction:column;gap:4px;width:100%;max-width:760px;";
  beforeTextLabel.appendChild(document.createTextNode("Text before the FSM (optional; plain text, blank lines start paragraphs)"));
  var beforeText = document.createElement("textarea");
  beforeText.id = "export-flow-before-text";
  beforeText.rows = 3;
  beforeText.placeholder = "For example: We now examine the machine below.";
  beforeText.style.cssText = "width:100%;resize:vertical;";
  try { exportFlowBeforeText = localStorage.getItem(EXPORT_FLOW_BEFORE_TEXT_KEY) || ""; } catch (e) { exportFlowBeforeText = ""; }
  beforeText.value = exportFlowBeforeText;
  beforeTextLabel.appendChild(beforeText);
  row.appendChild(beforeTextLabel);

  var flowTextLabel = document.createElement("label");
  flowTextLabel.id = "export-flow-text-label";
  flowTextLabel.style.cssText = "display:flex;flex-direction:column;gap:4px;width:100%;max-width:760px;";
  flowTextLabel.appendChild(document.createTextNode("Text after the FSM (optional; plain text, blank lines start paragraphs)"));
  var flowText = document.createElement("textarea");
  flowText.id = "export-flow-text";
  flowText.rows = 4;
  flowText.placeholder = "For example: This machine accepts strings whose final three symbols are abb.";
  flowText.style.cssText = "width:100%;resize:vertical;";
  try { exportFlowText = localStorage.getItem(EXPORT_FLOW_TEXT_KEY) || ""; } catch (e) { exportFlowText = ""; }
  flowText.value = exportFlowText;
  if (exportFlowText.trim() || exportFlowBeforeText.trim()) {
    exportLayoutMode = "flow";
    layout.value = "flow";
    standaloneCaption.nodeValue = "Full document (LaTeX / Typst)";
    label.title = "Checked: export a complete LaTeX or Typst document. Unchecked: export a source snippet for an existing document.";
    try { localStorage.setItem(EXPORT_LAYOUT_KEY, "flow"); } catch (e) {}
  }
  beforeText.addEventListener("input", function () {
    exportFlowBeforeText = beforeText.value;
    try { localStorage.setItem(EXPORT_FLOW_BEFORE_TEXT_KEY, exportFlowBeforeText); } catch (e) {}
    if (exportFlowBeforeText.trim()) {
      exportLayoutMode = "flow";
      layout.value = "flow";
      standaloneCaption.nodeValue = "Full document (LaTeX / Typst)";
      label.title = "Checked: export a complete LaTeX or Typst document. Unchecked: export a source snippet for an existing document.";
      try { localStorage.setItem(EXPORT_LAYOUT_KEY, "flow"); } catch (e) {}
    }
  });
  flowText.addEventListener("input", function () {
    exportFlowText = flowText.value;
    try { localStorage.setItem(EXPORT_FLOW_TEXT_KEY, exportFlowText); } catch (e) {}
    if (exportFlowText.trim()) {
      exportLayoutMode = "flow";
      layout.value = "flow";
      standaloneCaption.nodeValue = "Full document (LaTeX / Typst)";
      label.title = "Checked: export a complete LaTeX or Typst document. Unchecked: export a source snippet for an existing document.";
      try { localStorage.setItem(EXPORT_LAYOUT_KEY, "flow"); } catch (e) {}
    }
  });
  flowTextLabel.appendChild(flowText);
  flowTextLabel.hidden = false;
  row.appendChild(flowTextLabel);

  var gapLabel = document.createElement("label");
  gapLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
  gapLabel.appendChild(document.createTextNode("Gap between FSM and adjacent text (inches; bottom padding if both text boxes are blank)"));
  var gapInput = document.createElement("input");
  gapInput.id = "export-diagram-gap";
  gapInput.type = "number";
  gapInput.min = "0";
  gapInput.max = "4";
  gapInput.step = "0.05";
  try {
    var savedGap = localStorage.getItem(EXPORT_DIAGRAM_GAP_KEY);
    exportDiagramGap = savedGap === null ? 0.25 : Math.max(0, Math.min(4, Number(savedGap) || 0));
  } catch (e) { exportDiagramGap = 0.25; }
  gapInput.value = String(exportDiagramGap);
  gapInput.style.width = "5.5em";
  gapInput.addEventListener("input", function () {
    var value = Number(gapInput.value);
    if (!isFinite(value)) return;
    exportDiagramGap = Math.max(0, Math.min(4, value));
    try { localStorage.setItem(EXPORT_DIAGRAM_GAP_KEY, String(exportDiagramGap)); } catch (e) {}
  });
  gapLabel.appendChild(gapInput);
  row.appendChild(gapLabel);

  var ppiLabel = document.createElement("label");
  ppiLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
  ppiLabel.appendChild(document.createTextNode("PNG resolution"));
  var ppi = document.createElement("select");
  ppi.id = "export-ppi";
  [[96, "96 PPI (screen)"], [144, "144 PPI"], [300, "300 PPI (print)"], [600, "600 PPI"]].forEach(function (item) {
    var option = document.createElement("option"); option.value = item[0]; option.textContent = item[1]; ppi.appendChild(option);
  });
  try { exportPpi = Number(localStorage.getItem("fsm-export-ppi")) || 300; } catch (e) { exportPpi = 300; }
  if ([96, 144, 300, 600].indexOf(exportPpi) < 0) exportPpi = 300;
  ppi.value = String(exportPpi);
  ppi.addEventListener("change", function () {
    exportPpi = Number(ppi.value);
    try { localStorage.setItem("fsm-export-ppi", String(exportPpi)); } catch (e) {}
  });
  ppiLabel.appendChild(ppi);
  settingsRow.appendChild(ppiLabel);

  row.appendChild(checksRow);
  row.appendChild(settingsRow);

  var anchorBtn = document.getElementById("btn-typst") || document.getElementById("btn-latex");
  var host = anchorBtn ? anchorBtn.parentNode : null;
  if (host && host.parentNode) host.parentNode.insertBefore(row, host.nextSibling);
  else canvas.parentNode.appendChild(row);
}
