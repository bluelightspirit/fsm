"""Formal (textbook) regex syntax, matching pyformlang.regular_expression.Regex
(see https://pyformlang.readthedocs.io/en/latest/usage.html#regular-expression):

  - concatenation: a space, or a literal '.'
  - union:         '|' or '+'   (NOT "one or more" - there is no Kleene-plus
                                 or '?' in this dialect, only Kleene star)
  - Kleene star:   '*'
  - epsilon:       the literal word "epsilon", or '$'
  - grouping:      ( ... )
  - alphabet:      any maximal run of characters that are not one of the
                    reserved characters/words above becomes ONE symbol, e.g.
                    "abc" (no separators) is a single 3-letter symbol, not
                    three 1-letter symbols. Reserved characters can be used
                    literally inside a symbol by escaping them with '\\'.

This intentionally does NOT support Python-style sugar (\\d, [...], ?, +
meaning "one or more", etc.) - use glushkov_regex.py (Python-style, marked
experimental) for that instead.
"""
from __future__ import annotations

from glushkov_core import build_nfa_from_ast, determinize  # re-exported below

RESERVED = set(" .|+*()$")


class FormalRegexSyntaxError(ValueError):
    pass


def _tokenize(pattern):
    """Yields ("op", ch) for reserved single-char operators, ("symbol", text)
    for a maximal run of non-reserved characters (with backslash-escapes
    merged in, however many appear throughout the run), and ("space",)
    wherever whitespace occurs between symbols."""
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
        # A symbol run: plain characters and backslash-escapes, merged
        # together as long as nothing unescaped interrupts them.
        buf = []
        while i < n:
            c = pattern[i]
            if c == " " or c in ".|+*()$":
                break
            if c == "\\":
                if i + 1 >= n:
                    raise FormalRegexSyntaxError("Dangling '\\' at end of pattern")
                buf.append(pattern[i + 1])
                i += 2
                continue
            buf.append(c)
            i += 1
        text = "".join(buf)
        tokens.append(("epsilon",) if text == "epsilon" else ("symbol", text))
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
            raise FormalRegexSyntaxError(f"Unexpected token {self.peek()!r}")
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
                node = ("alt", node, rhs)
            else:
                break
        return node

    def _starts_factor(self, tok):
        return tok is not None and tok[0] in ("symbol", "epsilon") or tok == ("op", "(")

    def parse_concat(self):
        self._skip_spaces()
        parts = []
        while True:
            tok = self.peek()
            if tok == ("space",):
                # Look ahead past the space: does another factor follow?
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
            raise FormalRegexSyntaxError(
                "Expected a symbol, '(', or 'epsilon'/'$' here - "
                "write 'epsilon' or '$' explicitly if you mean the empty string"
            )
        node = parts[0]
        for part in parts[1:]:
            node = ("cat", node, part)
        return node

    def parse_factor(self):
        node = self.parse_atom()
        while True:
            self._skip_spaces_peek_only()
            if self.peek() == ("op", "*"):
                self.advance()
                node = ("star", node)
            else:
                break
        return node

    def _skip_spaces_peek_only(self):
        # '*' binds tightly to its atom; a space before '*' does not apply,
        # but we still must not accidentally consume a real concatenation
        # space if '*' isn't actually next - so just check without skipping.
        pass

    def parse_atom(self):
        tok = self.peek()
        if tok is None:
            raise FormalRegexSyntaxError("Unexpected end of pattern")
        if tok == ("op", "("):
            self.advance()
            self._skip_spaces()
            node = self.parse_union()
            self._skip_spaces()
            if self.peek() != ("op", ")"):
                raise FormalRegexSyntaxError("Missing closing ')'")
            self.advance()
            return node
        if tok == ("op", "$"):
            self.advance()
            return ("empty",)
        if tok == ("epsilon",):
            self.advance()
            return ("empty",)
        if tok[0] == "symbol":
            self.advance()
            return ("leaf", tok[1])
        raise FormalRegexSyntaxError(f"Unexpected token {tok!r}")


def parse_formal_regex(pattern):
    if pattern.strip() == "":
        return ("empty",)
    tokens = _tokenize(pattern)
    return _Parser(tokens).parse()


def build_formal_nfa(pattern):
    ast = parse_formal_regex(pattern)
    return build_nfa_from_ast(ast)
