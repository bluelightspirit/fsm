"""Python-style regex syntax (EXPERIMENTAL): literals, `.` (any), \d \w \s
\D \W \S, bracket expressions [abc]/[a-z]/[^...], escaped literals,
alternation `|`, concatenation, grouping `(...)`, and the quantifiers
`*` `+` `?`.

Character classes and bracket expressions are each treated as ONE atomic
alphabet symbol (e.g. \d becomes a single edge labeled "d"), rather than
being expanded into a branch per concrete character - that's what keeps the
resulting automaton small. Thompson-style libraries that expand \d into
0|1|2|...|9 pay a 10x-per-occurrence cost that this construction never
introduces in the first place.

This is the informal, Python-`re`-flavored dialect - see formal_regex.py for
the formal/textbook dialect (pyformlang.Regex-compatible), which is the
primary, non-experimental option. Not supported here yet: anchors (^ $),
{m,n} repetition counts, backreferences, lookaround.
"""
from __future__ import annotations

from glushkov_core import build_nfa_from_ast, determinize  # noqa: F401 (re-exported)


class RegexSyntaxError(ValueError):
    pass


CLASS_LETTERS = set("dwsDWS")


def _leaf_label(kind, value):
    if kind == "class":
        return value  # \d -> "d", \W -> "W", etc.
    if kind == "any":
        return "any"  # bare `.` (any character)
    if kind == "bracket":
        return value  # the raw bracket text, e.g. "[a-z]" or "[^0-9]"
    return value  # literal character, used as-is (e.g. "4", ".", "(")


class _Parser:
    def __init__(self, pattern):
        self.s = pattern
        self.i = 0
        self.n = len(pattern)

    def peek(self):
        return self.s[self.i] if self.i < self.n else None

    def advance(self):
        ch = self.s[self.i]
        self.i += 1
        return ch

    def parse(self):
        node = self.parse_alt()
        if self.i != self.n:
            raise RegexSyntaxError(f"Unexpected '{self.peek()}' at position {self.i}")
        return node

    def parse_alt(self):
        node = self.parse_cat()
        while self.peek() == "|":
            self.advance()
            rhs = self.parse_cat()
            node = ("alt", node, rhs)
        return node

    def parse_cat(self):
        parts = []
        while self.peek() is not None and self.peek() not in "|)":
            parts.append(self.parse_quant())
        if not parts:
            return ("empty",)
        node = parts[0]
        for part in parts[1:]:
            node = ("cat", node, part)
        return node

    def parse_quant(self):
        node = self.parse_atom()
        while self.peek() in ("*", "+", "?"):
            op = self.advance()
            if op == "*":
                node = ("star", node)
            elif op == "+":
                node = ("plus", node)
            else:
                node = ("opt", node)
        return node

    def parse_atom(self):
        ch = self.peek()
        if ch is None:
            raise RegexSyntaxError("Unexpected end of pattern")
        if ch == "(":
            self.advance()
            node = self.parse_alt()
            if self.peek() != ")":
                raise RegexSyntaxError("Missing closing ')'")
            self.advance()
            return node
        if ch == ".":
            self.advance()
            return ("leaf", _leaf_label("any", None))
        if ch == "[":
            return ("leaf", _leaf_label("bracket", self._parse_bracket()))
        if ch == "\\":
            self.advance()
            escaped = self.peek()
            if escaped is None:
                raise RegexSyntaxError("Dangling '\\' at end of pattern")
            self.advance()
            if escaped in CLASS_LETTERS:
                return ("leaf", _leaf_label("class", escaped))
            return ("leaf", _leaf_label("lit", escaped))
        if ch in ")|*+?":
            raise RegexSyntaxError(f"Unexpected '{ch}' at position {self.i}")
        self.advance()
        return ("leaf", _leaf_label("lit", ch))

    def _parse_bracket(self):
        start = self.i
        self.advance()  # consume '['
        if self.peek() == "^":
            self.advance()
        if self.peek() == "]":  # a leading ']' is a literal member, not the close
            self.advance()
        while self.peek() is not None and self.peek() != "]":
            self.advance()
        if self.peek() != "]":
            raise RegexSyntaxError("Missing closing ']'")
        self.advance()
        return self.s[start:self.i]


def parse_regex(pattern):
    if pattern == "":
        return ("empty",)
    return _Parser(pattern).parse()


def build_glushkov_nfa(pattern):
    """Returns {"states": n, "starts": [0], "accepts": [...], "edges": [...],
    "alphabet": [...]}. State 0 is the Glushkov start marker; states 1..n
    each correspond to one symbol occurrence (leaf) in the pattern, labeled
    with that leaf's symbol. No epsilon transitions are ever produced."""
    ast = parse_regex(pattern)
    return build_nfa_from_ast(ast)
