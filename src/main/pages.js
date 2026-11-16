// Page-sized canvas at 96 px per inch, growing downward one page at a time.
// State x positions stay within the side margins. Y remains continuous across
// pages; rendering clips each state to every page's printable rectangle.

var PX_PER_INCH = 96;
var PAGE_MARGIN_PRESETS = {
  ieee: { label: "IEEE conference", top: 0.75, bottom: 1, left: 0.625, right: 0.625 },
  chicago: { label: "Chicago", top: 1, bottom: 1, left: 1, right: 1 },
  mla: { label: "MLA", top: 1, bottom: 1, left: 1, right: 1 },
  apa: { label: "APA", top: 1, bottom: 1, left: 1, right: 1 },
  custom: { label: "Custom", top: 1, bottom: 1, left: 1, right: 1 },
};
function marginPresetValues(key, sizeKey) {
  if (key === "ieee" && (sizeKey || pageSizeKey) === "a4") return { top: 0.75, bottom: 1.69, left: 0.51, right: 0.51 };
  var p = PAGE_MARGIN_PRESETS[key] || PAGE_MARGIN_PRESETS.apa;
  return { top: p.top, bottom: p.bottom, left: p.left, right: p.right };
}
function inferMarginPreset(margins, sizeKey) {
  if (margins && PAGE_MARGIN_PRESETS[margins.preset]) return margins.preset;
  var keys = ["ieee", "chicago", "mla", "apa", "custom"];
  var matches = [];
  keys.forEach(function (key) {
    var expected = marginPresetValues(key, sizeKey);
    if (["top", "bottom", "left", "right"].every(function (side) {
      var value = Number(margins && margins[side]);
      return isFinite(value) && Math.abs(value - expected[side]) < 0.001;
    })) matches.push(key);
  });
  // IEEE is the only preset with distinctive values. Equal one-inch presets
  // cannot be identified from older exports that omitted their preset key.
  return matches.length === 1 ? matches[0] : "apa";
}
var pageMargins = { preset: "apa", top: 1, bottom: 1, left: 1, right: 1 };
var constrainToMargins = true; // serialized as before; now locks state and label editing to the printable area
var showCurveHandles = true;
var includeCurveHandlesInExports = false;
var MAX_PAGES = 20;
var PAGE_SIZES = { letter: { label: "US Letter", w: 8.5, h: 11 }, a4: { label: "A4", w: 210 / 25.4, h: 297 / 25.4 } };
var pageSizeKey = "letter";
var pageCount = 1;
var __pagesLast = "";

function pageWidthPx() {
  return Math.round(PAGE_SIZES[pageSizeKey].w * PX_PER_INCH);
}
function editorPixelRatio() { return Math.max(1, Number(window.devicePixelRatio) || 1); }

function pageHeightPx() {
  return Math.round(PAGE_SIZES[pageSizeKey].h * PX_PER_INCH);
}

// ---- per-page margins ------------------------------------------------------------------------
// "all":     every page uses pageMargins (the preset or the custom values) - the original behaviour.
// "edges":   like "all", but the FIRST page's top and the LAST page's bottom can be set separately,
//            to leave room for text before and after the diagram. With one page both apply to it.
// "perPage": every page has its own four margins; pages without an entry use pageMargins.
var MARGIN_MODES = ["all", "edges", "perPage"];
var pageMarginMode = "all";
var pageMarginEdges = { firstTop: null, lastBottom: null };   // inches, or null = use pageMargins
var pageMarginPages = [];                                      // pageMarginPages[p] = {top,bottom,left,right} or null

function clampMarginInches(value, fallback) {
  var v = Number(value);
  return value != null && value !== "" && isFinite(v) ? Math.max(0, Math.min(4, v)) : fallback;
}

function marginsForPage(p) {
  var last = Math.max(1, pageCount) - 1;
  p = Math.max(0, Math.min(last, Math.round(Number(p)) || 0));
  var m = { top: pageMargins.top, bottom: pageMargins.bottom, left: pageMargins.left, right: pageMargins.right };
  if (pageMarginMode === "edges") {
    if (p === 0 && pageMarginEdges.firstTop != null) m.top = pageMarginEdges.firstTop;
    if (p === last && pageMarginEdges.lastBottom != null) m.bottom = pageMarginEdges.lastBottom;
  } else if (pageMarginMode === "perPage") {
    var own = pageMarginPages[p];
    if (own) { m.top = own.top; m.bottom = own.bottom; m.left = own.left; m.right = own.right; }
  }
  return m;
}

function allPageMargins() {
  var out = [];
  for (var p = 0; p < pageCount; p++) out.push(marginsForPage(p));
  return out;
}

// Exporters accept either one margins object or an object carrying a per-page list in .pages.
function marginsAt(margins, p) {
  if (margins && margins.pages && margins.pages.length) {
    return margins.pages[Math.max(0, Math.min(margins.pages.length - 1, Math.round(Number(p)) || 0))];
  }
  return margins;
}

function pageIndexForY(y) {
  return Math.max(0, Math.min(Math.max(1, pageCount) - 1, Math.floor(y / pageHeightPx())));
}

function afterMarginChange(redraw) {
  if (constrainToMargins && typeof nodes !== "undefined") nodes.forEach(function (node) { constrainNodeToMargins(node); });
  __pagesLast = "";
  syncPagesUI();
  if (redraw && typeof draw === "function") draw();
}

function setPageMarginMode(mode, redraw) {
  pageMarginMode = MARGIN_MODES.indexOf(mode) >= 0 ? mode : "all";
  afterMarginChange(redraw);
}

function setPageMarginEdges(edges, redraw) {
  edges = edges || {};
  pageMarginEdges = {
    firstTop: edges.firstTop == null || edges.firstTop === "" ? null : clampMarginInches(edges.firstTop, null),
    lastBottom: edges.lastBottom == null || edges.lastBottom === "" ? null : clampMarginInches(edges.lastBottom, null),
  };
  afterMarginChange(redraw);
}

// margins == null puts that page back on the base margins.
function setPageMarginPage(p, margins, redraw) {
  p = Math.max(0, Math.min(MAX_PAGES - 1, Math.round(Number(p)) || 0));
  if (margins == null) {
    pageMarginPages[p] = null;
  } else {
    pageMarginPages[p] = {
      top: clampMarginInches(margins.top, pageMargins.top),
      bottom: clampMarginInches(margins.bottom, pageMargins.bottom),
      left: clampMarginInches(margins.left, pageMargins.left),
      right: clampMarginInches(margins.right, pageMargins.right),
    };
  }
  afterMarginChange(redraw);
}

// Choosing a preset means "use this everywhere", so it clears every override.
function clearPageMarginOverrides() {
  pageMarginEdges = { firstTop: null, lastBottom: null };
  pageMarginPages = [];
}

function pageMarginSettingsForSave() {
  return {
    mode: pageMarginMode,
    edges: { firstTop: pageMarginEdges.firstTop, lastBottom: pageMarginEdges.lastBottom },
    pages: pageMarginPages.map(function (m) { return m ? { top: m.top, bottom: m.bottom, left: m.left, right: m.right } : null; }),
  };
}

// Tolerant on purpose: files saved before this feature simply have none of these fields.
function restorePageMarginSettings(data) {
  data = data || {};
  pageMarginMode = MARGIN_MODES.indexOf(data.mode) >= 0 ? data.mode : "all";
  var e = data.edges || {};
  pageMarginEdges = {
    firstTop: e.firstTop == null ? null : clampMarginInches(e.firstTop, null),
    lastBottom: e.lastBottom == null ? null : clampMarginInches(e.lastBottom, null),
  };
  pageMarginPages = [];
  (Array.isArray(data.pages) ? data.pages : []).slice(0, MAX_PAGES).forEach(function (m, i) {
    pageMarginPages[i] = m && typeof m === "object" ? {
      top: clampMarginInches(m.top, pageMargins.top),
      bottom: clampMarginInches(m.bottom, pageMargins.bottom),
      left: clampMarginInches(m.left, pageMargins.left),
      right: clampMarginInches(m.right, pageMargins.right),
    } : null;
  });
}

function setPageMargins(margins, redraw) {
  var next = margins || {};
  var preset = inferMarginPreset(next, pageSizeKey);
  var presetValues = marginPresetValues(preset, pageSizeKey);
  pageMargins = { preset: preset };
  ["top", "bottom", "left", "right"].forEach(function (side) {
    var value = Number(next[side]);
    pageMargins[side] = next[side] != null && isFinite(value) ? Math.max(0, Math.min(4, value)) : presetValues[side];
  });
  if (constrainToMargins && typeof nodes !== "undefined") nodes.forEach(function (node) { constrainNodeToMargins(node); });
  syncPagesUI();
  if (redraw && typeof draw === "function") draw();
}

function setPageSize(key, redraw) {
  pageSizeKey = PAGE_SIZES[key] ? key : "letter";
  if (pageMargins.preset !== "custom") {
    var preset = marginPresetValues(pageMargins.preset, pageSizeKey);
    setPageMargins({ preset: pageMargins.preset, top: preset.top, bottom: preset.bottom, left: preset.left, right: preset.right }, false);
  }
  setPageCount(pageCount);
  if (constrainToMargins && typeof nodes !== "undefined") nodes.forEach(function (node) { constrainNodeToMargins(node); });
  var input = document.getElementById("page-size");
  if (input) input.value = pageSizeKey;
  if (redraw && typeof draw === "function") draw();
}

// The plain fields are what single-flow exports use (top of the first page, bottom of the last page,
// left/right of the first page); .pages carries one margins object per page for paged exports.
// In "all" mode these equal the base margins, as before.
function pageMarginsForExport() {
  var first = marginsForPage(0), last = marginsForPage(pageCount - 1);
  return { preset: pageMargins.preset, mode: pageMarginMode,
           top: first.top, bottom: last.bottom, left: first.left, right: first.right,
           pages: allPageMargins() };
}

// The base margins only (what the preset / custom fields hold), for saving.
function pageBaseMarginsForSave() {
  return { preset: pageMargins.preset, top: pageMargins.top, bottom: pageMargins.bottom, left: pageMargins.left, right: pageMargins.right };
}

function pageFitLayout(margins) {
  var width = pageWidthPx(), height = pageHeightPx();
  var innerW = width - (margins.left + margins.right) * PX_PER_INCH;
  var innerH = height - (margins.top + margins.bottom) * PX_PER_INCH;
  var safe = Math.max(nodeRadius + styleLinkFontSize + styleArrowSize, styleStateFontSize * 3);
  safe = Math.min(safe, Math.max(0, Math.min(innerW, innerH) / 2 - 2));
  var scale = Math.max(0.01, Math.min((innerW - safe * 2) / width, (innerH - safe * 2) / height));
  return {
    scale: scale,
    x: margins.left + (innerW - width * scale) / (2 * PX_PER_INCH),
    y: margins.top + (innerH - height * scale) / (2 * PX_PER_INCH),
  };
}

function setConstrainToMargins(value, redraw) {
  constrainToMargins = !!value;
  if (constrainToMargins && typeof nodes !== "undefined") nodes.forEach(function (node) { constrainNodeToMargins(node); });
  var input = document.getElementById("page-constrain-margins");
  if (input) input.checked = constrainToMargins;
  __pagesLast = "";
  syncPagesUI();
  if (redraw && typeof draw === "function") draw();
}

function clampToPrintable(x, y, insetX, insetY) {
  insetX = Math.max(0, Number(insetX) || 0);
  insetY = Math.max(0, Number(insetY == null ? insetX : insetY) || 0);
  var w = pageWidthPx(), h = pageHeightPx();
  var p = 0, bestDistance = Infinity, bestY = y;
  for (var candidate = 0; candidate < pageCount; candidate++) {
    var cm = marginsForPage(candidate);
    var candidateMin = candidate * h + cm.top * PX_PER_INCH + insetY;
    var candidateMax = (candidate + 1) * h - cm.bottom * PX_PER_INCH - insetY;
    if (candidateMax < candidateMin) candidateMin = candidateMax = candidate * h + h / 2;
    var candidateY = Math.max(candidateMin, Math.min(candidateMax, y));
    var distance = Math.abs(candidateY - y);
    if (distance < bestDistance) { bestDistance = distance; p = candidate; bestY = candidateY; }
  }
  var pm = marginsForPage(p);
  var minX = pm.left * PX_PER_INCH + insetX;
  var maxX = w - pm.right * PX_PER_INCH - insetX;
  var minY = p * h + pm.top * PX_PER_INCH + insetY;
  var maxY = (p + 1) * h - pm.bottom * PX_PER_INCH - insetY;
  if (maxX < minX) minX = maxX = w / 2;
  if (maxY < minY) minY = maxY = p * h + h / 2;
  return { x: Math.max(minX, Math.min(maxX, x)), y: bestY, page: p };
}

function constrainNodeToMargins(node) {
  if (!constrainToMargins || !node) return;
  var w = pageWidthPx();
  var textWidth = 0;
  if (canvas && typeof labelSegments === "function") {
    textWidth = richTextWidth(canvas.getContext("2d"), labelSegments(node.text || ""), styleStateFontSize);
  }
  var insetX = Math.max(nodeRadius, textWidth / 2) + 2;
  var insetY = Math.max(nodeRadius, styleStateFontSize * 0.75) + 2;
  var pm = marginsForPage(pageIndexForY(node.y));       // left/right come from the page the state sits on
  var minX = pm.left * PX_PER_INCH + insetX;
  var maxX = w - pm.right * PX_PER_INCH - insetX;
  if (maxX < minX) minX = maxX = w / 2;
  node.x = Math.max(minX, Math.min(maxX, node.x));
  // Keep the first page's top boundary, but let states cross every lower
  // page seam. Rendering projects the crossing fragment into the next page.
  node.y = Math.max(marginsForPage(0).top * PX_PER_INCH + insetY, node.y);
}

function clampNodePosition(x, y) {
  var node = { x: x, y: y };
  constrainNodeToMargins(node);
  return { x: node.x, y: node.y };
}

function lowestContentY() {
  var y = 0;
  for (var i = 0; i < nodes.length; i++) y = Math.max(y, nodes[i].y + nodeRadius);
  return y;
}

function setPageCount(n) {
  n = Math.round(n);
  if (!(n >= 1)) n = 1;
  if (n > MAX_PAGES) n = MAX_PAGES;
  pageCount = n;
  if (typeof canvas !== "undefined" && canvas) {
    var w = pageWidthPx();
    var h = pageHeightPx() * n;
    var ratio = editorPixelRatio();
    if (canvas.width !== Math.round(w * ratio)) canvas.width = Math.round(w * ratio);
    if (canvas.height !== Math.round(h * ratio)) canvas.height = Math.round(h * ratio);
    canvas.style.width = "100%";
    canvas.style.maxWidth = w + "px";
    canvas.style.height = "auto";
  }
  __pagesLast = "";
  syncPagesUI();
}

// Drawn behind the diagram, on screen only (exports call drawUsing directly).
function drawPageGuides(c) {
  var fg = getDrawColors().fg;
  var w = pageWidthPx();
  var h = pageHeightPx();
  c.save();
  if (c.canvas === canvas && typeof c.scale === "function") c.scale(editorPixelRatio(), editorPixelRatio());
  c.globalCompositeOperation = "destination-over";
  c.strokeStyle = fg;
  c.fillStyle = fg;
  c.lineWidth = 1;
  for (var p = 0; p < pageCount; p++) {
    var top = p * h;
    var pm = marginsForPage(p);
    var mt = pm.top * PX_PER_INCH, mb = pm.bottom * PX_PER_INCH, ml = pm.left * PX_PER_INCH, mr = pm.right * PX_PER_INCH;
    c.globalAlpha = 0.35;
    c.setLineDash([]);
    c.strokeRect(0.5, top + 0.5, w - 1, h - 1);
    c.globalAlpha = 0.18;
    c.setLineDash([6, 6]);
    c.strokeRect(ml + 0.5, top + mt + 0.5, w - ml - mr, h - mt - mb);
    c.globalAlpha = 0.45;
    c.setLineDash([]);
    c.font = "12px sans-serif";
    c.fillText("Page " + (p + 1), 8, top + 16);
  }
  c.restore();
}

function addPage() {
  if (pageCount >= MAX_PAGES) return;
  flushHistory();
  setPageCount(pageCount + 1);
  draw();
  commitHistory();
}

function removeLastPage() {
  if (pageCount <= 1 || lowestContentY() > (pageCount - 1) * pageHeightPx()) return;
  flushHistory();
  setPageCount(pageCount - 1);
  draw();
  commitHistory();
}

function syncPagesUI() {
  var info = document.getElementById("pages-info");
  var add = document.getElementById("pages-add");
  var remove = document.getElementById("pages-remove");
  if (!info || !add || !remove) return;
  var canRemove = pageCount > 1 && lowestContentY() <= (pageCount - 1) * pageHeightPx();
  var key = pageCount + "|" + canRemove + "|" + JSON.stringify(pageMargins) + "|" + constrainToMargins + "|" + pageSizeKey;
  if (key === __pagesLast) return;
  __pagesLast = key;
  var size = PAGE_SIZES[pageSizeKey];
  info.textContent =
    pageCount + (pageCount === 1 ? " page" : " pages") + " \u00b7 " + size.label + " " +
    size.w.toFixed(2) + "\u00d7" + size.h.toFixed(2) + " in \u00b7 " + PAGE_MARGIN_PRESETS[pageMargins.preset].label +
    " margins (T " + pageMargins.top + ' in, B ' + pageMargins.bottom + ' in, L ' + pageMargins.left + ' in, R ' + pageMargins.right + " in)" + marginModeSummary();
  remove.disabled = !canRemove;
  remove.title = canRemove || pageCount === 1 ? "" : "Move everything off the last page first";
  add.disabled = pageCount >= MAX_PAGES;
  var presetInput = document.getElementById("page-margin-preset");
  if (presetInput) presetInput.value = pageMargins.preset;
  var constrainInput = document.getElementById("page-constrain-margins");
  if (constrainInput) constrainInput.checked = constrainToMargins;
  ["top", "bottom", "left", "right"].forEach(function (side) {
    var input = document.getElementById("page-margin-" + side);
    if (input && document.activeElement !== input) input.value = pageMargins[side];
  });
  syncMarginModeUI();
}

// ---- margin-mode controls (they sit under the margin inputs) ---------------------------------
var __marginUi = null;

function marginModeSummary() {
  if (pageMarginMode === "edges") {
    return " \u00b7 first page top " + marginsForPage(0).top + " in, last page bottom " + marginsForPage(pageCount - 1).bottom + " in";
  }
  if (pageMarginMode === "perPage") return " \u00b7 custom margins per page";
  return "";
}

function marginField(id, text, title) {
  var wrap = document.createElement("label");
  wrap.style.cssText = "display:inline-flex;align-items:center;gap:4px";
  wrap.title = title || "";
  var span = document.createElement("span");
  span.textContent = text;
  var input = document.createElement("input");
  input.type = "number"; input.min = "0"; input.max = "4"; input.step = "0.05"; input.id = id;
  input.style.width = "64px";
  wrap.appendChild(span);
  wrap.appendChild(input);
  return { wrap: wrap, input: input };
}

function buildPerPageRows(ui) {
  ui.perPage.textContent = "";
  ui.rows = [];
  for (var p = 0; p < pageCount; p++) (function (p) {
    var line = document.createElement("div");
    line.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap";
    var name = document.createElement("strong");
    name.textContent = "Page " + (p + 1);
    name.style.minWidth = "52px";
    line.appendChild(name);
    var fields = {};
    [["top", "Top"], ["bottom", "Bottom"], ["left", "Left"], ["right", "Right"]].forEach(function (s) {
      var f = marginField("page-margin-" + p + "-" + s[0], s[1], "Margin on this page only, in inches");
      fields[s[0]] = f.input;
      line.appendChild(f.wrap);
      f.input.addEventListener("change", function () {
        flushHistory();
        setPageMarginPage(p, { top: fields.top.value, bottom: fields.bottom.value, left: fields.left.value, right: fields.right.value }, true);
        commitHistory();
      });
    });
    var reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Reset";
    reset.title = "Put this page back on the margins above";
    reset.addEventListener("click", function () { flushHistory(); setPageMarginPage(p, null, true); commitHistory(); });
    line.appendChild(reset);
    ui.perPage.appendChild(line);
    ui.rows[p] = { fields: fields, reset: reset };
  })(p);
}

function syncMarginModeUI() {
  var ui = __marginUi;
  if (!ui) return;
  ui.select.value = pageMarginMode;
  var hints = {
    all: "The margins above apply to every page.",
    edges: "The margins above apply to every page. The two boxes below override the first page's top and the last page's bottom, to leave room for text before and after the diagram. A one-page diagram uses both.",
    perPage: "Edit each page's margins. Pages you do not edit follow the margins above.",
  };
  ui.hint.textContent = hints[pageMarginMode] || "";
  ui.edges.style.display = pageMarginMode === "edges" ? "flex" : "none";
  ui.perPage.style.display = pageMarginMode === "perPage" ? "flex" : "none";
  var active = document.activeElement;
  if (pageMarginMode === "edges") {
    [[ui.first.input, pageMarginEdges.firstTop, pageMargins.top], [ui.last.input, pageMarginEdges.lastBottom, pageMargins.bottom]].forEach(function (f) {
      f[0].placeholder = String(f[2]);
      if (active !== f[0]) f[0].value = f[1] == null ? "" : String(f[1]);
    });
  }
  if (pageMarginMode === "perPage") {
    if (ui.rows.length !== pageCount) buildPerPageRows(ui);
    for (var p = 0; p < pageCount; p++) {
      var m = marginsForPage(p), row = ui.rows[p];
      ["top", "bottom", "left", "right"].forEach(function (side) {
        if (active !== row.fields[side]) row.fields[side].value = String(m[side]);
      });
      row.reset.disabled = !pageMarginPages[p];
    }
  }
}

function wirePageMarginModes(anchor) {
  if (!anchor || !anchor.parentNode || document.getElementById("page-margin-modes")) return;
  var row = document.createElement("div");
  row.id = "page-margin-modes";
  row.style.cssText = "margin:6px 0;font-size:12px;display:flex;flex-direction:column;gap:6px";

  var head = document.createElement("div");
  head.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap";
  var label = document.createElement("label");
  label.textContent = "Margin mode";
  label.htmlFor = "page-margin-mode";
  var select = document.createElement("select");
  select.id = "page-margin-mode";
  [["all", "Same on every page"], ["edges", "Same, with first-page top / last-page bottom"], ["perPage", "Custom per page"]].forEach(function (o) {
    var opt = document.createElement("option");
    opt.value = o[0];
    opt.textContent = o[1];
    select.appendChild(opt);
  });
  head.appendChild(label);
  head.appendChild(select);

  var hint = document.createElement("div");
  hint.style.opacity = "0.75";

  var edges = document.createElement("div");
  edges.style.cssText = "display:none;align-items:center;gap:12px;flex-wrap:wrap";
  var first = marginField("page-margin-first-top", "First page top (in)", "Top margin of the first page only. Leave empty to use the top margin above.");
  var last = marginField("page-margin-last-bottom", "Last page bottom (in)", "Bottom margin of the last page only. Leave empty to use the bottom margin above.");
  edges.appendChild(first.wrap);
  edges.appendChild(last.wrap);

  var perPage = document.createElement("div");
  perPage.id = "page-margin-per-page";
  perPage.style.cssText = "display:none;flex-direction:column;gap:4px";

  row.appendChild(head);
  row.appendChild(hint);
  row.appendChild(edges);
  row.appendChild(perPage);
  anchor.parentNode.insertBefore(row, anchor.nextSibling);
  __marginUi = { row: row, select: select, hint: hint, edges: edges, first: first, last: last, perPage: perPage, rows: [] };

  select.addEventListener("change", function () {
    flushHistory();
    setPageMarginMode(select.value, true);
    commitHistory();
  });
  function commitEdges() {
    flushHistory();
    setPageMarginEdges({ firstTop: first.input.value, lastBottom: last.input.value }, true);
    commitHistory();
  }
  first.input.addEventListener("change", commitEdges);
  last.input.addEventListener("change", commitEdges);
  syncMarginModeUI();
}

function wirePagesUI() {
  if (document.getElementById("pages-row")) return;
  var row = document.createElement("div");
  row.id = "pages-row";
  row.style.cssText =
    "display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:8px 0;font-size:0.95rem;width:100%;flex-basis:100%;box-sizing:border-box;";
  var add = document.createElement("button");
  add.type = "button";
  add.id = "pages-add";
  add.textContent = "+ Add page";
  add.onclick = addPage;
  var remove = document.createElement("button");
  remove.type = "button";
  remove.id = "pages-remove";
  remove.textContent = "\u2212 Remove last page";
  remove.onclick = removeLastPage;
  var info = document.createElement("span");
  info.id = "pages-info";
  info.style.opacity = "0.75";
  row.appendChild(add);
  row.appendChild(remove);
  var settings = document.createElement("div");
  settings.id = "page-settings-row";
  settings.style.cssText = row.style.cssText;
  var preset = document.createElement("select");
  preset.id = "page-margin-preset";
  Object.keys(PAGE_MARGIN_PRESETS).forEach(function (key) {
    var option = document.createElement("option");
    option.value = key;
    option.textContent = PAGE_MARGIN_PRESETS[key].label;
    preset.appendChild(option);
  });
  preset.value = pageMargins.preset;
  var sizeSelect = document.createElement("select");
  sizeSelect.id = "page-size";
  Object.keys(PAGE_SIZES).forEach(function (key) {
    var option = document.createElement("option"); option.value = key; option.textContent = PAGE_SIZES[key].label;
    sizeSelect.appendChild(option);
  });
  sizeSelect.value = pageSizeKey;
  sizeSelect.addEventListener("change", function () { setPageSize(sizeSelect.value, true); preset.value = pageMargins.preset; syncPagesUI(); commitHistory(); });
  settings.appendChild(sizeSelect);
  settings.appendChild(preset);
  var customInputs = {};
  ["top", "bottom", "left", "right"].forEach(function (side) {
    var label = document.createElement("label");
    label.style.cssText = "display:flex;align-items:center;gap:3px;";
    label.appendChild(document.createTextNode(side.charAt(0).toUpperCase() + side.slice(1)));
    var input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "4";
    input.step = "0.125";
    input.value = pageMargins[side];
    input.id = "page-margin-" + side;
    input.style.width = "60px";
    input.setAttribute("aria-label", side + " margin in inches");
    input.addEventListener("change", function () {
      var next = { preset: "custom" };
      ["top", "bottom", "left", "right"].forEach(function (s) { next[s] = customInputs[s].value; });
      setPageMargins(next, true);
      preset.value = "custom";
      ["top", "bottom", "left", "right"].forEach(function (s) { customInputs[s].value = pageMargins[s]; });
      commitHistory();
    });
    customInputs[side] = input;
    label.appendChild(input);
      settings.appendChild(label);
  });
  preset.addEventListener("change", function () {
    var p = marginPresetValues(preset.value);
    clearPageMarginOverrides();
    setPageMargins({ preset: preset.value, top: p.top, bottom: p.bottom, left: p.left, right: p.right }, true);
    ["top", "bottom", "left", "right"].forEach(function (s) { customInputs[s].value = pageMargins[s]; });
    commitHistory();
  });
  row.appendChild(info);
  canvas.parentNode.insertBefore(row, canvas.nextSibling); // directly under the diagram
  canvas.parentNode.insertBefore(settings, row.nextSibling);
  setPageCount(pageCount); // size the canvas even when nothing was loaded
  wirePageMarginModes(settings);
  wireTypstHelp(document.getElementById("page-margin-modes") || settings);
}

function wireTypstHelp(anchor) {
  if (document.getElementById("typst-compile-help")) return;
  var details = document.createElement("details");
  details.id = "typst-compile-help";
  details.style.cssText = "margin:8px 0 18px;font-size:0.9rem;";
  var summary = document.createElement("summary");
  summary.textContent = "Compile Typst to a multi-page PDF or separate PNG files";
  details.appendChild(summary);
  var help = document.createElement("p");
  help.style.cssText = "margin:6px 0;";
  help.textContent = "With the Typst CLI installed, run the appropriate command from the folder containing your .typ file:";
  details.appendChild(help);
  var ppiNote = document.createElement("p");
  ppiNote.textContent = "Typst PDF output stays vector sharp at any zoom. PNG defaults to 144 PPI; use --ppi 300 or --ppi 600 for print quality. The export PNG resolution selector changes this only for PNG downloads from the editor.";
  details.appendChild(ppiNote);
  [["PowerShell", 'typst compile "FSM_1.typ" "FSM_1.pdf"', 'typst compile "FSM_1.typ" "page-{0p}.png"'],
   ["macOS Terminal", 'typst compile "FSM_1.typ" "FSM_1.pdf"', 'typst compile "FSM_1.typ" "page-{0p}.png"'],
   ["Linux Terminal", 'typst compile "FSM_1.typ" "FSM_1.pdf"', 'typst compile "FSM_1.typ" "page-{0p}.png"']].forEach(function (entry) {
    var section = document.createElement("p");
    section.style.cssText = "margin:8px 0 4px;font-weight:600;";
    section.textContent = entry[0];
    var code = document.createElement("pre");
    code.style.cssText = "white-space:pre-wrap;margin:0 0 8px;padding:8px;background:rgba(127,127,127,.12);border-radius:4px;";
    code.textContent = "PDF:  " + entry[1] + "\nPNGs (screen): " + entry[2] + "\nPNGs (print, 300 PPI): typst compile --ppi 300 \"FSM_1.typ\" \"page-{0p}.png\"\nPNGs (print, 600 PPI): typst compile --ppi 600 \"FSM_1.typ\" \"page-{0p}.png\"";
    details.appendChild(section);
    details.appendChild(code);
  });
  anchor.parentNode.insertBefore(details, anchor.nextSibling);
}

