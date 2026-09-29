// DFA/NFA analysis and NFA subset construction for the current canvas graph.
var automataPanelSignature = "";
var automataPanelWorkspaceId = null;
var automataStatusMessage = "";

function automataEpsilon(symbol) {
  return ["ε", "ϵ", "λ", "epsilon", "eps", "\\epsilon"].indexOf(String(symbol).trim().toLowerCase()) >= 0;
}

function automataSplitLabel(label) {
  return String(label || "").split(",").map(function (part) { return part.trim(); }).filter(Boolean);
}

function automataBuildModel() {
  var nodeIds = new Map();
  nodes.forEach(function (node, i) { nodeIds.set(node, i); });
  var edges = [], starts = [];
  links.forEach(function (link) {
    if (link instanceof StartLink) {
      var startIndex = nodeIds.get(link.node);
      if (startIndex != null) starts.push(startIndex);
      return;
    }
    var from, to;
    if (link instanceof SelfLink) from = to = nodeIds.get(link.node);
    else if (link instanceof Link) { from = nodeIds.get(link.nodeA); to = nodeIds.get(link.nodeB); }
    else return;
    var symbols = automataSplitLabel(link.text);
    if (!symbols.length) edges.push({ from: from, to: to, symbol: "", label: link.text || "" });
    symbols.forEach(function (symbol) { edges.push({ from: from, to: to, symbol: symbol, label: link.text || "" }); });
  });
  var inferred = [];
  edges.forEach(function (edge) {
    if (edge.symbol && !automataEpsilon(edge.symbol) && inferred.indexOf(edge.symbol) < 0) inferred.push(edge.symbol);
  });
  inferred.sort();
  return {
    nodes: nodes.map(function (node, i) { return { id: i, name: node.text || "q" + i, accepting: !!node.isAcceptState }; }),
    starts: starts,
    accepts: nodes.map(function (node, i) { return node.isAcceptState ? i : -1; }).filter(function (i) { return i >= 0; }),
    edges: edges,
    inferredAlphabet: inferred,
  };
}

function automataAlphabet(model) {
  var input = document.getElementById("automata-alphabet");
  var raw = input ? input.value : "";
  if (!raw.trim()) return model.inferredAlphabet.slice();
  return raw.split(",").map(function (symbol) { return symbol.trim(); }).filter(function (symbol, i, all) { return symbol && !automataEpsilon(symbol) && all.indexOf(symbol) === i; }).sort();
}

function automataAnalyze(model, type, alphabet) {
  var errors = [], warnings = [], n = model.nodes.length;
  if (!n) errors.push("Add at least one state.");
  if (!model.starts.length) errors.push("No start arrow is assigned.");
  if (model.starts.length > 1) errors.push("There are " + model.starts.length + " start arrows; a DFA/NFA has one start state.");
  if (!model.accepts.length) warnings.push("No accepting states: the machine accepts the empty language.");
  var epsilonCount = 0, emptyLabels = 0, invalidTargets = 0;
  var targets = new Map(), adjacency = Array.from({ length: n }, function () { return []; });
  model.edges.forEach(function (edge) {
    if (edge.from == null || edge.to == null || edge.from < 0 || edge.to < 0 || edge.from >= n || edge.to >= n) { invalidTargets++; return; }
    if (!edge.symbol) { emptyLabels++; return; }
    if (automataEpsilon(edge.symbol)) epsilonCount++;
    var key = edge.from + "\u0000" + edge.symbol;
    if (!targets.has(key)) targets.set(key, new Set());
    targets.get(key).add(edge.to);
    adjacency[edge.from].push({ to: edge.to, symbol: edge.symbol });
  });
  if (invalidTargets) errors.push(invalidTargets + " transition(s) point to a state that is no longer in the diagram.");
  if (emptyLabels) errors.push(emptyLabels + " transition(s) have no input symbol.");
  if (type === "dfa" && epsilonCount) errors.push("A DFA cannot contain ε-transitions (" + epsilonCount + " found).");
  var alphabetSet = new Set(alphabet), outsideAlphabet = [];
  model.edges.forEach(function (edge) {
    if (edge.symbol && !automataEpsilon(edge.symbol) && !alphabetSet.has(edge.symbol) && outsideAlphabet.indexOf(edge.symbol) < 0) outsideAlphabet.push(edge.symbol);
  });
  if (outsideAlphabet.length) errors.push("Transition symbols outside the selected alphabet: " + outsideAlphabet.join(", ") + ".");
  var duplicateTransitions = [];
  targets.forEach(function (destinations, key) {
    if (destinations.size > 1) duplicateTransitions.push(key.split("\u0000")[0] + ": " + Array.from(destinations).map(function (i) { return model.nodes[i].name; }).join(" / "));
  });
  var deterministic = duplicateTransitions.length === 0 && epsilonCount === 0;
  if (type === "dfa" && duplicateTransitions.length) errors.push("DFA is nondeterministic for " + duplicateTransitions.length + " state/symbol pair(s).");
  if (!alphabet.length && n) warnings.push("No input symbols are defined. Enter an alphabet above or add labeled arrows.");
  var missing = [];
  model.nodes.forEach(function (node) {
    alphabet.forEach(function (symbol) {
      var destinations = targets.get(node.id + "\u0000" + symbol);
      if (!destinations || destinations.size === 0) missing.push(node.name + " — " + symbol);
    });
  });
  if (type === "dfa") {
    if (missing.length) errors.push("DFA is incomplete: " + missing.length + " transition(s) are missing.");
  }
  var reachable = new Set();
  var queue = model.starts.slice();
  while (queue.length) {
    var current = queue.shift();
    if (reachable.has(current) || current == null || current < 0 || current >= n) continue;
    reachable.add(current);
    adjacency[current].forEach(function (edge) { if (!reachable.has(edge.to)) queue.push(edge.to); });
  }
  var unreachable = model.nodes.filter(function (node) { return !reachable.has(node.id); }).map(function (node) { return node.name; });
  if (unreachable.length) warnings.push("Unreachable states: " + unreachable.join(", ") + ".");
  var reverse = Array.from({ length: n }, function () { return []; });
  adjacency.forEach(function (list, from) { list.forEach(function (edge) { reverse[edge.to].push(from); }); });
  var canAccept = new Set(), back = model.accepts.slice();
  while (back.length) {
    var accepted = back.shift();
    if (canAccept.has(accepted) || accepted < 0 || accepted >= n) continue;
    canAccept.add(accepted);
    reverse[accepted].forEach(function (from) { if (!canAccept.has(from)) back.push(from); });
  }
  var dead = model.nodes.filter(function (node) { return !canAccept.has(node.id); }).map(function (node) { return node.name; });
  return {
    errors: errors, warnings: warnings, deterministic: deterministic,
    complete: missing.length === 0, connected: unreachable.length === 0,
    epsilonCount: epsilonCount, unreachable: unreachable, dead: dead,
    missing: missing, alphabet: alphabet, valid: errors.length === 0,
  };
}

function automataAddResult(container, text, kind) {
  var item = document.createElement("div");
  item.className = "analysis-item" + (kind ? " " + kind : "");
  item.textContent = text;
  container.appendChild(item);
}

function refreshAutomataPanel(force) {
  var panel = document.getElementById("automata-panel");
  if (!panel) return;
  var workspaceId = typeof Workspace !== "undefined" ? Workspace.getActiveId() : null;
  if (workspaceId !== automataPanelWorkspaceId) {
    automataPanelWorkspaceId = workspaceId;
    automataStatusMessage = "";
    try {
      document.getElementById("automata-type").value = localStorage.getItem("fsm-automata-type-" + workspaceId) || "dfa";
      var savedAlphabet = localStorage.getItem("fsm-automata-alphabet-" + workspaceId);
      document.getElementById("automata-alphabet").value = savedAlphabet || "";
    } catch (e) { document.getElementById("automata-type").value = "dfa"; document.getElementById("automata-alphabet").value = ""; }
    force = true;
  }
  var model = automataBuildModel();
  var signature = JSON.stringify({ nodes: model.nodes, starts: model.starts, edges: model.edges });
  if (!force && signature === automataPanelSignature) return;
  automataPanelSignature = signature;
  var mode = document.getElementById("automata-type").value;
  var alpha = automataAlphabet(model);
  var report = automataAnalyze(model, mode, alpha);
  var summary = document.getElementById("automata-summary"), results = document.getElementById("automata-results");
  summary.textContent = model.nodes.length + " states · " + model.edges.filter(function (edge) { return !!edge.symbol; }).length + " transitions · " + alpha.length + " symbols";
  while (results.firstChild) results.removeChild(results.firstChild);
  automataAddResult(results, "Validation: " + (report.valid ? "no structural errors" : report.errors.length + " error(s)"), report.valid ? "ok" : "error");
  report.errors.forEach(function (message) { automataAddResult(results, message, "error"); });
  automataAddResult(results, "Deterministic: " + (report.deterministic ? "yes" : "no"));
  automataAddResult(results, "Complete over this alphabet: " + (report.complete ? "yes" : "no"));
  automataAddResult(results, "Connected from start: " + (report.connected ? "yes" : "no"));
  automataAddResult(results, "ε-transitions: " + report.epsilonCount);
  automataAddResult(results, "Unreachable: " + (report.unreachable.length ? report.unreachable.join(", ") : "none"));
  automataAddResult(results, "Dead states: " + (report.dead.length ? report.dead.join(", ") : "none"));
  if (report.missing.length) automataAddResult(results, "Missing transitions: " + report.missing.slice(0, 8).join("; ") + (report.missing.length > 8 ? "; …" : ""), mode === "dfa" ? "error" : "");
  report.warnings.forEach(function (message) { automataAddResult(results, message); });
  if (automataStatusMessage) automataAddResult(results, automataStatusMessage, automataStatusMessage.indexOf("verified") >= 0 ? "ok" : "");
}

function automataConvertNfaToDfa() {
  var model = automataBuildModel(), alphabet = automataAlphabet(model);
  var report = automataAnalyze(model, "nfa", alphabet);
  if (!report.valid) { automataStatusMessage = "Fix validation errors before converting."; refreshAutomataPanel(true); return; }
  if (!model.starts.length) return;
  function closure(seed) {
    var result = new Set(seed), queue = seed.slice();
    while (queue.length) {
      var state = queue.shift();
      model.edges.forEach(function (edge) {
        if (edge.from === state && automataEpsilon(edge.symbol) && !result.has(edge.to)) { result.add(edge.to); queue.push(edge.to); }
      });
    }
    return result;
  }
  function key(set) { return Array.from(set).sort(function (a, b) { return a - b; }).join(","); }
  var initial = closure([model.starts[0]]), subsets = [initial], byKey = new Map([[key(initial), 0]]), transitions = [], cursor = 0;
  while (cursor < subsets.length) {
    var fromSet = subsets[cursor];
    alphabet.forEach(function (symbol) {
      var destinations = new Set();
      fromSet.forEach(function (state) {
        model.edges.forEach(function (edge) { if (edge.from === state && edge.symbol === symbol) destinations.add(edge.to); });
      });
      var target = closure(Array.from(destinations)), targetKey = key(target);
      if (!byKey.has(targetKey)) {
        if (subsets.length >= 256) throw new Error("Subset construction exceeded 256 DFA states; conversion stopped.");
        byKey.set(targetKey, subsets.length); subsets.push(target);
      }
      transitions.push({ from: cursor, to: byKey.get(targetKey), symbol: symbol });
    });
    cursor++;
  }
  var groups = new Map();
  transitions.forEach(function (edge) {
    var groupKey = edge.from + ":" + edge.to;
    if (!groups.has(groupKey)) groups.set(groupKey, { from: edge.from, to: edge.to, symbols: [] });
    groups.get(groupKey).symbols.push(edge.symbol);
  });
  var newNodes = subsets.map(function (set) {
    var members = Array.from(set).sort(function (a, b) { return a - b; });
    return { text: members.length ? "{" + members.map(function (i) { return model.nodes[i].name; }).join(",") + "}" : "∅", isAcceptState: members.some(function (i) { return model.nodes[i].accepting; }) };
  });
  var width = pageWidthPx(), height = pageHeightPx(), cx = width / 2, cy = height / 2;
  var radius = Math.max(0, Math.min(width * 0.34, height * 0.34, 260));
  newNodes.forEach(function (node, i) {
    var angle = -Math.PI / 2 + 2 * Math.PI * i / Math.max(1, newNodes.length);
    node.x = cx + radius * Math.cos(angle); node.y = cy + radius * Math.sin(angle);
  });
  var newLinks = [];
  newNodes.forEach(function (_, i) { if (i === 0) newLinks.push({ type: "StartLink", node: i, text: "" }); });
  groups.forEach(function (group) {
    var text = group.symbols.join(",");
    if (group.from === group.to) newLinks.push({ type: "SelfLink", node: group.from, text: text, anchorAngle: -Math.PI / 2 });
    else newLinks.push({ type: "Link", nodeA: group.from, nodeB: group.to, text: text, parallelPart: 0.5, perpendicularPart: 0, curvePoints: null });
  });
  flushHistory(); saveBackup();
  var baseName = Workspace.getActive() ? Workspace.getActive().name : "NFA";
  var newId = Workspace.create("DFA from " + baseName);
  Workspace.switchTo(newId);
  var data = { nodes: newNodes, links: newLinks, style: getStyle(), pages: pageCount, pageSize: pageSizeKey, margins: pageMarginsForExport(), constrainToMargins: constrainToMargins };
  Workspace.saveActive(data); deserializeState(data); History.reset(snapshotJSON()); draw();
  automataStatusMessage = "Created a DFA with " + subsets.length + " subset state(s) in the workspace.";
  refreshAutomataPanel(true);
}

function automataCreateWorkspace(name, generated, alphabet) {
  var width = pageWidthPx(), height = pageHeightPx();
  var count = generated.nodes.length;
  var columns = 4, rows = Math.max(5, Math.min(7, Math.ceil(count / (4 * MAX_PAGES))));
  var perPage = columns * rows;
  var generatedPages = Math.max(1, Math.ceil(count / perPage));
  var radius = nodeRadius;

  // Preserve Pyformlang's construction order. Its state IDs are qN, and
  // numeric ordering keeps the Thompson-NFA chains and branches local.
  var stateOrder = generated.nodes.map(function (_, i) { return i; });
  stateOrder.sort(function (a, b) {
    var an = String(generated.nodes[a].name || "q" + a), bn = String(generated.nodes[b].name || "q" + b);
    var am = /^(\D*)(\d+)$/.exec(an), bm = /^(\D*)(\d+)$/.exec(bn);
    if (am && bm && am[1] === bm[1]) return Number(am[2]) - Number(bm[2]);
    return an.localeCompare(bn) || a - b;
  });

  var marginLeft = pageMargins.left * PX_PER_INCH;
  var marginRight = pageMargins.right * PX_PER_INCH;
  var marginTop = pageMargins.top * PX_PER_INCH;
  var marginBottom = pageMargins.bottom * PX_PER_INCH;
  var safeX = Math.max(radius + 20, styleStateFontSize * 3.2);
  var safeY = radius + 20;
  var minX = marginLeft + safeX, maxX = width - marginRight - safeX;
  var minY = marginTop + safeY, maxY = height - marginBottom - safeY;
  if (maxX < minX) minX = maxX = width / 2;
  if (maxY < minY) minY = maxY = height / 2;
  var orderRank = new Array(count);
  stateOrder.forEach(function (state, rank) { orderRank[state] = rank; });
  function displayGeneratedStateName(name, index) {
    var value = String(name || ("q" + index));
    var match = /^q(\d+)$/i.exec(value);
    return match ? value.charAt(0) + "_{" + match[1] + "}" : value;
  }
  var generatedNodes = generated.nodes.map(function (node, i) {
    var orderIndex = orderRank[i];
    var page = Math.floor(orderIndex / perPage);
    var cell = orderIndex % perPage;
    var row = Math.floor(cell / columns);
    var col = cell % columns;
    if (row % 2) col = columns - 1 - col;
    var x = minX + (columns === 1 ? 0 : (maxX - minX) * col / (columns - 1));
    var y = page * height + minY + (rows === 1 ? 0 : (maxY - minY) * row / (rows - 1));
    return { text: displayGeneratedStateName(node.name, i), isAcceptState: !!node.accepting,
      x: x, y: y };
  });
  var generatedLinks = [];
  (generated.starts || []).forEach(function (i) { generatedLinks.push({ type: "StartLink", node: i, text: "", deltaX: 0, deltaY: -Math.max(50, nodeRadius * 2) }); });
  var grouped = new Map();
  (generated.edges || []).forEach(function (edge) {
    var key = edge.from + ":" + edge.to;
    if (!grouped.has(key)) grouped.set(key, { from: edge.from, to: edge.to, symbols: [] });
    var symbols = automataSplitLabel(edge.symbol);
    symbols.forEach(function (symbol) { if (grouped.get(key).symbols.indexOf(symbol) < 0) grouped.get(key).symbols.push(symbol); });
  });
  // Builds the same tent-shaped curvePoints link.js's _ensureCurvePoints()
  // would derive from a single perpendicularPart, so scoring and rendering
  // always agree on shape.
  function tentCurvePoints(base) {
    return [0.25, 0.5, 0.75].map(function (t) {
      return { t: t, perpendicular: base * (1 - Math.abs(2 * t - 1)) };
    });
  }
  // Mirrors link.js's Link.prototype.getEndPointsAndCircle bezier-segment math
  // exactly, so "does this clear the obstacle" is asked about the real curve.
  function bezierSegmentsFromRoute(route) {
    var segments = [];
    for (var si = 0; si < route.length - 1; si++) {
      var previous = route[Math.max(0, si - 1)], current = route[si];
      var next = route[si + 1], following = route[Math.min(route.length - 1, si + 2)];
      segments.push({
        startX: current.x, startY: current.y, endX: next.x, endY: next.y,
        control1X: current.x + (next.x - previous.x) / 6,
        control1Y: current.y + (next.y - previous.y) / 6,
        control2X: next.x - (following.x - current.x) / 6,
        control2Y: next.y - (following.y - current.y) / 6,
      });
    }
    return segments;
  }
  function sampleSegments(segments, perSeg) {
    var pts = [];
    segments.forEach(function (seg) {
      for (var i = 0; i <= perSeg; i++) {
        var t = i / perSeg, u = 1 - t;
        pts.push({
          x: u * u * u * seg.startX + 3 * u * u * t * seg.control1X + 3 * u * t * t * seg.control2X + t * t * t * seg.endX,
          y: u * u * u * seg.startY + 3 * u * u * t * seg.control1Y + 3 * u * t * t * seg.control2Y + t * t * t * seg.endY,
        });
      }
    });
    return pts;
  }
  function handlesFromCurvePoints(a, b, curvePoints) {
    var dx = b.x - a.x, dy = b.y - a.y, length = Math.sqrt(dx * dx + dy * dy) || 1;
    return curvePoints.map(function (p) {
      return { x: a.x + dx * p.t - (dy / length) * p.perpendicular, y: a.y + dy * p.t + (dx / length) * p.perpendicular };
    });
  }
  // Worst-case clearance (negative means it collides) of the curve actually
  // rendered by this set of curvePoints, sampled densely against obstacles.
  function realClearance(a, b, curvePoints, obstacles, radius, clearanceMargin) {
    var route = [a].concat(handlesFromCurvePoints(a, b, curvePoints), [b]);
    var segments = bezierSegmentsFromRoute(route);
    var pts = sampleSegments(segments, 20);
    var worst = Infinity;
    pts.forEach(function (p) {
      obstacles.forEach(function (node) {
        var d = Math.sqrt((p.x - node.x) * (p.x - node.x) + (p.y - node.y) * (p.y - node.y)) - radius - clearanceMargin;
        if (d < worst) worst = d;
      });
    });
    return worst;
  }
  function curveOffsetFor(source, target, linkIndex) {
    var a = generatedNodes[source], b = generatedNodes[target];
    var dx = b.x - a.x, dy = b.y - a.y;
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    var clearanceMargin = 8;
    var base = Math.max(20, radius * 0.8);
    var relevant = [];
    generatedNodes.forEach(function (node, i) {
      if (i === source || i === target) return;
      var ox = node.x - a.x, oy = node.y - a.y;
      var along = (ox * dx + oy * dy) / (length * length);
      if (along > -0.15 && along < 1.15) relevant.push(node);
    });
    if (!relevant.length) return 0;
    var preferredSign = (source < target ? 1 : -1) * (linkIndex % 2 ? -1 : 1);
    var signs = [preferredSign, -preferredSign];
    var maxBendCap = Math.min(width, height) * 0.4;
    for (var si = 0; si < signs.length; si++) {
      var sign = signs[si];
      for (var magnitude = base; magnitude <= maxBendCap; magnitude *= 1.25) {
        var candidate = tentCurvePoints(sign * magnitude);
        if (realClearance(a, b, candidate, relevant, radius, clearanceMargin) >= 0) return sign * magnitude;
      }
    }
    // Tight cluster where nothing fully clears: least-bad fallback rather than
    // an unbounded loop, so a pathological layout still produces something.
    return preferredSign * maxBendCap;
  }
  var curveIndex = 0;
  grouped.forEach(function (edge) {
    var label = edge.symbols.join(",");
    if (edge.from === edge.to) generatedLinks.push({ type: "SelfLink", node: edge.from, text: label, anchorAngle: -Math.PI / 2 });
    else generatedLinks.push({ type: "Link", nodeA: edge.from, nodeB: edge.to, text: label, parallelPart: 0.5,
      perpendicularPart: curveOffsetFor(edge.from, edge.to, curveIndex++), curvePoints: null });
  });
  flushHistory(); saveBackup();
  var newId = Workspace.create(name);
  Workspace.switchTo(newId);
  var data = { nodes: generatedNodes, links: generatedLinks, style: getStyle(), pages: generatedPages,
    pageSize: pageSizeKey, margins: pageMarginsForExport(), constrainToMargins: constrainToMargins };
  Workspace.saveActive(data); deserializeState(data);
  History.reset(snapshotJSON()); draw();
  try {
    localStorage.setItem("fsm-automata-type-" + newId, generated.type || "nfa");
    localStorage.setItem("fsm-automata-alphabet-" + newId, (alphabet || []).join(", "));
  } catch (e) {}
  automataStatusMessage = "Created " + name + " with " + generatedNodes.length + " states in the workspace.";
  refreshAutomataPanel(true);
}

function automataGenerateRegex() {
  var input = document.getElementById("automata-regex");
  var mode = document.getElementById("automata-regex-mode").value;
  var button = document.getElementById("automata-regex-create");
  var expression = input.value.trim();
  if (!expression) { automataStatusMessage = "Enter a regular expression first."; refreshAutomataPanel(true); return; }
  button.disabled = true;
  automataStatusMessage = "Generating an automaton with Pyformlang…"; refreshAutomataPanel(true);
  fetch("/api/automata/regex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regex: expression, mode: mode }) })
    .then(function (response) { return response.json().then(function (body) { if (!response.ok) throw new Error(body.error || "Regex conversion failed"); return body.automaton; }); })
    .then(function (generated) { automataCreateWorkspace("From regex: " + expression, generated, generated.alphabet); })
    .catch(function (error) { automataStatusMessage = error.message; refreshAutomataPanel(true); })
    .finally(function () { button.disabled = false; });
}

function automataShowRegularGrammar() {
  var model = automataBuildModel(), output = document.getElementById("automata-grammar");
  if (model.nodes.length === 0 || model.starts.length !== 1) {
    automataStatusMessage = "A regular grammar needs at least one state and exactly one start arrow.";
    refreshAutomataPanel(true); return;
  }
  var alternatives = model.nodes.map(function () { return []; });
  var hasUnlabeled = model.edges.some(function (edge) { return !edge.symbol; });
  if (hasUnlabeled) {
    automataStatusMessage = "Add an input symbol to every arrow before converting this FSM to a grammar.";
    refreshAutomataPanel(true); return;
  }
  model.edges.forEach(function (edge) {
    if (!edge.symbol || edge.from == null || edge.to == null || !alternatives[edge.from] || !alternatives[edge.to]) return;
    if (automataEpsilon(edge.symbol)) alternatives[edge.from].push("Q" + edge.to);
    else alternatives[edge.from].push(edge.symbol + " Q" + edge.to);
  });
  model.accepts.forEach(function (state) { alternatives[state].push("ε"); });
  output.textContent = alternatives.map(function (rules, i) { return "Q" + i + " → " + (rules.length ? rules.join(" | ") : "∅"); }).join("\n");
  output.hidden = false;
  automataStatusMessage = "Displayed an equivalent right-linear grammar; each Q-state corresponds to a state in this FSM.";
  refreshAutomataPanel(true);
}

function wireAutomataUI() {
  var mode = document.getElementById("automata-type"), alpha = document.getElementById("automata-alphabet");
  var validate = document.getElementById("automata-validate"), lean = document.getElementById("automata-lean"), convert = document.getElementById("automata-convert");
  var regexButton = document.getElementById("automata-regex-create"), grammarButton = document.getElementById("automata-to-grammar");
  if (!mode || mode.dataset.wired) return;
  mode.dataset.wired = "1";
  function saveSettings() {
    var id = Workspace.getActiveId();
    try { localStorage.setItem("fsm-automata-type-" + id, mode.value); localStorage.setItem("fsm-automata-alphabet-" + id, alpha.value); } catch (e) {}
    automataStatusMessage = "";
    refreshAutomataPanel(true);
  }
  mode.addEventListener("change", saveSettings);
  alpha.addEventListener("input", saveSettings);
  validate.addEventListener("click", function () { automataStatusMessage = ""; refreshAutomataPanel(true); });
  lean.addEventListener("click", function () {
    var model = automataBuildModel(), type = mode.value, report = automataAnalyze(model, type, automataAlphabet(model));
    if (!report.valid) { automataStatusMessage = "Resolve validation errors before Lean checking."; refreshAutomataPanel(true); return; }
    automataStatusMessage = "Checking this graph with PyPantograph…"; refreshAutomataPanel(true); lean.disabled = true;
    fetch("/api/lean/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ automaton: model, alphabet: report.alphabet, type: type }) })
      .then(function (response) { return response.json().then(function (body) { if (!response.ok) throw new Error(body.error || "Lean check failed"); return body; }); })
      .then(function (body) { automataStatusMessage = body.lean && body.lean.ok ? "PyPantograph verified the Lean model." : ((body.lean && body.lean.message) || "PyPantograph could not verify this graph."); refreshAutomataPanel(true); })
      .catch(function (error) { automataStatusMessage = "Lean check unavailable: " + error.message; refreshAutomataPanel(true); })
      .finally(function () { lean.disabled = false; });
  });
  convert.addEventListener("click", function () {
    try { automataConvertNfaToDfa(); }
    catch (error) { automataStatusMessage = error.message; refreshAutomataPanel(true); }
  });
  regexButton.addEventListener("click", automataGenerateRegex);
  grammarButton.addEventListener("click", automataShowRegularGrammar);
  refreshAutomataPanel(true);
}
