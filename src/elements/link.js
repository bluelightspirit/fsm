function Link(a, b) {
  this.nodeA = a;
  this.nodeB = b;
  this.text = "";
  this.lineAngleAdjust = 0; // value to add to textAngle when link is straight line
  this.labelDx = 0; // manual label offset (Alt+drag)
  this.labelDy = 0;

  // make anchor point relative to the locations of nodeA and nodeB
  this.parallelPart = 0.5; // percentage from nodeA to nodeB
  this.perpendicularPart = 0; // pixels from line between nodeA and nodeB
  this.curvePoints = null; // three route handles for the whole link
}

Link.prototype._curvePageBreaks = function (start, end) {
  var ph = typeof pageHeightPx === "function" ? pageHeightPx() : 1056;
  var lo = Math.min(start.y, end.y), hi = Math.max(start.y, end.y);
  var breaks = [0, 1];
  if (Math.abs(end.y - start.y) > 1e-6) {
    for (var y = (Math.floor(lo / ph) + 1) * ph; y < hi - 1e-6; y += ph) {
      var t = (y - start.y) / (end.y - start.y);
      if (t > 1e-6 && t < 1 - 1e-6) breaks.push(t);
    }
  }
  breaks.sort(function (a, b) { return a - b; });
  return breaks;
};

Link.prototype._linkCenters = function () {
  var ph = pageHeightPx(), gap = (pageMargins.top + pageMargins.bottom) * PX_PER_INCH;
  var reach = Math.max(nodeRadius, styleStateFontSize * 0.75) + 2;
  function candidates(node) {
    var out = [{ x: node.x, y: node.y }];
    for (var p = 0; p + 1 < pageCount; p++) {
      var nextTop = (p + 1) * ph + pageMargins.top * PX_PER_INCH;
      var priorBottom = (p + 1) * ph - pageMargins.bottom * PX_PER_INCH;
      if (Math.abs(node.y - nextTop) <= reach) out.push({ x: node.x, y: node.y - gap });
      if (Math.abs(node.y - priorBottom) <= reach) out.push({ x: node.x, y: node.y + gap });
    }
    return out;
  }
  function choose(node, highY) {
    var list = candidates(node), best = list[0];
    for (var i = 1; i < list.length; i++) {
      if (highY ? list[i].y > best.y : list[i].y < best.y) best = list[i];
    }
    return best;
  }
  // When either state straddles a page seam, route from the fragment on the
  // source side toward the fragment on the destination side. This lets the
  // curve continue across the printable-area gap instead of ending in it.
  var down = this.nodeB.y >= this.nodeA.y;
  var a = choose(this.nodeA, !down), b = choose(this.nodeB, down);
  return { a: a, b: b };
};

Link.prototype._visibleCirclePoint = function (node, center, toward, inset, preferredPage) {
  var radius = nodeRadius;
  if (!constrainToMargins || typeof pageHeightPx !== "function" || typeof pageWidthPx !== "function") {
    var vx = toward.x - center.x, vy = toward.y - center.y;
    var vl = Math.sqrt(vx * vx + vy * vy) || 1;
    return { x: center.x + vx / vl * radius, y: center.y + vy / vl * radius };
  }
  var ph = pageHeightPx();
  var pad = Math.max(0, inset || 0) + Math.max(1, styleLineWidth || 1);
  var left = pageMargins.left * PX_PER_INCH + pad;
  var right = pageWidthPx() - pageMargins.right * PX_PER_INCH - pad;
  var reach = Math.max(radius, styleStateFontSize * 0.75) + 2;
  var gap = (pageMargins.top + pageMargins.bottom) * PX_PER_INCH;
  var circleCenters = [{ x: node.x, y: node.y }];
  for (var p = 0; p + 1 < pageCount; p++) {
    var nextTop = (p + 1) * ph + pageMargins.top * PX_PER_INCH;
    var priorBottom = (p + 1) * ph - pageMargins.bottom * PX_PER_INCH;
    if (Math.abs(node.y - nextTop) <= reach) circleCenters.push({ x: node.x, y: node.y - gap });
    if (Math.abs(node.y - priorBottom) <= reach) circleCenters.push({ x: node.x, y: node.y + gap });
  }
  preferredPage = preferredPage == null
    ? Math.max(0, Math.min(pageCount - 1, Math.floor(node.y / ph)))
    : Math.max(0, Math.min(pageCount - 1, preferredPage));
  var best = null, bestScore = Infinity;
  // Check every rendered fragment of a split state, preferring the fragment
  // at the state's actual page position. That lets an arrow from page 2 attach
  // to the visible page 1 arc instead of being stuck on its duplicate.
  circleCenters.forEach(function (circleCenter) {
    var page = Math.max(0, Math.min(pageCount - 1, Math.floor(circleCenter.y / ph)));
    var top = page * ph + pageMargins.top * PX_PER_INCH + pad;
    var bottom = (page + 1) * ph - pageMargins.bottom * PX_PER_INCH - pad;
    var targetAngle = Math.atan2(toward.y - circleCenter.y, toward.x - circleCenter.x);
    for (var i = 0; i < 720; i++) {
      var angle = Math.PI * 2 * i / 720;
      var x = circleCenter.x + Math.cos(angle) * radius, y = circleCenter.y + Math.sin(angle) * radius;
      if (x < left || x > right || y < top || y > bottom) continue;
      var delta = Math.atan2(Math.sin(angle - targetAngle), Math.cos(angle - targetAngle));
      var score = Math.abs(page - preferredPage) * 100 + delta * delta;
      if (score < bestScore) { bestScore = score; best = { x: x, y: y }; }
    }
  });
  if (best) return best;
  var dx = toward.x - center.x, dy = toward.y - center.y, length = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: center.x + dx / length * radius, y: center.y + dy / length * radius };
};

Link.prototype._ensureCurvePoints = function (count, pageBreaks) {
  var centers = this._linkCenters();
  var dx = centers.b.x - centers.a.x, dy = centers.b.y - centers.a.y;
  var length = Math.sqrt(dx * dx + dy * dy) || 1;
  // Convert saved per-page cubic handles to three whole-link handles. This
  // keeps imported older links editable while dropping the page-count-based UI.
  if (Array.isArray(this.curvePoints) && this.curvePoints.length && typeof this.curvePoints[0].t !== "number") {
    var oldBreaks = pageBreaks || this._curvePageBreaks(centers.a, centers.b);
    var oldHandles = [];
    this.curvePoints.forEach(function (seg, i) {
      if (!seg || !seg.c1 || !seg.c2) return;
      [seg.c1, seg.c2].forEach(function (point) {
        var t0 = oldBreaks[i], t1 = oldBreaks[i + 1];
        var px = centers.a.x + dx * (t0 + (t1 - t0) * point.parallel) - (dy / length) * point.perpendicular;
        var py = centers.a.y + dy * (t0 + (t1 - t0) * point.parallel) + (dx / length) * point.perpendicular;
        var t = ((px - centers.a.x) * dx + (py - centers.a.y) * dy) / (length * length);
        var perp = (dx * (py - centers.a.y) - dy * (px - centers.a.x)) / length;
        oldHandles.push({ t: t, perpendicular: perp });
      });
    });
    oldHandles.sort(function (a, b) { return a.t - b.t; });
    this.curvePoints = [0.25, 0.5, 0.75].map(function (target) {
      if (!oldHandles.length) return { t: target, perpendicular: 0 };
      var best = oldHandles[0];
      oldHandles.forEach(function (point) { if (Math.abs(point.t - target) < Math.abs(best.t - target)) best = point; });
      return { t: target, perpendicular: best.perpendicular };
    });
  }
  if (!Array.isArray(this.curvePoints)) this.curvePoints = [];
  if (!this.curvePoints.length) {
    var base = this.perpendicularPart || 0;
    this.curvePoints = [0.25, 0.5, 0.75].map(function (t) { return { t: t, perpendicular: base * (1 - Math.abs(2 * t - 1)) }; });
  }
};

Link.prototype.getCurveHandles = function () {
  if (!this.perpendicularPart && !this.curvePoints) return [];
  var centers = this._linkCenters();
  this._ensureCurvePoints();
  var dx = centers.b.x - centers.a.x, dy = centers.b.y - centers.a.y;
  var length = Math.sqrt(dx * dx + dy * dy) || 1;
  return this.curvePoints.map(function (point, i) {
    return {
      x: centers.a.x + dx * point.t - (dy / length) * point.perpendicular,
      y: centers.a.y + dy * point.t + (dx / length) * point.perpendicular,
      segment: i,
    };
  });
};

Link.prototype.moveCurveHandle = function (handleIndex, x, y) {
  var handles = this.getCurveHandles();
  var handle = handles[handleIndex];
  if (!handle) return;
  var centers = this._linkCenters();
  var dx = centers.b.x - centers.a.x, dy = centers.b.y - centers.a.y;
  var length2 = dx * dx + dy * dy || 1;
  if (typeof pageHeightPx === "function") {
    x = Math.max(2, Math.min(pageWidthPx() - 2, x));
    y = Math.max(2, Math.min(pageCount * pageHeightPx() - 2, y));
  }
  var parallel = ((x - centers.a.x) * dx + (y - centers.a.y) * dy) / length2;
  var perpendicular = (dx * (y - centers.a.y) - dy * (x - centers.a.x)) / Math.sqrt(length2);
  var spec = this.curvePoints[handle.segment];
  spec.t = Math.max(-0.5, Math.min(1.5, parallel));
  spec.perpendicular = Math.max(-pageHeightPx(), Math.min(pageHeightPx(), perpendicular));
  this.perpendicularPart = Math.abs(spec.perpendicular) > 0.5 ? this.perpendicularPart || 1 : this.perpendicularPart;
};

Link.prototype.getAnchorPoint = function () {
  var dx = this.nodeB.x - this.nodeA.x;
  var dy = this.nodeB.y - this.nodeA.y;
  var scale = Math.sqrt(dx * dx + dy * dy);
  if (scale < 1e-6) return { x: this.nodeA.x, y: this.nodeA.y };
  var x =
    this.nodeA.x +
    dx * this.parallelPart -
    (dy * this.perpendicularPart) / scale;
  var y =
    this.nodeA.y +
    dy * this.parallelPart +
    (dx * this.perpendicularPart) / scale;
  var padding = Math.max(2, styleLineWidth || 1);
  var maxX = typeof pageWidthPx === "function" ? pageWidthPx() - padding : Infinity;
  var maxY = typeof pageHeightPx === "function" && typeof pageCount !== "undefined"
    ? pageHeightPx() * pageCount - padding
    : Infinity;
  return {
    x: Math.max(padding, Math.min(maxX, x)),
    y: Math.max(padding, Math.min(maxY, y)),
  };
};

Link.prototype.setAnchorPoint = function (x, y) {
  var previousPerpendicular = this.perpendicularPart;
  var dx = this.nodeB.x - this.nodeA.x;
  var dy = this.nodeB.y - this.nodeA.y;
  var scale = Math.sqrt(dx * dx + dy * dy);
  if (scale < 1e-6) return;
  if (typeof pageWidthPx === "function" && typeof pageHeightPx === "function") {
    x = Math.max(2, Math.min(pageWidthPx() - 2, x));
    y = Math.max(2, Math.min(pageHeightPx() * pageCount - 2, y));
  }
  this.parallelPart =
    (dx * (x - this.nodeA.x) + dy * (y - this.nodeA.y)) / (scale * scale);
  this.perpendicularPart =
    (dx * (y - this.nodeA.y) - dy * (x - this.nodeA.x)) / scale;
  // Dragging the curve itself moves every page segment with the legacy anchor.
  // Keep the whole-link handles moving with the legacy curve anchor.
  if (Array.isArray(this.curvePoints) && this.curvePoints.length) {
    var delta = this.perpendicularPart - previousPerpendicular;
    this.curvePoints.forEach(function (point) { if (point && typeof point.perpendicular === "number") point.perpendicular += delta; });
  }
  // snap to a straight line
  if (
    this.parallelPart > 0 &&
    this.parallelPart < 1 &&
    Math.abs(this.perpendicularPart) < snapToPadding
  ) {
    this.lineAngleAdjust = (this.perpendicularPart < 0) * Math.PI;
    this.perpendicularPart = 0;
  }
};

Link.prototype.getEndPointsAndCircle = function () {
  if (this.perpendicularPart == 0 && !this.curvePoints) {
    var midX = (this.nodeA.x + this.nodeB.x) / 2;
    var midY = (this.nodeA.y + this.nodeB.y) / 2;
    var start = this.nodeA.closestPointOnCircle(midX, midY);
    var end = this.nodeB.closestPointOnCircle(midX, midY);
    return {
      hasCircle: false,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
    };
  }
  var anchor = this.getAnchorPoint();
  // A quadratic curve uses the dragged anchor as its control point. Unlike a
  // circumcircle through the anchor, the curve stays inside the convex hull
  // of its endpoints and control point, so it cannot balloon off the paper.
  var centers = this._linkCenters();
  var a = centers.a, b = centers.b;
  var handles = this.getCurveHandles();
  var first = handles[0] || anchor, last = handles[handles.length - 1] || anchor;
  var ax = first.x - a.x, ay = first.y - a.y;
  var bx = b.x - last.x, by = b.y - last.y;
  var al = Math.sqrt(ax * ax + ay * ay), bl = Math.sqrt(bx * bx + by * by);
  if (al < 1e-6) { ax = b.x - a.x; ay = b.y - a.y; al = Math.sqrt(ax * ax + ay * ay) || 1; }
  if (bl < 1e-6) { bx = b.x - a.x; by = b.y - a.y; bl = Math.sqrt(bx * bx + by * by) || 1; }
  var sourcePage = Math.max(0, Math.min(pageCount - 1, Math.floor(a.y / pageHeightPx())));
  var start = this._visibleCirclePoint(this.nodeA, a, { x: a.x + ax, y: a.y + ay }, 0, sourcePage);
  // The final route handle selects which visible copy of a split destination
  // receives the arrowhead. Dragging that handle across a page break switches
  // between the page fragments instead of locking the tip to the source page.
  var targetPage = Math.max(0, Math.min(pageCount - 1, Math.floor(last.y / pageHeightPx())));
  var end = this._visibleCirclePoint(this.nodeB, b, { x: b.x - bx, y: b.y - by }, styleArrowSize || 0, targetPage);
  var startX = start.x, startY = start.y;
  var endX = end.x, endY = end.y;
  // The three route handles shape one continuous curve. Page clipping cuts
  // that curve at printable boundaries, so the number of pages never adds dots.
  this._ensureCurvePoints();
  handles = this.getCurveHandles();
  var route = [{ x: startX, y: startY }].concat(handles, [{ x: endX, y: endY }]);
  var segments = [];
  for (var si = 0; si < route.length - 1; si++) {
    var previous = route[Math.max(0, si - 1)], current = route[si];
    var next = route[si + 1], following = route[Math.min(route.length - 1, si + 2)];
    segments.push({
      startX: current.x, startY: current.y,
      endX: next.x, endY: next.y,
      control1X: current.x + (next.x - previous.x) / 6,
      control1Y: current.y + (next.y - previous.y) / 6,
      control2X: next.x - (following.x - current.x) / 6,
      control2Y: next.y - (following.y - current.y) / 6,
    });
  }
  return {
    hasCircle: false,
    hasCurve: true,
    startX: startX,
    startY: startY,
    endX: endX,
    endY: endY,
    controlX: anchor.x,
    controlY: anchor.y,
    segments: segments,
  };
};

Link.prototype.draw = function (c) {
  var stuff = this.getEndPointsAndCircle();
  // draw arc
  c.beginPath();
  if (stuff.hasCircle) {
    c.arc(
      stuff.circleX,
      stuff.circleY,
      stuff.circleRadius,
      stuff.startAngle,
      stuff.endAngle,
      stuff.isReversed,
    );
  } else if (stuff.hasCurve) {
    c.moveTo(stuff.startX, stuff.startY);
    for (var si = 0; si < stuff.segments.length; si++) {
      var segment = stuff.segments[si];
      c.bezierCurveTo(segment.control1X, segment.control1Y, segment.control2X, segment.control2Y, segment.endX, segment.endY);
    }
  } else {
    c.moveTo(stuff.startX, stuff.startY);
    c.lineTo(stuff.endX, stuff.endY);
  }
  c.stroke();
  // draw the head of the arrow
  if (stuff.hasCurve) {
    var finalSegment = stuff.segments[stuff.segments.length - 1];
    var tangentX = stuff.endX - finalSegment.control2X;
    var tangentY = stuff.endY - finalSegment.control2Y;
    drawArrow(c, stuff.endX, stuff.endY, Math.atan2(tangentY, tangentX));
  } else if (stuff.hasCircle) {
    drawArrow(
      c,
      stuff.endX,
      stuff.endY,
      stuff.endAngle - stuff.reverseScale * (Math.PI / 2),
    );
  } else {
    drawArrow(
      c,
      stuff.endX,
      stuff.endY,
      Math.atan2(stuff.endY - stuff.startY, stuff.endX - stuff.startX),
    );
  }
  // draw the text
  if (stuff.hasCurve) {
    var middle = stuff.segments[Math.floor(stuff.segments.length / 2)];
    var textX = (middle.startX + 3 * middle.control1X + 3 * middle.control2X + middle.endX) / 8;
    var textY = (middle.startY + 3 * middle.control1Y + 3 * middle.control2Y + middle.endY) / 8;
    var textAngle = Math.atan2(stuff.endY - stuff.startY, stuff.endX - stuff.startX);
    drawText(c, this.text, textX + this.labelDx, textY + this.labelDy, textAngle, selectedObject == this);
  } else if (stuff.hasCircle) {
    var startAngle = stuff.startAngle;
    var endAngle = stuff.endAngle;
    if (endAngle < startAngle) {
      endAngle += Math.PI * 2;
    }
    var textAngle = (startAngle + endAngle) / 2 + stuff.isReversed * Math.PI;
    var textX = stuff.circleX + stuff.circleRadius * Math.cos(textAngle);
    var textY = stuff.circleY + stuff.circleRadius * Math.sin(textAngle);
    drawText(
      c,
      this.text,
      textX + this.labelDx,
      textY + this.labelDy,
      textAngle,
      selectedObject == this,
    );
  } else {
    var textX = (stuff.startX + stuff.endX) / 2;
    var textY = (stuff.startY + stuff.endY) / 2;
    var textAngle = Math.atan2(
      stuff.endX - stuff.startX,
      stuff.startY - stuff.endY,
    );
    drawText(
      c,
      this.text,
      textX + this.labelDx,
      textY + this.labelDy,
      textAngle + this.lineAngleAdjust,
      selectedObject == this,
    );
  }
  if (stuff.hasCurve && (c.canvas !== canvas ? includeCurveHandlesInExports : false)) this.drawCurveHandles(c);
};

Link.prototype.drawCurveHandles = function (c) {
  var handles = this.getCurveHandles();
  c.save(); c.fillStyle = "white"; c.strokeStyle = "black"; c.lineWidth = 2;
  for (var i = 0; i < handles.length; i++) {
    if (typeof c.drawCurveHandle === "function") c.drawCurveHandle(handles[i].x, handles[i].y, 6);
    else { c.beginPath(); c.arc(handles[i].x, handles[i].y, 6, 0, Math.PI * 2); c.fill(); c.stroke(); }
  }
  c.restore();
};

Link.prototype.containsPoint = function (x, y, extraTolerance) {
  var tolerance = hitTargetPadding + (extraTolerance || 0);
  var stuff = this.getEndPointsAndCircle();
  if (stuff.hasCircle) {
    var dx = x - stuff.circleX;
    var dy = y - stuff.circleY;
    var distance = Math.sqrt(dx * dx + dy * dy) - stuff.circleRadius;
    if (Math.abs(distance) < tolerance) {
      var angle = Math.atan2(dy, dx);
      var startAngle = stuff.startAngle;
      var endAngle = stuff.endAngle;
      if (stuff.isReversed) {
        var temp = startAngle;
        startAngle = endAngle;
        endAngle = temp;
      }
      if (endAngle < startAngle) {
        endAngle += Math.PI * 2;
      }
      if (angle < startAngle) {
        angle += Math.PI * 2;
      } else if (angle > endAngle) {
        angle -= Math.PI * 2;
      }
      return angle > startAngle && angle < endAngle;
    }
  } else if (stuff.hasCurve) {
    for (var si = 0; si < stuff.segments.length; si++) {
      var seg = stuff.segments[si], previous = { x: seg.startX, y: seg.startY };
      for (var i = 1; i <= 24; i++) {
        var t = i / 24, u = 1 - t;
        var current = {
          x: u * u * u * seg.startX + 3 * u * u * t * seg.control1X + 3 * u * t * t * seg.control2X + t * t * t * seg.endX,
          y: u * u * u * seg.startY + 3 * u * u * t * seg.control1Y + 3 * u * t * t * seg.control2Y + t * t * t * seg.endY,
        };
        var dx = current.x - previous.x, dy = current.y - previous.y;
        var length2 = dx * dx + dy * dy;
        var percent = length2 ? Math.max(0, Math.min(1, ((x - previous.x) * dx + (y - previous.y) * dy) / length2)) : 0;
        var distanceX = x - (previous.x + percent * dx), distanceY = y - (previous.y + percent * dy);
        if (Math.sqrt(distanceX * distanceX + distanceY * distanceY) < tolerance) return true;
        previous = current;
      }
    }
  } else {
    var dx = stuff.endX - stuff.startX;
    var dy = stuff.endY - stuff.startY;
    var length = Math.sqrt(dx * dx + dy * dy);
    var percent =
      (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
    var distance = (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
    return percent > 0 && percent < 1 && Math.abs(distance) < tolerance;
  }
  return false;
};

Link.prototype.getCurveHandleAt = function (x, y) {
  if (!showCurveHandles || this !== selectedObject || (!this.perpendicularPart && !this.curvePoints)) return -1;
  var handles = this.getCurveHandles();
  for (var i = handles.length - 1; i >= 0; i--) {
    var dx = handles[i].x - x, dy = handles[i].y - y;
    if (dx * dx + dy * dy <= 12 * 12) return i;
  }
  return -1;
};
