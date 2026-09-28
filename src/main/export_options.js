// Export options row (under the export buttons).
var EXPORT_STANDALONE_KEY = "fsm-export-standalone";
var EXPORT_LAYOUT_KEY = "fsm-export-layout";
var EXPORT_COPY_KEY = "fsm-export-copy";
var EXPORT_DOWNLOAD_KEY = "fsm-export-download";
var exportLayoutMode = "paged";
var exportPpi = 300;
function selectedExportPpi() { return exportPpi; }

function exportPaged() { return exportLayoutMode === "paged"; }
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
  label.title = "Controls whether LaTeX includes its document preamble. Export layout is selected separately; Typst always includes the page size needed to match the editor.";
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
    document.createTextNode("Standalone LaTeX document"),
  );
  checksRow.appendChild(label);

  var layoutLabel = document.createElement("label");
  layoutLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
  layoutLabel.appendChild(document.createTextNode("Export layout"));
  var layout = document.createElement("select");
  layout.id = "export-layout";
  [["paged", "Paper pages (page size and selected margins)"], ["full", "Full diagram (one uncropped tall export)"]].forEach(function (item) {
    var option = document.createElement("option"); option.value = item[0]; option.textContent = item[1]; layout.appendChild(option);
  });
  try { exportLayoutMode = localStorage.getItem(EXPORT_LAYOUT_KEY) || "paged"; } catch (e) { exportLayoutMode = "paged"; }
  if (exportLayoutMode !== "full") exportLayoutMode = "paged";
  layout.value = exportLayoutMode;
  layout.addEventListener("change", function () {
    exportLayoutMode = layout.value;
    try { localStorage.setItem(EXPORT_LAYOUT_KEY, exportLayoutMode); } catch (e) {}
  });
  layoutLabel.appendChild(layout);
  settingsRow.appendChild(layoutLabel);

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
