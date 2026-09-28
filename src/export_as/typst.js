// Draw using this instead of a canvas, then call toTypst() afterward.
// Emits CeTZ drawing code (https://typst.app/universe/package/cetz).

// Convert the editor's label shortcuts (\alpha, q_0, "abc") into Typst math.
// Multi-letter runs must be quoted in Typst math or they parse as variables.
function labelToTypstMath(text) {
  var out = [];
  var i = 0;
  while (i < text.length) {
    var ch = text.charAt(i);
    var rest = text.slice(i);
    var m;

    if (ch === "\\" && (m = /^\\([A-Za-z]+)/.exec(rest))) {
      var name = m[1];
      var cap = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      var idx = greekLetterNames.indexOf(cap);
      if (idx >= 0 && (name === cap || name === cap.toLowerCase())) {
        // same code points the canvas uses, so the export matches the screen
        var base = name === cap ? 913 : 945;
        out.push(String.fromCharCode(base + idx + (idx > 16 ? 1 : 0)));
        i += m[0].length;
        continue;
      }
    }
    if (ch === "_" && (m = /^_(\d+)/.exec(rest))) {
      out.push("_(" + m[1] + ")");
      i += m[0].length;
      continue;
    }
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
      out.push(ch); // real unicode symbols are valid in Typst math
    } else {
      out.push('"' + ch.replace(/["\\]/g, "\\$&") + '"');
    }
    i++;
  }
  return out.join(" ").replace(/ _\(/g, "_(");
}

function ExportAsTypst() {
  this._points = [];
  this._data = "";
  this._scale = 0.02; // pixels -> cm (CeTZ's default unit); 30px radius = 0.6cm

  // json: optional snapshot string, embedded as a comment so the diagram
  // can be restored later from the .typ file itself.
  this.toTypst = function (json) {
    var header = json
      ? "// fsm-data: " + String(json).replace(/[\r\n]+/g, " ") + "\n"
      : "";
    return (
      header +
      '#import "@preview/cetz:0.4.2"\n' +
      "\n" +
      "#align(center, cetz.canvas({\n" +
      "  import cetz.draw: *\n" +
      this._data +
      "}))\n"
    );
  };

  this._pt = function (x, y, digits) {
    return "(" + fixed(x, digits) + ", " + fixed(-y, digits) + ")";
  };

  this.beginPath = function () {
    this._points = [];
  };

  this.arc = function (x, y, radius, startAngle, endAngle, isReversed) {
    x *= this._scale;
    y *= this._scale;
    radius *= this._scale;
    if (endAngle - startAngle == Math.PI * 2) {
      this._data +=
        "  circle(" +
        this._pt(x, y, 3) +
        ", radius: " +
        fixed(radius, 3) +
        ")\n";
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
    this._data +=
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
      ")\n";
  };

  this.moveTo = this.lineTo = function (x, y) {
    this._points.push({ x: x * this._scale, y: y * this._scale });
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
    this._data += "  line(" + this._pointList() + ")\n";
  };

  // only used for arrowheads
  this.fill = function () {
    if (this._points.length < 3) return;
    this._data +=
      "  line(" +
      this._pointList() +
      ", close: true, fill: black, stroke: none)\n";
  };

  this.measureText = function (text) {
    var c = canvas.getContext("2d");
    c.font = '20px "Times New Roman", serif';
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
          y -= 10;
        } else {
          anchor = "south";
          y += 10;
        }
      }
    }
    x *= this._scale;
    y *= this._scale;
    this._data +=
      "  content(" +
      this._pt(x, y, 3) +
      ", $" +
      labelToTypstMath(originalText) +
      '$, anchor: "' +
      anchor +
      '")\n';
  };

  this.translate = this.save = this.restore = this.clearRect = function () {};
}
