"""Regex -> automaton conversion for the browser-based FSM editor.

Two regex dialects, chosen by "syntax" in the request payload:

  "python" (default): Parsed and compiled by Pyformlang's PythonRegex implementation.
      Supports Python-style operators, character classes, shortcuts, and bounded repetitions;
      character classes are expanded to concrete character symbols.

  "theory" (EXPERIMENTAL): textbook regular expressions. Every character is its own symbol
      (`abb` is a, b, b); union is `+` or `|`, star is `*`, `ε`, `epsilon` or `$` is the empty string,
      grouping with parentheses. Parsed by classic_regex.py and compiled to an epsilon-NFA by
      thompson_port.py, a Python port of the Lean implementation in lean_regex_check.py, so the
      "Verify with Lean" button can check that the two agree. Deterministic outputs use one
      explicit subset construction with epsilon-closure for both regex dialects.

Both end in the same JSON shape: nodes, starts, accepts, edges, alphabet. DFA output is made
total by routing missing transitions to a shared sink state (not covered by the Lean check).
"""

from __future__ import annotations

from typing import Any

from classic_regex import parse_classic_regex, ClassicRegexSyntaxError
from thompson_port import compile_regex

MAX_REGEX_LENGTH = 512
MAX_STATES = 512
MAX_TRANSITIONS = 2048


def _complete_dfa(dfa: dict[str, Any]) -> dict[str, Any]:
    """Route every missing (state, symbol) pair to a shared non-accepting
    sink state. Subset construction may produce a partial transition function,
    but the editor's DFA validator
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


def _pyformlang_to_dict(automaton: Any) -> dict[str, Any]:
    """Convert a Pyformlang automaton to the editor's stable integer-ID format."""
    from pyformlang.finite_automaton import Epsilon

    states = sorted(automaton.states, key=lambda state: (type(state.value).__name__, repr(state.value)))
    state_id = {state: index for index, state in enumerate(states)}
    alphabet = sorted((symbol.value for symbol in automaton.symbols), key=str)
    edges = []
    for source in states:
        for symbol in sorted(automaton.symbols, key=lambda item: str(item.value)):
            for target in automaton(source, symbol):
                edges.append({"from": state_id[source], "to": state_id[target], "symbol": symbol.value})
        for target in automaton(source, Epsilon()):
            edges.append({"from": state_id[source], "to": state_id[target], "symbol": "\u03b5"})

    return {
        "states": len(states),
        "starts": sorted(state_id[state] for state in automaton.start_states),
        "accepts": sorted(state_id[state] for state in automaton.final_states),
        "edges": edges,
        "alphabet": alphabet,
    }


def _build_python_nfa(expression: str) -> Any:
    """Use Pyformlang's PythonRegex parser and its Thompson ε-NFA construction."""
    try:
        from pyformlang.regular_expression import PythonRegex
    except ImportError as exc:
        raise ValueError("Python-style regex conversion requires Pyformlang 1.0.11. Run `python -m pip install --upgrade -r requirements.txt` and restart the server.") from exc
    try:
        return PythonRegex(expression).to_epsilon_nfa()
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Could not parse that Python-style regex: {str(exc)[:400]}") from exc


def _determinize_nfa(nfa: dict[str, Any]) -> dict[str, Any]:
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

    alphabet = sorted(nfa["alphabet"], key=str)
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
    if mode not in ("nfa", "dfa", "moore", "mealy"):
        raise ValueError("Choose ε-NFA, DFA, Moore, or Mealy output.")
    if syntax not in ("theory", "python"):
        raise ValueError("Choose either the Python-style or formal (theory, experimental) regex syntax.")

    python_nfa = None
    if syntax == "theory":
        nfa = _build_theory_nfa(expression)
    else:
        python_nfa = _build_python_nfa(expression)
        nfa = _pyformlang_to_dict(python_nfa)

    deterministic_output = mode in ("dfa", "moore", "mealy")
    if deterministic_output:
        # Use the same explicit epsilon-closure subset construction for both
        # regex dialects. This guarantees one transition per state/symbol,
        # which is essential for valid DFA, Moore, and Mealy output.
        automaton = _determinize_nfa(nfa)
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
    if deterministic_output:
        seen_transitions = set()
        for edge in edges:
            key = (edge["from"], edge["symbol"])
            if key in seen_transitions:
                raise ValueError("Internal conversion error: determinization produced multiple destinations for one state/symbol pair.")
            seen_transitions.add(key)
    if mode == "moore":
        nodes = [{"id": i, "name": f"q{i} / {'accept' if i in accepts_set else 'reject'}", "accepting": False} for i in range(total_states)]
        accepts = []
    elif mode == "mealy":
        edges = [dict(edge, symbol=f"{edge['symbol']}/{'accept' if edge['to'] in accepts_set else 'reject'}") for edge in edges]
        nodes = [{"id": i, "name": f"q{i}", "accepting": False} for i in range(total_states)]
        accepts = []
    else:
        nodes = [{"id": i, "name": f"q{i}", "accepting": i in accepts_set} for i in range(total_states)]
    return {
        "type": mode,
        "syntax": syntax,
        "experimental": syntax == "theory",
        "nodes": nodes,
        "starts": automaton["starts"],
        "accepts": accepts,
        "edges": edges,
        "alphabet": automaton["alphabet"],
        "emptyWordAccepted": automaton["starts"][0] in accepts_set,
    }
