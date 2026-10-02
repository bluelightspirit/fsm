"""Shared Glushkov (position) automaton construction, factored out so both
the formal-theory parser (formal_regex.py) and the Python-style parser
(glushkov_regex.py) can feed it the same AST shape without duplicating the
construction logic:

  ("empty",) | ("leaf", label) | ("alt", l, r) | ("cat", l, r)
  | ("star", x) | ("plus", x) | ("opt", x)

Standard textbook algorithm (Aho/Sethi/Ullman "Dragon Book", direct DFA
construction from a regular expression) - not derived from any third-party
regex-engine source.
"""
from __future__ import annotations


class _LeafInfo:
    __slots__ = ("label",)

    def __init__(self, label):
        self.label = label


def _number_leaves(node, leaves, counter):
    kind = node[0]
    if kind == "empty":
        return ("empty",)
    if kind == "leaf":
        pos = counter[0]
        counter[0] += 1
        leaves.append(_LeafInfo(node[1]))
        return ("pos", pos)
    if kind == "alt":
        return ("alt", _number_leaves(node[1], leaves, counter), _number_leaves(node[2], leaves, counter))
    if kind == "cat":
        return ("cat", _number_leaves(node[1], leaves, counter), _number_leaves(node[2], leaves, counter))
    if kind == "star":
        return ("star", _number_leaves(node[1], leaves, counter))
    if kind == "plus":
        return ("plus", _number_leaves(node[1], leaves, counter))
    if kind == "opt":
        return ("opt", _number_leaves(node[1], leaves, counter))
    raise AssertionError(f"unhandled node kind {kind!r}")


class _Compute:
    """Computes nullable/firstpos/lastpos and accumulates followpos, per the
    standard Glushkov/Berry-Sethi construction."""

    def __init__(self):
        self.followpos = {}

    def add_follow(self, positions, targets):
        for p in positions:
            self.followpos.setdefault(p, set()).update(targets)

    def visit(self, node):
        kind = node[0]
        if kind == "empty":
            return True, set(), set()
        if kind == "pos":
            p = node[1]
            return False, {p}, {p}
        if kind == "alt":
            ln, lf, ll = self.visit(node[1])
            rn, rf, rl = self.visit(node[2])
            return (ln or rn), lf | rf, ll | rl
        if kind == "cat":
            ln, lf, ll = self.visit(node[1])
            rn, rf, rl = self.visit(node[2])
            self.add_follow(ll, rf)
            nullable = ln and rn
            firstpos = lf | rf if ln else lf
            lastpos = ll | rl if rn else rl
            return nullable, firstpos, lastpos
        if kind == "star":
            cn, cf, cl = self.visit(node[1])
            self.add_follow(cl, cf)
            return True, cf, cl
        if kind == "plus":
            cn, cf, cl = self.visit(node[1])
            self.add_follow(cl, cf)
            return cn, cf, cl
        if kind == "opt":
            cn, cf, cl = self.visit(node[1])
            return True, cf, cl
        raise AssertionError(f"unhandled numbered node kind {kind!r}")


def build_nfa_from_ast(ast):
    """Returns {"states": n, "starts": [0], "accepts": [...], "edges": [...],
    "alphabet": [...]}. State 0 is the Glushkov start marker; states 1..n
    each correspond to one leaf (symbol occurrence), labeled with that
    leaf's symbol. No epsilon transitions are ever produced."""
    leaves: list[_LeafInfo] = []
    numbered = _number_leaves(ast, leaves, [0])
    computer = _Compute()
    nullable, firstpos, lastpos = computer.visit(numbered)
    n = len(leaves)
    edges = []
    alphabet = set()
    for p in firstpos:
        label = leaves[p].label
        alphabet.add(label)
        edges.append({"from": 0, "to": p + 1, "symbol": label})
    for p, targets in computer.followpos.items():
        for q in targets:
            label = leaves[q].label
            alphabet.add(label)
            edges.append({"from": p + 1, "to": q + 1, "symbol": label})
    accepts = {p + 1 for p in lastpos}
    if nullable:
        accepts.add(0)
    return {
        "states": n + 1,
        "starts": [0],
        "accepts": sorted(accepts),
        "edges": edges,
        "alphabet": sorted(alphabet),
    }


def determinize(nfa):
    """Subset construction over an already epsilon-free NFA (no
    epsilon-closure step is needed, unlike Thompson-style NFAs)."""
    starts = frozenset(nfa["starts"])
    move = {}
    for e in nfa["edges"]:
        move.setdefault((e["from"], e["symbol"]), set()).add(e["to"])
    alphabet = nfa["alphabet"]
    accepts_set = set(nfa["accepts"])
    dfa_states = {starts: 0}
    order = [starts]
    dfa_edges = []
    frontier = [starts]
    while frontier:
        current = frontier.pop()
        current_id = dfa_states[current]
        for symbol in alphabet:
            nxt = set()
            for s in current:
                nxt |= move.get((s, symbol), set())
            nxt = frozenset(nxt)
            if not nxt:
                continue
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
