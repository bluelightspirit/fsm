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
