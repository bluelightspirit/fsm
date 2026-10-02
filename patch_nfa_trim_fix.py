#!/usr/bin/env python3
"""Fixes a real bug in _contract_epsilon_chains: when a state's chain target
had already been eliminated earlier in the same pass, the old code filtered
that edge out entirely (treating the state as having zero outgoing edges)
instead of resolving through to the target's eventual replacement. That
permanently blocked elimination of any state upstream of an already-removed
one - exactly the shape of long forwarding chains like Q17->Q13->Q7->Q114
->Q108->Q104 that Thompson construction produces. Verified against a
reproduction of that exact shape (id ordering matters: this only manifests
when a chain's edges go from higher ids to lower ids, which is why an
earlier synthetic test missed it) before being written here.

Run from the repo root, after patch_nfa_trim.py has already been applied.
Aborts without writing anything if the expected buggy function isn't found."""

OLD_FUNC = '''def _contract_epsilon_chains(num_states, starts, accepts, edges):
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

NEW_FUNC = '''def _contract_epsilon_chains(num_states, starts, accepts, edges):
    """Eliminate Thompson-construction spine states: a state that is not a
    start or accepting state, and whose only outgoing transition is an
    unconditional epsilon jump to another state, behaves identically to that
    other state. Removing it and rewiring its incoming edges to point at the
    target directly does not change which strings the automaton accepts.

    Elimination decisions resolve each edge's target through any
    already-eliminated state to its eventual replacement, rather than
    treating an edge to an eliminated state as simply gone. Without that, a
    long run of consecutive forwarder-only states (common in Thompson
    construction, e.g. five or more states in a row each doing nothing but
    an unconditional epsilon jump to the next) only partially collapses:
    whichever end of the run gets processed first blocks the rest.
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
            # Resolve every outgoing edge's target through eliminations that
            # already happened this pass, then dedupe. A state qualifies for
            # elimination only if that leaves exactly one (symbol, target)
            # pair, and it's an unconditional epsilon jump elsewhere.
            effective = set()
            for e in out_edges[state]:
                target = e["to"] if e["to"] in alive else resolve(e["to"])
                effective.add((e["symbol"], target))
            if len(effective) != 1:
                continue
            symbol, target = next(iter(effective))
            if symbol != "ε" or target == state:
                continue
            alive.discard(state)
            redirect[state] = target
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

path = "automata_integration.py"
with open(path, encoding="utf-8") as f:
    src = f.read()

if src.count(OLD_FUNC) != 1:
    if "if len(effective) != 1:" in src:
        raise SystemExit("ABORTED: this fix already appears to be applied. Nothing to do.")
    raise SystemExit(
        "ABORTED, nothing written: the expected buggy _contract_epsilon_chains body wasn't found "
        "exactly once. Send me the current automata_integration.py so I can re-anchor this."
    )

with open(path, "w", encoding="utf-8") as f:
    f.write(src.replace(OLD_FUNC, NEW_FUNC, 1))
print("patched automata_integration.py: fixed the cascading-chain bug in _contract_epsilon_chains.")
print("restart the Python server (from your venv) to pick this up, then regenerate the regex FSM fresh.")
