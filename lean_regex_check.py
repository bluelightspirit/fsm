"""Differential check, via PyPantograph, that the editor's formal-theory
construction agrees EXACTLY with a second implementation written in Lean.

Stage 1 (any mode): Python's Thompson epsilon-NFA (thompson_port.py) equals
  RegexNFA.compileRegex's output for the same regex.
Stage 2 (DFA mode): the DFA the editor builds (_determinize_theory, before
  its sink-state completion step) equals RegexNFA.subsetConstruct applied to
  Lean's own NFA.

Both are `by decide` equality theorems submitted through the same
Server(imports=["Init"]) + check_compile call the existing "Check with Lean"
button uses. Python computes everything that gets drawn; Lean only confirms
it computes the identical structure.

What this is NOT: a proof of L(compile r) = L(r) or L(DFA) = L(NFA) in
general. It shows two independent implementations agree on this input.

check_compile's failure behaviour is not documented anywhere I could find, so
_run_lean does not assume it raises: it also scans returned messages for
errors. test_lean_negative_control.py exists to confirm a deliberately wrong
theorem is reported as a failure.
"""
from __future__ import annotations

from importlib.util import find_spec
from threading import Lock
from typing import Any

from classic_regex import ClassicRegexSyntaxError, parse_classic_regex
from thompson_port import compile_regex

_lean_lock = Lock()

MAX_REGEX_LENGTH = 256
MAX_NFA_STATES = 256
MAX_DFA_STATES = 128

_REGEX_NFA_LEAN_SOURCE = r'''
namespace RegexNFA

inductive Regex where
  | empty
  | eps
  | char (c : Char)
  | alt  (r₁ r₂ : Regex)
  | seq  (r₁ r₂ : Regex)
  | star (r : Regex)
  deriving Repr, Inhabited

inductive Transition where
  | symbol  (src : Nat) (c : Char) (dst : Nat)
  | epsilon (src : Nat) (dst : Nat)
  deriving Repr, Inhabited, DecidableEq

structure NFA where
  start       : Nat
  accept      : Nat
  transitions : List Transition
  nextState   : Nat
  deriving Repr, Inhabited, DecidableEq

structure Builder where
  nextState : Nat := 0
  transitions : List Transition := []

def Builder.fresh (b : Builder) : Nat × Builder :=
  (b.nextState, { b with nextState := b.nextState + 1 })

def Builder.addTransition
    (b : Builder)
    (t : Transition) : Builder :=
  { b with transitions := t :: b.transitions }

def compile : Regex → Builder → Nat × Nat × Builder
  | .empty, b =>
      let (s, b) := b.fresh
      let (f, b) := b.fresh
      (s, f, b)
  | .eps, b =>
      let (s, b) := b.fresh
      let (f, b) := b.fresh
      let b := b.addTransition (.epsilon s f)
      (s, f, b)
  | .char c, b =>
      let (s, b) := b.fresh
      let (f, b) := b.fresh
      let b := b.addTransition (.symbol s c f)
      (s, f, b)
  | .seq r₁ r₂, b =>
      let (s₁, f₁, b) := compile r₁ b
      let (s₂, f₂, b) := compile r₂ b
      let b := b.addTransition (.epsilon f₁ s₂)
      (s₁, f₂, b)
  | .alt r₁ r₂, b =>
      let (s, b) := b.fresh
      let (f, b) := b.fresh
      let (s₁, f₁, b) := compile r₁ b
      let (s₂, f₂, b) := compile r₂ b
      let b := b.addTransition (.epsilon s s₁)
      let b := b.addTransition (.epsilon s s₂)
      let b := b.addTransition (.epsilon f₁ f)
      let b := b.addTransition (.epsilon f₂ f)
      (s, f, b)
  | .star r, b =>
      let (s, b) := b.fresh
      let (f, b) := b.fresh
      let (s₁, f₁, b) := compile r b
      let b := b.addTransition (.epsilon s s₁)
      let b := b.addTransition (.epsilon s f)
      let b := b.addTransition (.epsilon f₁ s₁)
      let b := b.addTransition (.epsilon f₁ f)
      (s, f, b)

def compileRegex (r : Regex) : NFA :=
  let (start, accept, b) := compile r {}
  { start := start, accept := accept, transitions := b.transitions.reverse, nextState := b.nextState }

end RegexNFA
'''

# Subset construction. Deliberately fuel-bounded structural recursion rather
# than `partial def`: partial definitions are opaque to the kernel, so `decide`
# could not evaluate them. Mirrors the canonical (sorted, FIFO) Python
# _determinize_theory step for step; the mirror was checked against the real
# Python for exact state count, accepts and edge order.
_SUBSET_LEAN_SOURCE = r'''
namespace RegexNFA

def epsClosureStep (trans : List Transition) (s : Nat) : List Nat :=
  trans.filterMap (fun t => match t with
    | .epsilon src dst => if src == s then some dst else none
    | _ => none)

def epsClosureAux : Nat → List Transition → List Nat → List Nat → List Nat
  | 0, _, seen, _ => seen
  | _ + 1, _, seen, [] => seen
  | fuel + 1, trans, seen, s :: rest =>
      if seen.contains s then
        epsClosureAux fuel trans seen rest
      else
        epsClosureAux fuel trans (s :: seen) (epsClosureStep trans s ++ rest)

def epsClosure (nfa : NFA) (states : List Nat) : List Nat :=
  epsClosureAux (nfa.nextState * nfa.nextState + nfa.transitions.length + 1) nfa.transitions [] states

def insertSorted (x : Nat) : List Nat → List Nat
  | [] => [x]
  | y :: ys =>
      if x < y then x :: y :: ys
      else if x == y then y :: ys
      else y :: insertSorted x ys

def sortDedup (xs : List Nat) : List Nat :=
  xs.foldl (fun acc x => insertSorted x acc) []

def concatAll : List (List Nat) → List Nat
  | [] => []
  | xs :: rest => xs ++ concatAll rest

def moveOn (trans : List Transition) (states : List Nat) (c : Char) : List Nat :=
  sortDedup (concatAll (states.map (fun s =>
    trans.filterMap (fun t => match t with
      | .symbol src c' dst => if src == s && c' == c then some dst else none
      | _ => none))))

def insertSortedChar (x : Char) : List Char → List Char
  | [] => [x]
  | y :: ys =>
      if x.toNat < y.toNat then x :: y :: ys
      else if x == y then y :: ys
      else y :: insertSortedChar x ys

def alphabetOf (trans : List Transition) : List Char :=
  trans.foldl (fun acc t => match t with
    | .symbol _ c _ => insertSortedChar c acc
    | _ => acc) []

structure DFA where
  start       : Nat
  accepts     : List Nat
  transitions : List (Nat × Char × Nat)
  numStates   : Nat
  deriving Repr, Inhabited, DecidableEq

def findIdx (target : List Nat) : List (List Nat) → Nat → Option Nat
  | [], _ => none
  | x :: xs, i => if x == target then some i else findIdx target xs (i + 1)

def stepSymbols (nfa : NFA) (idx : Nat) (current : List Nat) :
    List Char → List (List Nat) → List (Nat × Char × Nat) →
    List (List Nat) × List (Nat × Char × Nat)
  | [], disc, edges => (disc, edges)
  | c :: cs, disc, edges =>
      let moved := moveOn nfa.transitions current c
      if moved.isEmpty then
        stepSymbols nfa idx current cs disc edges
      else
        let target := sortDedup (epsClosure nfa moved)
        match findIdx target disc 0 with
        | some j => stepSymbols nfa idx current cs disc (edges ++ [(idx, c, j)])
        | none => stepSymbols nfa idx current cs (disc ++ [target]) (edges ++ [(idx, c, disc.length)])

def subsetLoop (nfa : NFA) (alphabet : List Char) :
    Nat → Nat → List (List Nat) → List (Nat × Char × Nat) →
    List (List Nat) × List (Nat × Char × Nat)
  | 0, _, disc, edges => (disc, edges)
  | fuel + 1, idx, disc, edges =>
      match disc[idx]? with
      | none => (disc, edges)
      | some current =>
          match stepSymbols nfa idx current alphabet disc edges with
          | (disc', edges') => subsetLoop nfa alphabet fuel (idx + 1) disc' edges'

def dfaAccepts (nfa : NFA) (disc : List (List Nat)) : List Nat :=
  (List.range disc.length).filter (fun i =>
    match disc[i]? with
    | some s => s.contains nfa.accept
    | none => false)

def subsetConstruct (nfa : NFA) : DFA :=
  let alphabet := alphabetOf nfa.transitions
  let startSet := sortDedup (epsClosure nfa [nfa.start])
  match subsetLoop nfa alphabet 1024 0 [startSet] [] with
  | (disc, edges) =>
      { start := 0, accepts := dfaAccepts nfa disc, transitions := edges, numStates := disc.length }

end RegexNFA
'''


def _char_literal(c: str) -> str:
    if len(c) != 1:
        raise ValueError(f"expected exactly one character, got {c!r}")
    if c == "'":
        return "'\\''"
    if c == "\\":
        return "'\\\\'"
    if c == " ":
        return "' '"
    return f"'{c}'"


def _ast_to_lean_term(node: dict) -> str:
    if "eps" in node:
        return "RegexNFA.Regex.eps"
    if "char" in node:
        return f"(RegexNFA.Regex.char {_char_literal(node['char'])})"
    if "seq" in node:
        l, r = node["seq"]
        return f"(RegexNFA.Regex.seq {_ast_to_lean_term(l)} {_ast_to_lean_term(r)})"
    if "alt" in node:
        l, r = node["alt"]
        return f"(RegexNFA.Regex.alt {_ast_to_lean_term(l)} {_ast_to_lean_term(r)})"
    if "star" in node:
        return f"(RegexNFA.Regex.star {_ast_to_lean_term(node['star'])})"
    raise ValueError(f"unknown AST node {node!r}")


def _transition_to_lean(t: tuple) -> str:
    if t[0] == "symbol":
        _, src, c, dst = t
        return f"(RegexNFA.Transition.symbol {src} {_char_literal(c)} {dst})"
    _, src, dst = t
    return f"(RegexNFA.Transition.epsilon {src} {dst})"


def build_verification_source(expression: str) -> str:
    """Stage 1: Python's Thompson NFA == RegexNFA.compileRegex."""
    ast = parse_classic_regex(expression)
    py = compile_regex(ast)

    transitions_literal = "[" + ", ".join(_transition_to_lean(t) for t in py["transitions"]) + "]"
    source = _REGEX_NFA_LEAN_SOURCE
    source += f"\ndef pythonRegex : RegexNFA.Regex := {_ast_to_lean_term(ast)}\n"
    source += f"def pythonTransitions : List RegexNFA.Transition := {transitions_literal}\n"
    source += f"def pythonStart : Nat := {py['start']}\n"
    source += f"def pythonAccept : Nat := {py['accept']}\n"
    source += f"def pythonNextState : Nat := {py['next_state']}\n"
    source += (
        "theorem python_matches_lean_thompson_construction :\n"
        "    RegexNFA.compileRegex pythonRegex\n"
        "      = { start := pythonStart, accept := pythonAccept,\n"
        "          transitions := pythonTransitions, nextState := pythonNextState } := by decide\n"
    )
    return source


def _python_dfa(expression: str) -> dict[str, Any]:
    # The editor's own functions, so what is checked is what is drawn.
    from automata_integration import _build_theory_nfa, _determinize_theory

    return _determinize_theory(_build_theory_nfa(expression))


def build_dfa_verification_source(expression: str) -> str:
    """Stage 2: the editor's DFA == RegexNFA.subsetConstruct (compileRegex r)."""
    ast = parse_classic_regex(expression)
    dfa = _python_dfa(expression)

    edges = ", ".join(
        f"({e['from']}, {_char_literal(e['symbol'])}, {e['to']})" for e in dfa["edges"]
    )
    accepts = ", ".join(str(a) for a in dfa["accepts"])

    source = _REGEX_NFA_LEAN_SOURCE + _SUBSET_LEAN_SOURCE
    source += f"\ndef pythonRegex : RegexNFA.Regex := {_ast_to_lean_term(ast)}\n"
    source += f"def pythonDfaTransitions : List (Nat × Char × Nat) := [{edges}]\n"
    source += f"def pythonDfaAccepts : List Nat := [{accepts}]\n"
    source += f"def pythonDfaNumStates : Nat := {dfa['states']}\n"
    source += (
        "set_option maxRecDepth 100000 in\n"
        "theorem python_dfa_matches_lean_subset_construction :\n"
        "    RegexNFA.subsetConstruct (RegexNFA.compileRegex pythonRegex)\n"
        "      = ({ start := 0, accepts := pythonDfaAccepts,\n"
        "           transitions := pythonDfaTransitions,\n"
        "           numStates := pythonDfaNumStates } : RegexNFA.DFA) := by decide\n"
    )
    return source


def _compile_errors(units: Any) -> list[str]:
    errors: list[str] = []
    try:
        for unit in units or []:
            for message in getattr(unit, "messages", None) or []:
                text = str(message)
                if "error" in text.lower():
                    errors.append(text)
    except TypeError:
        pass
    return errors


def _run_lean(server: Any, source: str) -> tuple[bool, str]:
    """True only if check_compile neither raised nor returned an error message."""
    try:
        units = server.check_compile(source)
    except Exception as exc:
        return False, (str(exc).strip() or exc.__class__.__name__)[:800]
    errors = _compile_errors(units)
    if errors:
        return False, " | ".join(errors)[:800]
    return True, ""


def check_regex_construction_with_lean(payload: dict[str, Any]) -> dict[str, Any]:
    expression = payload.get("regex", "")
    mode = payload.get("mode", "nfa")
    if not isinstance(expression, str) or not expression.strip():
        return {"ok": False, "available": True, "message": "Enter a regular expression first."}
    if len(expression) > MAX_REGEX_LENGTH:
        return {"ok": False, "available": True, "message": f"Limited to {MAX_REGEX_LENGTH} characters for Lean checking."}
    if mode not in ("nfa", "dfa"):
        return {"ok": False, "available": True, "message": "Choose either ε-NFA or DFA output."}

    if find_spec("pantograph") is None:
        return {
            "ok": False,
            "available": False,
            "message": "PyPantograph is not installed. Install Lean and run: python -m pip install -r requirements-lean.txt",
        }

    try:
        ast = parse_classic_regex(expression)
        py = compile_regex(ast)
        if py["next_state"] > MAX_NFA_STATES:
            return {"ok": False, "available": True, "message": f"That regex's Thompson construction has {py['next_state']} states; the Lean check is limited to {MAX_NFA_STATES}."}
        stages = [("ε-NFA", build_verification_source(expression))]
        if mode == "dfa":
            dfa = _python_dfa(expression)
            if dfa["states"] > MAX_DFA_STATES:
                return {"ok": False, "available": True, "message": f"That DFA has {dfa['states']} states; the Lean check is limited to {MAX_DFA_STATES}."}
            stages.append(("DFA", build_dfa_verification_source(expression)))
    except ClassicRegexSyntaxError as exc:
        return {"ok": False, "available": True, "message": f"Could not parse that regex: {exc}"}
    except Exception as exc:
        return {"ok": False, "available": True, "message": f"Could not prepare the Lean check: {str(exc)[:600]}"}

    results: list[dict[str, Any]] = []
    try:
        from pantograph import Server

        with _lean_lock:
            with Server(imports=["Init"], timeout=120) as server:
                for label, source in stages:
                    ok, detail = _run_lean(server, source)
                    results.append({"stage": label, "ok": ok, "detail": detail})
                    if not ok:
                        break  # the DFA stage is meaningless if the NFA stage disagrees
    except Exception as exc:
        message = str(exc).strip() or exc.__class__.__name__
        return {"ok": False, "available": True, "message": message[:1000]}

    parts: list[str] = []
    for r in results:
        if r["stage"] == "ε-NFA":
            parts.append(
                "ε-NFA: Lean and Python produce the identical Thompson construction for this regex."
                if r["ok"] else f"ε-NFA check FAILED: {r['detail']}"
            )
        else:
            parts.append(
                "DFA: Lean's subset construction yields exactly the DFA the editor builds "
                "(compared before the sink-state completion step, which is not covered)."
                if r["ok"] else f"DFA check FAILED: {r['detail']}"
            )
    if len(results) < len(stages):
        parts.append("DFA check skipped because the ε-NFA stage failed.")
    all_ok = len(results) == len(stages) and all(r["ok"] for r in results)
    if all_ok:
        parts.append("This confirms two implementations agree exactly; it is not a general correctness proof.")
    return {"ok": all_ok, "available": True, "message": " ".join(parts), "stages": results}
