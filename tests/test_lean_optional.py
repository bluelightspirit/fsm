"""Lean checks. SLOW (each starts a Lean session) and needs PyPantograph + a Lean toolchain,
so they only run when you opt in:   FSM_TEST_LEAN=1 python3 -m unittest tests.test_lean_optional -v

Includes NEGATIVE controls: a deliberately wrong claim must be reported as a failure.
check_compile does not raise when a theorem fails; it returns the error in its messages,
and an early version of these checks ignored that and reported success for everything."""
import os
import unittest
from importlib.util import find_spec

RUN = os.environ.get("FSM_TEST_LEAN") == "1" and find_spec("pantograph") is not None


@unittest.skipUnless(RUN, "set FSM_TEST_LEAN=1 and install requirements-lean.txt to run the Lean checks")
class LeanChecks(unittest.TestCase):
    def test_formal_regex_construction_nfa_and_dfa(self):
        from lean_regex_check import check_regex_construction_with_lean
        for mode in ("nfa", "dfa"):
            result = check_regex_construction_with_lean({"regex": "(a+b)*abb", "mode": mode})
            self.assertTrue(result["ok"], result["message"])

    def test_wrong_claims_are_rejected(self):
        from pantograph import Server
        from lean_regex_check import _run_lean, build_dfa_verification_source, build_verification_source
        good_nfa, good_dfa = build_verification_source("ab*"), build_dfa_verification_source("(a+b)*abb")
        bad_nfa = good_nfa.replace("def pythonAccept : Nat := 3", "def pythonAccept : Nat := 4")
        bad_dfa = good_dfa.replace("def pythonDfaNumStates : Nat := 5", "def pythonDfaNumStates : Nat := 6")
        self.assertNotEqual(bad_nfa, good_nfa)
        self.assertNotEqual(bad_dfa, good_dfa)
        with Server(imports=["Init"], timeout=120) as server:
            self.assertTrue(_run_lean(server, good_nfa)[0])
            self.assertTrue(_run_lean(server, good_dfa)[0])
            self.assertFalse(_run_lean(server, bad_nfa)[0], "a wrong NFA claim was accepted")
            self.assertFalse(_run_lean(server, bad_dfa)[0], "a wrong DFA claim was accepted")

    def test_check_with_lean_button_reports_the_real_verdict(self):
        from automata_integration import regex_to_automaton
        from lean_integration import check_with_pypantograph
        dfa = regex_to_automaton({"regex": "(a|b)*abb", "mode": "dfa", "syntax": "python"})
        nfa = regex_to_automaton({"regex": "(a|b)*abb", "mode": "nfa", "syntax": "python"})
        proper = check_with_pypantograph({"automaton": dfa, "alphabet": dfa["alphabet"], "type": "dfa"})
        wrong = check_with_pypantograph({"automaton": nfa, "alphabet": nfa["alphabet"], "type": "dfa"})
        self.assertTrue(proper["ok"], proper["message"])
        self.assertFalse(wrong["ok"], "a nondeterministic automaton was certified as a DFA")


if __name__ == "__main__":
    unittest.main()
