"""Regex -> automaton conversion: language correctness, structure and error handling.
Standard library only. Run:  python3 -m unittest discover -s tests -v"""
import itertools
import re
import unittest

from tests.helpers import EPSILON, accepts
from automata_integration import regex_to_automaton


def build(regex, mode, syntax):
    return regex_to_automaton({"regex": regex, "mode": mode, "syntax": syntax})


ACCEPT_ABB = ["abb", "aabb", "babb", "aaabb", "ababb", "bababb"]
REJECT_ABB = ["", "a", "ab", "aba", "abba", "ba"]


class EndsInAbb(unittest.TestCase):
    """The regression that started the formal-regex rewrite: (a+b)*abb must accept
    exactly the strings over {a,b} that end in abb - `abb` is three symbols, not one."""

    def check(self, regex, syntax, mode):
        auto = build(regex, mode, syntax)
        for word in ACCEPT_ABB:
            self.assertTrue(accepts(auto, word), f"{syntax}/{mode} {regex!r} should accept {word!r}")
        for word in REJECT_ABB:
            self.assertFalse(accepts(auto, word), f"{syntax}/{mode} {regex!r} should reject {word!r}")
        self.assertEqual(auto["alphabet"], ["a", "b"], "abb must not become a single multi-character symbol")

    def test_formal_nfa(self):
        self.check("(a+b)*abb", "theory", "nfa")

    def test_formal_dfa(self):
        self.check("(a+b)*abb", "theory", "dfa")

    def test_formal_union_bar_also_works(self):
        self.check("(a|b)*abb", "theory", "dfa")

    def test_python_style_nfa(self):
        self.check("(a|b)*abb", "python", "nfa")

    def test_python_style_dfa(self):
        self.check("(a|b)*abb", "python", "dfa")


class FormalSyntax(unittest.TestCase):
    def test_adjacent_characters_are_separate_symbols(self):
        auto = build("ab", "nfa", "theory")
        self.assertEqual(auto["alphabet"], ["a", "b"])
        self.assertTrue(accepts(auto, "ab"))
        self.assertFalse(accepts(auto, "a"))
        self.assertFalse(accepts(auto, "ba"))

    def test_star_binds_tighter_than_concatenation(self):
        auto = build("ab*", "dfa", "theory")           # a followed by any number of b
        for word in ("a", "ab", "abbb"):
            self.assertTrue(accepts(auto, word), word)
        for word in ("", "b", "abab", "ba"):
            self.assertFalse(accepts(auto, word), word)

    def test_grouping_overrides_precedence(self):
        auto = build("(ab)*", "dfa", "theory")
        for word in ("", "ab", "abab"):
            self.assertTrue(accepts(auto, word), word)
        for word in ("a", "aba", "abb"):
            self.assertFalse(accepts(auto, word), word)

    def test_plus_is_union_not_one_or_more(self):
        auto = build("a+b", "dfa", "theory")
        self.assertTrue(accepts(auto, "a"))
        self.assertTrue(accepts(auto, "b"))
        self.assertFalse(accepts(auto, "aa"))
        self.assertFalse(accepts(auto, "ab"))

    def test_epsilon_keyword_accepts_only_the_empty_string(self):
        for mode in ("nfa", "dfa"):
            auto = build("epsilon", mode, "theory")
            self.assertTrue(accepts(auto, ""), mode)
            self.assertFalse(accepts(auto, "a"), mode)

    def test_nfa_is_epsilon_nfa(self):
        auto = build("(a+b)*abb", "nfa", "theory")
        self.assertTrue(any(e["symbol"] == EPSILON for e in auto["edges"]))


class AutomatonStructure(unittest.TestCase):
    PATTERNS = [("(a+b)*abb", "theory"), ("ab*", "theory"), ("(a|b)*abb", "python"), ("a(b|c)*", "python")]

    def test_dfa_is_deterministic_and_complete(self):
        for regex, syntax in self.PATTERNS:
            auto = build(regex, "dfa", syntax)
            self.assertEqual(len(auto["starts"]), 1, (regex, syntax))
            seen = {}
            for e in auto["edges"]:
                self.assertNotEqual(e["symbol"], EPSILON, (regex, syntax))
                key = (e["from"], e["symbol"])
                self.assertNotIn(key, seen, f"{regex!r} {syntax}: two edges on {key}")
                seen[key] = e["to"]
            for node in auto["nodes"]:
                for symbol in auto["alphabet"]:
                    self.assertIn((node["id"], symbol), seen, f"{regex!r} {syntax}: state {node['id']} lacks {symbol!r}")

    def test_node_flags_match_accept_list(self):
        auto = build("(a+b)*abb", "dfa", "theory")
        self.assertEqual(sorted(n["id"] for n in auto["nodes"] if n["accepting"]), sorted(auto["accepts"]))

    def test_character_classes_stay_small(self):
        """\\d must be ONE symbol, not ten branches (the old engine produced 80-160 states here)."""
        nfa = build(r"\d+(\.\d\d)?", "nfa", "python")
        dfa = build(r"\d+(\.\d\d)?", "dfa", "python")
        self.assertLessEqual(len(nfa["nodes"]), 8)
        self.assertLessEqual(len(dfa["nodes"]), 10)
        for good in ("7", "42", "3.14", "100.00"):
            self.assertTrue(accepts(dfa, good), good)
        for bad in ("", ".", "3.1", "3.141", "a", "3.14.15"):
            self.assertFalse(accepts(dfa, bad), bad)


class AgreesWithPythonRe(unittest.TestCase):
    """Brute-force cross-check against Python's own `re` engine (fullmatch)."""

    CASES = [("(a|b)*abb", "ab"), ("a(b|c)*", "abc"), ("colou?r", "colur"), ("(ab|a)*b?", "ab")]

    def test_python_style_matches_re(self):
        for pattern, alphabet in self.CASES:
            compiled = re.compile(pattern)
            for mode in ("nfa", "dfa"):
                auto = build(pattern, mode, "python")
                for length in range(0, 7):
                    for letters in itertools.product(alphabet, repeat=length):
                        word = "".join(letters)
                        self.assertEqual(accepts(auto, word), compiled.fullmatch(word) is not None,
                                         f"{pattern!r} {mode} disagrees with re on {word!r}")


class ErrorsAndValidation(unittest.TestCase):
    def test_malformed_regexes_raise_value_error(self):
        for regex, syntax in [("a|", "theory"), ("(a", "theory"), ("a)", "theory"), ("(a", "python"), ("*a", "python")]:
            with self.assertRaises(ValueError, msg=f"{regex!r} ({syntax})"):
                build(regex, "nfa", syntax)

    def test_bad_arguments_raise_value_error(self):
        for payload in ({"regex": "", "mode": "nfa", "syntax": "theory"},
                        {"regex": "a", "mode": "pda", "syntax": "theory"},
                        {"regex": "a", "mode": "nfa", "syntax": "perl"},
                        {"regex": "a" * 600, "mode": "nfa", "syntax": "theory"}):
            with self.assertRaises(ValueError, msg=str(payload)[:60]):
                regex_to_automaton(payload)


if __name__ == "__main__":
    unittest.main()
