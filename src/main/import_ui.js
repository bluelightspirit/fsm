// Import a diagram from a .typ / .tex export (or pasted text).
// The exporters write the whole diagram as one comment line:
//   // fsm-data: {...}    (Typst)        % fsm-data: {...}    (LaTeX)

function extractFsmData(text) {
  var m = /^[ \t]*(?:\/\/|%)[ \t]*fsm-data:[ \t]*(\{.*\})[ \t]*$/m.exec(text);
  return m ? m[1] : null;
}

function fsmDataProblem(d) {
  if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.links)) {
    return "That data doesn't look like a diagram";
  }
  var n = d.nodes.length;
  function ok(i) {
    return typeof i === "number" && i >= 0 && i < n;
  }
  for (var i = 0; i < d.links.length; i++) {
    var l = d.links[i];
    var fine = l.type === "Link" ? ok(l.nodeA) && ok(l.nodeB) : ok(l.node);
    if (!fine) return "A link points at a state that doesn't exist";
  }
  return null;
}

function importDiagramFromText(text) {
  var json = extractFsmData(text);
  if (!json) {
    showToast("No fsm-data line found. Was this file exported from this tool?", "error");
    return false;
  }
  var data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    showToast("The fsm-data line is damaged (invalid JSON)", "error");
    return false;
  }
  var problem = fsmDataProblem(data);
  if (problem) {
    showToast(problem, "error");
    return false;
  }
  if (
    (nodes.length || links.length) &&
    !confirm("Replace the current diagram with the imported one? (Undo brings it back.)")
  ) {
    return false;
  }
  flushHistory();
  deserializeState(data);
  saveBackup();
  draw();
  commitHistory();
  showToast("Diagram imported");
  return true;
}

function importDiagramFromFile(file) {
  if (!file) return;
  file.text().then(
    function (t) {
      importDiagramFromText(t);
    },
    function () {
      showToast("Could not read that file", "error");
    },
  );
}

function wireImportUI() {
  if (document.getElementById("import-panel")) return;
  var box = document.createElement("details");
  box.id = "import-panel";
  box.style.cssText = "margin:8px 0;font-size:0.9rem;";
  var summary = document.createElement("summary");
  summary.textContent = "Import from .typ / .tex";
  summary.style.cursor = "pointer";
  box.appendChild(summary);

  var hint = document.createElement("div");
  hint.style.cssText = "margin:6px 0;opacity:0.75;";
  hint.textContent =
    "Choose a file this tool exported, drop it on the canvas, or paste its text. The diagram is read from the fsm-data comment line.";
  box.appendChild(hint);

  var file = document.createElement("input");
  file.type = "file";
  file.accept = ".typ,.tex,.txt";
  file.addEventListener("change", function () {
    importDiagramFromFile(file.files[0]);
    file.value = "";
  });
  box.appendChild(file);

  var area = document.createElement("textarea");
  area.rows = 4;
  area.placeholder = "...or paste the .typ / .tex text here";
  area.style.cssText = "display:block;width:100%;box-sizing:border-box;margin:6px 0;font-family:monospace;";
  box.appendChild(area);

  var btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Load pasted text";
  btn.onclick = function () {
    if (importDiagramFromText(area.value)) area.value = "";
  };
  box.appendChild(btn);

  var anchor = document.getElementById("export-options");
  if (!anchor) {
    var b = document.getElementById("btn-typst") || document.getElementById("btn-latex");
    anchor = b ? b.parentNode : null;
  }
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
  else canvas.parentNode.appendChild(box);

  // drop a .typ / .tex file onto the canvas
  canvas.addEventListener("dragover", function (e) {
    e.preventDefault();
  });
  canvas.addEventListener("drop", function (e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) importDiagramFromFile(e.dataTransfer.files[0]);
  });
}
