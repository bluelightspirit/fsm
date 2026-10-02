/*
 Finite State Machine Designer (http://madebyevan.com/fsm/)
 License: MIT License (see below)

 Copyright (c) 2010 Evan Wallace

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
*/

// draw using this instead of a canvas and call toLaTeX() afterward
function ExportAsLaTeX() {
  this._points = [];
  this._quadratic = null;
  this._texData = "";
  this.lineWidth = 1; // set by drawUsing()
  this.strokeStyle = "black";
  this._opts = function () {
    return this.strokeStyle + ", line width=" + fixed(this.lineWidth * 0.75, 2) + "pt";
  };
  this.beginNodeClip = function (page, margins, ppi, pageW, pageH) {
    this._texData += "\\begin{scope}\n\\clip (" + (margins.left * ppi * 0.1).toFixed(3) + "," + (-(page * pageH + margins.top * ppi) * 0.1).toFixed(3) + ") rectangle (" + ((pageW - margins.right * ppi) * 0.1).toFixed(3) + "," + (-(page * pageH + pageH - margins.bottom * ppi) * 0.1).toFixed(3) + ");\n";
  };
  this.endNodeClip = function () { this._texData += "\\end{scope}\n"; };
  this.beginArrowClip = function (pages, margins, ppi, pageW, pageH) {
    this._texData += "\\begin{scope}\n\\clip ";
    for (var p = 0; p < pages; p++) {
      if (p) this._texData += " ";
      this._texData += "(" + (margins.left * ppi * 0.1).toFixed(3) + "," + (-(p * pageH + margins.top * ppi) * 0.1).toFixed(3) + ") rectangle (" + ((pageW - margins.right * ppi) * 0.1).toFixed(3) + "," + (-(p * pageH + pageH - margins.bottom * ppi) * 0.1).toFixed(3) + ")";
    }
    this._texData += ";\n";
  };
  this.endArrowClip = function () { this._texData += "\\end{scope}\n"; };
  this.drawCurveHandle = function (x, y, r) {
    this._texData += "\\filldraw[fill=white,draw=black,line width=1.5pt] (" + fixed(x * this._scale, 3) + "," + fixed(-y * this._scale, 3) + ") circle (" + fixed(r * this._scale, 3) + ");\n";
  };
  this._scale = 0.1; // to convert pixels to document space (TikZ breaks if the numbers get too big, above 500?)

  this._fitPageData = function (data, page, margins, fit) {
    var height = pageHeightPx();
    data = data.replace(/\((-?[0-9.]+),(-?[0-9.]+)\)/g, function (m, x, y) {
      var px = Number(x) / 0.1;
      var py = -Number(y) / 0.1 - page * height;
      var outX = fit.x * PX_PER_INCH + px * fit.scale;
      var outY = fit.y * PX_PER_INCH + py * fit.scale;
      return "(" + fixed(outX * 0.1, 3) + "," + fixed(-outY * 0.1, 3) + ")";
    });
    data = data.replace(/circle \(([0-9.]+)\)/g, function (m, r) { return "circle (" + fixed(Number(r) * fit.scale, 3) + ")"; });
    data = data.replace(/:([0-9.]+)\)/g, function (m, r) { return ":" + fixed(Number(r) * fit.scale, 3) + ")"; });
    data = data.replace(/line width=([0-9.]+)pt/g, function (m, n) { return "line width=" + fixed(Number(n) * fit.scale, 2) + "pt"; });
    data = data.replace(/\\fontsize\{([0-9.]+)\}\{([0-9.]+)\}/g, function (m, size, baseline) {
      return "\\fontsize{" + fixed(Number(size) * fit.scale, 2) + "}{" + fixed(Number(baseline) * fit.scale, 2) + "}";
    });
    return data;
  };

  // json: optional snapshot string, embedded as a comment so the diagram can be restored later.
  // standalone: full document (cropped to the diagram) vs. just the tikzpicture to paste.
  this.toLaTeX = function (json, standalone, pages, margins, constrainMargins, pageMode) {
    var data = json ? "% fsm-data: " + String(json).replace(/[\r\n]+/g, " ") + "\n" : "";
    pages = Math.max(1, Math.min(20, Math.round(pages || 1)));
    margins = margins || { top: 1, bottom: 1, left: 1, right: 1 };
    var paged = "";
    var pageSize = PAGE_SIZES[pageSizeKey];
    var width = pageSize.w * 9.6, height = pageSize.h * 9.6;
    var outputPages = pageMode === false ? 1 : pages;
    if (pageMode === false) height *= pages;
    for (var p = 0; p < outputPages; p++) {
      if (p && !standalone) paged += "\\FSMPageBreak\n";
      var pageData = this._texData;
      if (pageMode !== false && p) pageData = pageData.replace(/\((-?[0-9.]+),(-?[0-9.]+)\)/g, function (m, x, y) {
        return "(" + x + "," + (Number(y) + p * pageHeightPx() * 0.1) + ")";
      });
      var picture =
        "\\begin{tikzpicture}[x=0.264583cm,y=0.264583cm]\n" +
        "\\path[use as bounding box] (0,0) rectangle (" + width.toFixed(3) + "," + (-height).toFixed(3) + ");\n" +
        "\\clip (0,0) rectangle (" + width.toFixed(3) + "," + (-height).toFixed(3) + ");\n" +
        "\\tikzstyle{every node}+=[inner sep=0pt]\n" +
        pageData +
        "\\end{tikzpicture}\n";
      if (!standalone && pageMode !== false) {
        picture =
          "\\thispagestyle{empty}\n" +
          "\\begin{tikzpicture}[remember picture,overlay]\n" +
          "\\begin{scope}[shift={(current page.north west)}]\n" +
          "\\begin{scope}[x=0.264583cm,y=0.264583cm]\n" +
          "\\clip (0,0) rectangle (" + width.toFixed(3) + "," + (-height).toFixed(3) + ");\n" +
          "\\tikzstyle{every node}+=[inner sep=0pt]\n" + pageData +
          "\\end{scope}\n\\end{scope}\n\\end{tikzpicture}\\null\n";
      }
      paged += picture;
    }
    if (!standalone) return data +
      "% needs \\usepackage{tikz}; set the host document to the selected paper size.\n" +
      "% If the host uses the standalone class, add the tikz option to its documentclass in the preamble.\n" +
      "\\providecommand{\\FSMPageBreak}{\\newpage}\n" + paged;
    return (
      data +
      "\\documentclass[tikz,border=0pt]{standalone}\n" +
      "\\usepackage{tikz}\n" +
      "\\pagestyle{empty}\n\\setlength{\\parindent}{0pt}\n\\setlength{\\parskip}{0pt}\n" +
      "\n" +
      "\\begin{document}\n" +
      paged +
      "\\end{document}\n"
    );
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
      this._texData +=
        "\\draw [" +
        this._opts() +
        "] (" +
        fixed(x, 3) +
        "," +
        fixed(-y, 3) +
        ") circle (" +
        fixed(radius, 3) +
        ");\n";
    } else {
      if (isReversed) {
        var temp = startAngle;
        startAngle = endAngle;
        endAngle = temp;
      }
      if (endAngle < startAngle) {
        endAngle += Math.PI * 2;
      }
      // TikZ needs the angles to be in between -2pi and 2pi or it breaks
      if (Math.min(startAngle, endAngle) < -2 * Math.PI) {
        startAngle += 2 * Math.PI;
        endAngle += 2 * Math.PI;
      } else if (Math.max(startAngle, endAngle) > 2 * Math.PI) {
        startAngle -= 2 * Math.PI;
        endAngle -= 2 * Math.PI;
      }
      startAngle = -startAngle;
      endAngle = -endAngle;
      this._texData +=
        "\\draw [" +
        this._opts() +
        "] (" +
        fixed(x + radius * Math.cos(startAngle), 3) +
        "," +
        fixed(-y + radius * Math.sin(startAngle), 3) +
        ") arc (" +
        fixed((startAngle * 180) / Math.PI, 5) +
        ":" +
        fixed((endAngle * 180) / Math.PI, 5) +
        ":" +
        fixed(radius, 3) +
        ");\n";
    }
  };
  this.moveTo = this.lineTo = function (x, y) {
    x *= this._scale;
    y *= this._scale;
    this._points.push({ x: x, y: y });
  };
  this.quadraticCurveTo = function (cx, cy, x, y) {
    this._quadratic = { cx: cx * this._scale, cy: cy * this._scale };
    this._points.push({ x: x * this._scale, y: y * this._scale });
  };
  this.bezierCurveTo = function (c1x, c1y, c2x, c2y, x, y) {
    this._points.push({ x: x * this._scale, y: y * this._scale, c1: { x: c1x * this._scale, y: c1y * this._scale }, c2: { x: c2x * this._scale, y: c2y * this._scale } });
  };
  this.stroke = function () {
    if (this._points.length == 0) return;
    if (this._points.some(function (point) { return !!point.c1; }) && this._points.length >= 2) {
      var first = this._points[0];
      this._texData += "\\draw [" + this._opts() + "] (" + fixed(first.x, 3) + "," + fixed(-first.y, 3) + ")";
      for (var ci = 1; ci < this._points.length; ci++) {
        var curvePoint = this._points[ci];
        if (curvePoint.c1) this._texData += " .. controls (" + fixed(curvePoint.c1.x, 3) + "," + fixed(-curvePoint.c1.y, 3) + ") and (" + fixed(curvePoint.c2.x, 3) + "," + fixed(-curvePoint.c2.y, 3) + ") .. (" + fixed(curvePoint.x, 3) + "," + fixed(-curvePoint.y, 3) + ")";
        else this._texData += " -- (" + fixed(curvePoint.x, 3) + "," + fixed(-curvePoint.y, 3) + ")";
      }
      this._texData += ";\n";
      return;
    }
    if (this._quadratic && this._points.length >= 2) {
      var a = this._points[0], b = this._points[this._points.length - 1], q = this._quadratic;
      var c1 = { x: a.x + (2 / 3) * (q.cx - a.x), y: a.y + (2 / 3) * (q.cy - a.y) };
      var c2 = { x: b.x + (2 / 3) * (q.cx - b.x), y: b.y + (2 / 3) * (q.cy - b.y) };
      this._texData += "\\draw [" + this._opts() + "] (" + fixed(a.x, 3) + "," + fixed(-a.y, 3) + ") .. controls (" + fixed(c1.x, 3) + "," + fixed(-c1.y, 3) + ") and (" + fixed(c2.x, 3) + "," + fixed(-c2.y, 3) + ") .. (" + fixed(b.x, 3) + "," + fixed(-b.y, 3) + ");\n";
      return;
    }
    this._texData += "\\draw [" + this._opts() + "]";
    for (var i = 0; i < this._points.length; i++) {
      var p = this._points[i];
      this._texData +=
        (i > 0 ? " --" : "") +
        " (" +
        fixed(p.x, 2) +
        "," +
        fixed(-p.y, 2) +
        ")";
    }
    this._texData += ";\n";
  };
  this.fill = function () {
    if (this._points.length == 0) return;
    this._texData += "\\fill [" + this._opts() + "]";
    for (var i = 0; i < this._points.length; i++) {
      var p = this._points[i];
      this._texData +=
        (i > 0 ? " --" : "") +
        " (" +
        fixed(p.x, 2) +
        "," +
        fixed(-p.y, 2) +
        ")";
    }
    this._texData += ";\n";
  };
  this.measureText = function (text) {
    var c = canvas.getContext("2d");
    c.font = styleFontCSS(styleLinkFontSize);
    return c.measureText(text);
  };
  this.advancedFillText = function (text, originalText, x, y, angleOrNull) {
    if (text.replace(" ", "").length > 0) {
      var nodeParams = "";
      // x and y start off as the center of the text, but will be moved to one side of the box when angleOrNull != null
      if (angleOrNull != null) {
        var width = this.measureText(text).width;
        var dx = Math.cos(angleOrNull);
        var dy = Math.sin(angleOrNull);
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) ((nodeParams = "[right] "), (x -= width / 2));
          else ((nodeParams = "[left] "), (x += width / 2));
        } else {
          if (dy > 0) ((nodeParams = "[below] "), (y -= styleLinkFontSize / 2));
          else ((nodeParams = "[above] "), (y += styleLinkFontSize / 2));
        }
      }
      x *= this._scale;
      y *= this._scale;
      this._texData +=
        "\\draw (" +
        fixed(x, 2) +
        "," +
        fixed(-y, 2) +
        ") node " +
        latexNodeParams(nodeParams, angleOrNull) +
        "{$" +
        labelToLatexMath(originalText) +
        "$};\n";
    }
  };

  this.translate = this.save = this.restore = this.clearRect = function () {};
}

// draw using this instead of a canvas and call toSVG() afterward
// Honors c.font (size and family), so state labels, line labels and subscripts
// keep the sizes they have on screen.
function ExportAsSVG() {
  this.fillStyle = "black";
  this.strokeStyle = "black";
  this.lineWidth = 1;
  this.font = '20px "Times New Roman", serif';
  this._points = [];
  this._svgData = "";
  this._transX = 0;
  this._transY = 0;
  this.beginNodeClip = function (page, margins, ppi, pageW, pageH) {
    var clipId = "fsm-node-page-" + page;
    this._svgData += '<defs><clipPath id="' + clipId + '" clipPathUnits="userSpaceOnUse"><rect x="' + margins.left * ppi + '" y="' + (page * pageH + margins.top * ppi) + '" width="' + (pageW - (margins.left + margins.right) * ppi) + '" height="' + (pageH - (margins.top + margins.bottom) * ppi) + '"/></clipPath></defs>\n<g clip-path="url(#' + clipId + ')">\n';
  };
  this.endNodeClip = function () { this._svgData += "</g>\n"; };
  this.beginArrowClip = function (pages, margins, ppi, pageW, pageH) {
    var rects = [];
    for (var p = 0; p < pages; p++) {
      rects.push('<rect x="' + margins.left * ppi + '" y="' + (p * pageH + margins.top * ppi) + '" width="' + (pageW - (margins.left + margins.right) * ppi) + '" height="' + (pageH - (margins.top + margins.bottom) * ppi) + '"/>');
    }
    this._svgData += '<defs><clipPath id="fsm-arrow-pages" clipPathUnits="userSpaceOnUse">' + rects.join("") + '</clipPath></defs>\n<g clip-path="url(#fsm-arrow-pages)">\n';
  };
  this.endArrowClip = function () { this._svgData += "</g>\n"; };
  this.drawCurveHandle = function (x, y, r) {
    x += this._transX; y += this._transY;
    this._svgData += '<circle cx="' + fixed(x, 3) + '" cy="' + fixed(y, 3) + '" r="' + fixed(r, 2) + '" fill="white" stroke="black" stroke-width="2"/>\n';
  };

  this.toSVG = function (pages, margins, constrainMargins, pageMode, pageIndex) {
    pages = pages || 1;
    margins = margins || { top: 1, bottom: 1, left: 1, right: 1 };
    var fallbackW = (typeof canvas !== "undefined" && canvas.width) || 800;
    var fallbackH = (typeof canvas !== "undefined" && canvas.height) || 600;
    var pageH = typeof pageHeightPx === "function" ? pageHeightPx() : fallbackH;
    var pageW = typeof pageWidthPx === "function" ? pageWidthPx() : fallbackW;
    var paged = pageMode !== false;
    var top = paged ? (pageIndex || 0) * pageH : 0;
    var outW = paged ? pageW : pageW;
    var outH = paged ? pageH : pageH * pages;
    var body = paged ? '<g transform="translate(0 ' + (-top) + ')">\n' + this._svgData + "</g>\n" : this._svgData;
    if (paged && constrainMargins) {
      var clipId = "fsm-printable-page";
      var clip = '<defs><clipPath id="' + clipId + '" clipPathUnits="userSpaceOnUse"><rect x="' + margins.left * PX_PER_INCH + '" y="' + margins.top * PX_PER_INCH + '" width="' + (pageW - (margins.left + margins.right) * PX_PER_INCH) + '" height="' + (pageH - (margins.top + margins.bottom) * PX_PER_INCH) + '"/></clipPath></defs>\n';
      body = clip + '<g clip-path="url(#' + clipId + ')">\n' + body + '</g>\n';
    }
    return (
      '<?xml version="1.0" standalone="no"?>\n' +
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n\n' +
      '<svg width="' + outW + '" height="' + outH + '" viewBox="0 0 ' + outW + ' ' + outH + '" version="1.1" xmlns="http://www.w3.org/2000/svg">\n' +
      body +
      "</svg>\n"
    );
  };

  this._strokeAttrs = function () {
    return 'stroke="' + this.strokeStyle + '" stroke-width="' + this.lineWidth + '" fill="none"';
  };

  this.beginPath = function () {
    this._points = [];
  };

  this.arc = function (x, y, radius, startAngle, endAngle, isReversed) {
    x += this._transX;
    y += this._transY;
    if (endAngle - startAngle == Math.PI * 2) {
      this._svgData +=
        "\t<ellipse " + this._strokeAttrs() +
        ' cx="' + fixed(x, 3) + '" cy="' + fixed(y, 3) +
        '" rx="' + fixed(radius, 3) + '" ry="' + fixed(radius, 3) + '"/>\n';
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
    var startX = x + radius * Math.cos(startAngle);
    var startY = y + radius * Math.sin(startAngle);
    var endX = x + radius * Math.cos(endAngle);
    var endY = y + radius * Math.sin(endAngle);
    var large = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
    this._svgData +=
      "\t<path " + this._strokeAttrs() + ' d="' +
      "M " + fixed(startX, 3) + "," + fixed(startY, 3) + " " +
      "A " + fixed(radius, 3) + "," + fixed(radius, 3) + " 0 " + large + " 1 " +
      fixed(endX, 3) + "," + fixed(endY, 3) + '"/>\n';
  };

  this.moveTo = this.lineTo = function (x, y) {
    this._points.push({ x: x + this._transX, y: y + this._transY });
  };
  this.quadraticCurveTo = function (cx, cy, x, y) {
    this._points.push({ type: "Q", cx: cx + this._transX, cy: cy + this._transY, x: x + this._transX, y: y + this._transY });
  };
  this.bezierCurveTo = function (c1x, c1y, c2x, c2y, x, y) {
    this._points.push({ type: "C", c1x: c1x + this._transX, c1y: c1y + this._transY, c2x: c2x + this._transX, c2y: c2y + this._transY, x: x + this._transX, y: y + this._transY });
  };

  this.stroke = function () {
    if (this._points.length == 0) return;
    var d = "";
    for (var i = 0; i < this._points.length; i++) {
      var point = this._points[i];
      if (point.type === "Q") d += "Q " + fixed(point.cx, 3) + "," + fixed(point.cy, 3) + " " + fixed(point.x, 3) + "," + fixed(point.y, 3) + " ";
      else if (point.type === "C") d += "C " + fixed(point.c1x, 3) + "," + fixed(point.c1y, 3) + " " + fixed(point.c2x, 3) + "," + fixed(point.c2y, 3) + " " + fixed(point.x, 3) + "," + fixed(point.y, 3) + " ";
      else d += (i == 0 ? "M" : "L") + " " + fixed(point.x, 3) + "," + fixed(point.y, 3) + " ";
    }
    this._svgData += "\t<path " + this._strokeAttrs() + ' d="' + d + '"/>\n';
  };

  this.fill = function () {
    if (this._points.length == 0) return;
    var pts = [];
    for (var i = 0; i < this._points.length; i++) {
      pts.push(fixed(this._points[i].x, 3) + "," + fixed(this._points[i].y, 3));
    }
    this._svgData +=
      '\t<polygon fill="' + this.fillStyle + '" stroke-width="' + this.lineWidth +
      '" points="' + pts.join(" ") + '"/>\n';
  };

  this.measureText = function (text) {
    var c = canvas.getContext("2d");
    c.font = this.font;
    return c.measureText(text);
  };

  this.fillText = function (text, x, y) {
    x += this._transX;
    y += this._transY;
    text = textToXML(text);
    if (text.replace(/ /g, "").length == 0) return;
    var m = /^([\d.]+)px\s+(.*)$/.exec(this.font);
    var size = m ? parseFloat(m[1]) : 20;
    var family = (m ? m[2] : "Times New Roman").replace(/"/g, "'");
    this._svgData +=
      '\t<text x="' + fixed(x, 3) + '" y="' + fixed(y, 3) +
      '" font-family="' + family + '" font-size="' + fixed(size, 2) +
      '" fill="' + this.fillStyle + '">' + text + "</text>\n";
  };

  this.translate = function (x, y) {
    this._transX = x;
    this._transY = y;
  };
  this.save = this.restore = this.clearRect = function () {};
}

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
  select.title = "Formal (theory): pyformlang.Regex-compatible syntax (|, +, *, 'epsilon'; multi-character symbols unless separated). Python-style: experimental Python-re-flavored sugar (\\d, [...], ?).";
  [["python", "Python-style regex"], ["theory", "Formal (theory) regex (experimental)"]].forEach(function (pair) {
    var opt = document.createElement("option");
    opt.value = pair[0]; opt.textContent = pair[1];
    select.appendChild(opt);
  });
  select.style.marginLeft = "6px";
  modeSelect.insertAdjacentElement("afterend", select);
  return select;
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
    })
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
  ensureRegexSyntaxSelect();
  regexButton.addEventListener("click", automataGenerateRegex);
  grammarButton.addEventListener("click", automataShowRegularGrammar);
  refreshAutomataPanel(true);
}

// Makes sure the footer credit reads "... Moeein Aali and Gary Young in 2026".
// A no-op when the page source already says so.
function addCreditLine() {
  var footer = document.querySelector("footer");
  if (!footer || footer.textContent.indexOf("Gary Young") >= 0) return;
  footer.appendChild(document.createTextNode(" and "));
  var a = document.createElement("a");
  a.href = "https://github.com/bluelightspirit";
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = "Gary Young";
  footer.appendChild(a);
  footer.appendChild(document.createTextNode(" in 2026"));
}

// Export options row (under the export buttons).
var EXPORT_STANDALONE_KEY = "fsm-export-standalone";
var EXPORT_LAYOUT_KEY = "fsm-export-layout";
var EXPORT_COPY_KEY = "fsm-export-copy";
var EXPORT_DOWNLOAD_KEY = "fsm-export-download";
var exportLayoutMode = "paged";
var exportPpi = 300;
function selectedExportPpi() { return exportPpi; }

function exportPaged() { return exportLayoutMode === "paged"; }
function exportCopyEnabled() { var el = document.getElementById("export-copy"); return el ? el.checked : true; }
function exportDownloadEnabled() { var el = document.getElementById("export-download"); return el ? el.checked : true; }

// true: full page-sized LaTeX document / Typst document.
// false: only the drawing code, ready to paste into your own file.
function exportStandalone() {
  var el = document.getElementById("export-standalone");
  return el ? el.checked : true;
}

function wireExportOptionsUI() {
  if (document.getElementById("export-options")) return;
  var row = document.createElement("div");
  row.id = "export-options";
  row.style.cssText = "margin:8px 0;font-size:0.9rem;display:flex;flex-direction:column;gap:8px;";
  var checksRow = document.createElement("div");
  checksRow.style.cssText = "display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;";
  var settingsRow = document.createElement("div");
  settingsRow.style.cssText = "display:flex;align-items:center;flex-wrap:wrap;gap:8px 18px;";
  var marginLabel = document.createElement("label");
  marginLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin-right:14px;";
  marginLabel.title = "Keep states inside the left and right margins. States and arrows may cross margins or page seams, but each page preview/export clips their visible parts to its printable area.";
  var marginBox = document.createElement("input");
  marginBox.type = "checkbox";
  marginBox.id = "page-constrain-margins";
  marginBox.checked = constrainToMargins;
  marginBox.addEventListener("change", function () { setConstrainToMargins(marginBox.checked, true); commitHistory(); });
  marginLabel.appendChild(marginBox);
  marginLabel.appendChild(document.createTextNode("Clip diagram to printable areas"));
  checksRow.appendChild(marginLabel);

  var curveLabel = document.createElement("label");
  curveLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin-right:14px;";
  curveLabel.title = "Show the two draggable control dots for each page segment of a curved arrow. This only changes the editor view.";
  var curveBox = document.createElement("input");
  curveBox.type = "checkbox";
  curveBox.id = "show-curve-handles";
  try { var showSaved = localStorage.getItem("fsm-show-curve-handles-v2"); showCurveHandles = showSaved === null || showSaved === "1"; } catch (e) { showCurveHandles = true; }
  curveBox.checked = showCurveHandles;
  curveBox.addEventListener("change", function () {
    showCurveHandles = curveBox.checked;
    try { localStorage.setItem("fsm-show-curve-handles-v2", showCurveHandles ? "1" : "0"); } catch (e) {}
    if (typeof draw === "function") draw();
  });
  curveLabel.appendChild(curveBox);
  curveLabel.appendChild(document.createTextNode("Show curve handles"));
  checksRow.appendChild(curveLabel);

  var exportCurveLabel = document.createElement("label");
  exportCurveLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;cursor:pointer;";
  exportCurveLabel.title = "Add the curve control dots to PNG, SVG, LaTeX, and Typst exports for inspection.";
  var exportCurveBox = document.createElement("input");
  exportCurveBox.type = "checkbox";
  exportCurveBox.id = "export-curve-handles";
  try { includeCurveHandlesInExports = localStorage.getItem("fsm-export-curve-handles") === "1"; } catch (e) { includeCurveHandlesInExports = false; }
  exportCurveBox.checked = includeCurveHandlesInExports;
  exportCurveBox.addEventListener("change", function () {
    includeCurveHandlesInExports = exportCurveBox.checked;
    try { localStorage.setItem("fsm-export-curve-handles", includeCurveHandlesInExports ? "1" : "0"); } catch (e) {}
    if (typeof draw === "function") draw();
  });
  exportCurveLabel.appendChild(exportCurveBox);
  exportCurveLabel.appendChild(document.createTextNode("Include curve handles in exports"));
  checksRow.appendChild(exportCurveLabel);

  [["export-copy", EXPORT_COPY_KEY, "Copy export", "Copy source text for SVG, LaTeX, and Typst; copy PNG as an image. For paged PNG/SVG, copy the first page."],
    ["export-download", EXPORT_DOWNLOAD_KEY, "Download export", "Download the selected format. Paged PNG and SVG create one file per page."]].forEach(function (item) {
    var actionLabel = document.createElement("label");
    actionLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;cursor:pointer;";
    var actionBox = document.createElement("input");
    actionBox.type = "checkbox";
    actionBox.id = item[0];
    actionBox.title = item[3];
    try { var savedAction = localStorage.getItem(item[1]); actionBox.checked = savedAction === null || savedAction === "1"; }
    catch (e) { actionBox.checked = true; }
    actionBox.addEventListener("change", function () {
      try { localStorage.setItem(item[1], actionBox.checked ? "1" : "0"); } catch (e) {}
    });
    actionLabel.appendChild(actionBox);
    actionLabel.appendChild(document.createTextNode(item[2]));
    checksRow.appendChild(actionLabel);
  });
  var label = document.createElement("label");
  label.style.cssText = "display:inline-flex;align-items:center;gap:6px;cursor:pointer;";
  label.title = "Controls whether LaTeX includes its document preamble. Export layout is selected separately; Typst always includes the page size needed to match the editor.";
  var box = document.createElement("input");
  box.type = "checkbox";
  box.id = "export-standalone";
  box.checked = true;
  try {
    var saved = localStorage.getItem(EXPORT_STANDALONE_KEY);
    if (saved !== null) box.checked = saved === "1";
  } catch (e) {}
  box.addEventListener("change", function () {
    try {
      localStorage.setItem(EXPORT_STANDALONE_KEY, box.checked ? "1" : "0");
    } catch (e) {}
  });
  label.appendChild(box);
  label.appendChild(
    document.createTextNode("Standalone LaTeX document"),
  );
  checksRow.appendChild(label);

  var layoutLabel = document.createElement("label");
  layoutLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
  layoutLabel.appendChild(document.createTextNode("Export layout"));
  var layout = document.createElement("select");
  layout.id = "export-layout";
  [["paged", "Paper pages (page size and selected margins)"], ["full", "Full diagram (one uncropped tall export)"]].forEach(function (item) {
    var option = document.createElement("option"); option.value = item[0]; option.textContent = item[1]; layout.appendChild(option);
  });
  try { exportLayoutMode = localStorage.getItem(EXPORT_LAYOUT_KEY) || "paged"; } catch (e) { exportLayoutMode = "paged"; }
  if (exportLayoutMode !== "full") exportLayoutMode = "paged";
  layout.value = exportLayoutMode;
  layout.addEventListener("change", function () {
    exportLayoutMode = layout.value;
    try { localStorage.setItem(EXPORT_LAYOUT_KEY, exportLayoutMode); } catch (e) {}
  });
  layoutLabel.appendChild(layout);
  settingsRow.appendChild(layoutLabel);

  var ppiLabel = document.createElement("label");
  ppiLabel.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
  ppiLabel.appendChild(document.createTextNode("PNG resolution"));
  var ppi = document.createElement("select");
  ppi.id = "export-ppi";
  [[96, "96 PPI (screen)"], [144, "144 PPI"], [300, "300 PPI (print)"], [600, "600 PPI"]].forEach(function (item) {
    var option = document.createElement("option"); option.value = item[0]; option.textContent = item[1]; ppi.appendChild(option);
  });
  try { exportPpi = Number(localStorage.getItem("fsm-export-ppi")) || 300; } catch (e) { exportPpi = 300; }
  if ([96, 144, 300, 600].indexOf(exportPpi) < 0) exportPpi = 300;
  ppi.value = String(exportPpi);
  ppi.addEventListener("change", function () {
    exportPpi = Number(ppi.value);
    try { localStorage.setItem("fsm-export-ppi", String(exportPpi)); } catch (e) {}
  });
  ppiLabel.appendChild(ppi);
  settingsRow.appendChild(ppiLabel);

  row.appendChild(checksRow);
  row.appendChild(settingsRow);

  var anchorBtn = document.getElementById("btn-typst") || document.getElementById("btn-latex");
  var host = anchorBtn ? anchorBtn.parentNode : null;
  if (host && host.parentNode) host.parentNode.insertBefore(row, host.nextSibling);
  else canvas.parentNode.appendChild(row);
}

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

  // Arrow labels must stay inside a printable page, even when their natural
  // midpoint falls in a side, top, bottom, or inter-page margin.
  if (angleOrNull != null && constrainToMargins && typeof pageHeightPx === "function") {
    var halfLabelWidth = width / 2 + 3;
    var halfLabelHeight = Math.max(fontSize / 2, lines.length * fontSize * 0.575) + 3;
    var printableLeft = pageMargins.left * PX_PER_INCH;
    var printableRight = pageWidthPx() - pageMargins.right * PX_PER_INCH;
    var printableWidth = Math.max(0, printableRight - printableLeft);
    var clampedHalfWidth = Math.min(halfLabelWidth, printableWidth / 2);
    var bestLabel = null;
    for (var page = 0; page < pageCount; page++) {
      var top = page * pageHeightPx() + pageMargins.top * PX_PER_INCH;
      var bottom = (page + 1) * pageHeightPx() - pageMargins.bottom * PX_PER_INCH;
      var availableHeight = Math.max(0, bottom - top);
      var clampedHalfHeight = Math.min(halfLabelHeight, availableHeight / 2);
      var minX = printableLeft + clampedHalfWidth;
      var maxX = printableRight - clampedHalfWidth;
      var minY = top + clampedHalfHeight;
      var maxY = bottom - clampedHalfHeight;
      var candidateX = Math.max(minX, Math.min(maxX, centerX));
      var candidateY = Math.max(minY, Math.min(maxY, y));
      var dx = candidateX - centerX, dy = candidateY - y;
      var distance = dx * dx + dy * dy;
      if (!bestLabel || distance < bestLabel.distance) {
        bestLabel = { x: candidateX, y: candidateY, distance: distance };
      }
    }
    if (bestLabel) { centerX = bestLabel.x; y = bestLabel.y; }
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
  if (typeof refreshAutomataPanel === "function") refreshAutomataPanel();
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

// History: snapshot-based undo/redo stack for the active FSM.
// Snapshots are JSON strings produced by snapshotJSON()/loadSnapshotJSON() in save.js.

var History = (function () {
  var stack = [];
  var index = -1;
  var LIMIT = 100;
  var listeners = [];

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i]();
      } catch (e) {}
    }
  }

  return {
    push: function (snapshot) {
      // dedupe consecutive identical states
      if (index >= 0 && stack[index] === snapshot) return;
      // drop redo tail
      if (index < stack.length - 1) {
        stack.length = index + 1;
      }
      stack.push(snapshot);
      if (stack.length > LIMIT) {
        stack.shift();
      }
      index = stack.length - 1;
      notify();
    },
    reset: function (snapshot) {
      stack = snapshot != null ? [snapshot] : [];
      index = stack.length - 1;
      notify();
    },
    undo: function () {
      if (index <= 0) return null;
      index--;
      notify();
      return stack[index];
    },
    redo: function () {
      if (index >= stack.length - 1) return null;
      index++;
      notify();
      return stack[index];
    },
    canUndo: function () {
      return index > 0;
    },
    canRedo: function () {
      return index < stack.length - 1;
    },
    onChange: function (fn) {
      listeners.push(fn);
    },
  };
})();

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

// I/O helpers: toast notifications, clipboard, file downloads.

var __toastTimer = null;
function showToast(message, kind) {
	var el = document.getElementById('toast');
	if (!el) return;
	el.textContent = message;
	el.className = 'toast show' + (kind ? ' toast-' + kind : '');
	if (__toastTimer) clearTimeout(__toastTimer);
	__toastTimer = setTimeout(function () {
		el.className = 'toast' + (kind ? ' toast-' + kind : '');
	}, 2200);
}

function copyToClipboard(text) {
	function fallback() {
		try {
			var ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.position = 'fixed';
			ta.style.left = '-9999px';
			ta.style.top = '0';
			document.body.appendChild(ta);
			ta.select();
			ta.setSelectionRange(0, text.length);
			var ok = document.execCommand('copy');
			document.body.removeChild(ta);
			return ok;
		} catch (e) {
			return false;
		}
	}
	if (navigator.clipboard && navigator.clipboard.writeText) {
		return navigator.clipboard.writeText(text).then(
			function () { return true; },
			function () { return fallback(); }
		);
	}
	return Promise.resolve(fallback());
}

function copyPNGCanvasToClipboard(sourceCanvas) {
	if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined' || !sourceCanvas || !sourceCanvas.toBlob) {
		return Promise.resolve(false);
	}
	try {
		var imageBlob = new Promise(function (resolve) {
			sourceCanvas.toBlob(function (blob) { resolve(blob); }, 'image/png');
		});
		return navigator.clipboard.write([new ClipboardItem({ 'image/png': imageBlob })]).then(
			function () { return true; }, function () { return false; }
		);
	} catch (e) { return Promise.resolve(false); }
}

function downloadBlob(filename, content, mime) {
	try {
		var blob = new Blob([content], { type: mime || 'application/octet-stream' });
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
		return true;
	} catch (e) {
		return false;
	}
}

function downloadDataURL(filename, dataURL) {
	try {
		var a = document.createElement('a');
		a.href = dataURL;
		a.download = filename;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		return true;
	} catch (e) {
		return false;
	}
}

function safeFileName(name, ext) {
	var base = (name || 'fsm').replace(/[^A-Za-z0-9._\-؀-ۿݐ-ݿ]+/g, '_');
	if (!base) base = 'fsm';
	return base + '.' + ext;
}

function activeFSMFileName(ext) {
	var name = 'fsm';
	try {
		if (typeof Workspace !== 'undefined') {
			var active = Workspace.getActive();
			if (active && active.name) name = active.name;
		}
	} catch (e) {}
	return safeFileName(name, ext);
}

// Label text parsing shared by the canvas and the exporters.
//   _x       subscript one character:            s_1
//   _a_b     consecutive subscripts join:        s_1_2  =  s_{12}
//   _{...}   subscript a group (or _(...)):      s_{12}
//   \_       toggle subscript mode on/off:       s\_12\_
//   \alpha, \Sigma ... Greek letters (also work inside subscripts)

var SUB_SCALE = 0.7; // subscript font size relative to normal
var SUB_DROP = 0.25; // how far subscripts sit below the baseline (fraction of font size)

function greekAt(text, pos) {
  if (text.charAt(pos) !== "\\") return null;
  for (var i = 0; i < greekLetterNames.length; i++) {
    var name = greekLetterNames[i];
    var offset = i + (i > 16 ? 1 : 0); // skips the final-sigma slot
    if (text.substr(pos + 1, name.length) === name) {
      return {
        raw: "\\" + name,
        t: String.fromCharCode(913 + offset),
        latex: "\\" + name + " ",
        len: name.length + 1,
        greek: true,
      };
    }
    var lower = name.toLowerCase();
    if (text.substr(pos + 1, lower.length) === lower) {
      return {
        raw: "\\" + lower,
        t: String.fromCharCode(945 + offset),
        latex: "\\" + lower + " ",
        len: lower.length + 1,
        greek: true,
      };
    }
  }
  return null;
}

function labelAtomAt(text, pos) {
  if (text.charAt(pos) === "\\" && text.charAt(pos + 1) === "_") return { raw: "_", t: "_", latex: "\\_", len: 2, greek: false };
  var g = greekAt(text, pos);
  if (g) return g;
  var ch = text.charAt(pos);
  var esc = "%&#$".indexOf(ch) >= 0 ? "\\" + ch : ch;
  return { raw: ch, t: ch, latex: esc, len: 1, greek: false };
}

// Returns [{sub: bool, raw, t, atoms}]: raw = source text, t = display text
// (Greek converted to unicode), atoms = the individual characters.
function labelSegments(text) {
  var atoms = [];
  var i = 0;
  var a;
  while (i < text.length) {
    var ch = text.charAt(i);
    if (ch === "_" && i + 1 < text.length) {
      var open = text.charAt(i + 1);
      if (open === "{" || open === "(") {
        var close = open === "{" ? "}" : ")";
        i += 2;
        while (i < text.length && text.charAt(i) !== close) {
          a = labelAtomAt(text, i);
          a.sub = true;
          atoms.push(a);
          i += a.len;
        }
        i += 1; // skip the closing bracket
        continue;
      }
      a = labelAtomAt(text, i + 1);
      a.sub = true;
      atoms.push(a);
      i += 1 + a.len;
      continue;
    }
    // (a trailing lone "_" falls through and shows as a literal underscore while typing)
    a = labelAtomAt(text, i);
    a.sub = false;
    atoms.push(a);
    i += a.len;
  }
  var segs = [];
  for (var k = 0; k < atoms.length; k++) {
    var at = atoms[k];
    var last = segs[segs.length - 1];
    if (last && last.sub === at.sub) {
      last.raw += at.raw;
      last.t += at.t;
      last.atoms.push(at);
    } else {
      segs.push({ sub: at.sub, raw: at.raw, t: at.t, atoms: [at] });
    }
  }
  return segs;
}

function richTextWidth(c, segs, fontSize) {
  var w = 0;
  for (var i = 0; i < segs.length; i++) {
    c.font = styleFontCSS(segs[i].sub ? fontSize * SUB_SCALE : fontSize);
    w += c.measureText(segs[i].t).width;
  }
  c.font = styleFontCSS(fontSize);
  return w;
}

function drawRichSegments(c, segs, x, baselineY, fontSize) {
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    c.font = styleFontCSS(s.sub ? fontSize * SUB_SCALE : fontSize);
    c.fillText(s.t, x, baselineY + (s.sub ? fontSize * SUB_DROP : 0));
    x += c.measureText(s.t).width;
  }
  c.font = styleFontCSS(fontSize);
}

// Words (2+ letters) come out upright like the canvas and Typst; single letters stay math italic.
function latexOfAtoms(atoms) {
  var out = "";
  var run = "";
  function flush() {
    out += run.length > 1 ? "\\mathrm{" + run + "}" : run;
    run = "";
  }
  for (var i = 0; i < atoms.length; i++) {
    var a = atoms[i];
    if (!a.greek && /^[A-Za-z]$/.test(a.raw)) {
      run += a.raw;
      continue;
    }
    flush();
    out += a.raw === " " ? "\\mbox{ }" : a.latex;
  }
  flush();
  return out;
}

function labelToLatexMath(text) {
  var segs = labelSegments(text);
  var out = "";
  for (var i = 0; i < segs.length; i++) {
    var body = latexOfAtoms(segs[i].atoms);
    if (segs[i].sub) out += (out === "" ? "{}" : "") + "_{" + body + "}";
    else out += body;
  }
  return out;
}

// TikZ node options: anchor plus a font size matching the Typst export (text px * 0.55 = pt),
// so labels no longer depend on the size of the document they are pasted into.
function latexNodeParams(nodeParams, angleOrNull) {
  var size = angleOrNull == null ? styleStateFontSize : styleLinkFontSize;
  var pt = fixed(size * 0.75, 2);
  var lead = fixed(size * 0.75 * 1.2, 2);
  var anchor = nodeParams.replace(/[\[\]\s]/g, "");
  return (
    "[" + (anchor ? anchor + ", " : "") + "font=\\fontsize{" + pt + "}{" + lead + "}\\selectfont] "
  );
}

function det(a, b, c, d, e, f, g, h, i) {
  return a * e * i + b * f * g + c * d * h - a * f * h - b * d * i - c * e * g;
}

function circleFromThreePoints(x1, y1, x2, y2, x3, y3) {
  var a = det(x1, y1, 1, x2, y2, 1, x3, y3, 1);
  var bx = -det(
    x1 * x1 + y1 * y1,
    y1,
    1,
    x2 * x2 + y2 * y2,
    y2,
    1,
    x3 * x3 + y3 * y3,
    y3,
    1,
  );
  var by = det(
    x1 * x1 + y1 * y1,
    x1,
    1,
    x2 * x2 + y2 * y2,
    x2,
    1,
    x3 * x3 + y3 * y3,
    x3,
    1,
  );
  var c = -det(
    x1 * x1 + y1 * y1,
    x1,
    y1,
    x2 * x2 + y2 * y2,
    x2,
    y2,
    x3 * x3 + y3 * y3,
    x3,
    y3,
  );
  return {
    x: -bx / (2 * a),
    y: -by / (2 * a),
    radius: Math.sqrt(bx * bx + by * by - 4 * a * c) / (2 * Math.abs(a)),
  };
}

function fixed(number, digits) {
  return number.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

// Side list for renaming states and arrows by typing.
var __namesRows = [];

function nameOfNode(n) {
  var i = nodes.indexOf(n);
  if (i < 0) return "?";
  return nodes[i].text ? nodes[i].text : "#" + (i + 1);
}

function describeObject(o) {
  if (o instanceof SelfLink) return nameOfNode(o.node) + " \u21BA";
  if (o instanceof StartLink) return "start \u2192 " + nameOfNode(o.node);
  if (o instanceof Link) return nameOfNode(o.nodeA) + " \u2192 " + nameOfNode(o.nodeB);
  return "State " + (nodes.indexOf(o) + 1);
}

function buildNamesRow(obj) {
  var row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:6px;padding:2px 4px;border-radius:6px;";
  var desc = document.createElement("span");
  desc.style.cssText =
    "flex:0 0 120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.7;";
  var input = document.createElement("input");
  input.type = "text";
  input.placeholder = links.indexOf(obj) >= 0 ? "arrow label" : "state name";
  input.style.cssText = "flex:1;min-width:0;font-size:1.1rem;padding:4px 8px;";
  input.addEventListener("focus", function () {
    selectedObject = obj;
    draw();
  });
  input.addEventListener("input", function () {
    obj.text = input.value;
    draw();
    commitHistoryDebounced();
  });
  var del = document.createElement("button");
  del.type = "button";
  del.textContent = "\u2715";
  del.title = "Delete";
  del.addEventListener("click", function () {
    selectedObject = obj;
    deleteSelected();
  });
  row.appendChild(desc);
  row.appendChild(input);
  row.appendChild(del);
  return { obj: obj, row: row, desc: desc, input: input };
}

// Called from draw(). Rebuilds the rows only when the set of objects changes,
// otherwise just syncs text, so typing in a box is never interrupted.
function refreshNamesPanel() {
  var list = document.getElementById("names-list");
  if (!list) return;
  var objs = nodes.concat(links);
  var same = objs.length === __namesRows.length;
  for (var i = 0; same && i < objs.length; i++) {
    if (__namesRows[i].obj !== objs[i]) same = false;
  }
  if (!same) {
    list.innerHTML = "";
    __namesRows = objs.map(buildNamesRow);
    if (__namesRows.length === 0) {
      var empty = document.createElement("div");
      empty.style.opacity = "0.6";
      empty.textContent = "No states yet. Double-click the canvas to add one.";
      list.appendChild(empty);
    }
    __namesRows.forEach(function (r) {
      list.appendChild(r.row);
    });
  }
  for (var j = 0; j < __namesRows.length; j++) {
    var r = __namesRows[j];
    var d = describeObject(r.obj);
    if (r.desc.textContent !== d) r.desc.textContent = d;
    if (document.activeElement !== r.input && r.input.value !== r.obj.text) {
      r.input.value = r.obj.text;
    }
    r.row.style.background = r.obj === selectedObject ? "rgba(99,102,241,0.18)" : "transparent";
  }
}

function wireNamesUI() {
  if (document.getElementById("names-panel")) return;
  var panel = document.createElement("div");
  panel.id = "names-panel";
  panel.style.cssText =
    "margin:10px 0;font-size:1rem;width:100%;flex-basis:100%;box-sizing:border-box;";
  var title = document.createElement("div");
  title.textContent = "States & arrows (type to rename)";
  title.style.cssText = "font-weight:600;font-size:1.1rem;margin-bottom:6px;";
  var list = document.createElement("div");
  list.id = "names-list";
  list.style.cssText = "max-height:220px;overflow:auto;";
  panel.appendChild(title);
  panel.appendChild(list);

  // directly below the diagram
  canvas.parentNode.insertBefore(panel, canvas.nextSibling);
  refreshNamesPanel();
}

// Page-sized canvas at 96 px per inch, growing downward one page at a time.
// State x positions stay within the side margins. Y remains continuous across
// pages; rendering clips each state to every page's printable rectangle.

var PX_PER_INCH = 96;
var PAGE_MARGIN_PRESETS = {
  ieee: { label: "IEEE conference", top: 0.75, bottom: 1, left: 0.625, right: 0.625 },
  chicago: { label: "Chicago", top: 1, bottom: 1, left: 1, right: 1 },
  mla: { label: "MLA", top: 1, bottom: 1, left: 1, right: 1 },
  apa: { label: "APA", top: 1, bottom: 1, left: 1, right: 1 },
  custom: { label: "Custom", top: 1, bottom: 1, left: 1, right: 1 },
};
function marginPresetValues(key, sizeKey) {
  if (key === "ieee" && (sizeKey || pageSizeKey) === "a4") return { top: 0.75, bottom: 1.69, left: 0.51, right: 0.51 };
  var p = PAGE_MARGIN_PRESETS[key] || PAGE_MARGIN_PRESETS.apa;
  return { top: p.top, bottom: p.bottom, left: p.left, right: p.right };
}
function inferMarginPreset(margins, sizeKey) {
  if (margins && PAGE_MARGIN_PRESETS[margins.preset]) return margins.preset;
  var keys = ["ieee", "chicago", "mla", "apa", "custom"];
  var matches = [];
  keys.forEach(function (key) {
    var expected = marginPresetValues(key, sizeKey);
    if (["top", "bottom", "left", "right"].every(function (side) {
      var value = Number(margins && margins[side]);
      return isFinite(value) && Math.abs(value - expected[side]) < 0.001;
    })) matches.push(key);
  });
  // IEEE is the only preset with distinctive values. Equal one-inch presets
  // cannot be identified from older exports that omitted their preset key.
  return matches.length === 1 ? matches[0] : "apa";
}
var pageMargins = { preset: "apa", top: 1, bottom: 1, left: 1, right: 1 };
var constrainToMargins = true; // serialized as before; now locks state and label editing to the printable area
var showCurveHandles = true;
var includeCurveHandlesInExports = false;
var MAX_PAGES = 20;
var PAGE_SIZES = { letter: { label: "US Letter", w: 8.5, h: 11 }, a4: { label: "A4", w: 210 / 25.4, h: 297 / 25.4 } };
var pageSizeKey = "letter";
var pageCount = 1;
var __pagesLast = "";

function pageWidthPx() {
  return Math.round(PAGE_SIZES[pageSizeKey].w * PX_PER_INCH);
}
function editorPixelRatio() { return Math.max(1, Number(window.devicePixelRatio) || 1); }

function pageHeightPx() {
  return Math.round(PAGE_SIZES[pageSizeKey].h * PX_PER_INCH);
}

function setPageMargins(margins, redraw) {
  var next = margins || {};
  var preset = inferMarginPreset(next, pageSizeKey);
  var presetValues = marginPresetValues(preset, pageSizeKey);
  pageMargins = { preset: preset };
  ["top", "bottom", "left", "right"].forEach(function (side) {
    var value = Number(next[side]);
    pageMargins[side] = next[side] != null && isFinite(value) ? Math.max(0, Math.min(4, value)) : presetValues[side];
  });
  if (constrainToMargins && typeof nodes !== "undefined") nodes.forEach(function (node) { constrainNodeToMargins(node); });
  syncPagesUI();
  if (redraw && typeof draw === "function") draw();
}

function setPageSize(key, redraw) {
  pageSizeKey = PAGE_SIZES[key] ? key : "letter";
  if (pageMargins.preset !== "custom") {
    var preset = marginPresetValues(pageMargins.preset, pageSizeKey);
    setPageMargins({ preset: pageMargins.preset, top: preset.top, bottom: preset.bottom, left: preset.left, right: preset.right }, false);
  }
  setPageCount(pageCount);
  if (constrainToMargins && typeof nodes !== "undefined") nodes.forEach(function (node) { constrainNodeToMargins(node); });
  var input = document.getElementById("page-size");
  if (input) input.value = pageSizeKey;
  if (redraw && typeof draw === "function") draw();
}

function pageMarginsForExport() {
  return { preset: pageMargins.preset, top: pageMargins.top, bottom: pageMargins.bottom, left: pageMargins.left, right: pageMargins.right };
}

function pageFitLayout(margins) {
  var width = pageWidthPx(), height = pageHeightPx();
  var innerW = width - (margins.left + margins.right) * PX_PER_INCH;
  var innerH = height - (margins.top + margins.bottom) * PX_PER_INCH;
  var safe = Math.max(nodeRadius + styleLinkFontSize + styleArrowSize, styleStateFontSize * 3);
  safe = Math.min(safe, Math.max(0, Math.min(innerW, innerH) / 2 - 2));
  var scale = Math.max(0.01, Math.min((innerW - safe * 2) / width, (innerH - safe * 2) / height));
  return {
    scale: scale,
    x: margins.left + (innerW - width * scale) / (2 * PX_PER_INCH),
    y: margins.top + (innerH - height * scale) / (2 * PX_PER_INCH),
  };
}

function setConstrainToMargins(value, redraw) {
  constrainToMargins = !!value;
  if (constrainToMargins && typeof nodes !== "undefined") nodes.forEach(function (node) { constrainNodeToMargins(node); });
  var input = document.getElementById("page-constrain-margins");
  if (input) input.checked = constrainToMargins;
  __pagesLast = "";
  syncPagesUI();
  if (redraw && typeof draw === "function") draw();
}

function clampToPrintable(x, y, insetX, insetY) {
  insetX = Math.max(0, Number(insetX) || 0);
  insetY = Math.max(0, Number(insetY == null ? insetX : insetY) || 0);
  var w = pageWidthPx(), h = pageHeightPx();
  var p = 0, bestDistance = Infinity, bestY = y;
  for (var candidate = 0; candidate < pageCount; candidate++) {
    var candidateMin = candidate * h + pageMargins.top * PX_PER_INCH + insetY;
    var candidateMax = (candidate + 1) * h - pageMargins.bottom * PX_PER_INCH - insetY;
    if (candidateMax < candidateMin) candidateMin = candidateMax = candidate * h + h / 2;
    var candidateY = Math.max(candidateMin, Math.min(candidateMax, y));
    var distance = Math.abs(candidateY - y);
    if (distance < bestDistance) { bestDistance = distance; p = candidate; bestY = candidateY; }
  }
  var minX = pageMargins.left * PX_PER_INCH + insetX;
  var maxX = w - pageMargins.right * PX_PER_INCH - insetX;
  var minY = p * h + pageMargins.top * PX_PER_INCH + insetY;
  var maxY = (p + 1) * h - pageMargins.bottom * PX_PER_INCH - insetY;
  if (maxX < minX) minX = maxX = w / 2;
  if (maxY < minY) minY = maxY = p * h + h / 2;
  return { x: Math.max(minX, Math.min(maxX, x)), y: bestY, page: p };
}

function constrainNodeToMargins(node) {
  if (!constrainToMargins || !node) return;
  var w = pageWidthPx();
  var textWidth = 0;
  if (canvas && typeof labelSegments === "function") {
    textWidth = richTextWidth(canvas.getContext("2d"), labelSegments(node.text || ""), styleStateFontSize);
  }
  var insetX = Math.max(nodeRadius, textWidth / 2) + 2;
  var insetY = Math.max(nodeRadius, styleStateFontSize * 0.75) + 2;
  var minX = pageMargins.left * PX_PER_INCH + insetX;
  var maxX = w - pageMargins.right * PX_PER_INCH - insetX;
  if (maxX < minX) minX = maxX = w / 2;
  node.x = Math.max(minX, Math.min(maxX, node.x));
  // Keep the first page's top boundary, but let states cross every lower
  // page seam. Rendering projects the crossing fragment into the next page.
  node.y = Math.max(pageMargins.top * PX_PER_INCH + insetY, node.y);
}

function clampNodePosition(x, y) {
  var node = { x: x, y: y };
  constrainNodeToMargins(node);
  return { x: node.x, y: node.y };
}

function lowestContentY() {
  var y = 0;
  for (var i = 0; i < nodes.length; i++) y = Math.max(y, nodes[i].y + nodeRadius);
  return y;
}

function setPageCount(n) {
  n = Math.round(n);
  if (!(n >= 1)) n = 1;
  if (n > MAX_PAGES) n = MAX_PAGES;
  pageCount = n;
  if (typeof canvas !== "undefined" && canvas) {
    var w = pageWidthPx();
    var h = pageHeightPx() * n;
    var ratio = editorPixelRatio();
    if (canvas.width !== Math.round(w * ratio)) canvas.width = Math.round(w * ratio);
    if (canvas.height !== Math.round(h * ratio)) canvas.height = Math.round(h * ratio);
    canvas.style.width = "100%";
    canvas.style.maxWidth = w + "px";
    canvas.style.height = "auto";
  }
  __pagesLast = "";
  syncPagesUI();
}

// Drawn behind the diagram, on screen only (exports call drawUsing directly).
function drawPageGuides(c) {
  var fg = getDrawColors().fg;
  var w = pageWidthPx();
  var h = pageHeightPx();
  var mt = pageMargins.top * PX_PER_INCH;
  var mb = pageMargins.bottom * PX_PER_INCH;
  var ml = pageMargins.left * PX_PER_INCH;
  var mr = pageMargins.right * PX_PER_INCH;
  c.save();
  if (c.canvas === canvas && typeof c.scale === "function") c.scale(editorPixelRatio(), editorPixelRatio());
  c.globalCompositeOperation = "destination-over";
  c.strokeStyle = fg;
  c.fillStyle = fg;
  c.lineWidth = 1;
  for (var p = 0; p < pageCount; p++) {
    var top = p * h;
    c.globalAlpha = 0.35;
    c.setLineDash([]);
    c.strokeRect(0.5, top + 0.5, w - 1, h - 1);
    c.globalAlpha = 0.18;
    c.setLineDash([6, 6]);
    c.strokeRect(ml + 0.5, top + mt + 0.5, w - ml - mr, h - mt - mb);
    c.globalAlpha = 0.45;
    c.setLineDash([]);
    c.font = "12px sans-serif";
    c.fillText("Page " + (p + 1), 8, top + 16);
  }
  c.restore();
}

function addPage() {
  if (pageCount >= MAX_PAGES) return;
  flushHistory();
  setPageCount(pageCount + 1);
  draw();
  commitHistory();
}

function removeLastPage() {
  if (pageCount <= 1 || lowestContentY() > (pageCount - 1) * pageHeightPx()) return;
  flushHistory();
  setPageCount(pageCount - 1);
  draw();
  commitHistory();
}

function syncPagesUI() {
  var info = document.getElementById("pages-info");
  var add = document.getElementById("pages-add");
  var remove = document.getElementById("pages-remove");
  if (!info || !add || !remove) return;
  var canRemove = pageCount > 1 && lowestContentY() <= (pageCount - 1) * pageHeightPx();
  var key = pageCount + "|" + canRemove + "|" + JSON.stringify(pageMargins) + "|" + constrainToMargins + "|" + pageSizeKey;
  if (key === __pagesLast) return;
  __pagesLast = key;
  var size = PAGE_SIZES[pageSizeKey];
  info.textContent =
    pageCount + (pageCount === 1 ? " page" : " pages") + " \u00b7 " + size.label + " " +
    size.w.toFixed(2) + "\u00d7" + size.h.toFixed(2) + " in \u00b7 " + PAGE_MARGIN_PRESETS[pageMargins.preset].label +
    " margins (T " + pageMargins.top + ' in, B ' + pageMargins.bottom + ' in, L ' + pageMargins.left + ' in, R ' + pageMargins.right + " in)";
  remove.disabled = !canRemove;
  remove.title = canRemove || pageCount === 1 ? "" : "Move everything off the last page first";
  add.disabled = pageCount >= MAX_PAGES;
  var presetInput = document.getElementById("page-margin-preset");
  if (presetInput) presetInput.value = pageMargins.preset;
  var constrainInput = document.getElementById("page-constrain-margins");
  if (constrainInput) constrainInput.checked = constrainToMargins;
  ["top", "bottom", "left", "right"].forEach(function (side) {
    var input = document.getElementById("page-margin-" + side);
    if (input && document.activeElement !== input) input.value = pageMargins[side];
  });
}

function wirePagesUI() {
  if (document.getElementById("pages-row")) return;
  var row = document.createElement("div");
  row.id = "pages-row";
  row.style.cssText =
    "display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:8px 0;font-size:0.95rem;width:100%;flex-basis:100%;box-sizing:border-box;";
  var add = document.createElement("button");
  add.type = "button";
  add.id = "pages-add";
  add.textContent = "+ Add page";
  add.onclick = addPage;
  var remove = document.createElement("button");
  remove.type = "button";
  remove.id = "pages-remove";
  remove.textContent = "\u2212 Remove last page";
  remove.onclick = removeLastPage;
  var info = document.createElement("span");
  info.id = "pages-info";
  info.style.opacity = "0.75";
  row.appendChild(add);
  row.appendChild(remove);
  var settings = document.createElement("div");
  settings.id = "page-settings-row";
  settings.style.cssText = row.style.cssText;
  var preset = document.createElement("select");
  preset.id = "page-margin-preset";
  Object.keys(PAGE_MARGIN_PRESETS).forEach(function (key) {
    var option = document.createElement("option");
    option.value = key;
    option.textContent = PAGE_MARGIN_PRESETS[key].label;
    preset.appendChild(option);
  });
  preset.value = pageMargins.preset;
  var sizeSelect = document.createElement("select");
  sizeSelect.id = "page-size";
  Object.keys(PAGE_SIZES).forEach(function (key) {
    var option = document.createElement("option"); option.value = key; option.textContent = PAGE_SIZES[key].label;
    sizeSelect.appendChild(option);
  });
  sizeSelect.value = pageSizeKey;
  sizeSelect.addEventListener("change", function () { setPageSize(sizeSelect.value, true); preset.value = pageMargins.preset; syncPagesUI(); commitHistory(); });
  settings.appendChild(sizeSelect);
  settings.appendChild(preset);
  var customInputs = {};
  ["top", "bottom", "left", "right"].forEach(function (side) {
    var label = document.createElement("label");
    label.style.cssText = "display:flex;align-items:center;gap:3px;";
    label.appendChild(document.createTextNode(side.charAt(0).toUpperCase() + side.slice(1)));
    var input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "4";
    input.step = "0.125";
    input.value = pageMargins[side];
    input.id = "page-margin-" + side;
    input.style.width = "60px";
    input.setAttribute("aria-label", side + " margin in inches");
    input.addEventListener("change", function () {
      var next = { preset: "custom" };
      ["top", "bottom", "left", "right"].forEach(function (s) { next[s] = customInputs[s].value; });
      setPageMargins(next, true);
      preset.value = "custom";
      ["top", "bottom", "left", "right"].forEach(function (s) { customInputs[s].value = pageMargins[s]; });
      commitHistory();
    });
    customInputs[side] = input;
    label.appendChild(input);
      settings.appendChild(label);
  });
  preset.addEventListener("change", function () {
    var p = marginPresetValues(preset.value);
    setPageMargins({ preset: preset.value, top: p.top, bottom: p.bottom, left: p.left, right: p.right }, true);
    ["top", "bottom", "left", "right"].forEach(function (s) { customInputs[s].value = pageMargins[s]; });
    commitHistory();
  });
  row.appendChild(info);
  canvas.parentNode.insertBefore(row, canvas.nextSibling); // directly under the diagram
  canvas.parentNode.insertBefore(settings, row.nextSibling);
  setPageCount(pageCount); // size the canvas even when nothing was loaded
  wireTypstHelp(settings);
}

function wireTypstHelp(anchor) {
  if (document.getElementById("typst-compile-help")) return;
  var details = document.createElement("details");
  details.id = "typst-compile-help";
  details.style.cssText = "margin:8px 0 18px;font-size:0.9rem;";
  var summary = document.createElement("summary");
  summary.textContent = "Compile Typst to a multi-page PDF or separate PNG files";
  details.appendChild(summary);
  var help = document.createElement("p");
  help.style.cssText = "margin:6px 0;";
  help.textContent = "With the Typst CLI installed, run the appropriate command from the folder containing your .typ file:";
  details.appendChild(help);
  var ppiNote = document.createElement("p");
  ppiNote.textContent = "Typst PDF output stays vector sharp at any zoom. PNG defaults to 144 PPI; use --ppi 300 or --ppi 600 for print quality. The export PNG resolution selector changes this only for PNG downloads from the editor.";
  details.appendChild(ppiNote);
  [["PowerShell", 'typst compile "FSM_1.typ" "FSM_1.pdf"', 'typst compile "FSM_1.typ" "page-{0p}.png"'],
   ["macOS Terminal", 'typst compile "FSM_1.typ" "FSM_1.pdf"', 'typst compile "FSM_1.typ" "page-{0p}.png"'],
   ["Linux Terminal", 'typst compile "FSM_1.typ" "FSM_1.pdf"', 'typst compile "FSM_1.typ" "page-{0p}.png"']].forEach(function (entry) {
    var section = document.createElement("p");
    section.style.cssText = "margin:8px 0 4px;font-weight:600;";
    section.textContent = entry[0];
    var code = document.createElement("pre");
    code.style.cssText = "white-space:pre-wrap;margin:0 0 8px;padding:8px;background:rgba(127,127,127,.12);border-radius:4px;";
    code.textContent = "PDF:  " + entry[1] + "\nPNGs (screen): " + entry[2] + "\nPNGs (print, 300 PPI): typst compile --ppi 300 \"FSM_1.typ\" \"page-{0p}.png\"\nPNGs (print, 600 PPI): typst compile --ppi 600 \"FSM_1.typ\" \"page-{0p}.png\"";
    details.appendChild(section);
    details.appendChild(code);
  });
  anchor.parentNode.insertBefore(details, anchor.nextSibling);
}


// Serialization helpers for the active FSM.
// Reads/writes the active FSM via Workspace.

function serializeState() {
  var data = { nodes: [], links: [], style: getStyle(), pages: pageCount, pageSize: pageSizeKey, margins: pageMarginsForExport(), constrainToMargins: constrainToMargins };
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    data.nodes.push({
      x: node.x,
      y: node.y,
      text: node.text,
      isAcceptState: node.isAcceptState,
    });
  }
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var backupLink = null;
    if (link instanceof SelfLink) {
      backupLink = {
        type: "SelfLink",
        node: nodes.indexOf(link.node),
        text: link.text,
        labelDx: link.labelDx,
        labelDy: link.labelDy,
        anchorAngle: link.anchorAngle,
      };
    } else if (link instanceof StartLink) {
      backupLink = {
        type: "StartLink",
        node: nodes.indexOf(link.node),
        text: link.text,
        labelDx: link.labelDx,
        labelDy: link.labelDy,
        deltaX: link.deltaX,
        deltaY: link.deltaY,
      };
    } else if (link instanceof Link) {
      backupLink = {
        type: "Link",
        nodeA: nodes.indexOf(link.nodeA),
        nodeB: nodes.indexOf(link.nodeB),
        text: link.text,
        labelDx: link.labelDx,
        labelDy: link.labelDy,
        lineAngleAdjust: link.lineAngleAdjust,
        parallelPart: link.parallelPart,
        perpendicularPart: link.perpendicularPart,
        curvePoints: link.curvePoints,
      };
    }
    if (backupLink) data.links.push(backupLink);
  }
  return data;
}

function deserializeState(data) {
  nodes.length = 0;
  links.length = 0;
  selectedObject = null;
  if (!data || !data.nodes) return;
  applyStyle(data.style, false);
  setPageSize(data.pageSize || "letter", false);
  setPageCount(data.pages || 1);
  setPageMargins(data.margins || PAGE_MARGIN_PRESETS.apa, false);
  setConstrainToMargins(data.constrainToMargins !== false, false);
  if (typeof syncStyleInputs === "function") syncStyleInputs();
  for (var i = 0; i < data.nodes.length; i++) {
    var bn = data.nodes[i];
    var node = new Node(bn.x, bn.y);
    node.isAcceptState = !!bn.isAcceptState;
    node.text = bn.text || "";
    nodes.push(node);
  }
  for (var i = 0; i < data.links.length; i++) {
    var bl = data.links[i];
    var link = null;
    if (bl.type === "SelfLink") {
      link = new SelfLink(nodes[bl.node]);
      link.anchorAngle = bl.anchorAngle;
      link.text = bl.text;
      link.labelDx = bl.labelDx || 0;
      link.labelDy = bl.labelDy || 0;
    } else if (bl.type === "StartLink") {
      link = new StartLink(nodes[bl.node]);
      link.deltaX = bl.deltaX;
      link.deltaY = bl.deltaY;
      link.text = bl.text;
      link.labelDx = bl.labelDx || 0;
      link.labelDy = bl.labelDy || 0;
    } else if (bl.type === "Link") {
      link = new Link(nodes[bl.nodeA], nodes[bl.nodeB]);
      link.parallelPart = bl.parallelPart;
      link.perpendicularPart = bl.perpendicularPart;
      link.curvePoints = Array.isArray(bl.curvePoints) ? bl.curvePoints : null;
      link.text = bl.text;
      link.labelDx = bl.labelDx || 0;
      link.labelDy = bl.labelDy || 0;
      // Older/imported/generated links may omit this optional angle offset.
      // Keep the constructor's zero default so label placement never receives NaN.
      link.lineAngleAdjust = Number(bl.lineAngleAdjust) || 0;
    }
    if (link) links.push(link);
  }
  if (constrainToMargins) nodes.forEach(function (node) { constrainNodeToMargins(node); });
  if (typeof draw === "function") draw();
}

function snapshotJSON() {
  return JSON.stringify(serializeState());
}

function loadSnapshotJSON(json) {
  if (!json) return;
  try {
    deserializeState(JSON.parse(json));
  } catch (e) {}
}

function saveBackup() {
  if (typeof localStorage === "undefined" || !JSON) return;
  if (!Workspace.getActiveId()) return;
  Workspace.saveActive(serializeState());
}

function restoreBackup() {
  if (typeof localStorage === "undefined" || !JSON) return;
  if (!Workspace.getActiveId()) return;
  deserializeState(Workspace.loadActive());
}

// History commit helpers — defined here so other files can call them after mutations.
var __historyTimer = null;

function commitHistory() {
  if (__historyTimer) {
    clearTimeout(__historyTimer);
    __historyTimer = null;
  }
  saveBackup();
  History.push(snapshotJSON());
}

function commitHistoryDebounced() {
  if (__historyTimer) clearTimeout(__historyTimer);
  saveBackup(); // persist data immediately; only history push is debounced
  __historyTimer = setTimeout(function () {
    History.push(snapshotJSON());
    __historyTimer = null;
  }, 400);
}

function flushHistory() {
  if (__historyTimer) {
    clearTimeout(__historyTimer);
    __historyTimer = null;
    History.push(snapshotJSON());
  }
}

// Global diagram style: one value for every state / arrow / label.
// nodeRadius (defined in fsm.js) is reused for the state radius.
var styleStateFontSize = 20; // state names
var styleLinkFontSize = 20; // arrow labels
var styleStateLineWidth = 1; // state outlines
var styleLineWidth = 1; // arrows / lines
var styleArrowSize = 8;
var styleFontName = "Times New Roman";

// [name shown in the menu (also the Typst font name), canvas CSS font stack]
var STYLE_FONTS = [
  ["Times New Roman", '"Times New Roman", Times, serif'],
  ["New Computer Modern", '"CMU Serif", "Latin Modern Roman", "Times New Roman", serif'],
  ["Arial", "Arial, Helvetica, sans-serif"],
  ["Helvetica", "Helvetica, Arial, sans-serif"],
  ["Georgia", "Georgia, serif"],
  ["Palatino Linotype", '"Palatino Linotype", Palatino, "Book Antiqua", serif'],
  ["Cambria", "Cambria, serif"],
  ["Verdana", "Verdana, Geneva, sans-serif"],
  ["Calibri", "Calibri, Carlito, sans-serif"],
  ["Trebuchet MS", '"Trebuchet MS", sans-serif'],
  ["Courier New", '"Courier New", Courier, monospace'],
];

var STYLE_DEFAULTS = {
  stateFontSize: 20,
  linkFontSize: 20,
  nodeRadius: 30,
  stateLineWidth: 1,
  lineWidth: 1,
  arrowSize: 8,
  fontName: "Times New Roman",
};

// [key, label, min, max, step]
var STYLE_FIELDS = [
  ["stateFontSize", "State text", 8, 72, 1],
  ["linkFontSize", "Line text", 8, 72, 1],
  ["nodeRadius", "State radius", 12, 120, 1],
  ["stateLineWidth", "State outline", 0.5, 8, 0.5],
  ["lineWidth", "Line width", 0.5, 8, 0.5],
  ["arrowSize", "Arrowhead", 4, 40, 1],
];

function styleFontKnown(name) {
  for (var i = 0; i < STYLE_FONTS.length; i++) {
    if (STYLE_FONTS[i][0] === name) return true;
  }
  return false;
}

function styleFontStack(name) {
  for (var i = 0; i < STYLE_FONTS.length; i++) {
    if (STYLE_FONTS[i][0] === name) return STYLE_FONTS[i][1];
  }
  return STYLE_FONTS[0][1];
}

function styleFontCSS(size) {
  return size + "px " + styleFontStack(styleFontName);
}

function getStyle() {
  return {
    stateFontSize: styleStateFontSize,
    linkFontSize: styleLinkFontSize,
    nodeRadius: nodeRadius,
    stateLineWidth: styleStateLineWidth,
    lineWidth: styleLineWidth,
    arrowSize: styleArrowSize,
    fontName: styleFontName,
  };
}

// partial=true keeps the current value for any missing/blank field (used while typing);
// otherwise missing fields fall back to the defaults (used when loading a diagram).
function applyStyle(s, partial) {
  var src = {};
  for (var k in s || {}) src[k] = s[k];
  // older saves had a single text size and a single line width
  if (src.fontSize !== undefined) {
    if (src.stateFontSize === undefined) src.stateFontSize = src.fontSize;
    if (src.linkFontSize === undefined) src.linkFontSize = src.fontSize;
  }
  if (src.stateLineWidth === undefined && src.lineWidth !== undefined) {
    src.stateLineWidth = src.lineWidth;
  }
  var base = partial ? getStyle() : STYLE_DEFAULTS;
  var out = {};
  for (var i = 0; i < STYLE_FIELDS.length; i++) {
    var f = STYLE_FIELDS[i];
    var v = parseFloat(src[f[0]]);
    out[f[0]] = isNaN(v) ? base[f[0]] : Math.min(f[3], Math.max(f[2], v));
  }
  out.fontName = styleFontKnown(src.fontName) ? src.fontName : base.fontName;
  styleStateFontSize = out.stateFontSize;
  styleLinkFontSize = out.linkFontSize;
  nodeRadius = out.nodeRadius;
  styleStateLineWidth = out.stateLineWidth;
  styleLineWidth = out.lineWidth;
  styleArrowSize = out.arrowSize;
  styleFontName = out.fontName;
}

function syncStyleInputs() {
  var s = getStyle();
  for (var i = 0; i < STYLE_FIELDS.length; i++) {
    var el = document.getElementById("style-" + STYLE_FIELDS[i][0]);
    if (el) el.value = s[STYLE_FIELDS[i][0]];
  }
  var sel = document.getElementById("style-fontName");
  if (sel) sel.value = s.fontName;
}

function readStyleInputs() {
  var s = {};
  for (var i = 0; i < STYLE_FIELDS.length; i++) {
    var el = document.getElementById("style-" + STYLE_FIELDS[i][0]);
    if (el) s[STYLE_FIELDS[i][0]] = el.value;
  }
  var sel = document.getElementById("style-fontName");
  if (sel) s.fontName = sel.value;
  return s;
}

function wireStyleUI() {
  if (document.getElementById("style-panel")) return;
  var panel = document.createElement("div");
  panel.id = "style-panel";
  panel.style.cssText =
    "display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0;font-size:0.85rem;";

  function onLive() {
    applyStyle(readStyleInputs(), true);
    draw();
  }
  function onCommit() {
    applyStyle(readStyleInputs(), true);
    syncStyleInputs(); // show the clamped values
    draw();
    commitHistory();
  }

  var fontLabel = document.createElement("label");
  fontLabel.style.cssText = "display:flex;align-items:center;gap:4px;";
  fontLabel.appendChild(document.createTextNode("Font"));
  var select = document.createElement("select");
  select.id = "style-fontName";
  STYLE_FONTS.forEach(function (f) {
    var opt = document.createElement("option");
    opt.value = f[0];
    opt.textContent = f[0];
    select.appendChild(opt);
  });
  select.addEventListener("change", onCommit);
  fontLabel.appendChild(select);
  panel.appendChild(fontLabel);

  STYLE_FIELDS.forEach(function (f) {
    var label = document.createElement("label");
    label.style.cssText = "display:flex;align-items:center;gap:4px;";
    label.appendChild(document.createTextNode(f[1]));
    var input = document.createElement("input");
    input.type = "number";
    input.id = "style-" + f[0];
    input.min = f[2];
    input.max = f[3];
    input.step = f[4];
    input.style.width = "64px";
    input.addEventListener("input", onLive);
    input.addEventListener("change", onCommit);
    label.appendChild(input);
    panel.appendChild(label);
  });

  var reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset style";
  reset.onclick = function () {
    applyStyle(null, false);
    syncStyleInputs();
    draw();
    commitHistory();
  };
  panel.appendChild(reset);

  var anchorBtn = document.getElementById("btn-typst") || document.getElementById("btn-latex");
  var host = anchorBtn ? anchorBtn.parentNode : null;
  if (host && host.parentNode) host.parentNode.insertBefore(panel, host.nextSibling);
  else canvas.parentNode.appendChild(panel);
  syncStyleInputs();
}

// Theme manager: 'system' | 'light' | 'dark'.
// Default is 'system' — follows OS color scheme via prefers-color-scheme.
// User choice persists in localStorage['fsm_theme'].

var Theme = (function () {
  var KEY = "fsm_theme";
  var current = "system";
  var listeners = [];
  var mq = null;

  function getStored() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark" || v === "system") return v;
    } catch (e) {}
    return "system";
  }

  function setStored(v) {
    try {
      localStorage.setItem(KEY, v);
    } catch (e) {}
  }

  function apply() {
    var root = document.documentElement;
    if (current === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", current);
    }
    notify();
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i]();
      } catch (e) {}
    }
  }

  function effective() {
    if (current !== "system") return current;
    if (mq && mq.matches) return "dark";
    return "light";
  }

  function onSystemChange() {
    // Only matters if user is on 'system' mode.
    if (current === "system") notify();
  }

  return {
    init: function () {
      current = getStored();
      if (window.matchMedia) {
        mq = window.matchMedia("(prefers-color-scheme: dark)");
        if (mq.addEventListener) mq.addEventListener("change", onSystemChange);
        else if (mq.addListener) mq.addListener(onSystemChange);
      }
      apply();
    },
    get: function () {
      return current;
    },
    effective: effective,
    cycle: function () {
      // system -> light -> dark -> system
      current =
        current === "system"
          ? "light"
          : current === "light"
            ? "dark"
            : "system";
      setStored(current);
      apply();
    },
    set: function (v) {
      if (v !== "system" && v !== "light" && v !== "dark") return;
      current = v;
      setStored(v);
      apply();
    },
    onChange: function (fn) {
      listeners.push(fn);
    },
  };
})();

// UI wiring: sidebar (FSM list), toolbar buttons, keyboard shortcuts beyond editor.
// Called from window.onload in fsm.js after Workspace.init() and History.reset().

function wireUI() {
  var sidebarList = document.getElementById("fsm-list");
  var newBtn = document.getElementById("btn-new-fsm");
  var undoBtn = document.getElementById("btn-undo");
  var redoBtn = document.getElementById("btn-redo");
  var clearBtn = document.getElementById("btn-clear");
  var pngBtn = document.getElementById("btn-png");
  var svgBtn = document.getElementById("btn-svg");
  var latexBtn = document.getElementById("btn-latex");
  var titleEl = document.getElementById("current-fsm-name");
  var themeBtn = document.getElementById("btn-theme");

  function switchToFsm(id) {
    if (id === Workspace.getActiveId()) return;
    flushHistory();
    saveBackup();
    Workspace.switchTo(id);
    restoreBackup();
    History.reset(snapshotJSON());
    draw();
    updateTitle();
  }

  function promptRename(fsm) {
    var newName = prompt("Rename FSM:", fsm.name);
    if (newName == null) return;
    newName = newName.trim();
    if (!newName) return;
    Workspace.rename(fsm.id, newName);
    updateTitle();
  }

  function deleteFsm(fsm) {
    // Avoid window.confirm here: browsers suppress repeated native dialogs after
    // several deletions, which made the delete buttons appear to stop working.
    var dialog = document.getElementById("delete-fsm-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "delete-fsm-dialog";
      dialog.innerHTML =
        '<p class="delete-fsm-message"></p>' +
        '<div class="delete-fsm-actions"><button type="button" data-action="cancel">Cancel</button>' +
        '<button type="button" data-action="delete">Delete FSM</button></div>';
      document.body.appendChild(dialog);
      dialog.querySelector('[data-action="cancel"]').onclick = function () {
        dialog.close("cancel");
      };
      dialog.querySelector('[data-action="delete"]').onclick = function () {
        dialog.close("delete");
      };
    }
    dialog.querySelector(".delete-fsm-message").textContent =
      'Delete “' + fsm.name + '”? This cannot be undone.';
    dialog.onclose = function () {
      if (dialog.returnValue !== "delete") return;
      // The sidebar may have changed while the confirmation was open.
      if (!Workspace.list().some(function (item) { return item.id === fsm.id; })) return;
    var wasActive = fsm.id === Workspace.getActiveId();
    Workspace.remove(fsm.id);
    if (wasActive) {
      restoreBackup();
      History.reset(snapshotJSON());
      draw();
    }
    updateTitle();
    };
    dialog.showModal();
  }

  function renderSidebar() {
    var fsms = Workspace.list();
    var activeId = Workspace.getActiveId();

    // rebuild list
    while (sidebarList.firstChild)
      sidebarList.removeChild(sidebarList.firstChild);

    fsms.forEach(function (fsm) {
      var li = document.createElement("li");
      li.className = fsm.id === activeId ? "active" : "";

      var name = document.createElement("span");
      name.className = "name";
      name.textContent = fsm.name;
      name.title = fsm.name;
      name.onclick = function () {
        switchToFsm(fsm.id);
      };
      name.ondblclick = function (e) {
        e.stopPropagation();
        promptRename(fsm);
      };

      var renameBtn = document.createElement("button");
      renameBtn.className = "icon";
      renameBtn.title = "Rename";
      renameBtn.textContent = "✎"; // pencil
      renameBtn.onclick = function (e) {
        e.stopPropagation();
        promptRename(fsm);
      };

      var delBtn = document.createElement("button");
      delBtn.className = "icon";
      delBtn.title = "Delete";
      delBtn.textContent = "×"; // ×
      delBtn.onclick = function (e) {
        e.stopPropagation();
        deleteFsm(fsm);
      };

      li.appendChild(name);
      li.appendChild(renameBtn);
      li.appendChild(delBtn);
      sidebarList.appendChild(li);
    });
  }

  function updateTitle() {
    var active = Workspace.getActive();
    if (titleEl && active) titleEl.textContent = active.name;
  }

  function updateToolbar() {
    undoBtn.disabled = !History.canUndo();
    redoBtn.disabled = !History.canRedo();
  }

  newBtn.onclick = function () {
    flushHistory();
    saveBackup();
    var id = Workspace.create();
    Workspace.switchTo(id);
    restoreBackup();
    History.reset(snapshotJSON());
    draw();
    updateTitle();
  };

  undoBtn.onclick = function () {
    performUndo();
  };
  redoBtn.onclick = function () {
    performRedo();
  };
  clearBtn.onclick = function () {
    clearAll();
  };

  function bindExport(btn, fn) {
    if (!btn) return;
    btn.onclick = function (e) {
      e.preventDefault();
      fn();
    };
  }
  bindExport(pngBtn, saveAsPNG);
  bindExport(svgBtn, saveAsSVG);
  bindExport(latexBtn, saveAsLaTeX);
  if (typeof wireStyleUI === "function") wireStyleUI();
  if (typeof wireNamesUI === "function") wireNamesUI();
  if (typeof wireExportOptionsUI === "function") wireExportOptionsUI();
  if (typeof wireImportUI === "function") wireImportUI();
  if (typeof wirePagesUI === "function") wirePagesUI();
  if (typeof wireAutomataUI === "function") wireAutomataUI();
  if (typeof addCreditLine === "function") addCreditLine();
  bindExport(document.getElementById("btn-typst"), saveAsTypst);

  function updateThemeButton() {
    if (!themeBtn) return;
    var mode = Theme.get();
    var label =
      mode === "system" ? "Auto" : mode === "light" ? "Light" : "Dark";
    var icon = mode === "system" ? "◐" : mode === "light" ? "☀" : "☾";
    themeBtn.textContent = icon + " " + label;
    themeBtn.setAttribute(
      "aria-label",
      "Theme: " + label + " (click to change)",
    );
    themeBtn.title = "Theme: " + label + " (click to cycle)";
  }

  if (themeBtn && typeof Theme !== "undefined") {
    themeBtn.onclick = function () {
      Theme.cycle();
    };
    Theme.onChange(function () {
      updateThemeButton();
      draw(); // re-render canvas with new theme colors
    });
    updateThemeButton();
  }

  Workspace.onChange(function () {
    renderSidebar();
    updateTitle();
  });
  History.onChange(updateToolbar);

  renderSidebar();
  updateTitle();
  updateToolbar();
}

// Workspace: manages multiple FSMs persisted in localStorage.
// Storage layout:
//   fsm_workspace = { version, activeId, fsms: [{id, name, createdAt, updatedAt}] }
//   fsm_data_<id> = { nodes: [...], links: [...] }
// Migrates legacy `fsm` key (single-FSM) into the new format on first load.

var Workspace = (function () {
  var WORKSPACE_KEY = "fsm_workspace";
  var DATA_PREFIX = "fsm_data_";
  var LEGACY_KEY = "fsm";
  var VERSION = 2;

  var meta = null;
  var listeners = [];

  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      try {
        return crypto.randomUUID();
      } catch (e) {}
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }

  function dataKey(id) {
    return DATA_PREFIX + id;
  }

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {}
  }

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  function loadMeta() {
    var raw = safeGet(WORKSPACE_KEY);
    if (!raw) return null;
    try {
      var obj = JSON.parse(raw);
      if (obj && obj.fsms) return obj;
    } catch (e) {}
    return null;
  }

  function saveMeta() {
    safeSet(WORKSPACE_KEY, JSON.stringify(meta));
  }

  function readData(id) {
    var raw = safeGet(dataKey(id));
    if (!raw) return { nodes: [], links: [] };
    try {
      var obj = JSON.parse(raw);
      if (obj && obj.nodes && obj.links) return obj;
    } catch (e) {}
    return { nodes: [], links: [] };
  }

  function writeData(id, data) {
    safeSet(dataKey(id), JSON.stringify(data));
  }

  function migrate() {
    var legacyRaw = safeGet(LEGACY_KEY);
    var id = uuid();
    var now = Date.now();
    meta = {
      version: VERSION,
      activeId: id,
      fsms: [{ id: id, name: "FSM 1", createdAt: now, updatedAt: now }],
    };
    if (legacyRaw) {
      try {
        var parsed = JSON.parse(legacyRaw);
        if (parsed && parsed.nodes && parsed.links) {
          writeData(id, parsed);
        }
      } catch (e) {}
    } else {
      writeData(id, { nodes: [], links: [] });
    }
    saveMeta();
    safeRemove(LEGACY_KEY);
  }

  function ensureNonEmpty() {
    if (!meta.fsms.length) {
      var id = uuid();
      var now = Date.now();
      meta.fsms.push({ id: id, name: "FSM 1", createdAt: now, updatedAt: now });
      meta.activeId = id;
      writeData(id, { nodes: [], links: [] });
    }
    // validate activeId
    var found = false;
    for (var i = 0; i < meta.fsms.length; i++) {
      if (meta.fsms[i].id === meta.activeId) {
        found = true;
        break;
      }
    }
    if (!found) meta.activeId = meta.fsms[0].id;
  }

  function findFsm(id) {
    for (var i = 0; i < meta.fsms.length; i++) {
      if (meta.fsms[i].id === id) return meta.fsms[i];
    }
    return null;
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i]();
      } catch (e) {}
    }
  }

  return {
    init: function () {
      meta = loadMeta();
      if (!meta) {
        migrate();
      }
      ensureNonEmpty();
      saveMeta();
    },
    list: function () {
      return meta.fsms.map(function (f) {
        return { id: f.id, name: f.name };
      });
    },
    getActiveId: function () {
      return meta.activeId;
    },
    getActive: function () {
      return findFsm(meta.activeId);
    },
    loadActive: function () {
      return readData(meta.activeId);
    },
    saveActive: function (data) {
      writeData(meta.activeId, data);
      var active = findFsm(meta.activeId);
      if (active) {
        active.updatedAt = Date.now();
        saveMeta();
      }
    },
    create: function (name) {
      var id = uuid();
      var now = Date.now();
      var fsm = {
        id: id,
        name: name || "FSM " + (meta.fsms.length + 1),
        createdAt: now,
        updatedAt: now,
      };
      meta.fsms.push(fsm);
      writeData(id, { nodes: [], links: [] });
      saveMeta();
      notify();
      return id;
    },
    rename: function (id, name) {
      var fsm = findFsm(id);
      if (!fsm) return;
      fsm.name = name;
      fsm.updatedAt = Date.now();
      saveMeta();
      notify();
    },
    remove: function (id) {
      for (var i = 0; i < meta.fsms.length; i++) {
        if (meta.fsms[i].id === id) {
          meta.fsms.splice(i, 1);
          break;
        }
      }
      safeRemove(dataKey(id));
      if (meta.activeId === id) {
        meta.activeId = meta.fsms.length ? meta.fsms[0].id : null;
      }
      ensureNonEmpty();
      saveMeta();
      notify();
    },
    switchTo: function (id) {
      if (!findFsm(id)) return;
      meta.activeId = id;
      saveMeta();
      notify();
    },
    onChange: function (fn) {
      listeners.push(fn);
    },
  };
})();

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

function Node(x, y) {
  this.x = x;
  this.y = y;
  this.mouseOffsetX = 0;
  this.mouseOffsetY = 0;
  this.isAcceptState = false;
  this.text = "";
}

Node.prototype.setMouseStart = function (x, y) {
  this.mouseOffsetX = this.x - x;
  this.mouseOffsetY = this.y - y;
};

Node.prototype.setAnchorPoint = function (x, y) {
  this.x = x + this.mouseOffsetX;
  this.y = y + this.mouseOffsetY;
};

Node.prototype.draw = function (c) {
  // draw the circle
  c.beginPath();
  c.arc(this.x, this.y, nodeRadius, 0, 2 * Math.PI, false);
  c.stroke();

  // draw the text
  drawText(c, this.text, this.x, this.y, null, selectedObject == this);

  // draw a double circle for an accept state
  if (this.isAcceptState) {
    c.beginPath();
    c.arc(this.x, this.y, nodeRadius - 6, 0, 2 * Math.PI, false);
    c.stroke();
  }
};

Node.prototype.closestPointOnCircle = function (x, y) {
  var dx = x - this.x;
  var dy = y - this.y;
  var scale = Math.sqrt(dx * dx + dy * dy);
  return {
    x: this.x + (dx * nodeRadius) / scale,
    y: this.y + (dy * nodeRadius) / scale,
  };
};

Node.prototype.containsPoint = function (x, y, extraTolerance) {
  var radius = nodeRadius + (extraTolerance || 0);
  return (
    (x - this.x) * (x - this.x) + (y - this.y) * (y - this.y) < radius * radius
  );
};

function SelfLink(node, mouse) {
  this.node = node;
  this.anchorAngle = 0;
  this.mouseOffsetAngle = 0;
  this.text = "";
  this.labelDx = 0;
  this.labelDy = 0;

  if (mouse) {
    this.setAnchorPoint(mouse.x, mouse.y);
  }
}

SelfLink.prototype.setMouseStart = function (x, y) {
  this.mouseOffsetAngle =
    this.anchorAngle - Math.atan2(y - this.node.y, x - this.node.x);
};

SelfLink.prototype.setAnchorPoint = function (x, y) {
  this.anchorAngle =
    Math.atan2(y - this.node.y, x - this.node.x) + this.mouseOffsetAngle;
  // snap to 90 degrees
  var snap = Math.round(this.anchorAngle / (Math.PI / 2)) * (Math.PI / 2);
  if (Math.abs(this.anchorAngle - snap) < 0.1) this.anchorAngle = snap;
  // keep in the range -pi to pi so our containsPoint() function always works
  if (this.anchorAngle < -Math.PI) this.anchorAngle += 2 * Math.PI;
  if (this.anchorAngle > Math.PI) this.anchorAngle -= 2 * Math.PI;
};

SelfLink.prototype.getEndPointsAndCircle = function () {
  var circleX = this.node.x + 1.5 * nodeRadius * Math.cos(this.anchorAngle);
  var circleY = this.node.y + 1.5 * nodeRadius * Math.sin(this.anchorAngle);
  var circleRadius = 0.75 * nodeRadius;
  var startAngle = this.anchorAngle - Math.PI * 0.8;
  var endAngle = this.anchorAngle + Math.PI * 0.8;
  var startX = circleX + circleRadius * Math.cos(startAngle);
  var startY = circleY + circleRadius * Math.sin(startAngle);
  var endX = circleX + circleRadius * Math.cos(endAngle);
  var endY = circleY + circleRadius * Math.sin(endAngle);
  return {
    hasCircle: true,
    startX: startX,
    startY: startY,
    endX: endX,
    endY: endY,
    startAngle: startAngle,
    endAngle: endAngle,
    circleX: circleX,
    circleY: circleY,
    circleRadius: circleRadius,
  };
};

SelfLink.prototype.draw = function (c) {
  var stuff = this.getEndPointsAndCircle();
  // draw arc
  c.beginPath();
  c.arc(
    stuff.circleX,
    stuff.circleY,
    stuff.circleRadius,
    stuff.startAngle,
    stuff.endAngle,
    false,
  );
  c.stroke();
  // draw the text on the loop farthest from the node
  var textX = stuff.circleX + stuff.circleRadius * Math.cos(this.anchorAngle);
  var textY = stuff.circleY + stuff.circleRadius * Math.sin(this.anchorAngle);
  drawText(
    c,
    this.text,
    textX + this.labelDx,
    textY + this.labelDy,
    this.anchorAngle,
    selectedObject == this,
  );
  // draw the head of the arrow
  drawArrow(c, stuff.endX, stuff.endY, stuff.endAngle + Math.PI * 0.4);
};

SelfLink.prototype.containsPoint = function (x, y, extraTolerance) {
  var stuff = this.getEndPointsAndCircle();
  var dx = x - stuff.circleX;
  var dy = y - stuff.circleY;
  var distance = Math.sqrt(dx * dx + dy * dy) - stuff.circleRadius;
  return Math.abs(distance) < hitTargetPadding + (extraTolerance || 0);
};

function StartLink(node, start) {
  this.node = node;
  this.deltaX = 0;
  this.deltaY = 0;
  this.text = "";
  this.labelDx = 0;
  this.labelDy = 0;

  if (start) {
    this.setAnchorPoint(start.x, start.y);
  }
}

StartLink.prototype.setAnchorPoint = function (x, y) {
  this.deltaX = x - this.node.x;
  this.deltaY = y - this.node.y;

  if (Math.abs(this.deltaX) < snapToPadding) {
    this.deltaX = 0;
  }

  if (Math.abs(this.deltaY) < snapToPadding) {
    this.deltaY = 0;
  }
};

StartLink.prototype.getEndPoints = function () {
  // Imported/generated start arrows may omit their anchor offset. A zero
  // vector also makes closestPointOnCircle divide by zero, so give those
  // arrows a visible default entry from above the state.
  if (!isFinite(this.deltaX)) this.deltaX = 0;
  if (!isFinite(this.deltaY)) this.deltaY = 0;
  if (Math.sqrt(this.deltaX * this.deltaX + this.deltaY * this.deltaY) < 1e-6) {
    this.deltaX = 0;
    this.deltaY = -Math.max(50, nodeRadius * 2);
  }
  var startX = this.node.x + this.deltaX;
  var startY = this.node.y + this.deltaY;
  var end = this.node.closestPointOnCircle(startX, startY);
  return {
    startX: startX,
    startY: startY,
    endX: end.x,
    endY: end.y,
  };
};

StartLink.prototype.draw = function (c) {
  var stuff = this.getEndPoints();

  // draw the line
  c.beginPath();
  c.moveTo(stuff.startX, stuff.startY);
  c.lineTo(stuff.endX, stuff.endY);
  c.stroke();

  // draw the text at the end without the arrow
  var textAngle = Math.atan2(
    stuff.startY - stuff.endY,
    stuff.startX - stuff.endX,
  );
  drawText(
    c,
    this.text,
    stuff.startX + this.labelDx,
    stuff.startY + this.labelDy,
    textAngle,
    selectedObject == this,
  );

  // draw the head of the arrow
  drawArrow(c, stuff.endX, stuff.endY, Math.atan2(-this.deltaY, -this.deltaX));
};

StartLink.prototype.containsPoint = function (x, y, extraTolerance) {
  var stuff = this.getEndPoints();
  var dx = stuff.endX - stuff.startX;
  var dy = stuff.endY - stuff.startY;
  var length = Math.sqrt(dx * dx + dy * dy);
  var percent =
    (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
  var distance = (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
  return percent > 0 && percent < 1 && Math.abs(distance) < hitTargetPadding + (extraTolerance || 0);
};

function TemporaryLink(from, to) {
  this.from = from;
  this.to = to;
}

TemporaryLink.prototype.draw = function (c) {
  // draw the line
  c.beginPath();
  c.moveTo(this.to.x, this.to.y);
  c.lineTo(this.from.x, this.from.y);
  c.stroke();

  // draw the head of the arrow
  drawArrow(
    c,
    this.to.x,
    this.to.y,
    Math.atan2(this.to.y - this.from.y, this.to.x - this.from.x),
  );
};
