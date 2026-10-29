"""Shared helpers for the test-suite: a tiny automaton simulator over the JSON the
server returns ({"nodes","starts","accepts","edges","alphabet"})."""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

EPSILON = "\u03b5"

# Python-style regex uses a few class labels instead of one edge per concrete
# character: d = digit, w = word character, s = whitespace, any = ".".
_CLASSES = {
    "any": lambda c: True,
    "d": lambda c: c.isdigit(),
    "D": lambda c: not c.isdigit(),
    "w": lambda c: c.isalnum() or c == "_",
    "W": lambda c: not (c.isalnum() or c == "_"),
    "s": lambda c: c.isspace(),
    "S": lambda c: not c.isspace(),
}


def label_matches(label, ch):
    if label == ch:
        return True
    check = _CLASSES.get(label)
    return bool(check and check(ch))


def accepts(automaton, text):
    """True if the automaton (NFA with optional epsilon edges, or DFA) accepts `text`."""
    eps, move = {}, {}
    for e in automaton["edges"]:
        if e["symbol"] == EPSILON:
            eps.setdefault(e["from"], set()).add(e["to"])
        else:
            move.setdefault(e["from"], []).append((e["symbol"], e["to"]))

    def close(states):
        seen, stack = set(states), list(states)
        while stack:
            s = stack.pop()
            for t in eps.get(s, ()):
                if t not in seen:
                    seen.add(t)
                    stack.append(t)
        return seen

    current = close(set(automaton["starts"]))
    for ch in text:
        nxt = set()
        for s in current:
            for label, target in move.get(s, ()):
                if label_matches(label, ch):
                    nxt.add(target)
        current = close(nxt)
        if not current:
            return False
    return bool(current & set(automaton["accepts"]))
