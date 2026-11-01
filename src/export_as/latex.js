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
  // Clip edges are pulled inward by CLIP_INSET picture units (1 unit = 10 px), and in standalone
  // mode the page is trimmed from the top/right by ~1.37e-5 of its size (see patch_latex_trim_final.py).
  var CLIP_INSET = 0.013, PAGE_TRIM_RATIO_W = 1.3563e-5, PAGE_TRIM_RATIO_H = 1.3889e-5;
  // Real paper size in px. The editor's pageW/pageH are rounded to a whole-pixel grid; margins must be
  // measured from the real paper edges (see patch_latex_a4_margins.py).
  function paperPx(ppi) { var s = PAGE_SIZES[pageSizeKey]; return { w: s.w * ppi, h: s.h * ppi }; }
  this.beginNodeClip = function (page, margins, ppi, pageW, pageH) {
    this._texData += "\\begin{scope}\n\\clip (" + (margins.left * ppi * 0.1 + CLIP_INSET).toFixed(3) + "," + (-(page * pageH + margins.top * ppi) * 0.1 - CLIP_INSET).toFixed(3) + ") rectangle (" + ((paperPx(ppi).w - margins.right * ppi) * 0.1 - CLIP_INSET).toFixed(3) + "," + (-(page * pageH + paperPx(ppi).h - margins.bottom * ppi) * 0.1 + CLIP_INSET).toFixed(3) + ");\n";
  };
  this.endNodeClip = function () { this._texData += "\\end{scope}\n"; };
  this.beginArrowClip = function (pages, margins, ppi, pageW, pageH) {
    this._texData += "\\begin{scope}\n\\clip ";
    for (var p = 0; p < pages; p++) {
      if (p) this._texData += " ";
      this._texData += "(" + (margins.left * ppi * 0.1 + CLIP_INSET).toFixed(3) + "," + (-(p * pageH + margins.top * ppi) * 0.1 - CLIP_INSET).toFixed(3) + ") rectangle (" + ((paperPx(ppi).w - margins.right * ppi) * 0.1 - CLIP_INSET).toFixed(3) + "," + (-(p * pageH + paperPx(ppi).h - margins.bottom * ppi) * 0.1 + CLIP_INSET).toFixed(3) + ")";
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
  function escapePlainText(text) {
    var replacements = { "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "$": "\\$", "&": "\\&", "#": "\\#", "%": "\\%", "_": "\\_", "^": "\\textasciicircum{}", "~": "\\textasciitilde{}" };
    return String(text || "").replace(/[\\{}$&#%_^~]/g, function (ch) { return replacements[ch]; });
  }
  function flowTextLatex(text) {
    return String(text || "").trim().split(/\n\s*\n/).filter(Boolean).map(function (paragraph) {
      return "\\noindent " + escapePlainText(paragraph.replace(/\s*\n\s*/g, " "));
    }).join("\n\\par\n");
  }
  this.toLaTeX = function (json, standalone, pages, margins, constrainMargins, pageMode, followingText, flowOptions, precedingText) {
    var data = json ? "% fsm-data: " + String(json).replace(/[\r\n]+/g, " ") + "\n" : "";
    pages = Math.max(1, Math.min(20, Math.round(pages || 1)));
    margins = margins || { top: 1, bottom: 1, left: 1, right: 1 };
    var paged = "";
    var pageSize = PAGE_SIZES[pageSizeKey];
    if (pageMode === "flow") {
      if (flowOptions) {
        var cmPerPx = 2.54 / 96;
        var texDrawing = this._texData;
        var pictureHeight = flowOptions.bounds.height;
        var shiftX = flowOptions.left - flowOptions.bounds.x;
        function pictureCode(height, yShift) {
          return "\\begin{tikzpicture}[x=0.264583cm,y=0.264583cm]\n" +
            "\\path[use as bounding box] (0,0) rectangle (" + (flowOptions.width / 10).toFixed(4) + "," + (-height / 10).toFixed(4) + ");\n" +
            "\\clip (0,0) rectangle (" + (flowOptions.width / 10).toFixed(4) + "," + (-height / 10).toFixed(4) + ");\n" +
            "\\begin{scope}[shift={(" + (shiftX * cmPerPx).toFixed(4) + "cm," + (yShift * cmPerPx).toFixed(4) + "cm)}]\n" +
            "\\tikzstyle{every node}+=[inner sep=0pt]\n" + texDrawing + "\\end{scope}\n\\end{tikzpicture}\n";
        }
        var flowPicture = pictureCode(pictureHeight, flowOptions.bounds.y);
        var embeddedPicture = pictureCode(flowOptions.top + pictureHeight, flowOptions.bounds.y - flowOptions.top);
        var beforeBody = flowTextLatex(precedingText), textBody = flowTextLatex(followingText);
        function paragraphBlock(body, width) {
          return body ? "\\noindent\\hspace*{" + (flowOptions.left / 96).toFixed(4) + "in}\\begin{minipage}{" + width + "}\n\\fontsize{12}{18}\\selectfont\n" + body + "\\end{minipage}\\par\n" : "";
        }
        var flowBody = "\\vspace*{" + (flowOptions.top / 96).toFixed(4) + "in}\n";
        flowBody += paragraphBlock(beforeBody, (flowOptions.contentWidth / 96).toFixed(4) + "in");
        if (beforeBody) flowBody += "\\vspace*{" + (flowOptions.gap / 96).toFixed(4) + "in}\n";
        flowBody += "\\noindent " + flowPicture + "\\par\n";
        flowBody += "\\vspace*{" + (flowOptions.gap / 96).toFixed(4) + "in}\n";
        flowBody += paragraphBlock(textBody, (flowOptions.contentWidth / 96).toFixed(4) + "in");
        flowBody += "\\noindent\\rule{0pt}{" + (flowOptions.bottom / 96).toFixed(4) + "in}\\par\n";
        if (!standalone) {
          var embeddedBody = "\\par\n" + beforeBody + (beforeBody ? "\\par\\vspace*{" + (flowOptions.gap / 96).toFixed(4) + "in}\n" : "");
          embeddedBody += "\\begingroup\n\\sbox0{" + embeddedPicture + "}\n\\sbox1{\\copy0}\n";
          embeddedBody += "\\ifdim\\wd1>\\linewidth \\sbox1{\\resizebox{\\linewidth}{!}{\\copy0}}\\fi\n";
          embeddedBody += "\\dimen0=\\dimexpr\\pagegoal-\\pagetotal-" + (flowOptions.gap / 96).toFixed(4) + "in" + (textBody ? "-\\baselineskip" : "") + "\\relax\n";
          embeddedBody += "\\ifdim\\dimen0<1pt \\dimen0=1pt \\fi\n";
          embeddedBody += "\\ifdim\\dimexpr\\ht1+\\dp1\\relax>\\dimen0 \\sbox1{\\resizebox{!}{\\dimen0}{\\copy1}}\\fi\n";
          embeddedBody += "\\noindent\\usebox1\\par\n\\endgroup\n\\vspace*{" + (flowOptions.gap / 96).toFixed(4) + "in}\n" + textBody + "\\par\n";
          return data + "% Requires \\usepackage{tikz,graphicx} in the host document.\n" +
            "% Fit calculation assumes the selected paper size and bottom margin " + (flowOptions.bottom / 96).toFixed(4) + "in.\n" + embeddedBody;
        }
        return data +
          "\\documentclass{article}\n\\usepackage[paperwidth=" + (flowOptions.width / 96).toFixed(4) + "in,paperheight=" + (flowOptions.height / 96).toFixed(4) + "in,margin=0pt]{geometry}\n\\usepackage{tikz}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0pt}\n\\setlength{\\topskip}{0pt}\n\\setlength{\\parskip}{0pt}\n\\begin{document}\n" +
          "\\begin{minipage}{" + (flowOptions.width / 96).toFixed(4) + "in}\n" + flowBody + "\\end{minipage}\n\\end{document}\n";
      }
      var flowPicture =
        "\\begingroup\n" +
        "\\sbox0{\\begin{tikzpicture}[x=0.264583cm,y=0.264583cm]\n" +
        "\\tikzstyle{every node}+=[inner sep=0pt]\n" + this._texData +
        "\\end{tikzpicture}}\n" +
        "\\sbox1{\\resizebox{\\linewidth}{!}{\\copy0}}\n" +
        "\\sbox2{\\resizebox{!}{\\textheight}{\\copy0}}\n" +
        "\\ifdim\\wd0>\\linewidth\n" +
        "  \\ifdim\\dimexpr\\ht1+\\dp1\\relax>\\textheight \\copy2 \\else \\copy1 \\fi\n" +
        "\\else\n" +
        "  \\ifdim\\dimexpr\\ht0+\\dp0\\relax>\\textheight \\copy2 \\else \\copy0 \\fi\n" +
        "\\fi\n\\endgroup\n\\par\\medskip\n";
      var flowBody = flowPicture + flowTextLatex(followingText) + "\n";
      if (!standalone) return data +
        "% Requires \\usepackage{tikz,graphicx} in the host document.\n" +
        "% Set the host page margins to top=" + margins.top + "in, bottom=" + margins.bottom + "in, left=" + margins.left + "in, right=" + margins.right + "in.\n" +
        flowBody;
      return data +
        "\\documentclass{article}\n" +
        "\\usepackage[paperwidth=" + pageSize.w + "in,paperheight=" + pageSize.h + "in,top=" + margins.top + "in,bottom=" + margins.bottom + "in,left=" + margins.left + "in,right=" + margins.right + "in]{geometry}\n" +
        "\\usepackage{tikz}\n\\usepackage{graphicx}\n" +
        "\\setlength{\\parindent}{0pt}\n\\begin{document}\n" + flowBody + "\\end{document}\n";
    }
    var width = pageSize.w * 9.6, height = pageSize.h * 9.6;
    var outputPages = pageMode === false ? 1 : pages;
    var trimW = standalone ? width * PAGE_TRIM_RATIO_W : 0;
    var trimH = standalone ? height * PAGE_TRIM_RATIO_H : 0;
    if (pageMode === false) height *= pages;
    for (var p = 0; p < outputPages; p++) {
      if (p && !standalone) paged += "\\FSMPageBreak\n";
      var pageData = this._texData;
      if (pageMode !== false && p) pageData = pageData.replace(/\((-?[0-9.]+),(-?[0-9.]+)\)/g, function (m, x, y) {
        return "(" + x + "," + (Number(y) + p * pageHeightPx() * 0.1) + ")";
      });
      var picture =
        "\\begin{tikzpicture}[x=0.264583cm,y=0.264583cm]\n" +
        "\\path[use as bounding box] (0," + (-trimH).toFixed(6) + ") rectangle (" + (width - trimW).toFixed(6) + "," + (-height).toFixed(3) + ");\n" +
        "\\clip (0," + (-trimH).toFixed(6) + ") rectangle (" + (width - trimW).toFixed(6) + "," + (-height).toFixed(3) + ");\n" +
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
