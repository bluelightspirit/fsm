#!/usr/bin/env python3
"""Two fixes, verified in isolation before writing anything:
1. src/main/automata.js: curveOffsetFor now (a) scores the ACTUAL rendered
   Bezier curve instead of a mismatched parabola, and (b) treats the left/right
   printable margins as a hard bound the curve may never cross, with obstacle
   clearance as a best-effort goal within that bound.
2. src/elements/link.js: manually dragging a curve handle (or the legacy
   curve anchor) now clamps horizontally to the margin box, not the full page
   width, when "keep inside margins" is on. Vertical range is unchanged, so
   arrows can still cross page seams as before - only the left/right leak is
   closed.

Run from the repo root. Aborts without writing anything if an anchor is
missing (which likely means an earlier version of this patch is already
applied - check with: grep -n "realClearance\\|marginBoundLeft" src/main/automata.js src/elements/link.js).
"""

import re

edits = []  # (path, old, new, expected_count)


def sub(path, old, new, count=1):
    edits.append((path, old, new, count))


# ------------------------------------------------------------------ automata.js
OLD_CURVE_OFFSET_FOR = '''  function curveOffsetFor(source, target, linkIndex) {
    var a = generatedNodes[source], b = generatedNodes[target];
    var dx = b.x - a.x, dy = b.y - a.y;
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / length, ny = dx / length;
    var base = Math.max(20, radius * 0.8);
    var preferredSign = (source < target ? 1 : -1) * (linkIndex % 2 ? -1 : 1);
    var magnitudes = [base, base * 1.5, base * 2, base * 2.75, base * 3.5];
    var maxBend = magnitudes[magnitudes.length - 1];
    var obstacles = [];
    generatedNodes.forEach(function (node, i) {
      if (i === source || i === target) return;
      var ox = node.x - a.x, oy = node.y - a.y;
      var along = (ox * dx + oy * dy) / (length * length);
      var across = Math.abs(dx * oy - dy * ox) / length;
      if (along > 0 && along < 1 && across < maxBend + radius + 8) obstacles.push(node);
    });
    var best = { score: Infinity, offset: preferredSign * base };
    [preferredSign, -preferredSign].forEach(function (sign) {
      magnitudes.forEach(function (magnitude) {
        var score = magnitude * 0.05;
        for (var sample = 1; sample < 10; sample++) {
          var t = sample / 10;
          var bend = sign * magnitude * 4 * t * (1 - t);
          var x = a.x + dx * t + nx * bend;
          var y = a.y + dy * t + ny * bend;
          if (x < 8 || x > width - 8 || y < 8 || y > height * generatedPages - 8) score += 500;
          for (var oi = 0; oi < obstacles.length; oi++) {
            var ox = x - obstacles[oi].x, oy = y - obstacles[oi].y;
            var clearance = Math.sqrt(ox * ox + oy * oy) - radius - 8;
            if (clearance < 0) score += 100 - clearance;
          }
        }
        if (score < best.score) best = { score: score, offset: sign * magnitude };
      });
    });
    return best.offset;
  }
'''

NEW_CURVE_OFFSET_FOR = r'''  // Builds the same tent-shaped curvePoints link.js's _ensureCurvePoints()
  // would derive from a single perpendicularPart, so scoring and rendering
  // always agree on shape.
  function tentCurvePoints(bendAmount) {
    return [0.25, 0.5, 0.75].map(function (t) {
      return { t: t, perpendicular: bendAmount * (1 - Math.abs(2 * t - 1)) };
    });
  }
  // Mirrors link.js's Link.prototype.getEndPointsAndCircle bezier-segment math
  // exactly, so "does this clear the obstacle / stay inside the margins" is
  // asked about the curve that actually gets drawn, not an approximation.
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
  function curveOffsetFor(source, target, linkIndex) {
    var a = generatedNodes[source], b = generatedNodes[target];
    var dx = b.x - a.x, dy = b.y - a.y;
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    var clearanceMargin = 8;
    var base = Math.max(20, radius * 0.8);
    var preferredSign = (source < target ? 1 : -1) * (linkIndex % 2 ? -1 : 1);
    var obstacles = [];
    generatedNodes.forEach(function (node, i) {
      if (i === source || i === target) return;
      var ox = node.x - a.x, oy = node.y - a.y;
      var along = (ox * dx + oy * dy) / (length * length);
      if (along > -0.15 && along < 1.15) obstacles.push(node);
    });
    function handlesFromCurvePoints(curvePoints) {
      return curvePoints.map(function (p) {
        return { x: a.x + dx * p.t - (dy / length) * p.perpendicular, y: a.y + dy * p.t + (dx / length) * p.perpendicular };
      });
    }
    // Hard bound: the curve may never leave the printable width. Obstacle
    // clearance is a best-effort goal *within* that bound, never a reason to
    // exceed it.
    var marginBoundLeft = marginLeft + radius + clearanceMargin;
    var marginBoundRight = width - marginRight - radius - clearanceMargin;
    function evaluate(bendAmount) {
      var curvePoints = tentCurvePoints(bendAmount);
      var route = [a].concat(handlesFromCurvePoints(curvePoints), [b]);
      var pts = sampleSegments(bezierSegmentsFromRoute(route), 20);
      var withinMargins = true, worstObstacleClearance = Infinity;
      pts.forEach(function (p) {
        if (p.x < marginBoundLeft || p.x > marginBoundRight) withinMargins = false;
        obstacles.forEach(function (node) {
          var d = Math.sqrt((p.x - node.x) * (p.x - node.x) + (p.y - node.y) * (p.y - node.y)) - radius - clearanceMargin;
          if (d < worstObstacleClearance) worstObstacleClearance = d;
        });
      });
      return { withinMargins: withinMargins, clearance: worstObstacleClearance };
    }
    var maxBend = Math.max(0, (marginBoundRight - marginBoundLeft) / 2);
    var signs = [preferredSign, -preferredSign];
    var bestClearing = null; // clears every obstacle AND stays within margins
    var bestInMargin = { bend: 0, clearance: -Infinity }; // widest still-safe fallback
    for (var si = 0; si < signs.length && bestClearing == null; si++) {
      var sign = signs[si];
      for (var magnitude = base; magnitude <= maxBend; magnitude *= 1.25) {
        var result = evaluate(sign * magnitude);
        if (!result.withinMargins) break; // larger magnitudes only go further out
        if (result.clearance > bestInMargin.clearance) bestInMargin = { bend: sign * magnitude, clearance: result.clearance };
        if (result.clearance >= 0) { bestClearing = sign * magnitude; break; }
      }
    }
    return bestClearing != null ? bestClearing : bestInMargin.bend;
  }
'''

sub("src/main/automata.js", OLD_CURVE_OFFSET_FOR, NEW_CURVE_OFFSET_FOR)

# ------------------------------------------------------------------ link.js
OLD_MOVE_HANDLE_CLAMP = '''  if (typeof pageHeightPx === "function") {
    x = Math.max(2, Math.min(pageWidthPx() - 2, x));
    y = Math.max(2, Math.min(pageCount * pageHeightPx() - 2, y));
  }'''
NEW_MOVE_HANDLE_CLAMP = '''  if (typeof pageHeightPx === "function") {
    var handlePad = Math.max(2, styleLineWidth || 1);
    if (typeof constrainToMargins !== "undefined" && constrainToMargins && typeof pageMargins !== "undefined") {
      var handleLo = pageMargins.left * PX_PER_INCH + handlePad;
      var handleHi = pageWidthPx() - pageMargins.right * PX_PER_INCH - handlePad;
      if (handleHi < handleLo) { handleLo = handleHi = pageWidthPx() / 2; }
      x = Math.max(handleLo, Math.min(handleHi, x));
    } else {
      x = Math.max(2, Math.min(pageWidthPx() - 2, x));
    }
    y = Math.max(2, Math.min(pageCount * pageHeightPx() - 2, y));
  }'''
sub("src/elements/link.js", OLD_MOVE_HANDLE_CLAMP, NEW_MOVE_HANDLE_CLAMP)

OLD_SET_ANCHOR_CLAMP = '''  if (typeof pageWidthPx === "function" && typeof pageHeightPx === "function") {
    x = Math.max(2, Math.min(pageWidthPx() - 2, x));
    y = Math.max(2, Math.min(pageHeightPx() * pageCount - 2, y));
  }'''
NEW_SET_ANCHOR_CLAMP = '''  if (typeof pageWidthPx === "function" && typeof pageHeightPx === "function") {
    var anchorPad = Math.max(2, styleLineWidth || 1);
    if (typeof constrainToMargins !== "undefined" && constrainToMargins && typeof pageMargins !== "undefined") {
      var anchorLo = pageMargins.left * PX_PER_INCH + anchorPad;
      var anchorHi = pageWidthPx() - pageMargins.right * PX_PER_INCH - anchorPad;
      if (anchorHi < anchorLo) { anchorLo = anchorHi = pageWidthPx() / 2; }
      x = Math.max(anchorLo, Math.min(anchorHi, x));
    } else {
      x = Math.max(2, Math.min(pageWidthPx() - 2, x));
    }
    y = Math.max(2, Math.min(pageHeightPx() * pageCount - 2, y));
  }'''
sub("src/elements/link.js", OLD_SET_ANCHOR_CLAMP, NEW_SET_ANCHOR_CLAMP)

OLD_GET_ANCHOR_CLAMP = '''  var padding = Math.max(2, styleLineWidth || 1);
  var maxX = typeof pageWidthPx === "function" ? pageWidthPx() - padding : Infinity;
  var maxY = typeof pageHeightPx === "function" && typeof pageCount !== "undefined"
    ? pageHeightPx() * pageCount - padding
    : Infinity;
  return {
    x: Math.max(padding, Math.min(maxX, x)),
    y: Math.max(padding, Math.min(maxY, y)),
  };'''
NEW_GET_ANCHOR_CLAMP = '''  var padding = Math.max(2, styleLineWidth || 1);
  var minX = padding;
  var maxX = typeof pageWidthPx === "function" ? pageWidthPx() - padding : Infinity;
  if (typeof pageWidthPx === "function" && typeof constrainToMargins !== "undefined" && constrainToMargins && typeof pageMargins !== "undefined") {
    minX = pageMargins.left * PX_PER_INCH + padding;
    maxX = pageWidthPx() - pageMargins.right * PX_PER_INCH - padding;
    if (maxX < minX) { minX = maxX = pageWidthPx() / 2; }
  }
  var maxY = typeof pageHeightPx === "function" && typeof pageCount !== "undefined"
    ? pageHeightPx() * pageCount - padding
    : Infinity;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(padding, Math.min(maxY, y)),
  };'''
sub("src/elements/link.js", OLD_GET_ANCHOR_CLAMP, NEW_GET_ANCHOR_CLAMP)

# ------------------------------------------------------------------ check all, then write
contents = {}
for path, old, new, count in edits:
    text = contents.get(path)
    if text is None:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    found = text.count(old)
    if found != count:
        raise SystemExit(
            "ABORTED, nothing written. %s: expected %d match(es), found %d for a block starting:\n%s\n...\n"
            "This usually means a version of this patch is already applied, or the file has since changed."
            % (path, count, found, old.splitlines()[0])
        )
    contents[path] = text.replace(old, new)

for path, text in contents.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
print("patched %d files:" % len(contents))
for path in contents:
    print("  -", path)
print("restart/rebuild the server, then regenerate a regex FSM to test.")
