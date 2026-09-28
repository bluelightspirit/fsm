# Finite State Machine Designer

A small, no‑dependency tool for sketching finite state machines in the browser. Originally created by [Evan Wallace](http://madebyevan.com/fsm/) in 2010; this fork adds multi‑FSM workspaces, undo/redo, theming, and a refreshed UI — while keeping the codebase tiny vanilla JS + a single Python build script.

Live original: <http://madebyevan.com/fsm/>

---

## Features

- **Canvas‑based FSM editor** — states (circles), transitions (arrows), accept states (double circle), self‑loops, and start arrows.
- **Multiple FSMs** — keep many diagrams side‑by‑side. Each FSM has a UUID and is stored independently in `localStorage`. Create, rename, switch, and delete from the sidebar.
- **Undo / Redo** — snapshot‑based history per FSM (up to 100 steps), with text typing debounced into a single step.
- **Clear current FSM** — wipe one diagram with a confirm; the action itself is undoable.
- **Light / Dark / Auto theme** — defaults to your OS color scheme via `prefers-color-scheme`. Cycle the toolbar button (`◐ Auto → ☀ Light → ☾ Dark`); your choice persists.
- **Exports** — PNG, SVG, and LaTeX (TikZ). Exports always render in pure black on a transparent background, regardless of your theme, so they drop cleanly into any document.
- **LaTeX‑style text shortcuts** — type `\beta` for β, `S_0` for S₀, etc.
- **Keyboard shortcuts** — see below.
- **Auto‑save** — every edit persists to `localStorage` instantly.
- **Migration** — if you have data from the original (legacy `localStorage['fsm']` key), it is imported as `FSM 1` on first load.

---

## Usage

| Action | How |
|---|---|
| Add a state | Double‑click the canvas |
| Add an arrow | Shift‑drag from one state to another |
| Move something | Drag it |
| Make accept state | Double‑click an existing state |
| Edit label | Click an object, type |
| Greek letter | Type `\` then the name (e.g. `\alpha`, `\Sigma`) |
| Subscript digit | `_` then a digit (e.g. `q_0`) |

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Delete</kbd> | Delete selected node/link |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Backspace</kbd> | Delete selected node/link (Mac‑friendly) |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo |
| <kbd>Shift</kbd> + <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Z</kbd> | Redo |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Y</kbd> | Redo (alt) |
| <kbd>Backspace</kbd> | Delete the last character of the selected label |

---

## Run locally

There are no runtime dependencies. The build script concatenates `src/**/*.js` into `www/fsm.js`.

```bash
# one-shot build
python3 build.py

# rebuild on file change
python3 build.py --watch

# serve
cd www && python3 -m http.server 8000
# then open http://localhost:8000
```

---

## Project structure

```
fsm/
├── build.py                 # Python 3 concat script (no deps)
├── www/
│   ├── index.html           # UI shell, CSS variables, theme bootstrap
│   └── fsm.js               # built bundle (do not edit by hand)
└── src/
    ├── _license.js          # MIT header (Evan Wallace, 2010)
    ├── elements/
    │   ├── node.js          # state circle
    │   ├── link.js          # transition between two states
    │   ├── self_link.js     # self-loop transition
    │   ├── start_link.js    # initial-state arrow
    │   └── temporary_link.js# arrow being dragged
    ├── export_as/
    │   ├── svg.js           # ExportAsSVG (canvas-context shim)
    │   └── latex.js         # ExportAsLaTeX (TikZ output)
    └── main/
        ├── fsm.js           # core: events, draw loop, shortcuts
        ├── math.js          # circleFromThreePoints, det, fixed
        ├── save.js          # serialize/deserialize, history commit
        ├── workspace.js     # multi-FSM CRUD, localStorage layout
        ├── history.js       # undo/redo stack
        ├── theme.js         # light/dark/system theme manager
        └── ui.js            # toolbar/sidebar wiring
```

### `localStorage` layout

```text
fsm_workspace = { version: 2, activeId, fsms: [{ id, name, createdAt, updatedAt }] }
fsm_data_<id> = { nodes: [...], links: [...] }
fsm_theme     = "system" | "light" | "dark"
```

---

## License

MIT. Original copyright © 2010 Evan Wallace. See the header in `src/_license.js`.

---

## Credits

- Original design and implementation: [Evan Wallace](http://madebyevan.com/) — <http://madebyevan.com/fsm/>
- This fork (multi‑FSM, undo/redo, theming, refreshed UI): [Moeein Aali](https://github.com/MoeeinAali)
