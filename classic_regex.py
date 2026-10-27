"""Classic single-character automata-theory regex, matching the Lean spec
exactly: every character is its own symbol, implicit concatenation by
adjacency (ab = a.b), '|' or '+' for union, '*' for Kleene star, '(' ')' for
grouping, 'epsilon' or '$' for the empty string. No multi-character token
merging (unlike pyformlang.Regex) - this is the deliberate fix for that.

Adapted from formal_regex.py's already-tested tokenizer/parser, with the
symbol-run-merging behavior removed: every character (or backslash-escape)
is its own leaf, period.

Produces a JSON-serializable AST matching the Lean `Regex` inductive type
one-to-one:
  {"empty"} | {"eps"} | {"char": "a"}
  | {"alt": [l, r]} | {"seq": [l, r]} | {"star": r}
"""
from __future__ import annotations

RESERVED = set(" .|+*()$")


class ClassicRegexSyntaxError(ValueError):
    pass


def _tokenize(pattern):
    """Yields ("op", ch), ("char", ch) for exactly one character (escapes
    resolved), ("epsilon",) for the literal word "epsilon", and ("space",)."""
    tokens = []
    i, n = 0, len(pattern)
    while i < n:
        ch = pattern[i]
        if ch == " ":
            tokens.append(("space",))
            i += 1
            continue
        if ch in ".|+*()$":
            tokens.append(("op", ch))
            i += 1
            continue
        if ch == "\\":
            if i + 1 >= n:
                raise ClassicRegexSyntaxError("Dangling '\\' at end of pattern")
            tokens.append(("char", pattern[i + 1]))
            i += 2
            continue
        # "epsilon" as a bare word is the epsilon keyword; otherwise every
        # character is its own token (no run-merging).
        if pattern[i:i + 7] == "epsilon" and (i + 7 == n or pattern[i + 7] in RESERVED):
            tokens.append(("epsilon",))
            i += 7
            continue
        tokens.append(("char", ch))
        i += 1
    return tokens


class _Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.i = 0

    def peek(self):
        return self.tokens[self.i] if self.i < len(self.tokens) else None

    def _skip_spaces(self):
        while self.peek() == ("space",):
            self.i += 1

    def advance(self):
        tok = self.tokens[self.i]
        self.i += 1
        return tok

    def parse(self):
        self._skip_spaces()
        node = self.parse_union()
        self._skip_spaces()
        if self.i != len(self.tokens):
            raise ClassicRegexSyntaxError(f"Unexpected token {self.peek()!r}")
        return node

    def parse_union(self):
        node = self.parse_concat()
        while True:
            self._skip_spaces()
            tok = self.peek()
            if tok in (("op", "|"), ("op", "+")):
                self.advance()
                self._skip_spaces()
                rhs = self.parse_concat()
                node = {"alt": [node, rhs]}
            else:
                break
        return node

    def _starts_factor(self, tok):
        return tok is not None and (tok[0] in ("char", "epsilon") or tok == ("op", "("))

    def parse_concat(self):
        self._skip_spaces()
        parts = []
        while True:
            tok = self.peek()
            if tok == ("space",):
                save = self.i
                self._skip_spaces()
                if self._starts_factor(self.peek()):
                    parts.append(self.parse_factor())
                    continue
                self.i = save
                break
            if tok == ("op", "."):
                self.advance()
                self._skip_spaces()
                parts.append(self.parse_factor())
                continue
            if self._starts_factor(tok):
                parts.append(self.parse_factor())
                continue
            break
        if not parts:
            raise ClassicRegexSyntaxError(
                "Expected a character, '(', or 'epsilon'/'$' here - "
                "write 'epsilon' or '$' explicitly if you mean the empty string"
            )
        node = parts[0]
        for part in parts[1:]:
            node = {"seq": [node, part]}
        return node

    def parse_factor(self):
        node = self.parse_atom()
        while self.peek() == ("op", "*"):
            self.advance()
            node = {"star": node}
        return node

    def parse_atom(self):
        tok = self.peek()
        if tok is None:
            raise ClassicRegexSyntaxError("Unexpected end of pattern")
        if tok == ("op", "("):
            self.advance()
            self._skip_spaces()
            node = self.parse_union()
            self._skip_spaces()
            if self.peek() != ("op", ")"):
                raise ClassicRegexSyntaxError("Missing closing ')'")
            self.advance()
            return node
        if tok == ("op", "$"):
            self.advance()
            return {"eps": True}
        if tok == ("epsilon",):
            self.advance()
            return {"eps": True}
        if tok[0] == "char":
            self.advance()
            return {"char": tok[1]}
        raise ClassicRegexSyntaxError(f"Unexpected token {tok!r}")


def parse_classic_regex(pattern):
    if pattern.strip() == "":
        return {"eps": True}
    tokens = _tokenize(pattern)
    return _Parser(tokens).parse()
