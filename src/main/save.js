// Serialization helpers for the active FSM.
// Reads/writes the active FSM via Workspace.

function serializeState() {
  var data = { nodes: [], links: [], style: getStyle(), pages: pageCount, pageSize: pageSizeKey, margins: pageMarginsForExport(), constrainToMargins: constrainToMargins };
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    data.nodes.push({
      x: node.x,
      y: node.y,
      text: node.text,
      isAcceptState: node.isAcceptState,
    });
  }
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var backupLink = null;
    if (link instanceof SelfLink) {
      backupLink = {
        type: "SelfLink",
        node: nodes.indexOf(link.node),
        text: link.text,
        labelDx: link.labelDx,
        labelDy: link.labelDy,
        anchorAngle: link.anchorAngle,
      };
    } else if (link instanceof StartLink) {
      backupLink = {
        type: "StartLink",
        node: nodes.indexOf(link.node),
        text: link.text,
        labelDx: link.labelDx,
        labelDy: link.labelDy,
        deltaX: link.deltaX,
        deltaY: link.deltaY,
      };
    } else if (link instanceof Link) {
      backupLink = {
        type: "Link",
        nodeA: nodes.indexOf(link.nodeA),
        nodeB: nodes.indexOf(link.nodeB),
        text: link.text,
        labelDx: link.labelDx,
        labelDy: link.labelDy,
        lineAngleAdjust: link.lineAngleAdjust,
        parallelPart: link.parallelPart,
        perpendicularPart: link.perpendicularPart,
        curvePoints: link.curvePoints,
      };
    }
    if (backupLink) data.links.push(backupLink);
  }
  return data;
}

function deserializeState(data) {
  nodes.length = 0;
  links.length = 0;
  selectedObject = null;
  if (!data || !data.nodes) return;
  applyStyle(data.style, false);
  setPageSize(data.pageSize || "letter", false);
  setPageCount(data.pages || 1);
  setPageMargins(data.margins || PAGE_MARGIN_PRESETS.apa, false);
  setConstrainToMargins(data.constrainToMargins !== false, false);
  if (typeof syncStyleInputs === "function") syncStyleInputs();
  for (var i = 0; i < data.nodes.length; i++) {
    var bn = data.nodes[i];
    var node = new Node(bn.x, bn.y);
    node.isAcceptState = !!bn.isAcceptState;
    node.text = bn.text || "";
    nodes.push(node);
  }
  for (var i = 0; i < data.links.length; i++) {
    var bl = data.links[i];
    var link = null;
    if (bl.type === "SelfLink") {
      link = new SelfLink(nodes[bl.node]);
      link.anchorAngle = bl.anchorAngle;
      link.text = bl.text;
      link.labelDx = bl.labelDx || 0;
      link.labelDy = bl.labelDy || 0;
    } else if (bl.type === "StartLink") {
      link = new StartLink(nodes[bl.node]);
      link.deltaX = bl.deltaX;
      link.deltaY = bl.deltaY;
      link.text = bl.text;
      link.labelDx = bl.labelDx || 0;
      link.labelDy = bl.labelDy || 0;
    } else if (bl.type === "Link") {
      link = new Link(nodes[bl.nodeA], nodes[bl.nodeB]);
      link.parallelPart = bl.parallelPart;
      link.perpendicularPart = bl.perpendicularPart;
      link.curvePoints = Array.isArray(bl.curvePoints) ? bl.curvePoints : null;
      link.text = bl.text;
      link.labelDx = bl.labelDx || 0;
      link.labelDy = bl.labelDy || 0;
      link.lineAngleAdjust = bl.lineAngleAdjust;
    }
    if (link) links.push(link);
  }
  if (constrainToMargins) nodes.forEach(function (node) { constrainNodeToMargins(node); });
  if (typeof draw === "function") draw();
}

function snapshotJSON() {
  return JSON.stringify(serializeState());
}

function loadSnapshotJSON(json) {
  if (!json) return;
  try {
    deserializeState(JSON.parse(json));
  } catch (e) {}
}

function saveBackup() {
  if (typeof localStorage === "undefined" || !JSON) return;
  if (!Workspace.getActiveId()) return;
  Workspace.saveActive(serializeState());
}

function restoreBackup() {
  if (typeof localStorage === "undefined" || !JSON) return;
  if (!Workspace.getActiveId()) return;
  deserializeState(Workspace.loadActive());
}

// History commit helpers — defined here so other files can call them after mutations.
var __historyTimer = null;

function commitHistory() {
  if (__historyTimer) {
    clearTimeout(__historyTimer);
    __historyTimer = null;
  }
  saveBackup();
  History.push(snapshotJSON());
}

function commitHistoryDebounced() {
  if (__historyTimer) clearTimeout(__historyTimer);
  saveBackup(); // persist data immediately; only history push is debounced
  __historyTimer = setTimeout(function () {
    History.push(snapshotJSON());
    __historyTimer = null;
  }, 400);
}

function flushHistory() {
  if (__historyTimer) {
    clearTimeout(__historyTimer);
    __historyTimer = null;
    History.push(snapshotJSON());
  }
}
