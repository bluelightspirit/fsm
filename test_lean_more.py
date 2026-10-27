"""Run against REAL PyPantograph from ~/fsm:   python3 test_lean_more.py

Section 1 - ground truth on the ORIGINAL "Check with Lean" button. That code
  ignores returned messages, so its green "proved" message cannot be trusted
  until we know whether its generated source actually compiles. This submits
  that exact source through the message-scanning runner and prints the result,
  plus one deliberately wrong claim (a nondeterministic automaton declared a
  DFA), which MUST fail.
Section 2 - stress test: stage 1 (ε-NFA) and stage 2 (DFA) on a batch of
  regexes, in one Lean session.
"""
from pantograph import Server
from lean_regex_check import (
    MAX_DFA_STATES, _python_dfa, _run_lean,
    build_dfa_verification_source, build_verification_source,
)

PATTERNS = [
    "(a+b)*abb", "ab*", "a(b|c)*", "a+b", "(ab)*c", "(a|b)*", "a*b*",
    "(a+b)*a(a+b)", "epsilon", "a", "(a+b)*abb(a+b)*", "((a|b)(a|b))*",
    r"a\*b", "(0+1)*1(0+1)(0+1)", "a(b(c|d)*)*e",
]


def short(text, n=170):
    return " ".join(str(text).split())[:n]


def section1(server):
    print("=" * 72 + "\nSECTION 1: the ORIGINAL 'Check with Lean' source\n" + "=" * 72)
    try:
        from automata_integration import regex_to_automaton
        from lean_integration import _lean_source
    except Exception as exc:
        print("could not import the original checker:", exc)
        return
    cases = [
        ("proper DFA, claimed dfa        (expect OK)  ", "dfa", "dfa"),
        ("proper NFA, claimed nfa        (expect OK)  ", "nfa", "nfa"),
        ("NFA wrongly claimed to be a dfa (expect FAIL)", "nfa", "dfa"),
    ]
    for label, mode, kind in cases:
        auto = regex_to_automaton({"regex": "(a|b)*abb", "mode": mode, "syntax": "python"})
        source = _lean_source(auto, auto["alphabet"], kind)
        ok, detail = _run_lean(server, source)
        print(f"{label} -> ok={ok}")
        if detail:
            print("     ", short(detail, 400))


def section2(server):
    print("\n" + "=" * 72 + "\nSECTION 2: stage 1 + stage 2 across a batch of regexes\n" + "=" * 72)
    bad = 0
    for pattern in PATTERNS:
        row = {}
        try:
            row["nfa"] = _run_lean(server, build_verification_source(pattern))
            dfa = _python_dfa(pattern)
            if dfa["states"] > MAX_DFA_STATES:
                row["dfa"] = (None, f"skipped: {dfa['states']} DFA states")
            else:
                row["dfa"] = _run_lean(server, build_dfa_verification_source(pattern))
        except Exception as exc:
            row["nfa"] = (False, f"python-side error: {exc}")
            row["dfa"] = (None, "not run")
        def mark(r):
            return "skip" if r[0] is None else ("OK  " if r[0] else "FAIL")
        print(f"{pattern!r:22} NFA {mark(row['nfa'])}   DFA {mark(row['dfa'])}")
        for stage in ("nfa", "dfa"):
            if row[stage][0] is False:
                bad += 1
                print(f"      {stage.upper()} detail: {short(row[stage][1])}")
    print("\nSECTION 2 VERDICT:", "all stages passed" if bad == 0 else f"{bad} stage(s) failed - paste this output back")


with Server(imports=["Init"], timeout=120) as server:
    section1(server)
    section2(server)
