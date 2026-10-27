"""Direct Python port of RegexNFA.lean's compile function, mirroring its
exact state-allocation order so output can be checked byte-for-byte against
real `lean RegexNFA.lean` runs, and so a `by decide` equality theorem
against Lean's own compileRegex is meaningful (same algorithm, same
allocation order -> same states/edges, not just the same language)."""


class Builder:
    def __init__(self):
        self.next_state = 0
        self.transitions = []  # appended in REVERSE, like the Lean code, then reversed at the end

    def fresh(self):
        s = self.next_state
        self.next_state += 1
        return s

    def add_transition(self, t):
        self.transitions.append(t)  # Lean: t :: b.transitions (prepend) -> same as append-then-reverse-at-end


def compile_regex_ast(node, b: Builder):
    """node is classic_regex.py's AST shape: {"eps"}/{"char":c}/{"alt":[l,r]}
    /{"seq":[l,r]}/{"star":r}. Returns (start, final)."""
    if "eps" in node:
        s = b.fresh(); f = b.fresh()
        b.add_transition(("epsilon", s, f))
        return s, f
    if "char" in node:
        s = b.fresh(); f = b.fresh()
        b.add_transition(("symbol", s, node["char"], f))
        return s, f
    if "seq" in node:
        l, r = node["seq"]
        s1, f1 = compile_regex_ast(l, b)
        s2, f2 = compile_regex_ast(r, b)
        b.add_transition(("epsilon", f1, s2))
        return s1, f2
    if "alt" in node:
        s = b.fresh(); f = b.fresh()
        l, r = node["alt"]
        s1, f1 = compile_regex_ast(l, b)
        s2, f2 = compile_regex_ast(r, b)
        b.add_transition(("epsilon", s, s1))
        b.add_transition(("epsilon", s, s2))
        b.add_transition(("epsilon", f1, f))
        b.add_transition(("epsilon", f2, f))
        return s, f
    if "star" in node:
        s = b.fresh(); f = b.fresh()
        s1, f1 = compile_regex_ast(node["star"], b)
        b.add_transition(("epsilon", s, s1))
        b.add_transition(("epsilon", s, f))
        b.add_transition(("epsilon", f1, s1))
        b.add_transition(("epsilon", f1, f))
        return s, f
    raise AssertionError(f"unknown node {node!r}")


def compile_regex(ast):
    b = Builder()
    start, accept = compile_regex_ast(ast, b)
    return {
        "start": start,
        "accept": accept,
        "transitions": list(b.transitions),  # already in the same order Lean's .reverse produces
        "next_state": b.next_state,
    }
