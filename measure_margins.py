#!/usr/bin/env python3
"""Measure where ink stops on each page of one or more PDFs, using poppler's
pdftoppm (same rasterizer for every file). Standard library only.
Needs poppler-utils:   sudo apt install poppler-utils

Usage (quote names that contain spaces or parentheses):
  python3 measure_margins.py "a (2).pdf" b.pdf ...        # 300 dpi (finest), values in 96-dpi px
  python3 measure_margins.py --dpi 96 "a (2).pdf" ...     # whole pixels at exactly 96 dpi

Values are blank pixels between the ink and the edge of the rendered image, in
96-dpi pixels (96 = 1 inch). At 300 dpi one raster pixel is 0.32 px, so 96.00 means
300 blank raster pixels and 96.32 means 301. The rasterizer snaps clip edges
outward to whole pixels, so expect readings of 96.00-96.32 for a 1-inch margin;
anything BELOW 96.00 is ink inside the margin.

Each page is reported under two thresholds:
  solid    only clearly dark pixels (gray < 128)
  any ink  anything not pure white (includes faint anti-aliased edges)

A note is printed when the page is not a whole number of pixels at 96 dpi
(A4, or a page a hair off Letter), because a viewer then rounds or truncates
its size - e.g. 815.99 px shows as 815 in a truncating viewer.
"""
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile

THRESHOLDS = [
    ("solid", re.compile(b"[\\x00-\\x7f]")),     # gray < 128
    ("any ink", re.compile(b"[\\x00-\\xfe]")),   # anything not pure white
]


def read_pgm(path):
    with open(path, "rb") as f:
        data = f.read()
    m = re.match(rb"P5\s+(\d+)\s+(\d+)\s+(\d+)\s", data)
    if not m:
        raise ValueError("unexpected image format from pdftoppm")
    return int(m.group(1)), int(m.group(2)), data, m.end()


def ink_box(w, h, data, off, dark):
    left, right, top, bottom = w, w, None, None
    for y in range(h):
        row = data[off + y * w: off + (y + 1) * w]
        first = dark.search(row)
        if not first:
            continue
        last = dark.search(row[::-1])
        if top is None:
            top = y
        bottom = h - 1 - y
        left = min(left, first.start())
        right = min(right, last.start())
    return None if top is None else (left, top, right, bottom)


def page_size_pt(pdf):
    """Page 1 size in points from pdfinfo's 'Page size:' line (3 decimals)."""
    if shutil.which("pdfinfo") is None:
        return None
    out = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    m = re.search(r"Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts", out)
    return (float(m.group(1)), float(m.group(2))) if m else None


def main(argv):
    dpi = 300
    if argv and argv[0] == "--dpi":
        if len(argv) < 2:
            sys.exit("--dpi needs a number, e.g. --dpi 96")
        dpi = int(argv[1])
        argv = argv[2:]
    if not argv:
        sys.exit(__doc__)
    if shutil.which("pdftoppm") is None:
        sys.exit("pdftoppm not found. Install it with:  sudo apt install poppler-utils")
    to96 = 96.0 / dpi
    fmt = (lambda v: f"{v:6.1f}") if dpi == 96 else (lambda v: f"{v:6.2f}")
    for pdf in argv:
        if not os.path.exists(pdf):
            print(f"\n{pdf}: file not found")
            continue
        size = page_size_pt(pdf)
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(["pdftoppm", "-gray", "-r", str(dpi), pdf, os.path.join(tmp, "p")], check=True)
            pages = sorted(f for f in os.listdir(tmp) if f.endswith(".pgm"))
            print(f"\n{pdf}  ({len(pages)} page(s), rendered at {dpi} dpi)")
            for name in pages:
                w, h, data, off = read_pgm(os.path.join(tmp, name))
                head = f"  {name}: image {w}x{h} px"
                if size:
                    pw96, ph96 = size[0] * 96 / 72.0, size[1] * 96 / 72.0
                    head += f" | page {size[0]:.3f} x {size[1]:.3f} pt = {pw96:.4f} x {ph96:.4f} px at 96 dpi"
                print(head)
                if size and (abs(pw96 - round(pw96)) > 1e-3 or abs(ph96 - round(ph96)) > 1e-3):
                    print(f"    NOTE: not a whole number of pixels at 96 dpi; a viewer that truncates shows "
                          f"{math.floor(pw96 + 1e-9)}x{math.floor(ph96 + 1e-9)}, one that rounds shows "
                          f"{round(pw96)}x{round(ph96)}. Only 612 x 792 pt (Letter) is exact.")
                for label, dark in THRESHOLDS:
                    box = ink_box(w, h, data, off, dark)
                    if box is None:
                        print(f"    {label:8}: blank")
                        continue
                    l, t, r, b = (v * to96 for v in box)
                    print(f"    {label:8}: left {fmt(l)}  top {fmt(t)}  right {fmt(r)}  bottom {fmt(b)}")


if __name__ == "__main__":
    main(sys.argv[1:])
