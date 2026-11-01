// DFA/NFA/Moore/Mealy analysis and conversion for the current canvas graph.
var automataPanelSignature = "";
var automataPanelWorkspaceId = null;
var automataStatusMessage = "";

function automataEpsilon(symbol) {
  return ["ε", "ϵ", "λ", "epsilon", "eps", "\\epsilon"].indexOf(String(symbol).trim().toLowerCase()) >= 0;
}

function automataSplitLabel(label) {
  return String(label || "").split(",").map(function (part) { return part.trim(); }).filter(Boolean);
}

function automataGrammarVariable(index) {
  var subscripts = "₀₁₂₃₄₅₆₇₈₉";
  return "Q" + String(index).replace(/[0-9]/g, function (digit) { return subscripts[Number(digit)]; });
}

function automataSelectedType() {
  var select = document.getElementById("automata-type");
  return select ? select.value : "dfa";
}

function automataTransitionParts(raw, type) {
  var text = String(raw || "");
  if (type !== "mealy") return { symbol: text.trim(), output: "" };
  var slash = text.indexOf("/");
  return slash < 0 ? { symbol: text.trim(), output: "" } : { symbol: text.slice(0, slash).trim(), output: text.slice(slash + 1).trim() };
}

function automataMooreParts(raw) {
  var text = String(raw || ""), slash = text.lastIndexOf("/");
  return slash < 0 ? { name: text.trim(), output: "" } : { name: text.slice(0, slash).trim(), output: text.slice(slash + 1).trim() };
}

function automataBuildModel() {
  var type = automataSelectedType();
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
    var parts = automataTransitionParts(edge.symbol, type), symbol = parts.symbol;
    if (symbol && !automataEpsilon(symbol) && inferred.indexOf(symbol) < 0) inferred.push(symbol);
  });
  inferred.sort();
  return {
    nodes: nodes.map(function (node, i) {
      var moore = type === "moore" ? automataMooreParts(node.text || "q" + i) : { name: node.text || "q" + i, output: "" };
      return { id: i, name: moore.name || "q" + i, output: moore.output, accepting: !!node.isAcceptState };
    }),
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
  var deterministicType = type === "dfa" || type === "moore" || type === "mealy";
  if (!n) errors.push("Add at least one state.");
  if (!model.starts.length) errors.push("No start arrow is assigned.");
  if (model.starts.length > 1) errors.push("There are " + model.starts.length + " start arrows; this machine type requires exactly one start state.");
  if ((type === "dfa" || type === "nfa") && !model.accepts.length) warnings.push("No accepting states: the machine accepts the empty language.");
  var epsilonCount = 0, emptyLabels = 0, invalidTargets = 0;
  var targets = new Map(), adjacency = Array.from({ length: n }, function () { return []; });
  model.edges.forEach(function (edge) {
    if (edge.from == null || edge.to == null || edge.from < 0 || edge.to < 0 || edge.from >= n || edge.to >= n) { invalidTargets++; return; }
    var parts = automataTransitionParts(edge.symbol, type);
    if (!parts.symbol || (type === "mealy" && !parts.output)) { emptyLabels++; return; }
    if (automataEpsilon(parts.symbol)) epsilonCount++;
    var key = edge.from + "\u0000" + parts.symbol;
    if (!targets.has(key)) targets.set(key, new Set());
    targets.get(key).add(type === "mealy" ? edge.to + "\u0001" + parts.output : edge.to);
    adjacency[edge.from].push({ to: edge.to, symbol: parts.symbol });
  });
  if (invalidTargets) errors.push(invalidTargets + " transition(s) point to a state that is no longer in the diagram.");
  if (emptyLabels) errors.push(type === "mealy" ? emptyLabels + " transition(s) need input/output labels, such as a/accept." : emptyLabels + " transition(s) have no input symbol.");
  if (type !== "nfa" && epsilonCount) errors.push("" + type.toUpperCase() + " machines cannot contain ε-transitions (" + epsilonCount + " found).");
  if (type === "moore" && model.nodes.some(function (node) { return !node.output; })) errors.push("Each Moore state needs an output in its label, such as q0/accept.");
  var alphabetSet = new Set(alphabet), outsideAlphabet = [];
  model.edges.forEach(function (edge) {
    var symbol = automataTransitionParts(edge.symbol, type).symbol;
    if (symbol && !automataEpsilon(symbol) && !alphabetSet.has(symbol) && outsideAlphabet.indexOf(symbol) < 0) outsideAlphabet.push(symbol);
  });
  if (outsideAlphabet.length) errors.push("Transition symbols outside the selected alphabet: " + outsideAlphabet.join(", ") + ".");
  var duplicateTransitions = [];
  targets.forEach(function (destinations, key) {
    if (destinations.size > 1) duplicateTransitions.push(key.split("\u0000")[0] + (type === "mealy" ? ": multiple outputs/destinations" : ": " + Array.from(destinations).map(function (i) { return model.nodes[i].name; }).join(" / ")));
  });
  var deterministic = duplicateTransitions.length === 0 && epsilonCount === 0;
  if (deterministicType && duplicateTransitions.length) errors.push(type.toUpperCase() + " is nondeterministic for " + duplicateTransitions.length + " state/symbol pair(s).");
  if (!alphabet.length && n) warnings.push("No input symbols are defined. Enter an alphabet above or add labeled arrows.");
  var missing = [];
  model.nodes.forEach(function (node) {
    alphabet.forEach(function (symbol) {
      var destinations = targets.get(node.id + "\u0000" + symbol);
      if (!destinations || destinations.size === 0) missing.push(node.name + " — " + symbol);
    });
  });
  if (deterministicType) {
    if (missing.length) errors.push(type.toUpperCase() + " is incomplete: " + missing.length + " transition(s) are missing.");
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
  var acceptanceStates = type === "moore" ? model.nodes.filter(function (node) { return node.output === "accept"; }).map(function (node) { return node.id; }) :
    type === "mealy" ? model.edges.filter(function (edge) { return automataTransitionParts(edge.symbol, type).output === "accept"; }).map(function (edge) { return edge.from; }) : model.accepts.slice();
  var canAccept = new Set(), back = acceptanceStates;
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
  var leanButton = document.getElementById("automata-lean");
  if (leanButton) {
    leanButton.disabled = false;
    leanButton.title = mode === "mealy"
      ? "Lean checks the DFA structure with final Mealy output 'accept' treated as acceptance; it does not prove conversion semantics."
      : mode === "moore"
        ? "Lean checks the DFA structure derived from Moore outputs, with 'accept' states accepting; it does not prove conversion semantics."
      : "Check the current machine's structural invariants with Lean.";
  }
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

function automataAcceptorFromModel(model, type, alphabet) {
  var transitions = model.edges.map(function (edge) {
    var parts = automataTransitionParts(edge.symbol, type);
    return { from: edge.from, to: edge.to, symbol: parts.symbol, output: parts.output };
  });
  if (type === "nfa") {
    var epsilonEdges = transitions.filter(function (edge) { return automataEpsilon(edge.symbol); });
    function closure(seed) {
      var set = new Set(seed), queue = seed.slice();
      while (queue.length) {
        var q = queue.shift();
        epsilonEdges.forEach(function (edge) { if (edge.from === q && !set.has(edge.to)) { set.add(edge.to); queue.push(edge.to); } });
      }
      return Array.from(set).sort(function (a, b) { return a - b; });
    }
    function setKey(set) { return set.join(","); }
    var subsets = [closure(model.starts)], subsetIds = new Map([[setKey(subsets[0]), 0]]), dfaEdges = [], cursor = 0;
    while (cursor < subsets.length) {
      var current = subsets[cursor];
      alphabet.forEach(function (symbol) {
        var moved = new Set();
        current.forEach(function (q) { transitions.forEach(function (edge) { if (edge.from === q && edge.symbol === symbol) moved.add(edge.to); }); });
        var target = closure(Array.from(moved)), key = setKey(target);
        if (!subsetIds.has(key)) {
          if (subsets.length >= 256) throw new Error("Subset construction exceeded 256 states; conversion stopped.");
          subsetIds.set(key, subsets.length); subsets.push(target);
        }
        dfaEdges.push({ from: cursor, to: subsetIds.get(key), symbol: symbol });
      });
      cursor++;
    }
    return {
      nodes: subsets.map(function (set, id) { return { id: id, name: "q" + id, accepting: set.some(function (q) { return model.nodes[q].accepting; }) }; }),
      starts: [0], accepts: subsets.map(function (set, id) { return set.some(function (q) { return model.nodes[q].accepting; }) ? id : -1; }).filter(function (id) { return id >= 0; }),
      edges: dfaEdges, alphabet: alphabet,
    };
  }
  if (type === "mealy") {
    var map = new Map(), states = [], edgesOut = [], nameCounts = new Map();
    function getState(q, accepts) {
      var key = q + ":" + (accepts ? "1" : "0");
      if (!map.has(key)) {
        if (states.length >= 512) throw new Error("Mealy conversion exceeded 512 states; conversion stopped.");
        var baseName = model.nodes[q].name, copy = nameCounts.get(baseName) || 0;
        nameCounts.set(baseName, copy + 1);
        map.set(key, states.length); states.push({ q: q, accepting: accepts, name: baseName + (copy ? "′" + (copy + 1) : "") });
      }
      return map.get(key);
    }
    var initial = getState(model.starts[0], false), cursor = 0;
    while (cursor < states.length) {
      var current = states[cursor];
      transitions.forEach(function (edge) {
        if (edge.from !== current.q || automataEpsilon(edge.symbol)) return;
        var target = getState(edge.to, edge.output === "accept");
        edgesOut.push({ from: cursor, to: target, symbol: edge.symbol });
      });
      cursor++;
    }
    return { nodes: states.map(function (state, id) { return { id: id, name: state.name, accepting: state.accepting }; }),
      starts: [initial], accepts: states.map(function (state, id) { return state.accepting ? id : -1; }).filter(function (id) { return id >= 0; }),
      edges: edgesOut, alphabet: alphabet };
  }

  var nodes = model.nodes.map(function (node, id) {
    var accepting = type === "moore" ? node.output === "accept" : node.accepting;
    return { id: id, name: node.name, accepting: accepting };
  });
  if (type === "moore") {
    return { nodes: nodes, starts: model.starts.slice(), accepts: nodes.filter(function (node) { return node.accepting; }).map(function (node) { return node.id; }),
      edges: transitions.map(function (edge) { return { from: edge.from, to: edge.to, symbol: edge.symbol }; }), alphabet: alphabet };
  }
  return { nodes: nodes, starts: model.starts.slice(), accepts: model.accepts.slice(),
    edges: transitions.map(function (edge) { return { from: edge.from, to: edge.to, symbol: edge.symbol }; }), alphabet: alphabet };
}

// Shared right-linear grammar representation. Moore outputs mark accepting
// states; Mealy terminals preserve input/output traces as pair symbols.
function automataBuildType3Grammar(model, type) {
  var rules = [], terminals = [], stateCount = model.nodes.length;
  var start = model.starts[0];
  function addTerminal(from, to, symbol) {
    rules.push({ from: from, to: to, symbol: symbol });
    if (symbol && terminals.indexOf(symbol) < 0) terminals.push(symbol);
  }
  model.edges.forEach(function (edge) {
    var parts = automataTransitionParts(edge.symbol, type), terminal = parts.symbol;
    if (type === "mealy") terminal += "/" + parts.output;
    if (type === "nfa" && automataEpsilon(parts.symbol)) terminal = "";
    addTerminal(edge.from, edge.to, terminal);
  });
  if (type === "mealy") {
    model.nodes.forEach(function (node) { addTerminal(node.id, null, ""); });
  } else if (type === "moore") {
    model.nodes.filter(function (node) { return node.output === "accept"; }).forEach(function (node) { addTerminal(node.id, null, ""); });
  } else {
    model.accepts.forEach(function (state) { addTerminal(state, null, ""); });
  }
  rules.sort(function (a, b) { return a.from - b.from || a.symbol.localeCompare(b.symbol) || (a.to == null ? -1 : a.to) - (b.to == null ? -1 : b.to); });
  return { stateCount: stateCount, start: start, freshStart: false, stateNames: model.nodes.map(function (node, id) { return node.name || "q_" + id; }), rules: rules, terminals: terminals.sort() };
}

function automataType3GrammarToNfa(grammar) {
  // A → aB becomes an a-edge; A → ε marks the variable-state accepting.
  var accepting = new Set(grammar.rules.filter(function (rule) { return rule.to == null && !rule.symbol; }).map(function (rule) { return rule.from; }));
  var edges = grammar.rules.filter(function (rule) { return rule.to != null; }).map(function (rule) {
    return { from: rule.from, to: rule.to, symbol: rule.symbol || "ε" };
  });
  return {
    nodes: Array.from({ length: grammar.stateCount }, function (_, id) { return { id: id, name: grammar.freshStart && id === grammar.start ? "S" : grammar.stateNames[id] || "q_" + id, accepting: accepting.has(id) }; }),
    starts: [grammar.start], accepts: Array.from(accepting).sort(function (a, b) { return a - b; }), edges: edges, alphabet: grammar.terminals,
  };
}

function automataType3GrammarToDfa(grammar) {
  return automataAcceptorFromModel(automataType3GrammarToNfa(grammar), "nfa", grammar.terminals);
}

// Convert Moore/Mealy acceptor semantics through a right-linear Type 3 grammar.
function automataOutputMachineToNfa(model, type, alphabet) {
  var acceptor = type === "mealy" ? automataAcceptorFromModel(model, "mealy", alphabet) : model;
  var grammar = automataBuildType3Grammar(acceptor, type === "moore" ? "moore" : "dfa");
  var nfa = automataType3GrammarToNfa(grammar);
  nfa.alphabet = grammar.terminals;
  return { grammar: grammar, nfa: nfa };
}

function automataMealyToMoore(model, alphabet) {
  var transitions = model.edges.map(function (edge) {
    var parts = automataTransitionParts(edge.symbol, "mealy");
    return { from: edge.from, to: edge.to, symbol: parts.symbol, output: parts.output };
  });
  var ids = new Map(), states = [], edges = [];
  function stateFor(q, output) {
    var key = q + "\u0000" + output;
    if (!ids.has(key)) {
      if (states.length >= 512) throw new Error("Mealy-to-Moore conversion exceeded 512 states; conversion stopped.");
      ids.set(key, states.length); states.push({ q: q, output: output, name: model.nodes[q].name + " / " + output });
    }
    return ids.get(key);
  }
  var start = stateFor(model.starts[0], "∅"), cursor = 0;
  while (cursor < states.length) {
    var current = states[cursor];
    transitions.forEach(function (edge) {
      if (edge.from !== current.q) return;
      edges.push({ from: cursor, to: stateFor(edge.to, edge.output), symbol: edge.symbol });
    });
    cursor++;
  }
  return { nodes: states.map(function (state, id) { return { id: id, name: state.name, accepting: false }; }), starts: [start], accepts: [], edges: edges, alphabet: alphabet };
}

function automataMooreToMealy(model, alphabet) {
  var edges = model.edges.map(function (edge) {
    var parts = automataTransitionParts(edge.symbol, "moore");
    return { from: edge.from, to: edge.to, symbol: parts.symbol + "/" + model.nodes[edge.to].output };
  });
  return { nodes: model.nodes.map(function (node) { return { id: node.id, name: node.name, accepting: false }; }),
    starts: model.starts.slice(), accepts: [], edges: edges, alphabet: alphabet };
}

function automataConvertMachine() {
  var model = automataBuildModel(), source = automataSelectedType();
  var target = document.getElementById("automata-convert-target").value, alphabet = automataAlphabet(model);
  var report = automataAnalyze(model, source, alphabet);
  if (!report.valid) { automataStatusMessage = "Fix validation errors before converting."; refreshAutomataPanel(true); return; }
  var result, emptyWordAccepted = false;
  if (source === "mealy" && target === "moore") result = automataMealyToMoore(model, alphabet);
  else if (source === "moore" && target === "mealy") result = automataMooreToMealy(model, alphabet);
  else if (source === target) result = {
    nodes: model.nodes.map(function (node) { return { id: node.id, name: source === "moore" ? node.name + " / " + node.output : node.name, accepting: node.accepting }; }),
    starts: model.starts.slice(), accepts: model.accepts.slice(),
    edges: model.edges.map(function (edge) { var p = automataTransitionParts(edge.symbol, source); return { from: edge.from, to: edge.to, symbol: source === "mealy" ? p.symbol + "/" + p.output : p.symbol }; }),
    alphabet: alphabet,
  };
  else if ((source === "moore" || source === "mealy") && (target === "dfa" || target === "nfa")) {
    var regular = automataOutputMachineToNfa(model, source, alphabet);
    result = target === "nfa" ? regular.nfa : automataAcceptorFromModel(regular.nfa, "nfa", regular.grammar.terminals);
  } else {
    var acceptor = automataAcceptorFromModel(model, source, alphabet);
    emptyWordAccepted = acceptor.accepts.indexOf(acceptor.starts[0]) >= 0;
    if (target === "nfa" || target === "dfa") result = acceptor;
    else if (target === "moore") {
      result = { nodes: acceptor.nodes.map(function (node) { return { id: node.id, name: node.name + " / " + (node.accepting ? "accept" : "reject"), accepting: false }; }),
        starts: acceptor.starts, accepts: [], edges: acceptor.edges, alphabet: alphabet };
    } else {
      result = { nodes: acceptor.nodes.map(function (node) { return { id: node.id, name: node.name, accepting: false }; }),
        starts: acceptor.starts, accepts: [],
        edges: acceptor.edges.map(function (edge) { var dest = acceptor.nodes[edge.to]; return { from: edge.from, to: edge.to, symbol: edge.symbol + "/" + (dest.accepting ? "accept" : "reject") }; }), alphabet: alphabet };
    }
  }
  result.type = target;
  var labels = { dfa: "DFA", nfa: "NFA", moore: "Moore machine", mealy: "Mealy machine" };
  automataCreateWorkspace(labels[target] + " from " + labels[source], result, result.alphabet || alphabet);
  var note = "Created a " + labels[target] + " in the workspace.";
  if (source === "mealy" && (target === "dfa" || target === "nfa")) note += " Converted through a right-linear Type 3 grammar over the input alphabet; its ε-productions mark accepting states. An 'accept' output on the final transition makes the state accepting; the empty word is rejected.";
  if (source === "moore" && (target === "dfa" || target === "nfa")) note += " Converted through a right-linear Type 3 grammar; Moore states outputting 'accept' produce ε and become accepting states.";
  if ((source === "moore" || source === "mealy") && target === "nfa") note += " (For a deterministic source, the resulting NFA may be identical to the DFA.)";
  if (source === "mealy" && target === "moore") note += " Moore's start state is labeled ∅ because Mealy machines emit no initial output.";
  if (source === "moore" && target === "mealy") note += " The initial Moore output has no matching Mealy transition, so only outputs produced after input symbols are preserved.";
  if ((source === "dfa" || source === "nfa") && (target === "moore" || target === "mealy")) note += " Outputs are 'accept' or 'reject' according to the acceptor state after each input.";
  if (target === "mealy" && emptyWordAccepted) note += " The source accepts the empty word, which a Mealy machine cannot represent because it emits no output before input.";
  automataStatusMessage = note;
  refreshAutomataPanel(true);
}

function automataCreateWorkspace(name, generated, alphabet) {
  var width = pageWidthPx(), height = pageHeightPx();
  var count = generated.nodes.length;
  var columns = 4, rows = Math.max(5, Math.min(7, Math.ceil(count / (4 * MAX_PAGES))));
  var perPage = columns * rows;
  var generatedPages = Math.max(1, Math.ceil(count / perPage));
  var radius = nodeRadius;

  // Preserve generated state numbering; numeric ordering keeps Thompson-NFA
  // chains and branches local in the diagram.
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
  var generatedType = generated.type || "nfa", generatedAlphabet = alphabet || [];
  try {
    localStorage.setItem("fsm-automata-type-" + newId, generatedType);
    localStorage.setItem("fsm-automata-alphabet-" + newId, generatedAlphabet.join(", "));
  } catch (e) {}
  Workspace.switchTo(newId);
  var data = { nodes: generatedNodes, links: generatedLinks, style: getStyle(), pages: generatedPages,
    pageSize: pageSizeKey, margins: pageMarginsForExport(), constrainToMargins: constrainToMargins };
  Workspace.saveActive(data); deserializeState(data);
  History.reset(snapshotJSON()); draw();
  var typeSelect = document.getElementById("automata-type"), alphabetInput = document.getElementById("automata-alphabet");
  if (typeSelect) typeSelect.value = generatedType;
  if (alphabetInput) alphabetInput.value = generatedAlphabet.join(", ");
  automataStatusMessage = "Created " + name + " with " + generatedNodes.length + " states in the workspace.";
  refreshAutomataPanel(true);
}

// Inserts the regex-syntax selector next to the existing mode dropdown the
// first time it's needed, since index.html doesn't define one. Mirrors how
// the style/names/import panels were built: created in JS, nothing to add
// to index.html by hand.
function ensureRegexSyntaxSelect() {
  var existing = document.getElementById("automata-regex-syntax");
  if (existing) return existing;
  var modeSelect = document.getElementById("automata-regex-mode");
  if (!modeSelect) return null;
  var select = document.createElement("select");
  select.id = "automata-regex-syntax";
  select.title = "Python-style (default): familiar regex sugar such as \\d, [a-z], ?. Formal (theory, experimental): textbook regex - every character is its own symbol, + or | is union, * is star, 'epsilon' or $ is the empty string.";
  [["python", "Python-style regex"], ["theory", "Formal (theory) regex (experimental)"]].forEach(function (pair) {
    var opt = document.createElement("option");
    opt.value = pair[0]; opt.textContent = pair[1];
    select.appendChild(opt);
  });
  select.style.marginLeft = "6px";
  modeSelect.insertAdjacentElement("afterend", select);
  ensureRegexLeanButton(select);
  return select;
}

// Lean verification currently only covers theory-syntax ep-NFA output
// (lean_regex_check.py's by-decide equality theorem against
// RegexNFA.compileRegex). DFA mode gets this disabled until the DFA path
// has its own proof mechanism, rather than a confusing failure message.
function ensureRegexLeanButton(syntaxSelect) {
  var existing = document.getElementById("automata-regex-lean");
  if (existing) return existing;
  var btn = document.createElement("button");
  btn.type = "button";
  btn.id = "automata-regex-lean";
  btn.textContent = "Verify with Lean";
  btn.style.marginLeft = "6px";
  btn.addEventListener("click", automataVerifyRegexWithLean);
  syntaxSelect.insertAdjacentElement("afterend", btn);

  function sync() {
    var modeSelect = document.getElementById("automata-regex-mode");
    var syntax = syntaxSelect.value;
    var mode = modeSelect ? modeSelect.value : "nfa";
    var supported = syntax === "theory" && (mode === "nfa" || mode === "dfa");
    btn.disabled = !supported;
    btn.title = supported
      ? "Check that Python and Lean agree exactly on this construction (\u03b5-NFA, plus the DFA step when DFA output is selected)"
      : "Regex-construction verification supports only formal syntax with ε-NFA or DFA output";
  }
  syntaxSelect.addEventListener("change", sync);
  var modeSelect = document.getElementById("automata-regex-mode");
  if (modeSelect) modeSelect.addEventListener("change", sync);
  sync();
  return btn;
}

function automataVerifyRegexWithLean() {
  var input = document.getElementById("automata-regex");
  var btn = document.getElementById("automata-regex-lean");
  var expression = input.value.trim();
  if (!expression) { automataStatusMessage = "Enter a regular expression first."; refreshAutomataPanel(true); return; }
  btn.disabled = true;
  automataStatusMessage = "Verifying this construction with Lean (this can take a while on a cold PyPantograph start)\u2026";
  refreshAutomataPanel(true);
  fetch("/api/automata/lean-regex-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ regex: expression, mode: (document.getElementById("automata-regex-mode") || {}).value || "nfa" }),
  })
    .then(function (response) { return response.json(); })
    .then(function (result) {
      automataStatusMessage = result.message || (result.ok ? "Lean verification succeeded." : "Lean verification failed.");
      refreshAutomataPanel(true);
    })
    .catch(function (error) {
      automataStatusMessage = "Lean verification request failed: " + error.message;
      refreshAutomataPanel(true);
    })
    .finally(function () {
      btn.disabled = false;
    });
}

function automataGenerateRegex() {
  var input = document.getElementById("automata-regex");
  var mode = document.getElementById("automata-regex-mode").value;
  var syntaxSelect = ensureRegexSyntaxSelect();
  var syntax = syntaxSelect ? syntaxSelect.value : "theory";
  var button = document.getElementById("automata-regex-create");
  var expression = input.value.trim();
  if (!expression) { automataStatusMessage = "Enter a regular expression first."; refreshAutomataPanel(true); return; }
  button.disabled = true;
  var engineLabel = syntax === "theory" ? "the experimental formal-theory engine" : "the Python-style engine";
  automataStatusMessage = "Generating an automaton with " + engineLabel + "…"; refreshAutomataPanel(true);
  fetch("/api/automata/regex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regex: expression, mode: mode, syntax: syntax }) })
    .then(function (response) { return response.json().then(function (body) { if (!response.ok) throw new Error(body.error || "Regex conversion failed"); return body.automaton; }); })
    .then(function (generated) {
      var tag = generated.experimental ? " [experimental formal-theory]" : " [python-style]";
      automataCreateWorkspace("From regex: " + expression + tag, generated, generated.alphabet);
      if (generated.type === "mealy" && generated.emptyWordAccepted) {
        automataStatusMessage = "Created the Mealy machine, but it cannot represent acceptance of the empty word because it emits no output before input.";
        refreshAutomataPanel(true);
      }
    })
    .catch(function (error) { automataStatusMessage = error.message; refreshAutomataPanel(true); })
    .finally(function () { button.disabled = false; });
}

function automataShowRegularGrammar() {
  var machineType = automataSelectedType(), model = automataBuildModel(), output = document.getElementById("automata-grammar");
  var grammarReport = automataAnalyze(model, machineType, automataAlphabet(model));
  if (machineType === "mealy") {
    var mealyReport = automataAnalyze(model, machineType, automataAlphabet(model));
    if (!mealyReport.valid) {
      automataStatusMessage = "Cannot display a deterministic Mealy trace grammar while the machine is invalid: " + mealyReport.errors.join(" ");
      output.hidden = true;
      refreshAutomataPanel(true); return;
    }
  }
  if (machineType === "moore" && model.nodes.some(function (node) { return !node.output; })) { automataStatusMessage = "Give every Moore state an output before converting."; refreshAutomataPanel(true); return; }
  if (machineType === "mealy" && model.edges.some(function (edge) { var p = automataTransitionParts(edge.symbol, machineType); return !p.symbol || !p.output; })) { automataStatusMessage = "Give every Mealy arrow an input/output label before converting."; refreshAutomataPanel(true); return; }
  if (model.nodes.length === 0 || model.starts.length !== 1) {
    automataStatusMessage = "A regular grammar needs at least one state and exactly one start arrow.";
    refreshAutomataPanel(true); return;
  }
  var grammar = automataBuildType3Grammar(model, machineType);
  var hasUnlabeled = model.edges.some(function (edge) { return !edge.symbol; });
  if (hasUnlabeled) {
    automataStatusMessage = "Add an input symbol to every arrow before converting this FSM to a grammar.";
    refreshAutomataPanel(true); return;
  }
  var reachable = new Set([grammar.start]), queue = [grammar.start];
  while (queue.length) {
    var current = queue.shift();
    grammar.rules.forEach(function (rule) {
      if (rule.from === current && rule.to != null && !reachable.has(rule.to)) { reachable.add(rule.to); queue.push(rule.to); }
    });
  }
  var generating = new Set(grammar.rules.filter(function (rule) { return rule.to == null && !rule.symbol; }).map(function (rule) { return rule.from; }));
  var changed = true;
  while (changed) {
    changed = false;
    grammar.rules.forEach(function (rule) {
      if (rule.to != null && generating.has(rule.to) && !generating.has(rule.from)) { generating.add(rule.from); changed = true; }
    });
  }
  var keptStates = Array.from(reachable).filter(function (id) { return generating.has(id); });
  if (keptStates.indexOf(grammar.start) < 0) keptStates.push(grammar.start);
  keptStates.sort(function (a, b) { return a - b; });
  keptStates = [grammar.start].concat(keptStates.filter(function (id) { return id !== grammar.start; }));
  var variableIds = new Map(keptStates.map(function (id, index) { return [id, index]; }));
  var alternatives = keptStates.map(function () { return []; });
  grammar.rules.forEach(function (rule) {
    if (!variableIds.has(rule.from)) return;
    if (rule.to == null && !rule.symbol) alternatives[variableIds.get(rule.from)].push("ε");
    else if (rule.to != null && variableIds.has(rule.to)) {
      alternatives[variableIds.get(rule.from)].push((rule.symbol ? rule.symbol + " " : "") + automataGrammarVariable(variableIds.get(rule.to)));
    }
  });
  output.textContent = alternatives.map(function (rules, i) { return automataGrammarVariable(i) + " → " + (rules.length ? rules.join(" | ") : "∅"); }).join("\n");
  output.hidden = false;
    automataStatusMessage = machineType === "mealy"
    ? "Displayed the right-linear trace grammar; each Mealy terminal is an input/output pair. Convert to DFA to get the accepted input language over the original alphabet."
    : machineType === "moore"
      ? "Displayed a right-linear grammar for the Moore machine's input language; states outputting 'accept' produce ε."
      : "Displayed an equivalent right-linear grammar; each Q-state corresponds to a state in this FSM.";
  if (machineType === "dfa" && grammarReport.dead.length) {
    automataStatusMessage += " Removed nonaccepting dead state(s) " + grammarReport.dead.join(", ") + " and rules leading only to them; they cannot generate a terminal word.";
  }
  refreshAutomataPanel(true);
}

// Kleene's construction: view the right-linear grammar as its equivalent FSM,
// add a fresh start/final pair, then eliminate the old state variables.
function automataRegexEmpty() { return { k: "empty" }; }
function automataRegexEps() { return { k: "eps" }; }
function automataRegexLit(s) { return { k: "lit", s: s }; }
function automataRegexAlt(a, b) {
  if (a.k === "empty") return b; if (b.k === "empty" || JSON.stringify(a) === JSON.stringify(b)) return a;
  return { k: "alt", a: a, b: b };
}
function automataRegexCat(a, b) {
  if (a.k === "empty" || b.k === "empty") return automataRegexEmpty();
  if (a.k === "eps") return b; if (b.k === "eps") return a;
  return { k: "cat", a: a, b: b };
}
function automataRegexStar(a) {
  if (a.k === "empty" || a.k === "eps") return automataRegexEps();
  if (a.k === "star") return a;
  return { k: "star", a: a };
}
function automataRegexRender(ast, syntax, parent) {
  parent = parent || 0;
  var prec = ast.k === "alt" ? 1 : ast.k === "cat" ? 2 : ast.k === "star" ? 3 : 4, s;
  if (ast.k === "empty") s = "∅";
  else if (ast.k === "eps") s = syntax === "theory" ? "ε" : "()";
  else if (ast.k === "lit") {
    var reserved = syntax === "theory" ? /[\\.|+*()$]/ : /[\\.^$|?*+()[\]{}]/;
    s = reserved.test(ast.s) ? "\\" + ast.s : ast.s;
  } else if (ast.k === "alt") s = automataRegexRender(ast.a, syntax, prec) + (syntax === "theory" ? "+" : "|") + automataRegexRender(ast.b, syntax, prec);
  else if (ast.k === "cat") s = automataRegexRender(ast.a, syntax, prec) + automataRegexRender(ast.b, syntax, prec);
  else s = automataRegexRender(ast.a, syntax, prec) + "*";
  return prec < parent ? "(" + s + ")" : s;
}

function automataMinimizeDfa(model, alphabet) {
  var n = model.nodes.length;
  if (!n || model.starts.length !== 1) return model;
  var transition = Array.from({ length: n }, function () { return new Map(); }), missing = false, invalid = false;
  model.edges.forEach(function (edge) {
    if (edge.from < 0 || edge.from >= n || edge.to < 0 || edge.to >= n) { invalid = true; return; }
    var row = transition[edge.from], previous = row.get(edge.symbol);
    if (previous != null && previous !== edge.to) invalid = true;
    row.set(edge.symbol, edge.to);
  });
  alphabet.forEach(function (symbol) { transition.forEach(function (row) { if (!row.has(symbol)) missing = true; }); });
  if (invalid) return model;
  var sink = missing ? n : -1, total = n + (missing ? 1 : 0);
  if (missing) {
    transition.push(new Map());
    alphabet.forEach(function (symbol) { transition[n].set(symbol, n); });
    for (var state = 0; state < n; state++) alphabet.forEach(function (symbol) { if (!transition[state].has(symbol)) transition[state].set(symbol, sink); });
  }
  var reachable = new Set(), queue = [model.starts[0]];
  while (queue.length) {
    var current = queue.shift();
    if (reachable.has(current) || current < 0 || current >= total) continue;
    reachable.add(current);
    alphabet.forEach(function (symbol) { queue.push(transition[current].get(symbol)); });
  }
  var accepting = new Set(model.accepts || []);
  model.nodes.forEach(function (node, id) { if (node.accepting) accepting.add(id); });
  var acceptingStates = [], rejectingStates = [];
  Array.from(reachable).forEach(function (id) { (accepting.has(id) ? acceptingStates : rejectingStates).push(id); });
  var groups = [];
  if (acceptingStates.length) groups.push(acceptingStates);
  if (rejectingStates.length) groups.push(rejectingStates);
  var blockOf = new Array(total).fill(-1);
  while (true) {
    groups.forEach(function (group, block) { group.forEach(function (id) { blockOf[id] = block; }); });
    var refined = [], signatures = new Map();
    groups.forEach(function (group) {
      group.forEach(function (id) {
        var signature = (accepting.has(id) ? "1" : "0") + "|" + alphabet.map(function (symbol) { return blockOf[transition[id].get(symbol)]; }).join(",");
        if (!signatures.has(signature)) { signatures.set(signature, []); refined.push(signatures.get(signature)); }
        signatures.get(signature).push(id);
      });
    });
    if (refined.length === groups.length) { groups = refined; break; }
    groups = refined;
  }
  groups.forEach(function (group, block) { group.forEach(function (id) { blockOf[id] = block; }); });
  var startBlock = blockOf[model.starts[0]], blockOrder = [startBlock], seenBlocks = new Set([startBlock]), cursor = 0;
  while (cursor < blockOrder.length) {
    var representative = groups[blockOrder[cursor]][0];
    alphabet.forEach(function (symbol) {
      var targetBlock = blockOf[transition[representative].get(symbol)];
      if (!seenBlocks.has(targetBlock)) { seenBlocks.add(targetBlock); blockOrder.push(targetBlock); }
    });
    cursor++;
  }
  var newId = new Map(blockOrder.map(function (block, id) { return [block, id]; }));
  var nodesOut = blockOrder.map(function (block, id) { return { id: id, name: "q" + id, accepting: accepting.has(groups[block][0]) }; });
  var acceptsOut = nodesOut.filter(function (node) { return node.accepting; }).map(function (node) { return node.id; });
  var edgesOut = [];
  blockOrder.forEach(function (block, id) {
    var representative = groups[block][0];
    alphabet.forEach(function (symbol) { edgesOut.push({ from: id, to: newId.get(blockOf[transition[representative].get(symbol)]), symbol: symbol }); });
  });
  return { nodes: nodesOut, starts: [0], accepts: acceptsOut, edges: edgesOut, alphabet: alphabet.slice() };
}

function automataShowRegex(syntax) {
  var machineType = automataSelectedType(), model = automataBuildModel(), output = document.getElementById("automata-grammar");
  var alphabet = automataAlphabet(model);
  if (machineType === "moore" && model.nodes.some(function (node) { return !node.output; })) { automataStatusMessage = "Give every Moore state an output before converting."; refreshAutomataPanel(true); return; }
  if (machineType === "mealy" && model.edges.some(function (edge) { var p = automataTransitionParts(edge.symbol, machineType); return !p.symbol || !p.output; })) { automataStatusMessage = "Give every Mealy arrow an input/output label before converting."; refreshAutomataPanel(true); return; }
  model = automataAcceptorFromModel(model, machineType, alphabet);
  model = automataMinimizeDfa(model, alphabet);
  if (!model.nodes.length || model.starts.length !== 1) {
    automataStatusMessage = "A regular expression needs at least one state and exactly one start arrow.";
    refreshAutomataPanel(true); return;
  }
  if (model.nodes.length > 48) {
    automataStatusMessage = "Regex conversion is limited to 48 FSM states to keep the expression manageable.";
    refreshAutomataPanel(true); return;
  }
  if (model.edges.some(function (e) { return !e.symbol || e.from == null || e.to == null; })) {
    automataStatusMessage = "Add a symbol to every arrow before converting the grammar to a regex.";
    refreshAutomataPanel(true); return;
  }
  if (model.edges.some(function (e) { return !automataEpsilon(e.symbol) && e.symbol.length !== 1; })) {
    automataStatusMessage = "Regex conversion currently requires each input symbol to be one character.";
    refreshAutomataPanel(true); return;
  }
  var n = model.nodes.length, start = n, accept = n + 1, R = Array.from({ length: n + 2 }, function () { return Array.from({ length: n + 2 }, automataRegexEmpty); });
  R[start][model.starts[0]] = automataRegexEps();
  model.accepts.forEach(function (q) { R[q][accept] = automataRegexEps(); });
  model.edges.forEach(function (e) {
    var label = automataEpsilon(e.symbol) ? automataRegexEps() : automataRegexLit(e.symbol);
    R[e.from][e.to] = automataRegexAlt(R[e.from][e.to], label);
  });
  var alive = Array.from({ length: n + 2 }, function (_, i) { return i; });
  for (var q = 0; q < n; q++) {
    var loop = automataRegexStar(R[q][q]);
    alive.forEach(function (i) {
      if (i === q || R[i][q].k === "empty") return;
      alive.forEach(function (j) {
        if (j === q || R[q][j].k === "empty") return;
        R[i][j] = automataRegexAlt(R[i][j], automataRegexCat(automataRegexCat(R[i][q], loop), R[q][j]));
      });
    });
    alive.forEach(function (i) { R[i][q] = automataRegexEmpty(); R[q][i] = automataRegexEmpty(); });
    alive = alive.filter(function (i) { return i !== q; });
  }
  var expression = automataRegexRender(R[start][accept], syntax);
  if (expression.length > 20000) {
    automataStatusMessage = "The equivalent regex exceeded 20,000 characters; simplify the FSM and try again.";
    refreshAutomataPanel(true); return;
  }
  output.textContent = (syntax === "theory" ? "Formal theory regex: " : "Python-style regex: ") + expression;
  output.hidden = false;
  automataStatusMessage = "Converted the equivalent right-linear grammar to a regular expression by state elimination.";
  refreshAutomataPanel(true);
}

function wireAutomataUI() {
  var mode = document.getElementById("automata-type"), alpha = document.getElementById("automata-alphabet");
  var validate = document.getElementById("automata-validate"), lean = document.getElementById("automata-lean"), convert = document.getElementById("automata-convert");
  var regexButton = document.getElementById("automata-regex-create"), grammarButton = document.getElementById("automata-to-grammar");
  var pythonRegexButton = document.getElementById("automata-to-regex-python"), theoryRegexButton = document.getElementById("automata-to-regex-theory");
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
    var leanModel = model, leanType = type, leanAlphabet = report.alphabet;
    if (type === "mealy" || type === "moore") {
      var outputGrammar = automataOutputMachineToNfa(model, type, report.alphabet);
      leanModel = automataAcceptorFromModel(outputGrammar.nfa, "nfa", outputGrammar.grammar.terminals);
      leanType = "dfa";
      leanAlphabet = outputGrammar.grammar.terminals;
    }
    automataStatusMessage = "Checking this graph with PyPantograph…"; refreshAutomataPanel(true); lean.disabled = true;
    fetch("/api/lean/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ automaton: leanModel, alphabet: leanAlphabet, type: leanType }) })
      .then(function (response) { return response.json().then(function (body) { if (!response.ok) throw new Error(body.error || "Lean check failed"); return body; }); })
      .then(function (body) {
        if (body.lean && body.lean.ok) automataStatusMessage = (type === "moore" || type === "mealy")
          ? "Lean checked the DFA structure derived through the machine's right-linear Type 3 grammar; it did not prove the conversion semantics."
          : "PyPantograph verified the Lean model.";
        else automataStatusMessage = (body.lean && body.lean.message) || "PyPantograph could not verify this graph.";
        refreshAutomataPanel(true);
      })
      .catch(function (error) { automataStatusMessage = "Lean check unavailable: " + error.message; refreshAutomataPanel(true); })
      .finally(function () { lean.disabled = false; });
  });
  convert.addEventListener("click", function () {
    try { automataConvertMachine(); }
    catch (error) { automataStatusMessage = error.message; refreshAutomataPanel(true); }
  });
  ensureRegexSyntaxSelect();
  regexButton.addEventListener("click", automataGenerateRegex);
  grammarButton.addEventListener("click", automataShowRegularGrammar);
  pythonRegexButton.addEventListener("click", function () { automataShowRegex("python"); });
  theoryRegexButton.addEventListener("click", function () { automataShowRegex("theory"); });
  refreshAutomataPanel(true);
}
