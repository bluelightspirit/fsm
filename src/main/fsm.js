var greekLetterNames = [
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "Epsilon",
  "Zeta",
  "Eta",
  "Theta",
  "Iota",
  "Kappa",
  "Lambda",
  "Mu",
  "Nu",
  "Xi",
  "Omicron",
  "Pi",
  "Rho",
  "Sigma",
  "Tau",
  "Upsilon",
  "Phi",
  "Chi",
  "Psi",
  "Omega",
];

function convertLatexShortcuts(text) {
  // html greek characters
  for (var i = 0; i < greekLetterNames.length; i++) {
    var name = greekLetterNames[i];
    text = text.replace(
      new RegExp("\\\\" + name, "g"),
      String.fromCharCode(913 + i + (i > 16)),
    );
    text = text.replace(
      new RegExp("\\\\" + name.toLowerCase(), "g"),
      String.fromCharCode(945 + i + (i > 16)),
    );
  }

  // subscripts
  for (var i = 0; i < 10; i++) {
    text = text.replace(
      new RegExp("_" + i, "g"),
      String.fromCharCode(8320 + i),
    );
  }

  return text;
}

function textToXML(text) {
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  var result = "";
  for (var i = 0; i < text.length; i++) {
    var c = text.charCodeAt(i);
    if (c >= 0x20 && c <= 0x7e) {
      result += text[i];
    } else {
      result += "&#" + c + ";";
    }
  }
  return result;
}

function drawArrow(c, x, y, angle) {
  var dx = Math.cos(angle);
  var dy = Math.sin(angle);
  c.beginPath();
  c.moveTo(x, y);
  var a = styleArrowSize;
  var b = (a * 5) / 8;
  c.lineTo(x - a * dx + b * dy, y - a * dy - b * dx);
  c.lineTo(x - a * dx - b * dy, y - a * dy + b * dx);
  c.fill();
}

function canvasHasFocus() {
  return (document.activeElement || document.body) == document.body;
}

function drawText(c, originalText, x, y, angleOrNull, isSelected) {
  text = convertLatexShortcuts(originalText);
  // state labels are drawn without an angle, line labels with one
  var fontSize = angleOrNull == null ? styleStateFontSize : styleLinkFontSize;
  c.font = styleFontCSS(fontSize);
  var segs = labelSegments(originalText);
  text = segs.map(function (s) { return s.t; }).join("");
  var width = richTextWidth(c, segs, fontSize);

  // center the text
  x -= width / 2;

  // position the text intelligently if given an angle
  if (angleOrNull != null) {
    var cos = Math.cos(angleOrNull);
    var sin = Math.sin(angleOrNull);
    var cornerPointX = (width / 2 + 5) * (cos > 0 ? 1 : -1);
    var cornerPointY = (fontSize / 2 + 5) * (sin > 0 ? 1 : -1);
    var slide =
      sin * Math.pow(Math.abs(sin), 40) * cornerPointX -
      cos * Math.pow(Math.abs(cos), 10) * cornerPointY;
    x += cornerPointX - sin * slide;
    y += cornerPointY + cos * slide;
  }

  // draw text and caret (round the coordinates so the caret falls on a pixel)
  if ("advancedFillText" in c) {
    c.advancedFillText(text, originalText, x + width / 2, y, angleOrNull);
  } else {
    x = Math.round(x);
    y = Math.round(y);
    drawRichSegments(c, segs, x, y + fontSize * 0.3, fontSize);
    if (isSelected && caretVisible && canvasHasFocus() && document.hasFocus()) {
      x += width;
      c.beginPath();
      c.moveTo(x, y - fontSize / 2);
      c.lineTo(x, y + fontSize / 2);
      c.stroke();
    }
  }
}

var caretTimer;
var caretVisible = true;

function resetCaret() {
  clearInterval(caretTimer);
  caretTimer = setInterval("caretVisible = !caretVisible; draw()", 500);
  caretVisible = true;
}

var canvas;
var nodeRadius = 30;
var nodes = [];
var links = [];

var cursorVisible = true;
var snapToPadding = 6; // pixels
var hitTargetPadding = 6; // pixels
var selectedObject = null; // either a Link or a Node
var currentLink = null; // a Link
var movingObject = false;
var originalClick;

function getDrawColors() {
  try {
    var s = getComputedStyle(document.body);
    var fg = (s.getPropertyValue("--canvas-fg") || "").trim();
    var sel = (s.getPropertyValue("--canvas-selected") || "").trim();
    return { fg: fg || "black", selected: sel || "blue" };
  } catch (e) {
    return { fg: "black", selected: "blue" };
  }
}

var EXPORT_COLORS = { fg: "black", selected: "black" };

function drawUsing(c, colors) {
  colors = colors || getDrawColors();
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.save();
  c.translate(0.5, 0.5);

  for (var i = 0; i < nodes.length; i++) {
    c.lineWidth = styleStateLineWidth;
    c.fillStyle = c.strokeStyle =
      nodes[i] == selectedObject ? colors.selected : colors.fg;
    nodes[i].draw(c);
  }
  for (var i = 0; i < links.length; i++) {
    c.lineWidth = styleLineWidth;
    c.fillStyle = c.strokeStyle =
      links[i] == selectedObject ? colors.selected : colors.fg;
    links[i].draw(c);
  }
  if (currentLink != null) {
    c.lineWidth = styleLineWidth;
    c.fillStyle = c.strokeStyle = colors.fg;
    currentLink.draw(c);
  }

  c.restore();
}

function draw() {
  drawUsing(canvas.getContext("2d"));
  saveBackup();
  if (typeof refreshNamesPanel === "function") refreshNamesPanel();
}

function selectObject(x, y) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].containsPoint(x, y)) {
      return nodes[i];
    }
  }
  for (var i = 0; i < links.length; i++) {
    if (links[i].containsPoint(x, y)) {
      return links[i];
    }
  }
  return null;
}

function snapNode(node) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i] == node) continue;

    if (Math.abs(node.x - nodes[i].x) < snapToPadding) {
      node.x = nodes[i].x;
    }

    if (Math.abs(node.y - nodes[i].y) < snapToPadding) {
      node.y = nodes[i].y;
    }
  }
}

window.onload = function () {
  canvas = document.getElementById("canvas");

  if (typeof Theme !== "undefined") Theme.init();
  Workspace.init();
  restoreBackup();
  History.reset(snapshotJSON());

  if (typeof wireUI === "function") wireUI();

  draw();

  canvas.onmousedown = function (e) {
    var mouse = crossBrowserRelativeMousePos(e);
    flushHistory();
    var previousSelection = selectedObject;
    selectedObject = selectObject(mouse.x, mouse.y);
    movingObject = false;
    labelDrag = null;
    if (e.altKey) {
      // Alt+drag moves the label of the clicked link, or of the selected link
      var target = selectedObject;
      if (target == null || target instanceof Node) target = previousSelection;
      if (target != null && !(target instanceof Node)) {
        selectedObject = target;
        labelDrag = {
          startX: mouse.x,
          startY: mouse.y,
          dx: target.labelDx || 0,
          dy: target.labelDy || 0,
          moved: false,
        };
        draw();
        return false;
      }
    }
    originalClick = mouse;

    if (selectedObject != null) {
      if (shift && selectedObject instanceof Node) {
        currentLink = new SelfLink(selectedObject, mouse);
      } else {
        movingObject = true;
        deltaMouseX = deltaMouseY = 0;
        if (selectedObject.setMouseStart) {
          selectedObject.setMouseStart(mouse.x, mouse.y);
        }
      }
      resetCaret();
    } else if (shift) {
      currentLink = new TemporaryLink(mouse, mouse);
    }

    draw();

    if (canvasHasFocus()) {
      // disable drag-and-drop only if the canvas is already focused
      return false;
    } else {
      // otherwise, let the browser switch the focus away from wherever it was
      resetCaret();
      return true;
    }
  };

  canvas.ondblclick = function (e) {
    var mouse = crossBrowserRelativeMousePos(e);
    flushHistory();
    if (e.altKey) {
      // Alt+double-click on a link resets its label to the default spot
      var hit = selectObject(mouse.x, mouse.y);
      if (hit != null && !(hit instanceof Node) && (hit.labelDx || hit.labelDy)) {
        selectedObject = hit;
        hit.labelDx = 0;
        hit.labelDy = 0;
        draw();
        commitHistory();
      }
      return;
    }
    selectedObject = selectObject(mouse.x, mouse.y);

    if (selectedObject == null) {
      selectedObject = new Node(mouse.x, mouse.y);
      nodes.push(selectedObject);
      resetCaret();
      draw();
      commitHistory();
    } else if (selectedObject instanceof Node) {
      selectedObject.isAcceptState = !selectedObject.isAcceptState;
      draw();
      commitHistory();
    }
  };

  canvas.onmousemove = function (e) {
    var mouse = crossBrowserRelativeMousePos(e);

    if (labelDrag != null && selectedObject != null) {
      selectedObject.labelDx = labelDrag.dx + (mouse.x - labelDrag.startX);
      selectedObject.labelDy = labelDrag.dy + (mouse.y - labelDrag.startY);
      labelDrag.moved = true;
      draw();
      return;
    }

    if (currentLink != null) {
      var targetNode = selectObject(mouse.x, mouse.y);
      if (!(targetNode instanceof Node)) {
        targetNode = null;
      }

      if (selectedObject == null) {
        if (targetNode != null) {
          currentLink = new StartLink(targetNode, originalClick);
        } else {
          currentLink = new TemporaryLink(originalClick, mouse);
        }
      } else {
        if (targetNode == selectedObject) {
          currentLink = new SelfLink(selectedObject, mouse);
        } else if (targetNode != null) {
          currentLink = new Link(selectedObject, targetNode);
        } else {
          currentLink = new TemporaryLink(
            selectedObject.closestPointOnCircle(mouse.x, mouse.y),
            mouse,
          );
        }
      }
      draw();
    }

    if (movingObject) {
      selectedObject.setAnchorPoint(mouse.x, mouse.y);
      if (selectedObject instanceof Node) {
        snapNode(selectedObject);
      }
      draw();
    }
  };

  canvas.onmouseup = function (e) {
    if (labelDrag != null) {
      var moved = labelDrag.moved;
      labelDrag = null;
      draw();
      if (moved) commitHistory();
      return;
    }
    var didChange = movingObject;
    movingObject = false;

    if (currentLink != null) {
      if (!(currentLink instanceof TemporaryLink)) {
        selectedObject = currentLink;
        links.push(currentLink);
        resetCaret();
        didChange = true;
      }
      currentLink = null;
      draw();
    }

    if (didChange) commitHistory();
  };
};

var shift = false;
var labelDrag = null; // active Alt+drag of a link label

function deleteSelected() {
  if (selectedObject == null) return;
  flushHistory();
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i] == selectedObject) {
      nodes.splice(i--, 1);
    }
  }
  for (var i = 0; i < links.length; i++) {
    if (
      links[i] == selectedObject ||
      links[i].node == selectedObject ||
      links[i].nodeA == selectedObject ||
      links[i].nodeB == selectedObject
    ) {
      links.splice(i--, 1);
    }
  }
  selectedObject = null;
  commitHistory();
  draw();
}

function clearAll() {
  if (nodes.length === 0 && links.length === 0) return;
  if (!confirm("Clear all states and arrows in this FSM?")) return;
  flushHistory();
  nodes.length = 0;
  links.length = 0;
  selectedObject = null;
  commitHistory();
  draw();
}

function performUndo() {
  flushHistory();
  var snap = History.undo();
  if (snap == null) return;
  loadSnapshotJSON(snap);
  saveBackup();
  draw();
}

function performRedo() {
  flushHistory();
  var snap = History.redo();
  if (snap == null) return;
  loadSnapshotJSON(snap);
  saveBackup();
  draw();
}

function isEditableTarget(target) {
  if (!target) return false;
  var tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable)
    return true;
  return false;
}

document.onkeydown = function (e) {
  var key = crossBrowserKey(e);
  var meta = e.metaKey || e.ctrlKey;
  var target = e.target || e.srcElement;

  // Global shortcuts (work regardless of focus, except in editable fields).
  if (meta && !isEditableTarget(target)) {
    if (key === 90 || key === 122) {
      // Z / z
      if (e.shiftKey) performRedo();
      else performUndo();
      e.preventDefault();
      return false;
    }
    if (key === 89 || key === 121) {
      // Y / y
      performRedo();
      e.preventDefault();
      return false;
    }
  }

  if (key == 16) {
    shift = true;
  } else if (!canvasHasFocus()) {
    // don't read keystrokes when other things have focus
    return true;
  } else if (key == 8) {
    // backspace
    if (meta) {
      // Cmd/Ctrl+Backspace = delete selected (treat like Delete key)
      deleteSelected();
    } else if (selectedObject != null && "text" in selectedObject) {
      selectedObject.text = selectedObject.text.substr(
        0,
        selectedObject.text.length - 1,
      );
      resetCaret();
      draw();
      commitHistoryDebounced();
    }

    // backspace is a shortcut for the back button, but do NOT want to change pages
    return false;
  } else if (key == 46) {
    // delete key
    deleteSelected();
  }
};

document.onkeyup = function (e) {
  var key = crossBrowserKey(e);

  if (key == 16) {
    shift = false;
  }
};

document.onkeypress = function (e) {
  // don't read keystrokes when other things have focus
  var key = crossBrowserKey(e);
  if (!canvasHasFocus()) {
    // don't read keystrokes when other things have focus
    return true;
  } else if (
    key >= 0x20 &&
    key <= 0x7e &&
    !e.metaKey &&
    !e.altKey &&
    !e.ctrlKey &&
    selectedObject != null &&
    "text" in selectedObject
  ) {
    selectedObject.text += String.fromCharCode(key);
    resetCaret();
    draw();
    commitHistoryDebounced();

    // don't let keys do their actions (like space scrolls down the page)
    return false;
  } else if (key == 8) {
    // backspace is a shortcut for the back button, but do NOT want to change pages
    return false;
  }
};

function crossBrowserKey(e) {
  e = e || window.event;
  return e.which || e.keyCode;
}

function crossBrowserElementPos(e) {
  e = e || window.event;
  var obj = e.target || e.srcElement;
  var x = 0,
    y = 0;
  while (obj.offsetParent) {
    x += obj.offsetLeft;
    y += obj.offsetTop;
    obj = obj.offsetParent;
  }
  return { x: x, y: y };
}

function crossBrowserMousePos(e) {
  e = e || window.event;
  return {
    x:
      e.pageX ||
      e.clientX +
        document.body.scrollLeft +
        document.documentElement.scrollLeft,
    y:
      e.pageY ||
      e.clientY + document.body.scrollTop + document.documentElement.scrollTop,
  };
}

function crossBrowserRelativeMousePos(e) {
  var element = crossBrowserElementPos(e);
  var mouse = crossBrowserMousePos(e);
  var x = mouse.x - element.x;
  var y = mouse.y - element.y;
  // Account for CSS scaling of the canvas (width:100%) so mouse maps to buffer coords.
  if (canvas) {
    var rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      x *= canvas.width / rect.width;
      y *= canvas.height / rect.height;
    }
  }
  return { x: x, y: y };
}

function saveAsPNG() {
  var oldSelectedObject = selectedObject;
  selectedObject = null;
  drawUsing(canvas.getContext("2d"), EXPORT_COLORS);
  selectedObject = oldSelectedObject;
  var pngData = canvas.toDataURL("image/png");
  draw(); // restore on-screen with theme colors
  var ok = downloadDataURL(activeFSMFileName("png"), pngData);
  if (ok) showToast("PNG downloaded");
  else showToast("Could not download PNG", "error");
}

function saveAsSVG() {
  var exporter = new ExportAsSVG();
  var oldSelectedObject = selectedObject;
  selectedObject = null;
  drawUsing(exporter, EXPORT_COLORS);
  selectedObject = oldSelectedObject;
  var svgData = exporter.toSVG();
  var ok = downloadBlob(
    activeFSMFileName("svg"),
    svgData,
    "image/svg+xml;charset=utf-8",
  );
  if (ok) showToast("SVG downloaded");
  else showToast("Could not download SVG", "error");
}

function saveAsLaTeX() {
  var exporter = new ExportAsLaTeX();
  var oldSelectedObject = selectedObject;
  selectedObject = null;
  drawUsing(exporter, EXPORT_COLORS);
  selectedObject = oldSelectedObject;
  var texData = exporter.toLaTeX();
  Promise.resolve(copyToClipboard(texData)).then(function (ok) {
    if (ok) showToast("LaTeX copied to clipboard");
    else showToast("Could not copy — clipboard blocked", "error");
  });
}


function saveAsTypst() {
  var exporter = new ExportAsTypst();
  var oldSelectedObject = selectedObject;
  selectedObject = null;
  drawUsing(exporter, EXPORT_COLORS);
  selectedObject = oldSelectedObject;
  var json = snapshotJSON();
  if (typeof json !== "string") json = JSON.stringify(json);
  var typData = exporter.toTypst(json);
  var ok = downloadBlob(
    activeFSMFileName("typ"),
    typData,
    "text/plain;charset=utf-8",
  );
  Promise.resolve(copyToClipboard(typData)).then(function (copied) {
    if (ok) showToast(copied ? "Typst downloaded and copied" : "Typst downloaded");
    else showToast("Could not download Typst", "error");
  });
}
