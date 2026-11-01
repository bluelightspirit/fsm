# Finite State Machine Designer

A browser tool for sketching finite state machines and getting them into papers (A4 and US Letter) by following their respective margins and paper sizes in inches. Originally created by [Evan Wallace](http://madebyevan.com/fsm/) in 2010; this fork adds multi‑FSM workspaces, undo/redo and theming ([Moeein Aali](https://github.com/MoeeinAali)), plus paged exports to LaTeX/Typst, regex → automaton conversion, and optional Lean 4 checking.

Live original: <http://madebyevan.com/fsm/>

The editor is vanilla JavaScript plus a small Python server. Regex conversion uses Pyformlang; install the requirements before starting the server.

The purpose of making this is because in a generic Brave search, I didn't find any easy-to-use and obviously set margin and paper size based DFA/NFA generator out there for some reason. Most of them are of an unlimited scale, which is not how papers are sized.

## Note for AI usage

For transparency purposes, the bulk of this has been vibecoded by Claude Code and Codex. However, proofs have been made for LaTeX and Typst for margins to the best of my ability, while Lean 4 and Python combined with some personal tests tested DFAs and NFAs for validity. If you find any issues, feel free to make a pull request. I see that I can't raise issues in this project since it is a fork - so I may duplicate this soon so that the public can propose changes if they want.

I do declare this as vibecoded instead of just "Permissive AI Policy" per https://codeberg.org/ethical-foss/ai-free-foss-alternatives#vibecoded since I only hardcode changed HTML and Python here and there. I didn't bother touching JavaScript but did view it sometimes as efforts to figure out where Claude or Codex messed up.

## Note for design issues and missing features

Also, it should be noted that IEEE Conference is 2 column limited. Respecting the 2 column rule while maintaining all margins for US Letter and A4 for DFAs and NFAs probably would take another entire month or so of prompting as Claude takes eternity to develop things for free. Generic ChatGPT or the likes with less limitations would probably not get me anywhere. 

Typst labels for DFAs/NFAs as an alternative option to LaTeX also would probably take another week of prompting and waiting by Claude. 

Having a bulk select and delete option on the left side to manage FSMs or a search bar of them also would be nice, but would probably take another week of prompting and waiting by Claude as well.

A JavaScript or TypeScript library probably would've been more wise to use over vanilla JS for purposes of having to write less code while having more features available, but that is a hindsight problem. At least vanilla JS you don't have to deal with the plethora of vulnerabilities React, Node.js, and others get all the time. Although that doesn't matter TOO MUCH if code is run locally, it may be problematic for servers that may want to host this online in the future.

## Note for future projects

Turing machines, LBAs, and PDAs are similarly designed with states and transitions like DFA/NFAs. However, for that to work out, an entire new project would have to be started with different Lean 4 proofs, Python proofs, and design between transitions as far as I'm aware - or just a new tab at the top of this project. This is because PDAs/general CFGs (for Type 2, not Type 3 per https://devopedia.org/chomsky-hierarchy) represent context-free languages, while turing machines represent recursively enumerable languages (Type 0) and LBAs (restricted turing machines) represent context-sensitive languages (Type 1). 

## Another random note

The project does have a right-linear grammar (a regular subset of CFGs) generator from the current FSM available. Regex, the Pythonic way and computer theory way, are also available to generate FSMs. However, the number of states available to be used by this project are limited - found in the known limitations section of this README.

---

## Quick start

```bash
git clone --branch my-main https://github.com/bluelightspirit/fsm.git
cd fsm
python3 -m pip install -r requirements.txt
python3 server.py            # then open http://localhost:8000
```

In Windows PowerShell, use the Python launcher if it detects your Python version (`py -3.11 -m pip install -r requirements.txt`, then `py -3.11 server.py`). If it says no suitable runtime, use the full path to `python.exe`, for example `$py311 = "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"`, then `& $py311 -m pip install -r requirements.txt` and `& $py311 server.py`.

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
- DFA, NFA, Moore machine, and Mealy machine modes, with determinism, completeness, reachability, dead-state, and output-label validation.
- Conversions between DFA, NFA, Moore, and Mealy machines. NFA → DFA uses subset construction; Mealy → Moore splits states by incoming output. DFA/NFA → Moore/Mealy maps acceptor states to `accept` and `reject` outputs. Moore/Mealy → NFA is built through a right-linear Type 3 grammar: `ε` productions mark accepting states. DFA conversion determinizes that NFA. For a deterministic source, the NFA may be identical to the DFA. Moore states outputting `accept` are accepting. Mealy keeps the input alphabet and accepts a word when its final transition outputs `accept`; the empty word is rejected because Mealy emits no output before input.
- **Regex → automaton** — see below.
- Right‑linear grammar display and conversion back to an equivalent regular expression in Python-style or formal-theory notation. For Mealy machines, regex conversion uses the final-transition `accept` output as acceptance.
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

Type a regular expression in the right panel, choose **ε‑NFA**, **DFA**, **Moore**, or **Mealy**, pick a syntax, and generate. The result opens as a new diagram you can arrange yourself.

| | Python‑style (default) | Formal / theory (**experimental**) |
|---|---|---|
| Symbols | Python-style character symbols; `\d`, `\w`, `\s`, `.`, character classes, and bounded repetitions are supported | **every character is its own symbol** — `abb` is a, b, b |
| Union | `\|` | `+` or `\|` |
| Repetition | `*  +  ?` | `*` only |
| Empty string | `()` | `ε`, `epsilon`, or `$` |
| Concatenation | adjacency | adjacency, `.` or a space |
| Method | Pyformlang `PythonRegex` to ε‑NFA; project subset construction for DFA/Moore/Mealy output | Project's Thompson ε‑NFA, then the same subset construction |

Examples: `(a|b)*abb` (Python‑style) and `(a+b)*abb` (formal) both give the language of strings over {a, b} ending in `abb`. The Python‑style converter uses Pyformlang's `PythonRegex` implementation, including bounded repetitions. Expressions describe whole strings, so anchors, backreferences, and lookaround are not supported; `^` is a literal symbol. For strings beginning with `dog` and followed only by lowercase letters, use `dog[a-z]*` (Python-style) or `dog(a+b+c+d+e+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z)*` (formal theory). `Σ` is mathematical shorthand and must be expanded; `.` expands to all printable characters and may exceed the 2,048-transition limit. Limits: 512 characters, 512 states, 2,048 transitions.

If the converter here ever misbehaves, [CyberZHG's nfa2dfa](https://cyberzhg.github.io/toolbox/nfa2dfa) is a good alternative to compare against.

## Automaton / Type 3 grammar → regex

In the automaton properties panel, **Show regular CFG** displays the equivalent right-linear Type 3 grammar. **Show Python-style regex** and **Show formal-theory regex** convert the accepted input language to a regular expression using Kleene's state-elimination construction. For Mealy machines, the final transition output `accept` determines acceptance. Python-style notation uses `|` for union; formal-theory notation uses `+` and `ε`. Each input symbol must be one character; the conversion supports at most 48 states to keep expressions manageable.

## Moore and Mealy machines

Choose **Moore machine** in the machine-type menu and include each state's output in its label as `state/output` (for example, `q0/accept`). For a **Mealy machine**, label each arrow `input/output` (for example, `a/accept`); comma-separated alternatives can be written `a/accept,b/reject`. Moore → DFA/NFA treats Moore states outputting `accept` as accepting states. Mealy → DFA/NFA keeps the input alphabet and accepts when the final transition outputs `accept`; the empty word is rejected. The Mealy trace grammar remains available through **Show regular CFG**, where each input/output pair is a terminal. DFA/NFA to Moore/Mealy assigns `accept` or `reject` according to the acceptor state after each input. Mealy → Moore uses `∅` for the start state's no-output marker. Lean checks the resulting DFA structure, but does not prove conversion semantics.

---

## Lean checking (optional)

The app works without Lean. To enable the two buttons, use Python 3.11 or newer and install PyPantograph into the same Python environment that runs `server.py` (Git is needed because pip installs a tagged Git source). PyPantograph v0.3.15 requires Python `>=3.11.0`. The Python dependencies are the same on Windows, WSL, macOS, and Linux; `requirements-lean.txt` installs the Python bridge only. Install Lean 4 separately through [`elan`](https://github.com/leanprover/elan), then ensure its `lean` and `lake` commands are available in the same shell that starts the server.

```bash
python3 -m pip install -r requirements.txt
python3 -m pip install -r requirements-lean.txt
python3 server.py
```

In PowerShell, replace `python3` with `py -3.11` if the launcher detects Python; otherwise use the full `python.exe` path as in Quick start. Install elan/Lean in the environment where the server will run. WSL is the recommended Windows route for Lean; if running natively on Windows, the app handles the `.exe` suffix needed by PyPantograph's bundled REPL. After pip finishes, confirm the optional bridge is installed with `python -m pip show pantograph` (or the same interpreter path used above); the install is complete only if pip reports `Successfully installed pantograph-0.3.15` or `pip show` displays version `0.3.15`. Restart `server.py` after installation. See the [PyPantograph install notes](https://github.com/stanford-centaur/PyPantograph#installation) for platform details.

- **Check with Lean** sends the drawn diagram to Lean, which checks that the start and accept states exist and every transition connects existing states — and, for a DFA, that it is deterministic and complete.
- **Verify with Lean** (formal syntax only) checks that the ε‑NFA the tool built, and the DFA built from it, are *exactly* what an independent implementation written in Lean produces for that regex.

**What "Verify" does and does not show.** It confirms two implementations agree on that regex, which catches bugs in either one. It is **not** a proof that the construction always preserves the regex's language, and it does not cover the sink state added to complete a DFA. This regex-construction verification supports only ε-NFA and DFA output. A wrong claim is reported as a failure (the test‑suite checks this), and a pass means Lean accepted it.

For Moore and Mealy regex outputs, states/transitions are labeled `accept` or `reject` based on the DFA state after each input. Mealy conversion back to an acceptor uses the output on the final transition; the empty word is rejected because Mealy emits no output before input.

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
├── automata_integration.py   # regex -> automaton (Pyformlang + formal syntax), DFA completion
├── classic_regex.py          # formal regex parser (every character a symbol)
├── thompson_port.py          # Thompson epsilon-NFA, mirrors the Lean implementation
├── lean_integration.py       # "Check with Lean": invariants of the drawn model
├── lean_regex_check.py       # "Verify with Lean": Python vs Lean regex construction
├── measure_margins.py        # margin measurement for exported PDFs
├── requirements.txt          # Pyformlang for Python-style regex conversion
├── requirements-lean.txt     # optional: PyPantograph
├── NOTICE.md                 # third-party licenses and attributions
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

MIT. Original copyright © 2010 Evan Wallace. See the header in `src/_license.js`. Third-party components and references, including PyPantograph (Apache-2.0, optional, installed separately), are listed in [NOTICE.md](NOTICE.md).

---

## Credits

- Original design and implementation: [Evan Wallace](http://madebyevan.com/) — <http://madebyevan.com/fsm/>
- Multi‑FSM workspaces, undo/redo, theming, refreshed UI: [Moeein Aali](https://github.com/MoeeinAali)
- The automaton property checklist and conversion workflow were informed by [Automata Studio](https://github.com/ReyEscarlata0/automata-studio) (MIT‑licensed); this project uses its own implementation.
- Lean checking uses [PyPantograph](https://github.com/stanford-centaur/PyPantograph) from Stanford Centaur (Apache‑2.0).
- Python-style regex conversion uses [Pyformlang](https://github.com/Aunsiels/pyformlang)'s `PythonRegex` parser and automaton constructors (MIT).
- [CyberZHG's toolbox](https://cyberzhg.github.io/toolbox/) was used only as an external reference for expected automata; no code from it is used.
- Constructions: Pyformlang `PythonRegex` for Python-style regex, Thompson (1968) for the formal syntax.
