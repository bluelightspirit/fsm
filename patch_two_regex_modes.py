#!/usr/bin/env python3
"""Replaces automata_integration.py's regex_to_automaton() to support TWO
regex dialects, selected by a new "syntax" field in the request payload:

  - "theory"  (default): formal_regex.py, matching pyformlang.Regex syntax.
               This is the primary, non-experimental option.
  - "python":  glushkov_regex.py, Python-`re`-flavored sugar. Marked
               experimental in both the error-message text and the returned
               payload (an "experimental": true flag), since it's newer and
               has a narrower supported subset than full Python `re`.

Both dialects funnel into the same shared, already-verified Glushkov
construction core (glushkov_core.py), so there is one proven construction
and determinization path underneath two different front-end parsers.

Run from the repo root, with glushkov_core.py, glushkov_regex.py, and
formal_regex.py already copied into the repo root alongside this script.
Aborts without writing anything if automata_integration.py doesn't define
regex_to_automaton (wrong file / already replaced)."""

import os

REQUIRED_MODULES = ["glushkov_core.py", "glushkov_regex.py", "formal_regex.py"]
missing = [m for m in REQUIRED_MODULES if not os.path.exists(m)]
if missing:
    raise SystemExit(f"ABORTED: copy these into the repo root first: {', '.join(missing)}")

NEW_CONTENT = '''"""Regex -> automaton conversion for the browser-based FSM editor.

Supports two regex dialects (see "syntax" in the request payload):
  - "theory"  (default): formal_regex.py - the formal/textbook dialect,
              matching pyformlang.regular_expression.Regex syntax exactly
              (concatenation via space/'.', union via '|' or '+', '*' only,
              "epsilon"/'$' for the empty string, multi-character symbols
              unless separated). This is the primary, supported option.
  - "python": glushkov_regex.py - EXPERIMENTAL Python-`re`-flavored sugar
              (\\\\d \\\\w \\\\s, [...], ?, literal adjacency = concatenation).
              Narrower than full Python `re` (no anchors, no {m,n}, no
              backreferences/lookaround yet).

Both dialects parse into the same AST shape and are built by the shared,
already-verified Glushkov (position) automaton construction in
glushkov_core.py - a standard textbook algorithm (Aho/Sethi/Ullman), not
derived from any third-party regex-engine source. Unlike a Thompson
construction, it needs no epsilon transitions and doesn't expand a
character class into one branch per concrete character, which is what kept
earlier Pyformlang-based output so much larger for the same patterns.
"""

from __future__ import annotations

from typing import Any

import formal_regex
import glushkov_regex
from glushkov_core import determinize

MAX_REGEX_LENGTH = 512
MAX_STATES = 512
MAX_TRANSITIONS = 2048


def _complete_dfa(dfa: dict[str, Any]) -> dict[str, Any]:
    """Route every missing (state, symbol) pair to a shared non-accepting
    sink state. determinize() only ever produces transitions that were
    actually reachable, but the editor's DFA validator (and the Lean
    invariant) require a total transition function."""
    alphabet = dfa["alphabet"]
    total = dfa["states"]
    have = {(e["from"], e["symbol"]) for e in dfa["edges"]}
    missing = [(state, symbol) for state in range(total) for symbol in alphabet if (state, symbol) not in have]
    if not missing:
        return dfa
    sink = total
    edges = list(dfa["edges"])
    for state, symbol in missing:
        edges.append({"from": state, "to": sink, "symbol": symbol})
    for symbol in alphabet:
        edges.append({"from": sink, "to": sink, "symbol": symbol})
    return {
        "states": total + 1,
        "starts": dfa["starts"],
        "accepts": dfa["accepts"],
        "edges": edges,
        "alphabet": alphabet,
    }


def regex_to_automaton(payload: dict[str, Any]) -> dict[str, Any]:
    expression = payload.get("regex", "")
    mode = payload.get("mode", "nfa")
    syntax = payload.get("syntax", "theory")

    if not isinstance(expression, str) or not expression.strip():
        raise ValueError("Enter a regular expression first.")
    if len(expression) > MAX_REGEX_LENGTH:
        raise ValueError(f"Regular expressions are limited to {MAX_REGEX_LENGTH} characters.")
    if mode not in ("nfa", "dfa"):
        raise ValueError("Choose either \\u03b5-NFA or DFA output.")
    if syntax not in ("theory", "python"):
        raise ValueError("Choose either the formal (theory) or Python-style (experimental) regex syntax.")

    try:
        if syntax == "theory":
            nfa = formal_regex.build_formal_nfa(expression)
        else:
            nfa = glushkov_regex.build_glushkov_nfa(expression)
    except (formal_regex.FormalRegexSyntaxError, glushkov_regex.RegexSyntaxError) as exc:
        label = "formal-theory" if syntax == "theory" else "Python-style"
        raise ValueError(f"Could not parse that {label} regex: {exc}") from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise ValueError(f"Could not parse or convert that regex: {str(exc)[:400]}") from exc

    automaton = determinize(nfa) if mode == "dfa" else nfa
    if mode == "dfa":
        automaton = _complete_dfa(automaton)

    total_states = automaton["states"]
    if not total_states or total_states > MAX_STATES:
        raise ValueError(f"The conversion produced {total_states} states; the limit is {MAX_STATES}.")
    if len(automaton["edges"]) > MAX_TRANSITIONS:
        raise ValueError(f"The conversion exceeded the {MAX_TRANSITIONS}-transition limit.")

    accepts = sorted(automaton["accepts"])
    accepts_set = set(accepts)
    edges = sorted(automaton["edges"], key=lambda e: (e["from"], e["symbol"], e["to"]))
    return {
        "type": mode,
        "syntax": syntax,
        "experimental": syntax == "python",
        "nodes": [{"id": i, "name": f"q{i}", "accepting": i in accepts_set} for i in range(total_states)],
        "starts": automaton["starts"],
        "accepts": accepts,
        "edges": edges,
        "alphabet": automaton["alphabet"],
    }
'''

path = "automata_integration.py"
with open(path, encoding="utf-8") as f:
    src = f.read()

if "def regex_to_automaton" not in src:
    raise SystemExit("ABORTED, nothing written: automata_integration.py doesn't define regex_to_automaton().")

with open(path, "w", encoding="utf-8") as f:
    f.write(NEW_CONTENT)
print("replaced automata_integration.py: regex_to_automaton() now supports syntax='theory'|'python'.")
print("The JSON response gained two new fields: \"syntax\" and \"experimental\" (true for python-style).")
print("restart the Python server (from your venv) to pick this up.")
