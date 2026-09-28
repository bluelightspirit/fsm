#!/usr/bin/env python3
"""Adds draggable link labels (Alt+drag, Alt+double-click to reset).
Run from the repo root (~/fsm). Aborts without writing if any anchor is missing."""

edits = []  # (path, old, new, expected_count)


def sub(path, old, new, count=1):
    edits.append((path, old, new, count))


# ---- link.js ----
sub(
    "src/elements/link.js",
    "  this.lineAngleAdjust = 0; // value to add to textAngle when link is straight line\n",
    "  this.lineAngleAdjust = 0; // value to add to textAngle when link is straight line\n"
    "  this.labelDx = 0; // manual label offset (Alt+drag)\n"
    "  this.labelDy = 0;\n",
)
sub(
    "src/elements/link.js",
    "    drawText(c, this.text, textX, textY, textAngle, selectedObject == this);\n",
    "    drawText(\n      c,\n      this.text,\n      textX + this.labelDx,\n      textY + this.labelDy,\n"
    "      textAngle,\n      selectedObject == this,\n    );\n",
)
sub(
    "src/elements/link.js",
    "      this.text,\n      textX,\n      textY,\n      textAngle + this.lineAngleAdjust,\n",
    "      this.text,\n      textX + this.labelDx,\n      textY + this.labelDy,\n"
    "      textAngle + this.lineAngleAdjust,\n",
)

# ---- self_link.js ----
sub(
    "src/elements/self_link.js",
    '  this.text = "";\n\n  if (mouse) {',
    '  this.text = "";\n  this.labelDx = 0;\n  this.labelDy = 0;\n\n  if (mouse) {',
)
sub(
    "src/elements/self_link.js",
    "    this.text,\n    textX,\n    textY,\n    this.anchorAngle,\n",
    "    this.text,\n    textX + this.labelDx,\n    textY + this.labelDy,\n    this.anchorAngle,\n",
)

# ---- start_link.js ----
sub(
    "src/elements/start_link.js",
    '  this.text = "";\n\n  if (start) {',
    '  this.text = "";\n  this.labelDx = 0;\n  this.labelDy = 0;\n\n  if (start) {',
)
sub(
    "src/elements/start_link.js",
    "    this.text,\n    stuff.startX,\n    stuff.startY,\n    textAngle,\n",
    "    this.text,\n    stuff.startX + this.labelDx,\n    stuff.startY + this.labelDy,\n    textAngle,\n",
)

# ---- save.js (persist offsets; also flows into undo/redo and the fsm-data line) ----
sub(
    "src/main/save.js",
    "        text: link.text,\n",
    "        text: link.text,\n        labelDx: link.labelDx,\n        labelDy: link.labelDy,\n",
    count=3,
)
sub(
    "src/main/save.js",
    "      link.text = bl.text;\n",
    "      link.text = bl.text;\n      link.labelDx = bl.labelDx || 0;\n      link.labelDy = bl.labelDy || 0;\n",
    count=3,
)

# ---- fsm.js (gesture handling) ----
sub("src/main/fsm.js", "var shift = false;\n", "var shift = false;\nvar labelDrag = null; // active Alt+drag of a link label\n")

sub(
    "src/main/fsm.js",
    "    flushHistory();\n    selectedObject = selectObject(mouse.x, mouse.y);\n    movingObject = false;\n",
    "    flushHistory();\n"
    "    var previousSelection = selectedObject;\n"
    "    selectedObject = selectObject(mouse.x, mouse.y);\n"
    "    movingObject = false;\n"
    "    labelDrag = null;\n"
    "    if (e.altKey) {\n"
    "      // Alt+drag moves the label of the clicked link, or of the selected link\n"
    "      var target = selectedObject;\n"
    "      if (target == null || target instanceof Node) target = previousSelection;\n"
    "      if (target != null && !(target instanceof Node)) {\n"
    "        selectedObject = target;\n"
    "        labelDrag = {\n"
    "          startX: mouse.x,\n"
    "          startY: mouse.y,\n"
    "          dx: target.labelDx || 0,\n"
    "          dy: target.labelDy || 0,\n"
    "          moved: false,\n"
    "        };\n"
    "        draw();\n"
    "        return false;\n"
    "      }\n"
    "    }\n",
)

sub(
    "src/main/fsm.js",
    "  canvas.onmousemove = function (e) {\n    var mouse = crossBrowserRelativeMousePos(e);\n",
    "  canvas.onmousemove = function (e) {\n    var mouse = crossBrowserRelativeMousePos(e);\n\n"
    "    if (labelDrag != null && selectedObject != null) {\n"
    "      selectedObject.labelDx = labelDrag.dx + (mouse.x - labelDrag.startX);\n"
    "      selectedObject.labelDy = labelDrag.dy + (mouse.y - labelDrag.startY);\n"
    "      labelDrag.moved = true;\n"
    "      draw();\n"
    "      return;\n"
    "    }\n",
)

sub(
    "src/main/fsm.js",
    "  canvas.onmouseup = function (e) {\n    var didChange = movingObject;\n    movingObject = false;\n",
    "  canvas.onmouseup = function (e) {\n    if (labelDrag != null) {\n"
    "      var moved = labelDrag.moved;\n"
    "      labelDrag = null;\n"
    "      draw();\n"
    "      if (moved) commitHistory();\n"
    "      return;\n"
    "    }\n"
    "    var didChange = movingObject;\n    movingObject = false;\n",
)

sub(
    "src/main/fsm.js",
    "    var mouse = crossBrowserRelativeMousePos(e);\n    flushHistory();\n"
    "    selectedObject = selectObject(mouse.x, mouse.y);\n\n    if (selectedObject == null) {",
    "    var mouse = crossBrowserRelativeMousePos(e);\n    flushHistory();\n"
    "    if (e.altKey) {\n"
    "      // Alt+double-click on a link resets its label to the default spot\n"
    "      var hit = selectObject(mouse.x, mouse.y);\n"
    "      if (hit != null && !(hit instanceof Node) && (hit.labelDx || hit.labelDy)) {\n"
    "        selectedObject = hit;\n"
    "        hit.labelDx = 0;\n"
    "        hit.labelDy = 0;\n"
    "        draw();\n"
    "        commitHistory();\n"
    "      }\n"
    "      return;\n"
    "    }\n"
    "    selectedObject = selectObject(mouse.x, mouse.y);\n\n    if (selectedObject == null) {",
)

# ---- check everything first, then write ----
contents = {}
for path, old, new, count in edits:
    text = contents.get(path)
    if text is None:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    found = text.count(old)
    if found != count:
        raise SystemExit(
            "ABORTED, nothing written. %s: expected %d match(es), found %d for:\n%s"
            % (path, count, found, old)
        )
    contents[path] = text.replace(old, new)

for path, text in contents.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
print("patched %d files. now run: python3 build.py" % len(contents))
