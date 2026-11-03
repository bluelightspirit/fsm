# Finite State Machine and Deterministic Finite State Transducer (Type 3) Designer

A browser tool for sketching finite state machines and getting them into papers (A4 and US Letter) by following their respective margins and paper sizes in inches. Originally created by [Evan Wallace](http://madebyevan.com/fsm/) in 2010; this fork adds multi‑FSM workspaces, undo/redo and theming ([Moeein Aali](https://github.com/MoeeinAali)), plus paged exports to LaTeX/Typst, regex → automaton conversion, and optional Lean 4 checking.

Live original: <http://madebyevan.com/fsm/>

The editor is vanilla JavaScript plus a small Python server. Regex conversion uses Pyformlang; install the requirements before starting the server.

The purpose of making this is because in a generic Brave search, I didn't find any easy-to-use and obviously set margin and paper size based DFA/NFA generator out there for some reason. Most of them are of an unlimited scale or limited to 1 set canvas scale, which is not how papers are sized (as they can be multiple pages). https://abpaudel.com/fsm-designer/ is close since it covers width and height in pixels as boundaries for the FSM but does not support multiple pages or seem to be an easy copy and paste solution straight into LaTeX while respecting margins correctly... And I don't bother with exporting with JSON like https://github.com/yalue/fsm_designer does and just use internal comments in Typst or LaTeX instead since there is probably a sizable amount of people who would rather avoid JSON at all costs. 

## Random alternatives researched for FSM designers

I also don't bother with chip firing game weight stuff like https://markusfeng.com/projects/graph/ does as I don't have all the time in world...

The live editing way for diagrams may exist at https://www.reddit.com/r/programming/comments/a39sq3/comment/eb5el3w/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button among others - but these are of an unlimited scale again. I don't see obviously set paper margins or page separations available. https://web.cs.ucdavis.edu/~doty/automata/ is another live editing one.

Serializing global variables per https://www.reddit.com/r/programming/comments/a39sq3/comment/emr02o9/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button probably is a good idea also for compilers. I don't have all the time in the world for adding these either...

https://jimmyhmiller.com/fsm-maker/ is probably one of the most straightforward design options for text to FSM. I don't have all the time in the world to revamp the States & arrows section to be like that...

MATLAB at https://www.mathworks.com/help/hdlcoder/ug/model-a-state-machine-for-hdl-code-generation.html or Verilog at https://www.reddit.com/r/Verilog/comments/17c3bld/implementing_a_mealy_state_machine/ also can generate FSMs - but bothering trying to convert all MATLAB/Verilog code to FSMs here is not a realistic goal because of the known limitations of states portion and because I don't have all the time in the world. The same is true for JAX at https://google-research.github.io/self-organising-systems/2022/diff-fsm/ or PLCs at https://industrialmonitordirect.com/blogs/knowledgebase/state-machine-design-in-plc-programming-mealy-moore-and-implementation-approaches >_>

I also have no idea why https://vlsiverify.com/verilog/fsm-and-sequence-detector/ says only mealy machine and moore machines are ways to design FSMs... I guess Verilog is something else.

LaTeX shortcuts at https://formalsketch.github.io/ probably would work for this project, but I don't know where the code by Iman Mohammadi is at.

Finite state automaton via the CFG generated to regex converting is a WIP by Claude free messages delay. How fun it is to code without paying a penny to Claude... Moore and mealy machines also would make sense to make as part of type 3 designs. However, the first priority is converting CFG to regex. This is a a 2nd WIP. A 3rd WIP may be to try to attempt converting CFGs to regular languages, but that is easier said than done IMO because I'd have to do proofs in Lean 4 and/or Python to even be certain it is a type 3 language being converted instead of a type 2... The 4th WIP most likely will be unit tests / proofs by hand / seeing if Lean 4 and Python match human-made proofs. The 5th WIP (may change order later - this sounds vital tbh) would be to give examples and do proofs on trying to integrate FSMs for pages while also incorporating text right after the FSM ends instead of waiting for the page to end entirely. Oh for that one I'd want custom inch margin boundaries for the edges.

Status:
1st WIP is done - Codex did this fast. I also used Pyformlang for Python-style regex instead of using the brute force way Claude used that isn't library based...
2nd WIP now 1st WIP. Well - moore and mealy machines are added. Trying to make proofs to convert between them and DFAs/NFAs require brain power in my head though versus NFA/DFA I was taught at UMW... >_>
Now I will go after the 5th WIP. I will say FSTs are in Pyformlang's docs at https://pyformlang.readthedocs.io/en/latest/usage.html#finite-state-transducer and I doubt Claude and Codex even used that for the FSTs also...

Update:
Going after the 5th WIP to try to have text merge with the FSM on the top and bottom is not as simple as it seems to do... It used up way too many Codex tokens so now I am stuck on the waiting for Claude loop! Currently, the export does not separate the FSM into separate pages. The main way to make this work I'd assume is to integrate text into the canvas itself... perhaps the 3rd/4th WIPS would have been more achievable... oh well. Not gonna back out. Time to wait probably a whole nother month.

Update 1 expanded:

I am pretty sure it is a better idea to focus on adjusting the top-most and bottom-most margins in exports to Typst/LaTeX. There is probably a way to figure out the inch gap or pixels required for the exact spot for the FSM to be at. I will say, the bottom-most margin portion probably won't ever be in use realistically unless the user wants to cut off the FSM early to try to meet some strict page limit rule or something...

update 2: on the side i am gonna rework the canvas drawing to svg.js since I despise using native JS canvas for margin and inch management...

update 3: NVM realistically, that would prbobably take up WAY WAY too many lines of code as multi page support was gone long ago for SVG https://stackoverflow.com/questions/68438065/multi-page-svg-in-the-browser https://github.com/deekb/SVGraft exists to help make SVG splitting easier into multiple pages while respecting margins, but I'd have to also integrate that into the SVG and JavaScript combination design. https://github.com/typst/svg2pdf/pull/102#issuecomment-4937994028 goes as far to say to use krilla-svg so that SVGs can be converted to PDFs - it seems Typst people just are offshoring the maintenance over there instead of svg2pdf. Also, vanilla JS is faster per https://svgjs.dev/docs/3.2/ anyway than SVG.js... though it is FAR MORE READABLE and probably more maintainable as there's 11k+ stars for SVG.js on GitHub... maybe someone else can go down that rabbit hole one day so that any size paper and any size margins wouldn't need a stupid amount of tests to be 1 pixel off here and there for no apparent reason... SVG.js would be pretty good for color changing and animations it seems.

## Note for licenses

MIT. Original copyright © 2010 Evan Wallace. See the header in `src/_license.js`. Third-party components and references, including PyPantograph (Apache-2.0, optional, installed separately), are listed in [NOTICE.md](NOTICE.md). There is no LICENSE.md because there is more than 1 license used in this project.

## Note for more export options

A .dot file from a NetworkX graph at https://pyformlang.readthedocs.io/en/latest/usage.html#finite-state-transducer and https://networkx.org/documentation/networkx-2.5/auto_examples/pygraphviz/plot_write_dotfile.html may exist. I do not have all the time in the world, so feel free to make a PR for this.

Similarly, WebP is another export option commonly used in the web - I don't have all the time in the world so feel free to make a PR.

PDF is another export option commonly used in the web - for this one, I'd want a ton of options before exporting as PDF - do I want multiple pages, just the first page, just a specific page, do I want to export a Typst-based PDF or a LaTeX-based PDF, do I want to use some native Python or JavaScript PDF generating library, do I want to have SVGs or PNGs be merged into every PDF page instead, and stuff like that. I don't have all the time in the world to make this, so feel free to make a PR. 

## Note for mealy and moore machines

These are deterministic FSTs per page 75 at https://www.cs.utexas.edu/~ear/cs341/automatabook/AutomataTheoryBook.pdf (go to page 89 in PDF viewer). Efforts were made to convert between determinstic FSTs (mealy machine/moore machine) and FSMs (DFA/NFA), however, they simply are different as they are 2-tape based, so the converting probably will break in many cases... if you can find out how to fix it, feel free to make a PR! 

## Wheres NFSTs?

https://cseweb.ucsd.edu/classes/sp13/cse105-b/LecFST.pdf says NFSTs exist! You don't have an option to make one or convert to one! They are type 3 because they're FSTs!

I don't have all the time in the world. Feel free to make a PR if you want. Page 77 talks about a nondeterminstic Mealy machine at https://www.cs.utexas.edu/~ear/cs341/automatabook/AutomataTheoryBook.pdf (go to page 91 in PDF viewer). There's probably a nondeterminstic Moore machine too. There's Markov model as a NDFSM at page 79 (page 93 in PDF viewer) there too, and HMM at page 83 (page 97 in PDF viewer) as another NFST.

## What about Büchi Automata?

Infinite automata is welcome as another PR too. Info can be read at page 88 (page 102) of https://www.cs.utexas.edu/~ear/cs341/automatabook/AutomataTheoryBook.pdf

## Note for AI usage

For transparency purposes, the bulk of this has been vibecoded by Claude Code and Codex. However, proofs have been made for LaTeX and Typst for margins to the best of my ability, while Lean 4 and Python combined with some personal tests tested DFAs and NFAs for validity. If you find any issues, feel free to make a pull request. I see that I can't raise issues in this project since it is a fork - so I may duplicate this soon so that the public can propose changes if they want.

I do declare this as vibecoded instead of just "Permissive AI Policy" per https://codeberg.org/ethical-foss/ai-free-foss-alternatives#vibecoded since I only hardcode changed HTML and Python here and there. I didn't bother touching JavaScript but did view it sometimes as efforts to figure out where Claude or Codex messed up.

## Note for design issues and missing features

Also, it should be noted that IEEE Conference is 2 column limited. Respecting the 2 column rule while maintaining all margins for US Letter and A4 for DFAs and NFAs probably would take another entire month or so of prompting as Claude takes eternity to develop things for free. Generic ChatGPT or the likes with less limitations would probably not get me anywhere.

Typst labels for DFAs/NFAs as an alternative option to LaTeX also would probably take another week of prompting and waiting by Claude. 

Having a bulk select and delete option on the left side to manage FSMs or a search bar of them also would be nice, but would probably take another week of prompting and waiting by Claude as well.

A JavaScript or TypeScript library probably would've been more wise to use over vanilla JS for purposes of having to write less code while having more features available, but that is a hindsight problem. At least vanilla JS you don't have to deal with the plethora of vulnerabilities React, Node.js, and others get all the time. Although that doesn't matter TOO MUCH if code is run locally, it may be problematic for servers that may want to host this online in the future.

PyPantograph is used over LeanDojo because of the paper at https://link.springer.com/chapter/10.1007/978-3-031-90643-5_6 and https://leni.sh/research/ - basically PyPantograph is a complete theorem-proving interaction API while many other Lean 4 bridges out there are not. I also would be quite surprised if the Center for Automated Reasoning at Stanford University were to be wrong with the Python to Lean 4 bridge. ChatGPT does say C FFI and JSON bridges exist too - but C is a whole nother thing to deal with memory safety, while I don't think it's worth it to try to rework this to get JSON bridging instead of just sticking with the status quo of PyPantograph. Especially since the server is quite Python-based already...

Rocq with CoqGym may eventually be second and third integrations. Same for Agda. https://www.reddit.com/r/math/comments/1pjt8np/lean_vs_rocq/ exists to discuss about that. Well, I don't have all the time in the world for that, and I will say in general, drawing finite automata to have too many states and transitions already doesn't look super readable to a viewer as there is simply not enough room in a paper to easily visualize maybe 1,000 transitions and 80 states or something, even if across multiple pages. I don't see the purpose of going with Aesop if "Pantograph’s approach to metavariable coupling is based on Aesop’s technique" per the Stanford paper. PyPantograph supports "Draft-Sketch-Prove algorithm" feature too per that paper.

Ironically, LeanDojo v2 uses PyPantograph at https://github.com/lean-dojo/LeanDojo-v2/blob/main/README.md ... ummm lol. I don't know why I should exactly increase the chain as working with agents and trainers is well beyond the scope of designing automaton...

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
- **Flowing document export** for LaTeX and Typst places the FSM as a sized figure and lets following prose continue immediately after it. Choose **FSM then flowing text**, enter paragraphs in the text box, and use the full-document checkbox for a compile-ready file or turn it off for an embeddable snippet.
- A `.typ` or `.tex` file the tool exported can be **imported back** (the diagram is stored in a comment).

### Flowing text after an FSM

Choose **FSM then flowing text** under **Export layout**. Add plain text in the box that appears; blank lines start new paragraphs. Download or copy LaTeX or Typst. With **Full document** checked, the export sets the selected page size and all four margins. With it unchecked, it emits an embeddable snippet and a comment listing the margin values to apply in the host document. The custom top, bottom, left, and right fields are in inches, like the existing page controls.

Example: for US Letter with top and bottom margins of `0.75 in`, a left margin of `1 in`, and a right margin of `0.75 in`, the printable box is `6.75 × 9.5 in` (`8.5 − 1 − 0.75` wide and `11 − 0.75 − 0.75` high). For the `(a|b)*abb` example FSM, following text could be: “This DFA accepts strings over `{a,b}` that end in `abb`.” The standalone LaTeX export constrains the figure to that printable box; Typst scales it to the available text width. Both place the paragraph after the figure in normal page flow. If there is not enough room below the figure, the paragraph continues on the next page. This gives a direct check of the selected page bounds and expected flow.

**Automaton properties panel** (right side)
- Validation for DFA / NFA: determinism, completeness, reachability, dead states, missing transitions, ε‑transitions.
- NFA → DFA subset construction (creates a separate DFA in the workspace).
- **Regex → automaton** — see below.
- Right‑linear grammar display and conversion back to an equivalent regular expression in Python-style or formal-theory notation.
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
| Symbols | Python-style character symbols; `\d`, `\w`, `\s`, `.`, character classes, and bounded repetitions are supported | **every character is its own symbol** — `abb` is a, b, b |
| Union | `\|` | `+` or `\|` |
| Repetition | `*  +  ?` | `*` only |
| Empty string | `()` | `ε`, `epsilon`, or `$` |
| Concatenation | adjacency | adjacency, `.` or a space |
| Method | Pyformlang `PythonRegex` to ε‑NFA; Pyformlang subset construction for DFA output | Project's Thompson ε‑NFA, then subset construction |

Examples: `(a|b)*abb` (Python‑style) and `(a+b)*abb` (formal) both give the language of strings over {a, b} ending in `abb`. The Python-style converter uses Pyformlang's `PythonRegex` implementation, including bounded repetitions. Anchors, backreferences, and lookaround are not supported. Limits: 512 characters, 512 states, 2,048 transitions.

If the converter here ever misbehaves, [CyberZHG's nfa2dfa](https://cyberzhg.github.io/toolbox/nfa2dfa) is a good alternative to compare against.

## Automaton / Type 3 grammar → regex

In the automaton properties panel, **Show regular CFG** displays the equivalent right-linear Type 3 grammar. **Show Python-style regex** and **Show formal-theory regex** convert that same grammar to a regular expression using Kleene's state-elimination construction. Python-style notation uses `|` for union; formal-theory notation uses `+` and `ε`. Each input symbol must be one character; the conversion supports at most 48 states to keep expressions manageable.

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

## Credits

- Original design and implementation: [Evan Wallace](http://madebyevan.com/) — <http://madebyevan.com/fsm/>
- Multi‑FSM workspaces, undo/redo, theming, refreshed UI: [Moeein Aali](https://github.com/MoeeinAali)
- The automaton property checklist and conversion workflow were informed by [Automata Studio](https://github.com/ReyEscarlata0/automata-studio) (MIT‑licensed); this project uses its own implementation.
- Lean checking uses [PyPantograph](https://github.com/stanford-centaur/PyPantograph) from Stanford Centaur (Apache‑2.0).
- Python-style regex conversion uses [Pyformlang](https://github.com/Aunsiels/pyformlang)'s `PythonRegex` parser and automaton constructors (MIT).
- [CyberZHG's toolbox](https://cyberzhg.github.io/toolbox/) was used only as an external reference for expected automata; no code from it is used.
- Constructions: Pyformlang `PythonRegex` for Python-style regex, Thompson (1968) for the formal syntax.
