// Draw using this instead of a canvas, then call toTypst() afterward.
// Emits CeTZ drawing code (https://typst.app/universe/package/cetz).

// Convert the editor's label shortcuts (\alpha, q_0, "abc") into Typst math.
// Multi-letter runs must be quoted in Typst math or they parse as variables.
// Convert one plain run (no subscripts) of display text into Typst math.
// Multi-letter runs must be quoted in Typst math or they parse as variables.
function typstMathRun(text) {
  var out = [];
  var i = 0;
  while (i < text.length) {
    var ch = text.charAt(i);
    var rest = text.slice(i);
    var m;
    if ((m = /^[A-Za-z]+/.exec(rest))) {
      out.push(m[0].length === 1 ? m[0] : '"' + m[0] + '"');
      i += m[0].length;
      continue;
    }
    if ((m = /^\d+/.exec(rest))) {
      out.push(m[0]);
      i += m[0].length;
      continue;
    }
    if (ch === " ") {
      out.push('" "');
    } else if (ch === ",") {
      out.push(",");
    } else if (ch.charCodeAt(0) > 0x7f) {
      out.push(ch); // unicode symbols (including Greek) are valid in Typst math
    } else {
      out.push('"' + ch.replace(/["\\]/g, "\\$&") + '"');
    }
    i++;
  }
  return out.join(" ");
}

// Subscripts become one _(...) attached to what came before, so they never nest.
function labelToTypstMath(text) {
  var segs = labelSegments(text);
  var out = "";
  for (var i = 0; i < segs.length; i++) {
    var body = typstMathRun(segs[i].t);
    if (segs[i].sub) out += (out === "" ? '""' : "") + "_(" + body + ")";
    else out += (out === "" ? "" : " ") + body;
  }
  return out;
}

function ExportAsTypst() {
  this._points = [];
  this._quadratic = null;
  this._data = "";
  this._nodePages = [];
  this._activeNodePage = null;
  this._nodeLayer = false;
  this._arrowData = "";
  this._arrowLayer = false;
  this.lineWidth = 1; // set by drawUsing()
  this._scale = 2.54 / 96; // true size: 96 px = 1 inch (CeTZ units are cm)
  this._append = function (chunk) {
    if (this._nodeLayer && this._activeNodePage != null) this._nodePages[this._activeNodePage] = (this._nodePages[this._activeNodePage] || "") + chunk;
    else if (this._arrowLayer) this._arrowData += chunk;
    else this._data += chunk;
  };
  this.beginNodeClip = function (page) { this._nodeLayer = true; this._activeNodePage = page; this._nodePages[page] = ""; };
  this.endNodeClip = function () { this._nodeLayer = false; this._activeNodePage = null; };
  this.beginArrowClip = function () { this._arrowLayer = true; this._arrowData = ""; };
  this.endArrowClip = function () { this._arrowLayer = false; };
  this.drawCurveHandle = function (x, y, r) {
    this._append("  circle(" + this._pt(x * this._scale, y * this._scale, 3) + ", radius: " + fixed(r * this._scale, 3) + "cm, fill: white, stroke: black)\n");
  };

  // json: optional snapshot string, embedded as a comment so the diagram
  // can be restored later from the .typ file itself.
  this.toTypst = function (json, standalone, pages, margins, constrainMargins, pageMode) {
    var header = json
      ? "// fsm-data: " + String(json).replace(/[\r\n]+/g, " ") + "\n"
      : "";
    pages = Math.max(1, Math.min(20, Math.round(pages || 1)));
    margins = margins || { top: 1, bottom: 1, left: 1, right: 1 };
    var pageSize = PAGE_SIZES[pageSizeKey], pw = pageSize.w, ph = pageSize.h;
    var pwCm = pw * 2.54, phCm = ph * 2.54;
    var out = header + '#import "@preview/cetz:0.4.2"\n';
    var pagedMode = pageMode !== false;
    var totalHeight = ph * pages;
    var paperName = pageSizeKey === "a4" ? "a4" : "us-letter";
    out += pagedMode
      ? "#set page(paper: \"" + paperName + "\", margin: (top: " + margins.top + "in, bottom: " + margins.bottom + "in, left: " + margins.left + "in, right: " + margins.right + "in))\n"
      : "#set page(width: " + pw.toFixed(4) + "in, height: " + totalHeight.toFixed(4) + "in, margin: 0pt)\n";
    if (!pagedMode) {
      out += "#place(top + left)[\n  #box(width: " + pw.toFixed(4) + "in, height: " + totalHeight.toFixed(4) + "in, clip: true)[\n";
      out += "    #cetz.canvas({\n      import cetz.draw: *\n";
      out += "      line((0, 0), (" + pwCm.toFixed(3) + ", -" + (phCm * pages).toFixed(3) + "), stroke: rgb(0%, 0%, 0%, 0%))\n";
      out += this._data.replace(/\n/g, "\n      ");
      return out + "    })\n  ]\n]\n";
    }
    for (var p = 0; p < pages; p++) {
      if (p) out += "#pagebreak()\n";
      out += "#place(top + left, dx: -" + margins.left + "in, dy: -" + margins.top + "in)[\n";
      out += "  #box(width: " + pw.toFixed(4) + "in, height: " + ph.toFixed(4) + "in, clip: true)[\n";
      function canvasCode(data) {
        return "#cetz.canvas({\n        import cetz.draw: *\n" +
          "        line((0, 0), (" + pwCm.toFixed(3) + ", -" + phCm.toFixed(3) + "), stroke: rgb(0%, 0%, 0%, 0%))\n" +
          data.replace(/\n/g, "\n        ") + "      })";
      }
      var nodePageData = this._nodePages[p] || "";
      if (constrainMargins) {
        var innerW = pw - margins.left - margins.right;
        var innerH = ph - margins.top - margins.bottom;
        out += "    #place(top + left, dx: " + margins.left + "in, dy: " + margins.top + "in)[\n";
        out += "      #box(width: " + innerW.toFixed(4) + "in, height: " + innerH.toFixed(4) + "in, clip: true)[\n";
        if (nodePageData) out += "        #place(top + left, dx: -" + margins.left + "in, dy: -" + (p * ph + margins.top) + "in)[" + canvasCode(nodePageData) + "]\n";
        if (this._arrowData) out += "        #place(top + left, dx: -" + margins.left + "in, dy: -" + (p * ph + margins.top) + "in)[" + canvasCode(this._arrowData) + "]\n";
        out += "      ]\n    ]\n";
      } else {
        out += "    #place(top + left, dy: -" + (p * ph) + "in)[" + canvasCode(nodePageData + this._data + this._arrowData) + "]\n";
      }
      out += "  ]\n]\n";
    }
    return out;
  };

  this._pt = function (x, y, digits) {
    return "(" + fixed(x, digits) + ", " + fixed(-y, digits) + ")";
  };

  this.beginPath = function () {
    this._points = [];
    this._quadratic = null;
  };

  this.arc = function (x, y, radius, startAngle, endAngle, isReversed) {
    x *= this._scale;
    y *= this._scale;
    radius *= this._scale;
    if (endAngle - startAngle == Math.PI * 2) {
      this._append(
        "  circle(" +
        this._pt(x, y, 3) +
        ", radius: " +
        fixed(radius, 3) +
        ", stroke: " +
        fixed(this.lineWidth * 0.75, 2) +
        "pt)\n");
      return;
    }
    if (isReversed) {
      var temp = startAngle;
      startAngle = endAngle;
      endAngle = temp;
    }
    if (endAngle < startAngle) {
      endAngle += Math.PI * 2;
    }
    if (Math.min(startAngle, endAngle) < -2 * Math.PI) {
      startAngle += 2 * Math.PI;
      endAngle += 2 * Math.PI;
    } else if (Math.max(startAngle, endAngle) > 2 * Math.PI) {
      startAngle -= 2 * Math.PI;
      endAngle -= 2 * Math.PI;
    }
    // canvas y points down, Typst y points up
    startAngle = -startAngle;
    endAngle = -endAngle;
    var sx = x + radius * Math.cos(startAngle);
    var sy = -y + radius * Math.sin(startAngle);
    this._append(
      "  arc((" +
      fixed(sx, 3) +
      ", " +
      fixed(sy, 3) +
      "), start: " +
      fixed((startAngle * 180) / Math.PI, 5) +
      "deg, delta: " +
      fixed(((endAngle - startAngle) * 180) / Math.PI, 5) +
      "deg, radius: " +
      fixed(radius, 3) +
      ", stroke: " +
      fixed(this.lineWidth * 0.75, 2) +
      "pt)\n");
  };

  this.moveTo = this.lineTo = function (x, y) {
    this._points.push({ x: x * this._scale, y: y * this._scale });
  };
  this.quadraticCurveTo = function (cx, cy, x, y) {
    this._quadratic = { x: cx * this._scale, y: cy * this._scale };
    this._points.push({ x: x * this._scale, y: y * this._scale });
  };
  this.bezierCurveTo = function (c1x, c1y, c2x, c2y, x, y) {
    this._points.push({ x: x * this._scale, y: y * this._scale, c1: { x: c1x * this._scale, y: c1y * this._scale }, c2: { x: c2x * this._scale, y: c2y * this._scale } });
  };

  this._pointList = function () {
    var parts = [];
    for (var i = 0; i < this._points.length; i++) {
      parts.push(this._pt(this._points[i].x, this._points[i].y, 3));
    }
    return parts.join(", ");
  };

  this.stroke = function () {
    if (this._points.length < 2) return;
    if (this._points.some(function (point) { return !!point.c1; })) {
      var previous = this._points[0];
      for (var ci = 1; ci < this._points.length; ci++) {
        var curvePoint = this._points[ci];
        if (curvePoint.c1) this._append("  bezier(" + this._pt(previous.x, previous.y, 3) + ", " + this._pt(curvePoint.x, curvePoint.y, 3) + ", " + this._pt(curvePoint.c1.x, curvePoint.c1.y, 3) + ", " + this._pt(curvePoint.c2.x, curvePoint.c2.y, 3) + ", stroke: " + fixed(this.lineWidth * 0.75, 2) + "pt)\n");
        previous = curvePoint;
      }
      return;
    }
    if (this._quadratic) {
      var a = this._points[0], b = this._points[this._points.length - 1], q = this._quadratic;
      var c1 = { x: a.x + (2 / 3) * (q.x - a.x), y: a.y + (2 / 3) * (q.y - a.y) };
      var c2 = { x: b.x + (2 / 3) * (q.x - b.x), y: b.y + (2 / 3) * (q.y - b.y) };
      this._append("  bezier(" + this._pt(a.x, a.y, 3) + ", " + this._pt(b.x, b.y, 3) + ", " + this._pt(c1.x, c1.y, 3) + ", " + this._pt(c2.x, c2.y, 3) + ", stroke: " + fixed(this.lineWidth * 0.75, 2) + "pt)\n");
      return;
    }
    this._append(
      "  line(" +
      this._pointList() +
      ", stroke: " +
      fixed(this.lineWidth * 0.75, 2) +
      "pt)\n");
  };

  // only used for arrowheads
  this.fill = function () {
    if (this._points.length < 3) return;
    this._append(
      "  line(" +
      this._pointList() +
      ", close: true, fill: black, stroke: none)\n");
  };

  this.measureText = function (text) {
    var c = canvas.getContext("2d");
    c.font = styleFontCSS(styleLinkFontSize);
    return c.measureText(text);
  };

  this.advancedFillText = function (text, originalText, x, y, angleOrNull) {
    if (text.replace(/ /g, "").length == 0) return;
    var anchor = "center";
    // x and y start as the text center; move to one side when angleOrNull != null
    if (angleOrNull != null) {
      var width = this.measureText(text).width;
      var dx = Math.cos(angleOrNull);
      var dy = Math.sin(angleOrNull);
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          anchor = "west";
          x -= width / 2;
        } else {
          anchor = "east";
          x += width / 2;
        }
      } else {
        if (dy > 0) {
          anchor = "north";
          y -= styleLinkFontSize / 2;
        } else {
          anchor = "south";
          y += styleLinkFontSize / 2;
        }
      }
    }
    x *= this._scale;
    y *= this._scale;
    this._append(
      "  content(" +
      this._pt(x, y, 3) +
      ", text(font: " +
      JSON.stringify(styleFontName) +
      ", size: " +
      fixed((angleOrNull == null ? styleStateFontSize : styleLinkFontSize) * 0.75, 2) +
      "pt, $" +
      labelToTypstMath(originalText) +
      '$), anchor: "' +
      anchor +
      '")\n');
  };

  this.translate = this.save = this.restore = this.clearRect = function () {};
}
