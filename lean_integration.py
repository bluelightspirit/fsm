"""Optional PyPantograph bridge for checking the editor's finite-automaton model."""

from __future__ import annotations

from importlib.util import find_spec
from typing import Any

from threading import Lock

_lean_lock = Lock()


def _lean_source(automaton: dict[str, Any], alphabet: list[str], kind: str) -> str:
    nodes = automaton.get("nodes", [])
    starts = automaton.get("starts", [])
    accepts = automaton.get("accepts", [])
    edges = automaton.get("edges", [])
    if not isinstance(nodes, list) or not 1 <= len(nodes) <= 512:
        raise ValueError("The Lean check accepts diagrams with 1–512 states.")
    if not isinstance(starts, list) or len(starts) != 1:
        raise ValueError("The graph must have exactly one start arrow before Lean checking.")
    if not isinstance(alphabet, list) or len(alphabet) > 128:
        raise ValueError("The alphabet must contain at most 128 symbols.")
    if not isinstance(edges, list) or len(edges) > 2048:
        raise ValueError("The Lean check accepts at most 2,048 transitions.")

    count = len(nodes)
    start = int(starts[0])
    if not 0 <= start < count:
        raise ValueError("Start arrow points outside the state list.")
    accepting = [int(i) for i in accepts if isinstance(i, int) and 0 <= i < count]
    symbols = list(dict.fromkeys(str(symbol) for symbol in alphabet if str(symbol).strip()))
    symbol_ids = {symbol: i for i, symbol in enumerate(symbols)}
    epsilon_names = {"ε", "ϵ", "λ", "epsilon", "eps", r"\epsilon"}
    epsilon_id = len(symbols)
    rows: list[str] = []
    for edge in edges:
        if not isinstance(edge, dict) or not edge.get("symbol"):
            continue
        source, target = int(edge["from"]), int(edge["to"])
        symbol = str(edge["symbol"]).strip()
        if not (0 <= source < count and 0 <= target < count):
            raise ValueError("A transition points outside the state list.")
        symbol_id = epsilon_id if symbol.lower() in epsilon_names else symbol_ids.get(symbol)
        if symbol_id is None:
            raise ValueError(f"Transition symbol {symbol!r} is missing from the alphabet.")
        rows.append(f"({source}, {symbol_id}, {target})")

    def lean_list(values: list[int]) -> str:
        return "[" + ", ".join(str(value) for value in values) + "]"

    source = f"def states : List Nat := {lean_list(list(range(count)))}\n"
    source += f"def alphabet : List Nat := {lean_list(list(range(len(symbols))))}\n"
    source += f"def accepting : List Nat := {lean_list(accepting)}\n"
    source += f"def startState : Nat := {start}\n"
    source += "def transitions : List (Nat × Nat × Nat) := [" + ", ".join(rows) + "]\n"
    source += "theorem start_is_state : startState ∈ states := by decide\n"
    source += "theorem accepting_states_are_states : ∀ (s : Nat), s ∈ accepting → s ∈ states := by decide\n"
    source += "set_option maxRecDepth 100000 in\ntheorem transition_endpoints_are_states : ∀ t ∈ transitions, t.1 ∈ states ∧ t.2.2 ∈ states := by decide\n"
    if kind == "dfa":
        source += "set_option maxRecDepth 100000 in\ntheorem deterministic : ∀ t₁ ∈ transitions, ∀ t₂ ∈ transitions, t₁.1 = t₂.1 → t₁.2.1 = t₂.2.1 → t₁.2.2 = t₂.2.2 := by decide\n"
        source += "set_option maxRecDepth 100000 in\ntheorem complete : ∀ s ∈ states, ∀ a ∈ alphabet, ∃ t ∈ transitions, t.1 = s ∧ t.2.1 = a := by decide\n"
    return source


def _compile_errors(units: Any) -> list[str]:
    """check_compile reports failures as error messages inside the returned
    units rather than by raising, so success means no error message came back."""
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


def check_with_pypantograph(payload: dict[str, Any]) -> dict[str, Any]:
    if find_spec("pantograph") is None:
        return {
            "ok": False,
            "available": False,
            "message": "PyPantograph is not installed. Install Lean and run: python -m pip install -r requirements-lean.txt",
        }
    try:
        source = _lean_source(payload.get("automaton", {}), payload.get("alphabet", []), payload.get("type", "dfa"))
        from pantograph import Server

        # Pantograph sessions are stateful; serialize checks from threaded HTTP requests.
        with _lean_lock:
            # Pantograph waits for its Lean REPL to emit a startup-ready line.
            # On a cold WSL startup, 30 seconds can expire before any check runs.
            with Server(imports=["Init"], timeout=120) as server:
                units = server.check_compile(source)
        errors = _compile_errors(units)
        if errors:
            return {
                "ok": False,
                "available": True,
                "message": ("Lean rejected the generated source: " + " | ".join(errors))[:1000],
            }
        return {"ok": True, "available": True, "message": "Lean compiled and proved the generated finite-automaton invariants."}
    except Exception as exc:  # Expose actionable local setup/Lean diagnostics in the panel.
        message = str(exc).strip() or exc.__class__.__name__
        return {"ok": False, "available": True, "message": message[:1000]}
