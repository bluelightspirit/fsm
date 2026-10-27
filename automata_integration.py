"""Regex -> automaton conversion for the browser-based FSM editor.

Supports two regex dialects (see "syntax" in the request payload):
  - "python"  (default): glushkov_regex.py - a clean-room Glushkov (position)
              automaton construction. Built specifically because Pyformlang's
              PythonRegex expands a character class like \\d into ten
              separate literal-digit Thompson-construction branches, which
              made diagrams unusably large for common patterns (observed:
              ~80-160 states for \\d+(\\.\\d\\d)? ). Verified against
              Python's own `re` module across millions of test strings.
  - "theory": EXPERIMENTAL, pending a Lean-backed replacement. Calls real
              pyformlang.regular_expression.Regex directly - the formal/
              textbook dialect (concatenation via space/'.', union via '|'
              or '+', '*' only, "epsilon"/'$' for the empty string,
              multi-character symbols unless separated - e.g. "abb" with no
              separator is ONE symbol, not three - this is Pyformlang's own
              documented behavior, not an artifact of any reimplementation).
              This dialect has no character classes, so it isn't subject to
              the \\d-expansion problem above; using the real library here
              removes any risk of subtle divergence from a hand-written
              parser, which matters for something explicitly labeled
              "formal" even though it's marked experimental.
"""

from __future__ import annotations

from typing import Any

import glushkov_regex
from glushkov_core import determinize
from classic_regex import parse_classic_regex, ClassicRegexSyntaxError
from thompson_port import compile_regex

MAX_REGEX_LENGTH = 512
MAX_STATES = 512
MAX_TRANSITIONS = 2048


def _complete_dfa(dfa: dict[str, Any]) -> dict[str, Any]:
    """Route every missing (state, symbol) pair to a shared non-accepting
    sink state. Neither determinize() nor the Thompson construction
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
    """Builds the {"states","starts","accepts","edges","alphabet"} dict using
    classic_regex.py (single-character symbols, matching the Lean spec
    exactly - no merged multi-character tokens) and thompson_port.py (a
    direct Python port of RegexNFA.lean's `compile`, confirmed byte-for-byte
    identical to real `lean RegexNFA.lean` output, and confirmed via a
    by-decide equality theorem through PyPantograph to match Lean's own
    compileRegex for at least one pattern so far)."""
    try:
        ast = parse_classic_regex(expression)
    except ClassicRegexSyntaxError as exc:
        raise ValueError(f"Could not parse that formal-theory regex: {exc}") from exc

    result = compile_regex(ast)
    edges = []
    alphabet = set()
    for t in result["transitions"]:
        if t[0] == "symbol":
            _, source, c, destination = t
            edges.append({"from": source, "to": destination, "symbol": c})
            alphabet.add(c)
        else:
            _, source, destination = t
            edges.append({"from": source, "to": destination, "symbol": "\u03b5"})

    return {
        "states": result["next_state"],
        "starts": [result["start"]],
        "accepts": [result["accept"]],
        "edges": edges,
        "alphabet": sorted(alphabet),
    }


def _determinize_theory(nfa: dict[str, Any]) -> dict[str, Any]:
    """Subset construction with epsilon-closure, made CANONICALLY
    deterministic: every step that produces an order (worklist processing,
    epsilon-closure expansion) is explicitly sorted, rather than relying on
    Python's set iteration order. This makes exact DFA state numbering a
    specified property of the algorithm - required for the Lean port of
    this function to be a meaningful by-decide equality proof rather than
    an accident of a particular Python implementation's set hashing."""
    move = {}
    eps_targets: dict[int, set[int]] = {}
    for e in nfa["edges"]:
        if e["symbol"] == "\u03b5":
            eps_targets.setdefault(e["from"], set()).add(e["to"])
        else:
            move.setdefault((e["from"], e["symbol"]), set()).add(e["to"])

    def eps_closure(states):
        closure = set(states)
        frontier = sorted(closure)
        while frontier:
            next_frontier = []
            for s in frontier:
                for t in sorted(eps_targets.get(s, ())):
                    if t not in closure:
                        closure.add(t)
                        next_frontier.append(t)
            frontier = sorted(next_frontier)
        return tuple(sorted(closure))  # canonical sorted tuple, safe as a dict key

    alphabet = [s for s in nfa["alphabet"]]  # already sorted by _build_theory_nfa
    accepts_set = set(nfa["accepts"])
    start_key = eps_closure(nfa["starts"])
    dfa_states = {start_key: 0}
    order = [start_key]
    dfa_edges = []
    frontier = [start_key]  # processed FIFO, not Python's LIFO .pop()
    queue_index = 0
    while queue_index < len(frontier):
        current = frontier[queue_index]
        queue_index += 1
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

    dfa_accepts = sorted(i for i, s in enumerate(order) if set(s) & accepts_set)
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
        raise ValueError("Choose either \u03b5-NFA or DFA output.")
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
