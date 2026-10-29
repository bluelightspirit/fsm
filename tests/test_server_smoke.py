"""Starts the real server on a free port and exercises it over HTTP.
Standard library only. Run:  python3 -m unittest discover -s tests -v"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

from tests.helpers import ROOT, accepts


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def post(port, path, payload):
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}", data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read().decode("utf-8"))


class ServerSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = free_port()
        cls.log = tempfile.TemporaryFile("w+")
        cls.proc = subprocess.Popen([sys.executable, "server.py", str(cls.port)],
                                    cwd=ROOT, stdout=cls.log, stderr=subprocess.STDOUT, text=True)
        deadline = time.time() + 40
        while time.time() < deadline:
            if cls.proc.poll() is not None:
                cls.log.seek(0)
                raise RuntimeError("server exited early:\n" + cls.log.read())
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{cls.port}/", timeout=1).close()
                return
            except Exception:
                time.sleep(0.25)
        cls.proc.terminate()
        raise RuntimeError("server did not start within 40 s")

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        try:
            cls.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            cls.proc.kill()
        cls.log.close()

    def test_pages_are_served(self):
        for path in ("/", "/fsm.js"):
            with urllib.request.urlopen(f"http://127.0.0.1:{self.port}{path}", timeout=10) as response:
                self.assertEqual(response.status, 200, path)
                self.assertGreater(len(response.read()), 1000, path)

    def test_regex_endpoint_formal_dfa(self):
        status, body = post(self.port, "/api/automata/regex", {"regex": "(a+b)*abb", "mode": "dfa", "syntax": "theory"})
        self.assertEqual(status, 200, body)
        auto = body["automaton"]
        self.assertTrue(accepts(auto, "babb"))
        self.assertFalse(accepts(auto, "abba"))
        self.assertTrue(auto["experimental"])

    def test_regex_endpoint_python_style(self):
        status, body = post(self.port, "/api/automata/regex", {"regex": "colou?r", "mode": "nfa", "syntax": "python"})
        self.assertEqual(status, 200, body)
        self.assertTrue(accepts(body["automaton"], "colour"))
        self.assertFalse(body["automaton"]["experimental"])

    def test_bad_regex_is_a_400_with_a_message(self):
        status, body = post(self.port, "/api/automata/regex", {"regex": "a|", "mode": "nfa", "syntax": "theory"})
        self.assertEqual(status, 400)
        self.assertIn("error", body)

    def test_unknown_endpoint_is_404(self):
        status, _ = post(self.port, "/api/nope", {})
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
