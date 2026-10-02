#!/usr/bin/env python3
"""Replaces the formal/theory path with real pyformlang.regular_expression.Regex
(the same working pattern the original pre-Glushkov code used, just swapping
PythonRegex for Regex - no character classes exist in the formal dialect, so
the \\d-expansion bloat that justified moving Python-style off Pyformlang
does not apply here). The Python-style path keeps using the Glushkov engine
(glushkov_regex.py), unchanged - that decision is evidence-backed and not
being reverted.

Requires pyformlang to be installed (it already is, in the project's
.venv-py311 - this is the same dependency "Show regular CFG" / Lean checking
already use).

Run from the repo root. Aborts without writing anything if automata_integration.py
doesn't define regex_to_automaton."""

NEW_CONTENT = '''"""Regex -> automaton conversion for the browser-based FSM editor.

Supports two regex dialects (see "syntax" in the request payload):
  - "python"  (default): glushkov_regex.py - a clean-room Glushkov (position)
              automaton construction. Built specifically because Pyformlang's
              PythonRegex expands a character class like \\\\d into ten
              separate literal-digit Thompson-construction branches, which
              made diagrams unusably large for common patterns (observed:
              ~80-160 states for \\\\d+(\\\\.\\\\d\\\\d)? ). Verified against
              Python's own `re` module across millions of test strings.
  - "theory": EXPERIMENTAL, pending a Lean-backed replacement. Calls real
              pyformlang.regular_expression.Regex directly - the formal/
              textbook dialect (concatenation via space/'.', union via '|'
              or '+', '*' only, "epsilon"/'$' for the empty string,
              multi-character symbols unless separated - e.g. "abb" with no
              separator is ONE symbol, not three - this is Pyformlang's own
              documented behavior, not an artifact of any reimplementation).
              This dialect has no character classes, so it isn't subject to
              the \\\\d-expansion problem above; using the real library here
              removes any risk of subtle divergence from a hand-written
              parser, which matters for something explicitly labeled
              "formal" even though it's marked experimental.
"""

from __future__ import annotations

from typing import Any

import glushkov_regex
from glushkov_core import determinize

MAX_REGEX_LENGTH = 512
MAX_STATES = 512
MAX_TRANSITIONS = 2048

_EPSILON_NAMES = {"epsilon", "\\u03b5", "\\u03f5", "\\u03bb", "\\u0454"}


def _complete_dfa(dfa: dict[str, Any]) -> dict[str, Any]:
    """Route every missing (state, symbol) pair to a shared non-accepting
    sink state. Neither determinize() nor Pyformlang's to_deterministic()
    guarantee a total transition function, but the editor's DFA validator
    (and the Lean invariant) require one."""
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


def _build_theory_nfa(expression: str) -> dict[str, Any]:
    """Builds the {"states","starts","accepts","edges","alphabet"} dict from
    real pyformlang.regular_expression.Regex, matching the same working
    pattern the original pre-Glushkov implementation used (PythonRegex, with
    the class swapped for Regex - everything else about how to walk a
    Pyformlang EpsilonNFA stays the same, proven, pattern)."""
    try:
        from pyformlang.regular_expression import Regex
    except ImportError as exc:
        raise ValueError(
            "pyformlang is not installed. Run: python -m pip install -r requirements.txt"
        ) from exc

    try:
        automaton = Regex(expression).to_epsilon_nfa()
    except Exception as exc:
        raise ValueError(f"Could not parse that formal-theory regex: {str(exc)[:400]}") from exc

    states = sorted(automaton.states, key=str)
    if not states:
        raise ValueError("The conversion produced no states.")
    state_ids = {state: index for index, state in enumerate(states)}
    starts = sorted(state_ids[s] for s in automaton.start_states if s in state_ids)
    accepts = sorted(state_ids[s] for s in automaton.final_states if s in state_ids)

    edges = []
    alphabet = set()
    transition_dict = automaton.to_dict()
    for source, by_symbol in transition_dict.items():
        for symbol, destinations in by_symbol.items():
            label = str(symbol)
            if label.lower() in _EPSILON_NAMES:
                label = "\\u03b5"
            else:
                alphabet.add(label)
            # Pyformlang's ε-NFA transition dict holds a SET of destinations
            # per (state, symbol) pair.
            for destination in destinations:
                edges.append({"from": state_ids[source], "to": state_ids[destination], "symbol": label})

    return {
        "states": len(states),
        "starts": starts,
        "accepts": accepts,
        "edges": edges,
        "alphabet": sorted(alphabet),
    }


def _determinize_theory(nfa: dict[str, Any]) -> dict[str, Any]:
    """Subset construction WITH epsilon-closure, since (unlike the Glushkov
    path) a real pyformlang ε-NFA can contain epsilon transitions."""
    move = {}
    eps_targets: dict[int, set[int]] = {}
    for e in nfa["edges"]:
        if e["symbol"] == "\\u03b5":
            eps_targets.setdefault(e["from"], set()).add(e["to"])
        else:
            move.setdefault((e["from"], e["symbol"]), set()).add(e["to"])

    def eps_closure(states):
        states = set(states)
        stack = list(states)
        while stack:
            s = stack.pop()
            for t in eps_targets.get(s, ()):
                if t not in states:
                    states.add(t)
                    stack.append(t)
        return frozenset(states)

    alphabet = [s for s in nfa["alphabet"]]
    accepts_set = set(nfa["accepts"])
    start_key = eps_closure(nfa["starts"])
    dfa_states = {start_key: 0}
    order = [start_key]
    dfa_edges = []
    frontier = [start_key]
    while frontier:
        current = frontier.pop()
        current_id = dfa_states[current]
        for symbol in alphabet:
            nxt = set()
            for s in current:
                nxt |= move.get((s, symbol), set())
            if not nxt:
                continue
            nxt = eps_closure(nxt)
            if nxt not in dfa_states:
                dfa_states[nxt] = len(order)
                order.append(nxt)
                frontier.append(nxt)
            dfa_edges.append({"from": current_id, "to": dfa_states[nxt], "symbol": symbol})

    dfa_accepts = sorted(i for i, s in enumerate(order) if s & accepts_set)
    return {
        "states": len(order),
        "starts": [0],
        "accepts": dfa_accepts,
        "edges": dfa_edges,
        "alphabet": alphabet,
    }


def regex_to_automaton(payload: dict[str, Any]) -> dict[str, Any]:
    expression = payload.get("regex", "")
    mode = payload.get("mode", "nfa")
    syntax = payload.get("syntax", "python")

    if not isinstance(expression, str) or not expression.strip():
        raise ValueError("Enter a regular expression first.")
    if len(expression) > MAX_REGEX_LENGTH:
        raise ValueError(f"Regular expressions are limited to {MAX_REGEX_LENGTH} characters.")
    if mode not in ("nfa", "dfa"):
        raise ValueError("Choose either \\u03b5-NFA or DFA output.")
    if syntax not in ("theory", "python"):
        raise ValueError("Choose either the Python-style or formal (theory, experimental) regex syntax.")

    try:
        if syntax == "theory":
            nfa = _build_theory_nfa(expression)
        else:
            nfa = glushkov_regex.build_glushkov_nfa(expression)
    except glushkov_regex.RegexSyntaxError as exc:
        raise ValueError(f"Could not parse that Python-style regex: {exc}") from exc
    except ValueError:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        raise ValueError(f"Could not parse or convert that regex: {str(exc)[:400]}") from exc

    if mode == "dfa":
        automaton = _determinize_theory(nfa) if syntax == "theory" else determinize(nfa)
        automaton = _complete_dfa(automaton)
    else:
        automaton = nfa

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
        "experimental": syntax == "theory",
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
print("replaced automata_integration.py: 'theory' syntax now calls real pyformlang.Regex directly.")
print("'python' syntax is unchanged (still the Glushkov engine) and is now the non-experimental default.")
print("formal_regex.py and the old formal-mode-specific code are no longer used by this file.")
print("restart the Python server (from your venv, which already has pyformlang) to pick this up.")
