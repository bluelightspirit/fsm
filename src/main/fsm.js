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
  // State and arrow labels can contain explicit line breaks via Shift+Enter.
  var fontSize = angleOrNull == null ? styleStateFontSize : styleLinkFontSize;
  var lines = String(originalText).split(/\r?\n/);
  var lineSegments = [], widths = [], width = 0;
  for (var li = 0; li < lines.length; li++) {
    var segs = labelSegments(lines[li]);
    lineSegments.push(segs);
    widths.push(richTextWidth(c, segs, fontSize));
    width = Math.max(width, widths[li]);
  }

  // Keep a center anchor so each explicit line can be centered independently.
  var centerX = x;

  // position the text intelligently if given an angle
  if (angleOrNull != null) {
    var cos = Math.cos(angleOrNull);
    var sin = Math.sin(angleOrNull);
    var cornerPointX = (width / 2 + 5) * (cos > 0 ? 1 : -1);
    var cornerPointY = (fontSize / 2 + 5) * (sin > 0 ? 1 : -1);
    var slide =
      sin * Math.pow(Math.abs(sin), 40) * cornerPointX -
      cos * Math.pow(Math.abs(cos), 10) * cornerPointY;
    centerX += cornerPointX - sin * slide;
    y += cornerPointY + cos * slide;
  }

  // Draw each line centered around the same anchor.
  var lastCaretX = centerX, lastCaretY = y;
  for (var line = 0; line < lines.length; line++) {
    var offset = (line - (lines.length - 1) / 2) * fontSize * 1.15;
    var lineX = centerX, lineY = y + offset;
    if (angleOrNull != null) {
      lineX -= Math.sin(angleOrNull) * offset;
      lineY = y + Math.cos(angleOrNull) * offset;
    }
    if ("advancedFillText" in c) {
      c.advancedFillText(lines[line], lines[line], lineX, lineY, angleOrNull);
    } else {
      var startX = Math.round(lineX - widths[line] / 2);
      var baselineY = Math.round(lineY + fontSize * 0.3);
      drawRichSegments(c, lineSegments[line], startX, baselineY, fontSize);
      if (line === lines.length - 1) { lastCaretX = startX + widths[line]; lastCaretY = lineY; }
    }
  }
  if (isSelected && textEntryActive && caretVisible && canvasHasFocus() && document.hasFocus() && !("advancedFillText" in c)) {
    c.beginPath();
    c.moveTo(Math.round(lastCaretX), Math.round(lastCaretY - fontSize / 2));
    c.lineTo(Math.round(lastCaretX), Math.round(lastCaretY + fontSize / 2));
    c.stroke();
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

function drawUsing(c, colors, ignoreMarginClip) {
  colors = colors || getDrawColors();
  var editorContext = c.canvas === canvas && typeof c.scale === "function";
  var ratio = editorContext && typeof editorPixelRatio === "function" ? editorPixelRatio() : 1;
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.save();
  if (editorContext) c.scale(ratio, ratio);
  c.translate(0.5, 0.5);
  if (!ignoreMarginClip && constrainToMargins && typeof c.rect === "function" && typeof c.clip === "function") {
    c.beginPath();
    for (var p = 0; p < pageCount; p++) {
      c.rect(pageMargins.left * PX_PER_INCH, p * pageHeightPx() + pageMargins.top * PX_PER_INCH,
        pageWidthPx() - (pageMargins.left + pageMargins.right) * PX_PER_INCH,
        pageHeightPx() - (pageMargins.top + pageMargins.bottom) * PX_PER_INCH);
    }
    c.clip();
  }

  function drawNode(node, yOffset) {
    c.lineWidth = styleStateLineWidth;
    c.fillStyle = c.strokeStyle = node == selectedObject ? colors.selected : colors.fg;
    var originalY = node.y;
    node.y += yOffset;
    node.draw(c);
    node.y = originalY;
  }
  if (constrainToMargins) {
    var ph = pageHeightPx();
    var topInset = pageMargins.top * PX_PER_INCH;
    var bottomInset = pageMargins.bottom * PX_PER_INCH;
    var seamGap = (pageMargins.top + pageMargins.bottom) * PX_PER_INCH;
    for (var page = 0; page < pageCount; page++) {
      if (typeof c.beginNodeClip === "function") {
        c.beginNodeClip(page, pageMargins, PX_PER_INCH, pageWidthPx(), ph);
      } else if (typeof c.rect === "function" && typeof c.clip === "function") {
        c.save();
        c.beginPath();
        c.rect(pageMargins.left * PX_PER_INCH, page * ph + topInset,
          pageWidthPx() - (pageMargins.left + pageMargins.right) * PX_PER_INCH,
          ph - topInset - bottomInset);
        c.clip();
      }
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var reach = Math.max(nodeRadius, styleStateFontSize * 0.75) + 2;
        drawNode(node, 0); // the state’s ordinary position on this page
        if (page > 0) {
          var priorBottom = page * ph - bottomInset;
          if (Math.abs(node.y - priorBottom) <= reach) drawNode(node, seamGap);
        }
        if (page + 1 < pageCount) {
          var nextTop = (page + 1) * ph + topInset;
          if (Math.abs(node.y - nextTop) <= reach) drawNode(node, -seamGap);
        }
      }
      if (typeof c.endNodeClip === "function") c.endNodeClip();
      else if (typeof c.rect === "function" && typeof c.clip === "function") c.restore();
    }
  } else {
    for (var j = 0; j < nodes.length; j++) drawNode(nodes[j], 0);
  }
  var arrowClip = false;
  if (constrainToMargins && !ignoreMarginClip && typeof c.beginArrowClip === "function") {
    c.beginArrowClip(pageCount, pageMargins, PX_PER_INCH, pageWidthPx(), pageHeightPx());
    arrowClip = true;
  }
  for (var i = 0; i < links.length; i++) {
    c.lineWidth = styleLineWidth;
    c.fillStyle = c.strokeStyle =
      links[i] == selectedObject ? colors.selected : colors.fg;
    links[i].draw(c);
  }
  if (arrowClip) c.endArrowClip();
  if (currentLink != null) {
    c.lineWidth = styleLineWidth;
    c.fillStyle = c.strokeStyle = colors.fg;
    currentLink.draw(c);
  }

  c.restore();
  // Editor handles stay visible and draggable in the margin gaps; the
  // diagram strokes themselves remain clipped to each printable page.
  if (editorContext && showCurveHandles) {
    var editorCtx = canvas.getContext("2d");
    editorCtx.save();
    editorCtx.scale(ratio, ratio);
    editorCtx.translate(0.5, 0.5);
    if (selectedObject instanceof Link && selectedObject.getEndPointsAndCircle().hasCurve) selectedObject.drawCurveHandles(editorCtx);
    editorCtx.restore();
  }
}

function draw() {
  drawUsing(canvas.getContext("2d"), null, false);
  drawPageGuides(canvas.getContext("2d"));
  saveBackup();
  if (typeof refreshNamesPanel === "function") refreshNamesPanel();
  if (typeof syncPagesUI === "function") syncPagesUI();
}

function selectObject(x, y, extraTolerance, preferLinks) {
  extraTolerance = extraTolerance || 0;
  if (preferLinks) {
    for (var li = links.length - 1; li >= 0; li--) {
      if (links[li].containsPoint(x, y, extraTolerance)) return links[li];
    }
  }
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].containsPoint(x, y, extraTolerance)) {
      return nodes[i];
    }
  }
  for (var i = 0; i < links.length; i++) {
    if (links[i].containsPoint(x, y, extraTolerance)) {
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
    var shiftDown = !!(e.shiftKey || shift);
    if (pendingArrowSource != null && !shiftDown) {
      var pendingTarget = selectObject(mouse.x, mouse.y);
      if (pendingTarget instanceof Node) {
        if (pendingTarget !== pendingArrowSource) {
          var completedLink = new Link(pendingArrowSource, pendingTarget);
          links.push(completedLink);
          selectedObject = completedLink;
          textEntryActive = true;
          pendingArrowSource = null;
          movingObject = false;
          currentLink = null;
          resetCaret();
          draw();
          commitHistory();
          return false;
        }
        pendingArrowSource = null;
      } else {
        pendingArrowSource = null;
      }
    }
    if (showCurveHandles && !shiftDown && !e.ctrlKey && !e.metaKey) {
      for (var hi = links.length - 1; hi >= 0; hi--) {
        var handleIndex = links[hi].getCurveHandleAt(mouse.x, mouse.y);
        if (handleIndex >= 0) {
          selectedObject = links[hi];
          textEntryActive = false;
          curveHandleDrag = { link: selectedObject, index: handleIndex };
          movingObject = false;
          labelDrag = null;
          draw();
          return false;
        }
      }
    }
    var previousSelection = selectedObject;
    var preciseEditClick = !!(e.ctrlKey || e.metaKey);
    selectedObject = selectObject(mouse.x, mouse.y, preciseEditClick ? 18 : 0, preciseEditClick);
    textEntryActive = selectedObject != null && !shiftDown;
    movingObject = false;
    objectDragStarted = false;
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
      if (shiftDown && selectedObject instanceof Node) {
        textEntryActive = false;
        currentLink = new SelfLink(selectedObject, mouse);
        linkGestureSource = selectedObject;
        linkGestureMoved = false;
      } else {
        movingObject = true;
        objectDragStarted = false;
        deltaMouseX = deltaMouseY = 0;
        if (selectedObject.setMouseStart) {
          selectedObject.setMouseStart(mouse.x, mouse.y);
        }
      }
      resetCaret();
    } else if (shiftDown) {
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
      if (constrainToMargins) {
        var allowed = clampNodePosition(mouse.x, mouse.y);
        mouse = allowed;
      }
      selectedObject = new Node(mouse.x, mouse.y);
      textEntryActive = true;
      nodes.push(selectedObject);
      resetCaret();
      draw();
      commitHistory();
    } else if (selectedObject instanceof Node) {
      selectedObject.isAcceptState = !selectedObject.isAcceptState;
      textEntryActive = true;
      draw();
      commitHistory();
    } else if (selectedObject != null && "text" in selectedObject) {
      textEntryActive = true;
      resetCaret();
      draw();
    }
  };

  canvas.onmousemove = function (e) {
    var mouse = crossBrowserRelativeMousePos(e);

    if (curveHandleDrag != null) {
      curveHandleDrag.link.moveCurveHandle(curveHandleDrag.index, mouse.x, mouse.y);
      draw();
      return;
    }

    if (labelDrag != null && selectedObject != null) {
      var labelPoint = constrainToMargins ? clampToPrintable(mouse.x, mouse.y, styleLinkFontSize * 2) : mouse;
      selectedObject.labelDx = labelDrag.dx + (labelPoint.x - labelDrag.startX);
      selectedObject.labelDy = labelDrag.dy + (labelPoint.y - labelDrag.startY);
      labelDrag.moved = true;
      draw();
      return;
    }

    if (currentLink != null) {
      if (Math.hypot(mouse.x - originalClick.x, mouse.y - originalClick.y) > 3) linkGestureMoved = true;
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
      if (!objectDragStarted && Math.hypot(mouse.x - originalClick.x, mouse.y - originalClick.y) <= 3) return;
      objectDragStarted = true;
      textEntryActive = false;
      selectedObject.setAnchorPoint(mouse.x, mouse.y);
      if (selectedObject instanceof Node) {
        snapNode(selectedObject);
        constrainNodeToMargins(selectedObject);
      }
      draw();
    }
  };

  canvas.onmouseup = function (e) {
    if (linkGestureSource != null) {
      var up = crossBrowserRelativeMousePos(e);
      var target = selectObject(up.x, up.y);
      if (target instanceof Node) {
        var completed = target === linkGestureSource ? new SelfLink(target, up) : new Link(linkGestureSource, target);
        links.push(completed);
        selectedObject = completed;
        textEntryActive = true;
        currentLink = null;
        pendingArrowSource = null;
        resetCaret();
        draw();
        commitHistory();
      } else if (!linkGestureMoved) {
        pendingArrowSource = linkGestureSource;
        currentLink = null;
        draw();
      } else {
        currentLink = null;
        draw();
      }
      linkGestureSource = null;
      linkGestureMoved = false;
      return;
    }
    if (curveHandleDrag != null) {
      curveHandleDrag = null;
      draw();
      commitHistory();
      return;
    }
    if (labelDrag != null) {
      var moved = labelDrag.moved;
      labelDrag = null;
      draw();
      if (moved) commitHistory();
      return;
    }
    var didChange = objectDragStarted;
    movingObject = false;
    objectDragStarted = false;

    if (currentLink != null) {
      if (!(currentLink instanceof TemporaryLink)) {
        selectedObject = currentLink;
        links.push(currentLink);
        textEntryActive = true;
        if (constrainToMargins && currentLink instanceof SelfLink) constrainNodeToMargins(currentLink.node);
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
var curveHandleDrag = null;
var linkGestureSource = null;
var linkGestureMoved = false;
var pendingArrowSource = null;
var textEntryActive = false;
var objectDragStarted = false;

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

  if (key === 27 && !isEditableTarget(target)) {
    selectedObject = null;
    currentLink = null;
    movingObject = false;
    objectDragStarted = false;
    labelDrag = null;
    curveHandleDrag = null;
    linkGestureSource = null;
    linkGestureMoved = false;
    pendingArrowSource = null;
    textEntryActive = false;
    resetCaret();
    draw();
    e.preventDefault();
    return false;
  }

  if (key === 13 && !isEditableTarget(target) && canvasHasFocus() && selectedObject != null && "text" in selectedObject) {
    if (e.shiftKey) {
      selectedObject.text += "\n";
      textEntryActive = true;
      resetCaret();
      draw();
      commitHistoryDebounced();
      e.preventDefault();
      return false;
    }
    // Enter toggles label editing. After Enter ends typing, another Enter
    // reopens an empty or existing state/arrow label for typing again.
    textEntryActive = !textEntryActive;
    resetCaret();
    draw();
    e.preventDefault();
    return false;
  }

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
    textEntryActive &&
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
      x *= pageWidthPx() / rect.width;
      y *= (pageHeightPx() * pageCount) / rect.height;
    }
  }
  return { x: x, y: y };
}

function saveAsPNG() {
  var shouldCopy = exportCopyEnabled(), shouldDownload = exportDownloadEnabled();
  if (!shouldCopy && !shouldDownload) { showToast("Select Copy export, Download export, or both", "error"); return; }
  var oldSelectedObject = selectedObject;
  selectedObject = null;
  var exportScale = (typeof selectedExportPpi === "function" ? selectedExportPpi() : 96) / 96;
  var ok = true;
  if (!exportPaged()) {
    var fullCanvas = document.createElement("canvas");
    fullCanvas.width = Math.round(pageWidthPx() * exportScale); fullCanvas.height = Math.round(pageHeightPx() * pageCount * exportScale);
    var wasLocked = constrainToMargins; constrainToMargins = false;
    var fullCtx = fullCanvas.getContext("2d"); fullCtx.scale(exportScale, exportScale);
    drawUsing(fullCtx, EXPORT_COLORS, true);
    constrainToMargins = wasLocked;
    selectedObject = oldSelectedObject;
    draw();
    var fullOk = !shouldDownload || downloadDataURL(activeFSMFileName("png"), fullCanvas.toDataURL("image/png"));
    if (shouldCopy) copyPNGCanvasToClipboard(fullCanvas).then(function (copied) {
      if (shouldDownload && fullOk && copied) showToast("Full diagram PNG downloaded and copied");
      else if (shouldDownload && fullOk) showToast("Full diagram PNG downloaded; clipboard copy unavailable");
      else if (copied) showToast("Full diagram PNG copied");
      else showToast("Could not copy PNG image", "error");
    });
    else if (fullOk) showToast("Full diagram PNG downloaded"); else showToast("Could not download PNG", "error");
    return;
  }
  var firstPageCanvas = null;
  for (var p = 0; p < pageCount; p++) {
    var pageCanvas = document.createElement("canvas");
    pageCanvas.width = Math.round(pageWidthPx() * exportScale);
    pageCanvas.height = Math.round(pageHeightPx() * exportScale);
    var ctx = pageCanvas.getContext("2d");
    ctx.scale(exportScale, exportScale);
    ctx.translate(0, -p * pageHeightPx());
    // The paper edge clips exports; margin guides do not clip connector paths.
    drawUsing(ctx, EXPORT_COLORS, false);
    var suffix = pageCount > 1 ? "-" + (p + 1) : "";
    if (p === 0) firstPageCanvas = pageCanvas;
    if (shouldDownload) ok = downloadDataURL(activeFSMFileName("png").replace(/\.png$/i, suffix + ".png"), pageCanvas.toDataURL("image/png")) && ok;
  }
  selectedObject = oldSelectedObject;
  draw();
  if (shouldCopy) copyPNGCanvasToClipboard(firstPageCanvas).then(function (copied) {
    if (shouldDownload && ok && copied) showToast(pageCount > 1 ? pageCount + " PNG pages downloaded; page 1 copied" : "PNG downloaded and copied");
    else if (shouldDownload && ok) showToast(pageCount > 1 ? pageCount + " PNG pages downloaded; clipboard copy unavailable" : "PNG downloaded; clipboard copy unavailable");
    else if (copied) showToast(pageCount > 1 ? "PNG page 1 copied" : "PNG copied");
    else showToast("Could not copy PNG image", "error");
  });
  else if (shouldDownload && ok) showToast(pageCount > 1 ? pageCount + " PNG pages downloaded" : "PNG downloaded");
  else if (shouldDownload) showToast("Could not download PNG", "error");
}

function saveAsSVG() {
  var shouldCopy = exportCopyEnabled(), shouldDownload = exportDownloadEnabled();
  if (!shouldCopy && !shouldDownload) { showToast("Select Copy export, Download export, or both", "error"); return; }
  var exporter = new ExportAsSVG();
  var oldSelectedObject = selectedObject;
  selectedObject = null;
  var wasLocked = constrainToMargins; constrainToMargins = exportPaged() && wasLocked;
  drawUsing(exporter, EXPORT_COLORS);
  constrainToMargins = wasLocked;
  selectedObject = oldSelectedObject;
  var svgPaged = exportPaged();
  var ok = true;
  var firstSvg = "";
  if (svgPaged) {
    for (var p = 0; p < pageCount; p++) {
      var pageSvg = exporter.toSVG(pageCount, pageMarginsForExport(), constrainToMargins, true, p);
      if (p === 0) firstSvg = pageSvg;
      var base = activeFSMFileName("svg").replace(/\.svg$/i, "");
      if (shouldDownload) ok = downloadBlob(base + (pageCount > 1 ? "-" + (p + 1) : "") + ".svg", pageSvg, "image/svg+xml;charset=utf-8") && ok;
    }
  } else {
    firstSvg = exporter.toSVG(pageCount, pageMarginsForExport(), false, false);
    if (shouldDownload) ok = downloadBlob(activeFSMFileName("svg"), firstSvg, "image/svg+xml;charset=utf-8");
  }
  Promise.resolve(shouldCopy ? copyToClipboard(firstSvg) : false).then(function (copied) {
    if (shouldDownload && ok && shouldCopy && copied) showToast(svgPaged && pageCount > 1 ? "SVG pages downloaded; page 1 source copied" : "SVG downloaded and source copied");
    else if (shouldDownload && ok) showToast(svgPaged && pageCount > 1 ? "SVG pages downloaded" : "SVG downloaded");
    else if (shouldDownload) showToast("Could not download SVG", "error");
    else if (copied) showToast(svgPaged && pageCount > 1 ? "SVG page 1 source copied" : "SVG source copied");
    else showToast("Could not copy SVG source", "error");
  });
}

function saveAsLaTeX() {
  var shouldCopy = exportCopyEnabled(), shouldDownload = exportDownloadEnabled();
  if (!shouldCopy && !shouldDownload) { showToast("Select Copy export, Download export, or both", "error"); return; }
  var exporter = new ExportAsLaTeX();
  var oldSelectedObject = selectedObject;
  selectedObject = null;
  var wasLocked = constrainToMargins; constrainToMargins = exportPaged() && wasLocked;
  drawUsing(exporter, EXPORT_COLORS);
  constrainToMargins = wasLocked;
  selectedObject = oldSelectedObject;
  var texData = exporter.toLaTeX(snapshotJSON(), exportStandalone(), pageCount, pageMarginsForExport(), constrainToMargins, exportPaged());
  var downloaded = !shouldDownload || downloadBlob(activeFSMFileName("tex"), texData, "text/plain;charset=utf-8");
  Promise.resolve(shouldCopy ? copyToClipboard(texData) : false).then(function (copied) {
    if (shouldDownload && downloaded && shouldCopy && copied) showToast("LaTeX downloaded and copied");
    else if (shouldDownload && downloaded) showToast("LaTeX downloaded");
    else if (shouldDownload) showToast("Could not download LaTeX", "error");
    else if (copied) showToast("LaTeX copied to clipboard");
    else showToast("Could not copy — clipboard blocked", "error");
  });
}


function saveAsTypst() {
  var shouldCopy = exportCopyEnabled(), shouldDownload = exportDownloadEnabled();
  if (!shouldCopy && !shouldDownload) { showToast("Select Copy export, Download export, or both", "error"); return; }
  var exporter = new ExportAsTypst();
  var oldSelectedObject = selectedObject;
  selectedObject = null;
  var wasLocked = constrainToMargins; constrainToMargins = exportPaged() && wasLocked;
  drawUsing(exporter, EXPORT_COLORS);
  constrainToMargins = wasLocked;
  selectedObject = oldSelectedObject;
  var json = snapshotJSON();
  if (typeof json !== "string") json = JSON.stringify(json);
  var typData = exporter.toTypst(json, exportStandalone(), pageCount, pageMarginsForExport(), constrainToMargins, exportPaged());
  var downloaded = !shouldDownload || downloadBlob(activeFSMFileName("typ"), typData, "text/plain;charset=utf-8");
  Promise.resolve(shouldCopy ? copyToClipboard(typData) : false).then(function (copied) {
    if (shouldDownload && downloaded && shouldCopy && copied) showToast("Typst downloaded and copied");
    else if (shouldDownload && downloaded) showToast("Typst downloaded");
    else if (shouldDownload) showToast("Could not download Typst", "error");
    else if (copied) showToast("Typst copied to clipboard");
    else showToast("Could not copy Typst", "error");
  });
}
