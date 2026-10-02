#!/usr/bin/env python3
"""Replaces automata_integration.py's regex_to_automaton() entirely, swapping
Pyformlang/Thompson construction for the clean-room Glushkov construction in
glushkov_regex.py. This supersedes the earlier epsilon-contraction patches
(patch_nfa_trim.py / patch_nfa_trim_fix.py) - Glushkov automata have zero
epsilon transitions to contract in the first place, so there's nothing left
for that pass to do; it's fine if those patches were already applied, this
overwrite makes them moot either way.

The JSON contract returned to the frontend is unchanged (type/nodes/starts/
accepts/edges/alphabet), so automata.js and the NFA<->DFA buttons need no
changes.

Run from the repo root, with glushkov_regex.py already copied in alongside
this script. Aborts without writing anything if automata_integration.py
doesn't contain regex_to_automaton (wrong file / already replaced)."""

import os

NEW_CONTENT = '''"""Regex -> automaton conversion for the browser-based FSM editor.

Uses a clean-room Glushkov (position) automaton construction (see
glushkov_regex.py) rather than a Thompson-construction library. Thompson
construction expands a character class like \\\\d into ten separate
literal-digit branches, and needs long chains of epsilon-only states for
concatenation; Glushkov construction needs none of that - \\\\d becomes a
single edge labeled "d", the whole automaton has zero epsilon transitions,
and it has exactly (number of symbol occurrences + 1) states.
"""

from __future__ import annotations

from typing import Any

from glushkov_regex import RegexSyntaxError, build_glushkov_nfa, determinize

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
    if not isinstance(expression, str) or not expression.strip():
        raise ValueError("Enter a regular expression first.")
    if len(expression) > MAX_REGEX_LENGTH:
        raise ValueError(f"Regular expressions are limited to {MAX_REGEX_LENGTH} characters.")
    if mode not in ("nfa", "dfa"):
        raise ValueError("Choose either \\u03b5-NFA or DFA output.")

    try:
        nfa = build_glushkov_nfa(expression)
    except RegexSyntaxError as exc:
        raise ValueError(f"Could not parse that regex: {exc}") from exc
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
        "nodes": [{"id": i, "name": f"q{i}", "accepting": i in accepts_set} for i in range(total_states)],
        "starts": automaton["starts"],
        "accepts": accepts,
        "edges": edges,
        "alphabet": automaton["alphabet"],
    }
'''

if not os.path.exists("glushkov_regex.py"):
    raise SystemExit("ABORTED: glushkov_regex.py must be copied into the repo root before running this.")

path = "automata_integration.py"
with open(path, encoding="utf-8") as f:
    src = f.read()

if "def regex_to_automaton" not in src:
    raise SystemExit("ABORTED, nothing written: automata_integration.py doesn't define regex_to_automaton().")

with open(path, "w", encoding="utf-8") as f:
    f.write(NEW_CONTENT)
print("replaced automata_integration.py: regex_to_automaton() now uses Glushkov construction, no Pyformlang.")
print("Note: patch_nfa_trim.py / patch_nfa_trim_fix.py are now superseded (no-ops) - nothing left to do there.")
print("restart the Python server (from your venv) and regenerate the regex FSM fresh to test.")
