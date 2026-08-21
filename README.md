# KenKen

A web version of the KenKen puzzle game (also known as Calcudoku or MathDoku),
with an in-browser puzzle generator.

## Rules

Fill an N×N grid with the digits 1..N so that:

1. No digit repeats in any row or column (a Latin square).
2. Each heavily-outlined **cage** satisfies its arithmetic clue — the target
   number and operator printed in its top-left corner.

Cage arithmetic:

| Clue | Meaning |
|---|---|
| `12+` | The cage's cells sum to 12. |
| `48×` | The cage's cells multiply to 48. |
| `3−`  | Two cells whose difference is 3 (in either order). |
| `2÷`  | Two cells where one divides the other exactly, quotient 2. |
| `5`   | A single-cell "freebie" — the cell is 5. |

A digit **may** repeat within a cage, as long as it does not repeat within a
row or column.

See [`docs/KENKEN.md`](docs/KENKEN.md) for the full research reference on
rules, generation, solving, and difficulty rating.

## Running it

```bash
npm install
npm run dev
```

Then open the printed URL.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server. |
| `npm run build` | Typecheck and produce a production build in `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Run the test suite in watch mode. |
| `npm run test:run` | Run the test suite once. |
| `npm run test:coverage` | Run tests with coverage for the engine and game logic. |
| `npm run typecheck` | Typecheck without emitting. |
| `npm run lint` | Lint with oxlint. |

## How to play

Pick a grid size and difficulty, press **New puzzle**, then fill the grid.

- Click or tap a cell to select it; arrow keys move the selection.
- Type `1`–`9` (or use the on-screen keypad) to enter a digit.
- `Backspace` / `Delete` clears a cell.
- `Space` toggles **pencil-mark mode**, where digits are recorded as small
  candidate notes instead of an answer.
- `Ctrl`/`Cmd`+`Z` undoes, `Ctrl`/`Cmd`+`Shift`+`Z` (or `Ctrl`+`Y`) redoes.
- **Auto-clear marks**, on by default, erases a cell's pencil marks from its
  row and column peers as soon as a matching digit is entered. Toggle it in
  the settings; your choice is remembered between sessions.

The board is fully playable by touch — a 9×9 fits a 375px-wide phone screen.

## Project layout

```
src/
  engine/     Puzzle generation and solving. No React, no DOM, no dependencies.
  game/       Game state reducer (entries, pencil marks, undo/redo) and its hook.
  ui/         Presentational React components. Pure functions of a Puzzle + state.
  fixtures/   A fixed, uniqueness-verified puzzle used in tests.
docs/
  KENKEN.md      Research reference: rules, generation, solving, difficulty.
  ENGINE_API.md  The engine's public API contract.
```

The engine is deterministic: a puzzle is fully reproducible from its `seed`,
`size`, and `difficulty`. Every generated puzzle is verified to have exactly
one solution before it is returned.
