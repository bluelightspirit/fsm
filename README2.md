# Finite State Machine Designer

A browser tool for sketching finite state machines and getting them into papers. Originally created by [Evan Wallace](http://madebyevan.com/fsm/) in 2010; this fork adds multi‑FSM workspaces, undo/redo and theming ([Moeein Aali](https://github.com/MoeeinAali)), plus paged exports to LaTeX/Typst, regex → automaton conversion, and optional Lean checking.

Live original: <http://madebyevan.com/fsm/>

The editor is vanilla JavaScript plus a small Python server. **The base install needs no packages** — only Python 3 and a browser.

---

## Quick start

```bash
git clone https://github.com/bluelightspirit/fsm.git
cd fsm
python3 server.py            # then open http://localhost:8000
```

`python3 server.py 8001` picks another port; `--host 0.0.0.0` makes it reachable from other devices. The server rebuilds `www/fsm.js` automatically whenever something under `src/` changes.

Developed and tested on Python 3.11. Regex conversion and the Lean buttons talk to `server.py`, so they do not work if you only serve `www/` with `python3 -m http.server`.

---

## Features

**Editor**
- Canvas editor — states, transitions, accept states, self‑loops, start arrows, and three draggable curve handles per arrow.
- **Multiple FSMs** per browser, each stored separately in `localStorage`; create, rename, switch, delete from the sidebar.
- **Undo / redo** (up to 100 steps per FSM), **auto‑save**, light / dark / auto theme.
- LaTeX‑style text: `\beta` → β, subscripts `q_0` and `q_{12}`.
- Style panel: text sizes, state radius, outlines, line width, arrowhead size, fonts. Alt‑drag moves a label.

**Paged output**
- US Letter or A4 pages with margin presets (IEEE conference, Chicago, MLA, APA, custom), page zoom, and an option to keep states and labels inside the margins.
- Export to **PNG** (per page), **SVG**, **LaTeX (TikZ)** and **Typst (CeTZ)**, either as paper pages or one full diagram; optional standalone, compile‑ready files. Exports are black on transparent regardless of theme.
- A `.typ` or `.tex` file the tool exported can be **imported back** (the diagram is stored in a comment).

**Automaton properties panel** (right side)
- Validation for DFA / NFA: determinism, completeness, reachability, dead states, missing transitions, ε‑transitions.
- NFA → DFA subset construction (creates a separate DFA in the workspace).
- **Regex → automaton** — see below.
- Right‑linear grammar display.
- **Check with Lean** and **Verify with Lean** — see below.

---

## Usage

| Action | How |
|---|---|
| Add a state | Double‑click the canvas |
| Add an arrow | Shift‑drag from one state to another |
| Move a state or arrow | Click and drag it |
| Make accept state | Double‑click an existing state |
| Edit label | Click an object and type (Enter toggles typing, Shift+Enter adds a line) |
| Select a thin line | Ctrl/Cmd‑click near it (a click inside a state always picks the state) |
| Greek letter | `\` then the name (`\alpha`, `\Sigma`) |
| Subscript | `_` then a digit or `{…}` (`q_0`, `q_{12}`) |

| Shortcut | Action |
|---|---|
| <kbd>Delete</kbd> / <kbd>Cmd</kbd>+<kbd>Backspace</kbd> | Delete selected node/link |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo |
| <kbd>Shift</kbd> + <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Z</kbd>, or <kbd>Ctrl</kbd>+<kbd>Y</kbd> | Redo |
| <kbd>Backspace</kbd> | Delete the last character of the selected label |
| <kbd>Esc</kbd> | Clear the selection |

---

## Regex → automaton

Type a regular expression in the right panel, pick **ε‑NFA** or **DFA**, pick a syntax, and generate. The result opens as a new diagram you can arrange yourself.

| | Python‑style (default) | Formal / theory (**experimental**) |
|---|---|---|
| Symbols | each character; `\d \w \s`, `.` and `[a-z]` are single symbols | **every character is its own symbol** — `abb` is a, b, b |
| Union | `\|` | `+` or `\|` |
| Repetition | `*  +  ?` | `*` only |
| Empty string | — | `epsilon` or `$` |
| Concatenation | adjacency | adjacency, `.` or a space |
| Method | Glushkov position automaton (no ε‑edges) | Thompson ε‑NFA, then subset construction |

Examples: `(a|b)*abb` (Python‑style) and `(a+b)*abb` (formal) both give the language of strings over {a, b} ending in `abb`. Not supported in either: anchors, `{m,n}`, backreferences, lookaround. Limits: 512 characters, 512 states, 2,048 transitions.

If the converter here ever misbehaves, [CyberZHG's nfa2dfa](https://cyberzhg.github.io/toolbox/nfa2dfa) is a good alternative to compare against.

---

## Lean checking (optional)

The app works without Lean. To enable the two buttons, install Lean 4 through [`elan`](https://github.com/leanprover/elan) and PyPantograph into the Python environment that runs `server.py` (needs `git`):

```bash
python3 -m pip install -r requirements-lean.txt
```

Restart `server.py` afterwards. On Windows, WSL is recommended for the Lean toolchain. See the [PyPantograph install notes](https://github.com/stanford-centaur/PyPantograph#installation) for platform details.

- **Check with Lean** sends the drawn diagram to Lean, which checks that the start and accept states exist and every transition connects existing states — and, for a DFA, that it is deterministic and complete.
- **Verify with Lean** (formal syntax only) checks that the ε‑NFA the tool built, and the DFA built from it, are *exactly* what an independent implementation written in Lean produces for that regex.

**What "Verify" does and does not show.** It confirms two implementations agree on that regex, which catches bugs in either one. It is **not** a proof that the construction always preserves the regex's language, and it does not cover the sink state added to complete a DFA. A wrong claim is reported as a failure (the test‑suite checks this), and a pass means Lean accepted it.

---

## Testing

```bash
python3 -m unittest discover -s tests -v          # language correctness + a real server start; ~1 s
FSM_TEST_LEAN=1 python3 -m unittest tests.test_lean_optional -v   # Lean checks, opt-in (needs requirements-lean.txt)
scripts/clean_install_check.sh                    # fresh clone + fresh virtualenv + tests, as a new user would see it
scripts/clean_install_check.sh --lean             # the same, also installing PyPantograph and running the Lean checks
```

The clean‑install script tests the *committed* state, so commit before running it.

### Checking exported margins (optional)

`measure_margins.py` rasterises a PDF with poppler (`sudo apt install poppler-utils`) and reports how many 96‑dpi pixels of white lie between the ink and each page edge, which is how the LaTeX and Typst exports were compared:

```bash
python3 measure_margins.py export.pdf        # 300 dpi; 96.00 = one inch
```

Compiling exports needs `pdflatex` (LaTeX) or `typst`; neither is needed to use the editor.

---

## Known limitations

- The formal‑syntax converter is marked **experimental**.
- In Python‑style mode `\d` and the literal letter `d` get the same edge label, so a pattern that mixes them draws an ambiguous diagram.
- The LaTeX page size and margin fixes were measured with pdfTeX 1.40.22; another TeX distribution could differ by a hundredth of a point.
- Lean verification is limited to 256‑state ε‑NFAs and 128‑state DFAs.

---

## Project structure

```
fsm/
├── server.py                 # serves www/ and the API (regex conversion, Lean checks)
├── build.py                  # concatenates src/**/*.js into www/fsm.js (no deps)
├── automata_integration.py   # regex -> automaton (both syntaxes), DFA completion
├── glushkov_regex.py         # Python-style regex parser
├── glushkov_core.py          # Glushkov construction + subset construction
├── classic_regex.py          # formal regex parser (every character a symbol)
├── thompson_port.py          # Thompson epsilon-NFA, mirrors the Lean implementation
├── lean_integration.py       # "Check with Lean": invariants of the drawn model
├── lean_regex_check.py       # "Verify with Lean": Python vs Lean regex construction
├── measure_margins.py        # margin measurement for exported PDFs
├── requirements.txt          # base install: nothing to install
├── requirements-lean.txt     # optional: PyPantograph
├── tests/                    # unittest suite
├── scripts/                  # clean_install_check.sh
├── www/
│   ├── index.html            # UI shell, CSS variables, theme bootstrap
│   └── fsm.js                # built bundle (do not edit by hand)
└── src/
    ├── _license.js           # MIT header (Evan Wallace, 2010)
    ├── elements/             # node, link, self_link, start_link, temporary_link
    ├── export_as/            # svg.js, latex.js (TikZ), typst.js (CeTZ)
    └── main/                 # editor core (fsm.js), automata.js (analysis panel),
                              # pages.js (paged canvas), import_ui.js, workspace, history, theme, ui
```

### `localStorage` layout

```text
fsm_workspace = { version: 2, activeId, fsms: [{ id, name, createdAt, updatedAt }] }
fsm_data_<id> = { nodes: [...], links: [...] }
fsm_theme     = "system" | "light" | "dark"
```

---

## License

MIT. Original copyright © 2010 Evan Wallace. See the header in `src/_license.js`. PyPantograph (optional, installed separately) is Apache‑2.0.

---

## Credits

- Original design and implementation: [Evan Wallace](http://madebyevan.com/) — <http://madebyevan.com/fsm/>
- Multi‑FSM workspaces, undo/redo, theming, refreshed UI: [Moeein Aali](https://github.com/MoeeinAali)
- The automaton property checklist and conversion workflow were informed by [Automata Studio](https://github.com/ReyEscarlata0/automata-studio) (MIT‑licensed); this project uses its own implementation.
- Lean checking uses [PyPantograph](https://github.com/stanford-centaur/PyPantograph) from Stanford Centaur (Apache‑2.0).
- The [Pyformlang](https://github.com/Aunsiels/pyformlang) documentation was a reference for textbook regex syntax; no Pyformlang code is used.
- [CyberZHG's toolbox](https://cyberzhg.github.io/toolbox/) was used only as an external reference for expected automata; no code from it is used.
- Constructions: Glushkov (1961) / Berry–Sethi (1986) for Python‑style regex, Thompson (1968) for the formal syntax.
