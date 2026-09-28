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
