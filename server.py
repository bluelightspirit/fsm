#!/usr/bin/env python3
"""Build and serve the FSM editor with one command:

    python3 server.py            # http://localhost:8000
    python3 server.py 9000       # different port

Rebuilds automatically whenever anything under src/ (or build.py) changes,
so after editing you only need to refresh the browser."""

import argparse
import functools
import http.server
import os
import subprocess
import sys
import threading
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
WWW = os.path.join(ROOT, "www")


def build():
    r = subprocess.run([sys.executable, "build.py"], cwd=ROOT, capture_output=True, text=True)
    out = (r.stdout + r.stderr).strip()
    print(("[build] " if r.returncode == 0 else "[build FAILED] ") + out, flush=True)
    return r.returncode == 0


def newest_mtime():
    newest = os.path.getmtime(os.path.join(ROOT, "build.py"))
    for base, _dirs, files in os.walk(os.path.join(ROOT, "src")):
        for name in files:
            newest = max(newest, os.path.getmtime(os.path.join(base, name)))
    return newest


def watch():
    last = newest_mtime()
    while True:
        time.sleep(0.7)
        try:
            now = newest_mtime()
        except OSError:
            continue  # a file vanished mid-save; try again
        if now != last:
            last = now
            build()


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # no more hard refreshes
        super().end_headers()

    def log_message(self, fmt, *args):
        # only show errors (and skip the favicon 404)
        if len(args) > 1 and str(args[1]).startswith(("4", "5")) and "favicon" not in str(args[0]):
            super().log_message(fmt, *args)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("port", nargs="?", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 to reach it from other devices")
    args = ap.parse_args()

    build()
    threading.Thread(target=watch, daemon=True).start()

    handler = functools.partial(Handler, directory=WWW)
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    print("Serving http://localhost:%d  (Ctrl+C to stop; auto-rebuilds on changes)" % args.port, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
