"""Optional Pyformlang adapters used by the browser-based FSM editor."""

from __future__ import annotations

from importlib.util import find_spec
from typing import Any


MAX_REGEX_LENGTH = 512
MAX_STATES = 512
MAX_TRANSITIONS = 2048


def regex_to_automaton(payload: dict[str, Any]) -> dict[str, Any]:
    if find_spec("pyformlang") is None:
        raise RuntimeError(
            "Pyformlang is not installed. Run: python -m pip install -r requirements-automata.txt"
        )
    expression = payload.get("regex", "")
    mode = payload.get("mode", "nfa")
    if not isinstance(expression, str) or not expression.strip():
        raise ValueError("Enter a regular expression first.")
    if len(expression) > MAX_REGEX_LENGTH:
        raise ValueError(f"Regular expressions are limited to {MAX_REGEX_LENGTH} characters.")
    if mode not in ("nfa", "dfa"):
        raise ValueError("Choose either ε-NFA or DFA output.")

    from pyformlang.regular_expression import PythonRegex
    from pyformlang.finite_automaton import State

    try:
        automaton = PythonRegex(expression).to_epsilon_nfa()
        if mode == "dfa":
            automaton = automaton.to_deterministic()
            # Determinization may leave missing state/symbol pairs. The editor's
            # DFA validator (and the Lean invariant) require a total transition
            # function, so route those pairs to a non-accepting sink state.
            alphabet_symbols = sorted(automaton.symbols, key=str)
            states_for_completion = list(automaton.states)
            transition_dict = automaton.to_dict()
            missing = [
                (state, symbol)
                for state in states_for_completion
                for symbol in alphabet_symbols
                if symbol not in transition_dict.get(state, {})
            ]
            if missing:
                sink = State("__fsm_dead_state__")
                while sink in states_for_completion:
                    sink = State(str(sink) + "_")
                for state, symbol in missing:
                    automaton.add_transition(state, symbol, sink)
                for symbol in alphabet_symbols:
                    automaton.add_transition(sink, symbol, sink)
    except Exception as exc:
        raise ValueError(f"Could not parse or convert that regex: {str(exc)[:400]}") from exc

    states = sorted(automaton.states, key=str)
    if not states or len(states) > MAX_STATES:
        raise ValueError(f"The conversion produced {len(states)} states; the limit is {MAX_STATES}.")
    state_ids = {state: index for index, state in enumerate(states)}
    # Pyformlang's DFA has one `start_state`; ε-NFAs expose a set as `start_states`.
    start_states = [automaton.start_state] if mode == "dfa" else automaton.start_states
    starts = sorted((state_ids[state] for state in start_states if state in state_ids))
    accepts = sorted((state_ids[state] for state in automaton.final_states if state in state_ids))
    epsilon_names = {"epsilon", "ε", "ϵ", "λ", "є"}
    edges = []
    alphabet = set()
    transition_dict = automaton.to_dict()
    for source, by_symbol in transition_dict.items():
        for symbol, destinations in by_symbol.items():
            label = str(symbol)
            if label.lower() in epsilon_names:
                label = "ε"
            else:
                alphabet.add(label)
            # NFA transition dictionaries hold sets of destinations, while a
            # DFA dictionary holds one State directly.
            targets = destinations if mode == "nfa" else [destinations]
            for destination in targets:
                edges.append({"from": state_ids[source], "to": state_ids[destination], "symbol": label})
                if len(edges) > MAX_TRANSITIONS:
                    raise ValueError(f"The conversion exceeded the {MAX_TRANSITIONS}-transition limit.")
    edges.sort(key=lambda edge: (edge["from"], edge["symbol"], edge["to"]))
    return {
        "type": mode,
        "nodes": [{"id": i, "name": f"q{i}", "accepting": i in accepts} for i in range(len(states))],
        "starts": starts,
        "accepts": accepts,
        "edges": edges,
        "alphabet": sorted(alphabet),
    }
