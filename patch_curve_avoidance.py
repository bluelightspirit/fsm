#!/usr/bin/env python3
"""Replace curveOffsetFor in src/main/automata.js with a version that scores the
ACTUAL rendered Bezier curve (matching link.js exactly) instead of a mismatched
parabola. Run from the repo root (~/fsm). Aborts without writing if the
function isn't found in the expected shape."""

import re

NEW_FUNCS = r"""  // Builds the same tent-shaped curvePoints link.js's _ensureCurvePoints()
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
"""

path = "src/main/automata.js"
with open(path, encoding="utf-8") as f:
    src = f.read()

pattern = re.compile(r"  function curveOffsetFor\(source, target, linkIndex\) \{.*?\n  \}\n", re.S)
matches = list(pattern.finditer(src))
if len(matches) != 1:
    raise SystemExit(
        "ABORTED, nothing written. Expected exactly one curveOffsetFor(...) function in %s, found %d.\n"
        "Send me: sed -n '280,335p' src/main/automata.js" % (path, len(matches))
    )

new_src = src[: matches[0].start()] + NEW_FUNCS + src[matches[0].end():]
with open(path, "w", encoding="utf-8") as f:
    f.write(new_src)
print("patched src/main/automata.js: curveOffsetFor now scores the actual rendered Bezier curve.")
print("now run: python3 server.py   (or restart it if already running)")
