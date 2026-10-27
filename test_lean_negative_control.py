"""Run against REAL PyPantograph. Purpose: find out whether Server.check_compile
reports a failing theorem at all (by raising, or by returning an error
message). If the deliberately-wrong source below is reported as OK, then every
earlier "ok: True" from the Lean button is meaningless and we need to read the
returned units differently.

Run from ~/fsm:   python3 test_lean_negative_control.py
"""
from lean_regex_check import (
    build_dfa_verification_source, build_verification_source, _run_lean,
)
from pantograph import Server

good_dfa = build_dfa_verification_source("(a+b)*abb")
bad_dfa = good_dfa.replace("def pythonDfaNumStates : Nat := 5", "def pythonDfaNumStates : Nat := 6")
good_nfa = build_verification_source("ab*")
bad_nfa = good_nfa.replace("def pythonAccept : Nat := 3", "def pythonAccept : Nat := 4")
assert bad_dfa != good_dfa and bad_nfa != good_nfa, "tampering did not change the source"

cases = [
    ("NFA  correct   (expect OK)  ", good_nfa, True),
    ("NFA  tampered  (expect FAIL)", bad_nfa, False),
    ("DFA  correct   (expect OK)  ", good_dfa, True),
    ("DFA  tampered  (expect FAIL)", bad_dfa, False),
]
verdicts = []
with Server(imports=["Init"], timeout=120) as server:
    for label, source, expected in cases:
        # Show what check_compile really returns, so we learn its shape.
        try:
            raw = server.check_compile(source)
            print(f"\n{label} raw return: {repr(raw)[:600]}")
        except Exception as exc:
            print(f"\n{label} raised: {type(exc).__name__}: {str(exc)[:400]}")
        ok, detail = _run_lean(server, source)
        verdicts.append(ok == expected)
        print(f"{label} -> ok={ok}  {'as expected' if ok == expected else '*** UNEXPECTED ***'}")
        if detail:
            print(f"   detail: {detail[:300]}")

print("\nVERDICT:", "all four behaved as expected - failures ARE detected, so the OK results are meaningful."
      if all(verdicts) else
      "UNEXPECTED RESULT - paste this whole output back; earlier OK results may not have been checking anything.")
