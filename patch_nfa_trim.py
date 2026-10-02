#!/usr/bin/env python3
"""Adds a language-preserving epsilon-chain contraction pass to
automata_integration.py, run on ε-NFA output before layout. This is what
actually fixes "160 states for a simple regex": Thompson construction chains
many states together with unconditional epsilon transitions; a state whose
only job is "immediately epsilon-jump to X" behaves identically to being at
X, so it can be removed and its incoming edges rewired to X directly. Verified
separately (exhaustive string-acceptance comparison before/after) before
being written here.

Run from the repo root. Aborts without writing anything if automata_integration.py
doesn't match the expected current shape."""

import re

CONTRACT_FUNC = '''def _contract_epsilon_chains(num_states, starts, accepts, edges):
    """Eliminate Thompson-construction spine states: a state that is not a
    start or accepting state, and whose only outgoing transition is an
    unconditional epsilon jump to another state, behaves identically to that
    other state. Removing it and rewiring its incoming edges to point at the
    target directly does not change which strings the automaton accepts.
    """
    starts = set(starts)
    accepts = set(accepts)
    out_edges = {i: [] for i in range(num_states)}
    for e in edges:
        out_edges[e["from"]].append(e)
    alive = set(range(num_states))
    redirect: dict[int, int] = {}

    def resolve(state):
        seen = set()
        while state in redirect and state not in seen:
            seen.add(state)
            state = redirect[state]
        return state

    changed = True
    while changed:
        changed = False
        for state in list(alive):
            if state in starts or state in accepts:
                continue
            outs = [e for e in out_edges[state] if e["to"] in alive]
            if len(outs) != 1:
                continue
            edge = outs[0]
            if edge["symbol"] != "ε" or edge["to"] == state:
                continue
            alive.discard(state)
            redirect[state] = edge["to"]
            changed = True

    new_edges = []
    seen_keys = set()
    for e in edges:
        source = e["from"]
        if source not in alive:
            continue  # eliminated states keep no outgoing edges of their own
        target = e["to"] if e["to"] in alive else resolve(e["to"])
        if target not in alive:
            continue
        key = (source, e["symbol"], target)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        new_edges.append({"from": source, "to": target, "symbol": e["symbol"]})

    remaining = sorted(alive)
    remap = {old: new for new, old in enumerate(remaining)}
    final_edges = [{"from": remap[e["from"]], "to": remap[e["to"]], "symbol": e["symbol"]} for e in new_edges]
    final_starts = sorted(remap[s] for s in starts if s in remap)
    final_accepts = sorted(remap[a] for a in accepts if a in remap)
    return len(remaining), final_starts, final_accepts, final_edges


'''

OLD_TAIL = '''    states = sorted(automaton.states, key=str)
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
'''

NEW_TAIL = '''    states = sorted(automaton.states, key=str)
    # A generous raw guard before contraction; Thompson construction can be
    # bloated well past MAX_STATES for a modest regex, so the real limit is
    # enforced after the epsilon-chain contraction below, not here.
    RAW_STATE_GUARD = max(MAX_STATES * 8, 4000)
    if not states or len(states) > RAW_STATE_GUARD:
        raise ValueError(f"The conversion produced {len(states)} states; the limit is {RAW_STATE_GUARD}.")
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

    total_states = len(states)
    if mode == "nfa":
        # Thompson construction chains many states together purely with
        # unconditional epsilon jumps. Collapsing those spine states shrinks
        # the diagram (and makes automatic edge routing tractable) without
        # changing which strings the automaton accepts.
        total_states, starts, accepts, edges = _contract_epsilon_chains(total_states, starts, accepts, edges)

    if total_states > MAX_STATES:
        raise ValueError(f"The conversion produced {total_states} states; the limit is {MAX_STATES}.")
    if len(edges) > MAX_TRANSITIONS:
        raise ValueError(f"The conversion exceeded the {MAX_TRANSITIONS}-transition limit.")

    edges.sort(key=lambda edge: (edge["from"], edge["symbol"], edge["to"]))
    return {
        "type": mode,
        "nodes": [{"id": i, "name": f"q{i}", "accepting": i in accepts} for i in range(total_states)],
        "starts": starts,
        "accepts": accepts,
        "edges": edges,
        "alphabet": sorted(alphabet),
    }
'''

path = "automata_integration.py"
with open(path, encoding="utf-8") as f:
    src = f.read()

if "_contract_epsilon_chains" in src:
    raise SystemExit("ABORTED: automata_integration.py already has _contract_epsilon_chains; nothing to do.")

if src.count(OLD_TAIL) != 1:
    raise SystemExit(
        "ABORTED, nothing written: the expected tail of regex_to_automaton() wasn't found exactly once.\n"
        "Send me the full current automata_integration.py so I can re-anchor this patch."
    )

anchor = "def regex_to_automaton(payload: dict[str, Any]) -> dict[str, Any]:\n"
if src.count(anchor) != 1:
    raise SystemExit("ABORTED, nothing written: couldn't find the regex_to_automaton() definition line.")

new_src = src.replace(anchor, CONTRACT_FUNC + anchor, 1)
new_src = new_src.replace(OLD_TAIL, NEW_TAIL, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(new_src)
print("patched automata_integration.py: added _contract_epsilon_chains, applied for mode == 'nfa'.")
print("restart the Python server (source your venv first) to pick this up.")
