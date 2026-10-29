# Third-party notices

This project is released under the MIT license (see the header in `src/_license.js`). This file lists the
third-party software and references it relates to, and how each one is used. It is information for readers,
not legal advice.

## Part of this repository

| Component | License | Notes |
|---|---|---|
| **FSM Designer** by Evan Wallace | MIT | Copyright © 2010 Evan Wallace. This project is a fork; the original notice is kept in `src/_license.js`. |
| Multi-FSM workspaces, undo/redo, theming, refreshed UI by Moeein Aali | MIT | From the fork this repository builds on ([MoeeinAali/fsm](https://github.com/MoeeinAali/fsm)). |

## Used, but not included (installed separately, optional)

| Component | License | How it is used |
|---|---|---|
| **PyPantograph** (Stanford Centaur) | Apache-2.0 | Powers the "Check with Lean" and "Verify with Lean" buttons. `requirements-lean.txt` installs it from GitHub at tag `v0.3.15`; `lean_integration.py` and `lean_regex_check.py` call its Python API (`pantograph.Server`). No PyPantograph code is copied into this repository. |
| **Lean 4** | Apache-2.0 | Installed by you through [elan](https://github.com/leanprover/elan); PyPantograph runs it. The Lean source this project sends for checking (embedded in `lean_regex_check.py`) was written for this project. |

PyPantograph and Lean are not redistributed here, so their license texts and NOTICE files are not shipped with this
repository. **If you redistribute them together with this project** (for example in a container image or an
installer), the Apache-2.0 terms apply to those copies: include the Apache-2.0 license text and any NOTICE file
that comes with them. Apache-2.0 and MIT can be combined this way; each component keeps its own license.

## References (no code used)

- [Pyformlang](https://github.com/Aunsiels/pyformlang) (MIT): its documentation was a reference for textbook regex syntax. It is not a dependency.
- [CyberZHG's toolbox](https://github.com/CyberZHG/toolbox) (GPL-3.0): used only as an external reference for expected automata. No code from it is used.
- [Automata Studio](https://github.com/ReyEscarlata0/automata-studio) (MIT): informed the property checklist and conversion workflow; this project uses its own implementation.
- Algorithms from the literature, implemented independently here: Glushkov (1961) and Berry–Sethi (1986) for Python-style regex, Thompson (1968) for the formal syntax, and the standard subset construction.

## Generated output

Exported `.tex` and `.typ` files rely on packages that your own TeX or Typst installation provides (TikZ, and a Typst
drawing package). Those packages are not distributed with this project, and the exported files are yours to use.
