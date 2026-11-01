"""Optional PyPantograph bridge for checking the editor's finite-automaton model."""

from __future__ import annotations

from importlib.util import find_spec
import os
from pathlib import Path
import shutil
import subprocess
from typing import Any

from threading import Lock

_lean_lock = Lock()
_windows_repl_preflight_ok = False


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
    rows: list[tuple[int, int, int]] = []
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
        rows.append((source, symbol_id, target))

    # A canonical order makes the DFA property check a linear list equality,
    # instead of a quadratic pairwise comparison over every transition.
    rows = sorted(set(rows))
    if kind == "dfa" and count * len(symbols) > 2048:
        raise ValueError("Lean DFA checking is limited to 2,048 state/symbol pairs.")

    def lean_list(values: list[int]) -> str:
        return "[" + ", ".join(str(value) for value in values) + "]"

    source = f"def states : List Nat := {lean_list(list(range(count)))}\n"
    source += f"def alphabet : List Nat := {lean_list(list(range(len(symbols))))}\n"
    source += f"def accepting : List Nat := {lean_list(accepting)}\n"
    source += f"def startState : Nat := {start}\n"
    source += "def transitions : List (Nat × Nat × Nat) := [" + ", ".join(f"({s}, {a}, {t})" for s, a, t in rows) + "]\n"
    source += "theorem start_is_state : startState ∈ states := by decide\n"
    source += "theorem accepting_states_are_states : ∀ (s : Nat), s ∈ accepting → s ∈ states := by decide\n"
    source += "set_option maxRecDepth 100000 in\ntheorem transition_endpoints_are_states : ∀ t ∈ transitions, t.1 ∈ states ∧ t.2.2 ∈ states := by decide\n"
    if kind == "dfa":
        expected_keys = [(s, a) for s in range(count) for a in range(len(symbols))]
        source += "def expectedTransitionKeys : List (Nat × Nat) := [" + ", ".join(f"({s}, {a})" for s, a in expected_keys) + "]\n"
        source += "def transitionKeys : List (Nat × Nat) := transitions.map (fun t => (t.1, t.2.1))\n"
        # Since both lists are canonical, equality proves each state/symbol
        # pair has exactly one target: completeness and determinism together.
        source += "set_option maxRecDepth 100000 in\ntheorem dfa_transition_table_is_complete_and_deterministic : transitionKeys = expectedTransitionKeys := by decide +kernel\n"
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


def _start_pantograph(imports: list[str]) -> Any:
    """Start Pantograph, adding the executable suffix Windows requires."""
    from pantograph import Server

    if os.name != "nt":
        return Server(imports=imports, timeout=120)

    # PyPantograph 0.3.15 packages its Windows binary as `pantograph-repl`
    # without `.exe`. CreateProcess cannot launch that filename on Windows.
    import pantograph.server as pantograph_server

    bundled = Path(pantograph_server._get_proc_path())
    cache_dir = Path.cwd() / ".cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    executable = cache_dir / "pantograph-repl.exe"
    if not executable.exists() or executable.stat().st_size != bundled.stat().st_size:
        shutil.copyfile(bundled, executable)

    # The REPL links against Lean's DLLs. Resolve the version pinned by the
    # `lean-toolchain` file shipped in the PyPantograph package and expose its
    # bin directory to Windows' DLL loader.
    elan_bin = Path.home() / ".elan" / "bin"
    env_path = os.environ.get("PATH", "")
    if elan_bin.is_dir() and str(elan_bin) not in env_path.split(os.pathsep):
        env_path = str(elan_bin) + os.pathsep + env_path
    elan = shutil.which("elan", path=env_path)
    if not elan:
        candidate = elan_bin / "elan.exe"
        if candidate.is_file():
            elan = str(candidate)
    if not elan:
        raise RuntimeError("Elan was not found. Install Lean 4 through elan, then restart the server.")
    resolved = subprocess.run(
        [elan, "which", "lean"],
        cwd=bundled.parent,
        env={**os.environ, "PATH": env_path},
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if resolved.returncode != 0:
        detail = resolved.stderr.strip() or resolved.stdout.strip()
        raise RuntimeError(f"Elan could not resolve PyPantograph's Lean toolchain: {detail}")
    lean_bin = str(Path(resolved.stdout.strip()).parent)
    env_path = lean_bin + os.pathsep + env_path
    os.environ["PATH"] = env_path

    global _windows_repl_preflight_ok
    if not _windows_repl_preflight_ok:
        try:
            probe = subprocess.run(
                [str(executable), *imports],
                cwd=bundled.parent,
                env=os.environ.copy(),
                input=b"",
                capture_output=True,
                timeout=30,
                check=False,
            )
        except Exception as exc:
            raise RuntimeError(f"Could not launch the Windows Pantograph REPL preflight: {exc}") from exc
        if probe.returncode != 0 or not probe.stdout.startswith(b"ready."):
            detail = probe.stderr.decode(errors="replace").strip()
            raise RuntimeError(
                "Windows Pantograph REPL failed its startup preflight "
                f"(exit code {probe.returncode}): {detail or probe.stdout.decode(errors='replace').strip() or 'no output'}"
            )
        _windows_repl_preflight_ok = True

    server = Server(imports=imports, timeout=120, _sync_init=False)
    server.proc_path = str(executable)
    try:
        server.restart()
    except Exception as exc:
        raise RuntimeError(f"Windows Pantograph preflight succeeded, but its API session failed to start: {exc}") from exc
    return server


def check_with_pypantograph(payload: dict[str, Any]) -> dict[str, Any]:
    if find_spec("pantograph") is None:
        return {
            "ok": False,
            "available": False,
            "message": "PyPantograph is not installed. It requires Python 3.11 or newer. Install Lean and run `python -m pip install -r requirements-lean.txt` with the same Python environment that runs server.py.",
        }
    try:
        source = _lean_source(payload.get("automaton", {}), payload.get("alphabet", []), payload.get("type", "dfa"))
        from pantograph import Server

        # Pantograph sessions are stateful; serialize checks from threaded HTTP requests.
        with _lean_lock:
            # Pantograph waits for its Lean REPL to emit a startup-ready line.
            # On a cold WSL startup, 30 seconds can expire before any check runs.
            with _start_pantograph(["Init"]) as server:
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
