// Side list for renaming states and arrows by typing.
var __namesRows = [];

function nameOfNode(n) {
  var i = nodes.indexOf(n);
  if (i < 0) return "?";
  return nodes[i].text ? nodes[i].text : "#" + (i + 1);
}

function describeObject(o) {
  if (o instanceof SelfLink) return nameOfNode(o.node) + " \u21BA";
  if (o instanceof StartLink) return "start \u2192 " + nameOfNode(o.node);
  if (o instanceof Link) return nameOfNode(o.nodeA) + " \u2192 " + nameOfNode(o.nodeB);
  return "State " + (nodes.indexOf(o) + 1);
}

function buildNamesRow(obj) {
  var row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:6px;padding:2px 4px;border-radius:6px;";
  var desc = document.createElement("span");
  desc.style.cssText =
    "flex:0 0 120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.7;";
  var input = document.createElement("input");
  input.type = "text";
  input.placeholder = links.indexOf(obj) >= 0 ? "arrow label" : "state name";
  input.style.cssText = "flex:1;min-width:0;font-size:1.1rem;padding:4px 8px;";
  input.addEventListener("focus", function () {
    selectedObject = obj;
    draw();
  });
  input.addEventListener("input", function () {
    obj.text = input.value;
    draw();
    commitHistoryDebounced();
  });
  var del = document.createElement("button");
  del.type = "button";
  del.textContent = "\u2715";
  del.title = "Delete";
  del.addEventListener("click", function () {
    selectedObject = obj;
    deleteSelected();
  });
  row.appendChild(desc);
  row.appendChild(input);
  row.appendChild(del);
  return { obj: obj, row: row, desc: desc, input: input };
}

// Called from draw(). Rebuilds the rows only when the set of objects changes,
// otherwise just syncs text, so typing in a box is never interrupted.
function refreshNamesPanel() {
  var list = document.getElementById("names-list");
  if (!list) return;
  var objs = nodes.concat(links);
  var same = objs.length === __namesRows.length;
  for (var i = 0; same && i < objs.length; i++) {
    if (__namesRows[i].obj !== objs[i]) same = false;
  }
  if (!same) {
    list.innerHTML = "";
    __namesRows = objs.map(buildNamesRow);
    if (__namesRows.length === 0) {
      var empty = document.createElement("div");
      empty.style.opacity = "0.6";
      empty.textContent = "No states yet. Double-click the canvas to add one.";
      list.appendChild(empty);
    }
    __namesRows.forEach(function (r) {
      list.appendChild(r.row);
    });
  }
  for (var j = 0; j < __namesRows.length; j++) {
    var r = __namesRows[j];
    var d = describeObject(r.obj);
    if (r.desc.textContent !== d) r.desc.textContent = d;
    if (document.activeElement !== r.input && r.input.value !== r.obj.text) {
      r.input.value = r.obj.text;
    }
    r.row.style.background = r.obj === selectedObject ? "rgba(99,102,241,0.18)" : "transparent";
  }
}

function wireNamesUI() {
  if (document.getElementById("names-panel")) return;
  var panel = document.createElement("div");
  panel.id = "names-panel";
  panel.style.cssText =
    "margin:10px 0;font-size:1rem;width:100%;flex-basis:100%;box-sizing:border-box;";
  var title = document.createElement("div");
  title.textContent = "States & arrows (type to rename)";
  title.style.cssText = "font-weight:600;font-size:1.1rem;margin-bottom:6px;";
  var list = document.createElement("div");
  list.id = "names-list";
  list.style.cssText = "max-height:220px;overflow:auto;";
  panel.appendChild(title);
  panel.appendChild(list);

  // directly below the diagram
  canvas.parentNode.insertBefore(panel, canvas.nextSibling);
  refreshNamesPanel();
}
