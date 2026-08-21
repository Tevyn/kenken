# Hint system — design specification

A hint engine for the KenKen app: a pure function over engine types that finds
the *easiest* deduction a player could make right now, explains it in plain
English, says which cells to highlight, and can apply itself.

This document is written to be implemented from directly. It assumes
`docs/ENGINE_API.md` and `docs/KENKEN.md` as background, and it references the
existing solver in `src/engine/solver.ts` throughout — a large fraction of the
work is already done there and should be reused, not re-derived.

Contents:

1. [What the existing solver already gives us](#1-what-the-existing-solver-already-gives-us)
2. [Candidate baselines: `book` and `visible`](#2-candidate-baselines-book-and-visible)
3. [Technique ladder](#3-technique-ladder)
4. [Explanation templates and worked examples](#4-explanation-templates-and-worked-examples)
5. [Highlight spec](#5-highlight-spec)
6. [Hint selection policy](#6-hint-selection-policy)
7. [Progressive disclosure](#7-progressive-disclosure)
8. [Degenerate cases](#8-degenerate-cases)
9. [API sketch](#9-api-sketch)
10. [Recommended scope cut](#10-recommended-scope-cut)
11. [Sources](#11-sources)

---

## 1. What the existing solver already gives us

`src/engine/solver.ts` is a cage-combination CSP. Its `propagate()` runs five
rules to a fixpoint, and four of them map directly onto named human techniques:

| Solver rule | Location | Human technique |
|---|---|---|
| (A) combination filtering + candidate intersection | `shallow()` | cage combination analysis; freebie cages; "only one way to fill this cage" |
| (B) naked singles / peer elimination | `shallow()` | a placed digit blocks its row and column |
| (C) hidden singles | `shallow()` | only one home for a digit in a row/column |
| (D1) cage → unit locked candidates | `deep()` | cage confinement / cage-unit overlap |
| (D2) unit → cage locked candidates | `deep()` | "this digit must live in that cage" |

`enumerateCageCombos()` is the single most reusable piece. **A key finding of
the research below: exhaustive per-cage combination enumeration already
subsumes essentially every published "arithmetic trick" for a single cage** —
prime-factor decomposition of `×` targets, divisibility checks for `÷`, min/max
bounds on `+` cages, and intra-cage parity are all just filters on a
combination list that `enumerateCageCombos` already computes exactly. There is
no reason to implement them as separate techniques; they only affect the
*wording* of a cage-combination hint, never its conclusions.

What is genuinely missing, in rough order of value:

- **Cross-cage arithmetic** — the "every row and column of an N×N grid sums to
  `N(N+1)/2`" family: innies, outies, cage splitting, unit bounds. This is the
  one technique class with real deductive power that the solver does not have,
  and it is the most distinctively KenKen-flavoured thing a hint can teach.
- **Naked and hidden subsets** (pairs/triples within a row or column). Standard
  Sudoku fare; the solver has no subset rule at all.
- **X-Wing and chains.** Present in Sudoku literature, near-useless here (§10).

### 1.1 Refactor prerequisite

The hint engine needs the solver's machinery in a form that *reports* what it
deduced rather than silently mutating. Recommended, in `src/engine/`:

- Extract `buildContext` / `State` / the candidate representation into a new
  `candidates.ts`, exporting a `CandidateState` seeded from a player `Grid`
  rather than from an empty grid.
- Split `shallow()`/`deep()` into per-rule functions with the shape
  `(ctx, st) => Deduction[]`, and have `propagate()` compose them. The solver's
  hot loop must keep its current fast path (bitmask `Int32Array`, stale-cage
  tracking); the reporting variants can be separate entry points that the
  solver never calls.
- Keep `solver.ts`'s public behaviour and performance identical — it is on the
  generator's critical path and runs thousands of times per puzzle.

`hints.ts` then depends on `candidates.ts` and `types.ts` only. No React.

---

## 2. Candidate baselines: `book` and `visible`

The hint engine maintains **two** candidate sets per empty cell. Getting this
distinction right is what makes the whole system behave sanely.

**`book[cell]` — the bookkeeping fixpoint.** Seed `cands[i]` from the player's
`values` (a filled cell is its single digit; an empty cell is all digits), then
run rules **(A) + (B) only** to a fixpoint. This is the ground truth the engine
reasons from. It is *sound*: it uses only the puzzle and the player's entries.

**`visible[cell]` — what the player plausibly knows.**

```
visible[cell] = marks[cell].length > 0
  ? new Set(marks[cell])
  : { 1..size } minus { digits already filled in cell's row or column }
```

Rules (A) and (B) are treated as **bookkeeping, never as hints.** No player
wants to be told "row 3 already has a 7, so this cell isn't 7." Every technique
in the ladder below is a *conclusion* layered on top of the bookkeeping
fixpoint.

Two invariants follow, and they resolve the two obvious failure modes:

- **Soundness:** `marks` are *never* used to derive a conclusion. A player's
  pencil marks may be wrong, stale, or absent; deriving from them would produce
  false hints.
- **Novelty:** `marks` *are* used to decide whether a conclusion is worth
  offering. An elimination hint is only offered if it removes at least one
  digit from `visible[cell]` for at least one target cell. A placement hint is
  only offered if `values[cell] == null`.

The novelty test makes elimination hints self-limiting: the first press
explains "the 3÷ cage can only be 1 and 3", the second press writes those
pencil marks, and from then on `visible` equals `book` for those cells so the
hint stops firing. Without it, cage-narrowing hints would repeat forever.

---

## 3. Technique ladder

Ordered easiest-first. `rank` is the integer used to pick the easiest
applicable hint; gaps of 10 leave room to insert.

Techniques **overlap deliberately**. A cage with one surviving combination also
produces naked singles; the last empty cell in a row is also a naked single and
a hidden single. The ladder resolves this by always reporting the lowest-rank
technique whose *explanation* applies. That is a feature: the friendliest
phrasing wins.

| rank | id | Display name | Preconditions | Concludes | In `solver.ts`? |
|---|---|---|---|---|---|
| 10 | `freebie-cage` | Given cell | Cage has 1 cell; `values[cell] == null` | **Place** `cage.target` | Yes — rule (A), `enumerateCageCombos` n=1 branch |
| 20 | `last-cell-in-unit` | Last cell in a row or column | A row or column has exactly one empty cell | **Place** the missing digit | Yes — emergent from (B)/(C) |
| 30 | `single-cage-combination` | Only one way to fill this cage | After bookkeeping, the cage's surviving combinations all use the same multiset of digits; and for ≥1 cage cell `book ⊊ visible` | **Place** every cell (if exactly one surviving arrangement), else **eliminate** every digit outside the multiset from the cage's cells | Yes — rule (A) |
| 40 | `naked-single` | Only one digit left here | `popcount(book[cell]) === 1`, `values[cell] == null` | **Place** that digit | Yes — rules (A)+(B) |
| 50 | `hidden-single` | Only one home for this digit | In some row or column, digit `d` appears in `book` of exactly one cell, and that cell is empty with `popcount(book) > 1` | **Place** `d` there | Yes — rule (C) |
| 60 | `unit-sum-innie` | Row/column total, one cell over | Cages entirely inside a unit cover all but exactly one of its cells; each such cage has a single possible cell-sum under `book` | **Place** `N(N+1)/2 − Σ covered` in the leftover cell | **No — new code** |
| 70 | `unit-sum-outie` | Row/column total, cage sticks out | Cages entirely inside a unit, plus exactly one straddling cage with exactly one cell outside, cover the unit; the fully-inside cages and the straddling cage's *total* each have a single possible sum | **Place** `cageSum − (T − Σ covered)` in the outside cell | **No — new code** |
| 80 | `cage-locks-line` | A cage claims a digit for its row/column | Every surviving combination of cage `c` places digit `d` among the cage cells lying in unit `u` | **Eliminate** `d` from every cell of `u` outside `c` | Yes — rule (D1) |
| 90 | `unit-sum-bound` | Row/column total forces a range | As `unit-sum-innie` but the covered cages have a *range* of possible sums; the resulting interval for the leftover cell excludes some of its candidates | **Eliminate** out-of-range digits | **No — new code** |
| 100 | `line-locks-cage` | A row/column forces a digit into a cage | In unit `u`, every cell that can still hold `d` belongs to one cage `c`, and `c` has combinations that omit `d` from its `u`-cells | **Eliminate** (via combination pruning, which then narrows cells through rule A) | Yes — rule (D2) |
| 110 | `naked-set` | These cells are used up | `k` cells of a unit have `book` sets whose union has exactly `k` digits, `2 ≤ k ≤ 3` | **Eliminate** those digits from the unit's other cells | **No — new code** |
| 120 | `hidden-set` | These digits are cornered | `k` digits of a unit have `book` homes confined to exactly `k` cells, `2 ≤ k ≤ 3` | **Eliminate** all other digits from those `k` cells | **No — new code** |
| 130 | `unit-parity` | Odd/even counting | In a unit, every cage's odd-digit count is pinned except one | **Eliminate** by parity | **No — new code** |
| 140 | `x-wing` | X-Wing | Digit `d` has exactly two homes in each of two rows, in the same two columns (or transpose) | **Eliminate** `d` from those columns elsewhere | **No — new code** |
| — | `reveal` | Reveal a cell | Escape hatch; never reached by logic (§8.3) | **Place** from `puzzle.solution` | n/a |

### 3.1 Notes on the arithmetic techniques (ranks 60/70/90)

These are the only genuinely new deductive machinery, and they have a subtlety
that every summary of "innies and outies" glosses over: **in KenKen a cage's
target is not its sum** unless the operator is `+` or `=`. A `1−` cage in a 4×4
can sum to 3, 5, or 7.

So the implementation is:

```
cageSumSet(cageIndex, positions?) :=
  the set of Σ over the given positions, taken across the cage's
  surviving combinations in the current bookkeeping state
```

- For `'+'` and `'='` cages over *all* positions this is always a singleton
  equal to `target` — no enumeration needed, take the fast path.
- Otherwise derive it from `st.combos[cageIndex]`. For a partial position set
  (the straddling cage in `unit-sum-outie`) always derive it.
- When every contributing set is a singleton → `unit-sum-innie` / `-outie`
  place a digit.
- When some contributing set has ≥2 elements → the leftover cell's value lies
  in an interval `[T − maxΣ, T − minΣ]`; if that clips any candidate, emit
  `unit-sum-bound`.

This subsumes the "Rule of 21" / "Rule of 45" family for any grid size: the
unit total is `T = N(N+1)/2` (3×3→6, 4×4→10, 5×5→15, 6×6→21, 7×7→28, 8×8→36,
9×9→45). The multiplicative analogue ("Rule of 720", `N!`) is real but
essentially never fires on generated puzzles — skip it.

Generalisation to multi-unit blocks (two adjacent rows → `2T`, etc., which is
what "cage splitting" does) is deliberately **out of scope**; see §10.

---

## 4. Explanation templates and worked examples

Every hint carries two strings:

- `text` — player-facing. **No jargon.** No "candidate", "unit", "eliminate",
  "naked", "locked". Say "digit", "row", "rule out", "blocked".
- `secondary` — the technique's proper name, shown smaller/dimmer, so a player
  who wants to learn the vocabulary can. e.g. `"Hidden single"`.

Cell references render as `row R, column C`, both 1-based. Cage references
render as the printed label from `cageLabel()`, e.g. `the 12+ cage`.

The worked examples below use the verified 4×4 fixture from `docs/KENKEN.md`.
Cells are flat indices `row*4 + col`; the unique solution is:

```
index:  0  1  2  3      value: 1 2 3 4
        4  5  6  7             3 4 1 2
        8  9 10 11             2 1 4 3
       12 13 14 15             4 3 2 1

cages:  E(0,4) 3÷   A(1,5) 8×   D(2,3) 7+   B(6,10) 3−
        G(8,12) 8×  C(9,13,14) 6×   F(7,11) 1−   H(15) =1
```

Row/column total for this grid: `T = 4·5/2 = 10`.

---

### `freebie-cage` — rank 10

```
text:      "The cage marked {label} has only one cell, so it has to be {digit}."
secondary: "Given cell"
```

**Example** — cage H is the single cell 15 with target 1.
> The cage marked 1 has only one cell, so it has to be 1.

---

### `last-cell-in-unit` — rank 20

```
text:      "{Unit} already has {othersList} — the only digit left for
            row {r}, column {c} is {digit}."
secondary: "Last cell in a {unitKind}"
```

`othersList` is the filled digits in the unit, ascending, joined as
`"1, 2 and 3"`.

**Example** — the player has filled row 4 (cells 12,13,14) with 4, 3, 2.
> Row 4 already has 2, 3 and 4 — the only digit left for row 4, column 4 is 1.

---

### `single-cage-combination` — rank 30

Two variants; pick by whether the cage has exactly one surviving arrangement.

```
variant "narrowed":
text:      "There is only one set of digits that makes {label}: {digitList}.
            So the {n} cells of that cage hold {digitList} in some order —
            nothing else fits."
secondary: "Cage combination"

variant "placed":
text:      "There is only one way to fill the {label} cage: {assignmentList}."
secondary: "Cage combination"
```

`assignmentList` renders as `"3 at row 1, column 3 and 4 at row 1, column 4"`.

**Example (narrowed)** — cage E is `3÷` over cells 0 and 4 in a 4×4. Pairs with
`max/min = 3`: only `{1,3}`.
> There is only one set of digits that makes 3÷: 1 and 3. So the 2 cells of
> that cage hold 1 and 3 in some order — nothing else fits.

Eliminates 2 and 4 from cells 0 and 4. Novelty test passes at game start
because `visible` for both cells is `{1,2,3,4}`.

**Example (placed)** — after the player writes 3 into cell 4, cage E's only
surviving arrangement is `(1,3)`.
> There is only one way to fill the 3÷ cage: 1 at row 1, column 1 and 3 at
> row 2, column 1.

---

### `naked-single` — rank 40

The `reason` discriminator picks the tail of the sentence.

```
text:      "Row {r}, column {c} can only be {digit} — {reason}."
secondary: "Naked single"

reason = 'peers' : "every other digit already appears in its row or column"
reason = 'cage'  : "no other digit works with the {label} cage"
reason = 'mixed' : "the other digits are blocked by its row, its column, or
                   the {label} cage"
```

Pick `'cage'` when the cage's combination list alone pins the cell,
`'peers'` when row/column elimination alone does, `'mixed'` otherwise.

**Example** — the player has written 3 in cell 4. Cage E allows only `{1,3}`
for cell 0; the 3 in cell 4 is a column peer.
> Row 1, column 1 can only be 1 — the other digits are blocked by its row, its
> column, or the 3÷ cage.

---

### `hidden-single` — rank 50

```
text:      "In {unit}, only row {r}, column {c} can still hold a {digit} —
            every other cell there is blocked."
secondary: "Hidden single"
```

**Example** — verified on the fixture with an empty grid. After bookkeeping,
row 1's cells are: cell 0 ∈ {1,3} (cage E), cell 1 ∈ {2,4} (cage A), cells 2
and 3 ∈ {3,4} (cage D, `7+`). Digit 1 has exactly one home.
> In row 1, only row 1, column 1 can still hold a 1 — every other cell there is
> blocked.

Correct: cell 0 = 1.

---

### `unit-sum-innie` — rank 60

```
text:      "Every {unitKind} adds up to {T}. In {unit}, the {label list}
            {cageVerb} together {covered}, so the one cell left over —
            row {r}, column {c} — must be {digit}."
secondary: "Row total (innie)"
```

`cageVerb` is `"adds"` for one cage, `"add"` for several. `label list` renders
as `"the 4+ cage and the 8+ cage"`.

**Example (schematic, 5×5, `T = 15`)** — column 3 is covered by a 2-cell `4+`
cage and a 3-cell `8+` cage that both sit entirely inside it, leaving one cell.
> Every column adds up to 15. In column 3, the 4+ cage and the 8+ cage add
> together 12, so the one cell left over — row 2, column 3 — must be 3.

---

### `unit-sum-outie` — rank 70

```
text:      "Every {unitKind} adds up to {T}. In {unit}, {insideLabels}
            {cageVerb} {covered}, so the part of the {label} cage sitting
            there adds to {remainder}. That whole cage adds to {cageSum},
            so its cell outside — row {r}, column {c} — must be {digit}."
secondary: "Row total (outie)"
```

**Example (verified on the fixture, empty grid)** — column 2 holds cage A
(`8×`, cells 1 and 5, entirely inside) and cage C (`6×`, cells 9, 13 and 14 —
cells 9 and 13 are in column 2, cell 14 is not).

- `T = 10`.
- Cage A: pairs with product 8 from 1..4 → only `{2,4}`, sum 6. Singleton.
- So cage C's cells inside column 2 sum to `10 − 6 = 4`.
- Cage C: `6×` over 3 cells from 1..4 → only arrangements of `{1,2,3}`, total 6.
  Singleton.
- Cell 14 = `6 − 4 = 2`.

> Every column adds up to 10. In column 2, the 8× cage adds 6, so the part of
> the 6× cage sitting there adds to 4. That whole cage adds to 6, so its cell
> outside — row 4, column 3 — must be 2.

Correct: cell 14 = 2. Note this deduction is **unavailable to the current
solver by propagation** — it is exactly the kind of step that today forces a
branch.

---

### `cage-locks-line` — rank 80

```
text:      "However the {label} cage works out, its {digitList} end up in
            {unit}. So no other cell in {unit} can be {digitList}."
secondary: "Cage confinement"
```

Use `"its {digit} ends up"` for a single digit.

**Example (verified, empty grid)** — cage D is `7+` over cells 2 and 3, both in
row 1. The only pair from 1..4 summing to 7 is `{3,4}`.
> However the 7+ cage works out, its 3 and 4 end up in row 1. So no other cell
> in row 1 can be 3 or 4.

Eliminates 3 and 4 from cells 0 and 1. Correct: cell 0 = 1, cell 1 = 2.

---

### `unit-sum-bound` — rank 90

```
text:      "Every {unitKind} adds up to {T}. The rest of {unit} can only
            supply between {minRest} and {maxRest}, so row {r}, column {c}
            has to be between {lo} and {hi} — that rules out {removedList}."
secondary: "Row total (bounds)"
```

**Example (verified on the fixture, empty grid)** — column 4 holds cage F
(`1−`, cells 7 and 11, entirely inside), cage H (`=1`, cell 15, entirely
inside), and cell 3, which belongs to cage D and pokes out of the column.

- Cage F: pairs with `|a−b| = 1` from 1..4 → `{1,2}`, `{2,3}`, `{3,4}` → sums
  `{3, 5, 7}`. Not a singleton, so `unit-sum-innie` does not fire.
- Cage H: sum 1.
- Cell 3 = `10 − 1 − F ∈ {6, 4, 2}` → only 4 and 2 are legal digits.

> Every column adds up to 10. The rest of column 4 can only supply between 4
> and 8, so row 1, column 4 has to be between 2 and 6 — that rules out 1 and 3.

Cell 3 is now `{2,4}`; combined with cage D's `{3,4}` it collapses to 4.
Correct.

---

### `line-locks-cage` — rank 100

```
text:      "In {unit}, the only cells that can still hold a {digit} all belong
            to the {label} cage. So that cage has to use its {digit} there —
            which rules out {removedList} in {cellList}."
secondary: "Locked candidate (row into cage)"
```

**Example (verified, empty grid)** — in row 1, only cell 0 can hold a 1, and
cell 0 belongs to cage E (`3÷`). Cage E's combinations are `(1,3)` and `(3,1)`;
pruning to those placing 1 at cell 0 leaves `(1,3)`.
> In row 1, the only cells that can still hold a 1 all belong to the 3÷ cage.
> So that cage has to use its 1 there — which rules out 3 in row 1, column 1.

---

### `naked-set` — rank 110

```
text:      "{cellList} between them can only hold {digitList}, so those digits
            are used up there — nothing else in {unit} can be {digitList}."
secondary: "Naked {pair|triple}"
```

**Example (verified, empty grid)** — cells 2 and 3 (cage D, `7+`) both have
`book = {3,4}`.
> Row 1, column 3 and row 1, column 4 between them can only hold 3 and 4, so
> those digits are used up there — nothing else in row 1 can be 3 or 4.

Note this reaches the same conclusion as the `cage-locks-line` example above.
The rank ordering means the player is shown the cage-based phrasing, which is
more concrete. Good illustration of why the ladder tolerates overlap.

---

### `hidden-set` — rank 120

```
text:      "In {unit}, {digitList} can only go in {cellList}. Those cells are
            spoken for, so {removedList} can be crossed off there."
secondary: "Hidden {pair|triple}"
```

---

### `unit-parity` — rank 130

```
text:      "{Unit} holds exactly {k} odd digits. {knownLabels} already account
            for {j} of them, so the {label} cage must contribute {k−j} —
            that rules out {removedList}."
secondary: "Parity"
```

Every row and column of an N×N grid contains exactly `ceil(N/2)` odd digits.
Tier 2 (§10) — it fires rarely and the arithmetic reads badly.

---

### `x-wing` — rank 140

```
text:      "In rows {r1} and {r2}, {digit} can only go in columns {c1} and
            {c2}. Those two rows use up both of those spots, so {digit} can
            be crossed off the rest of columns {c1} and {c2}."
secondary: "X-Wing"
```

Tier 2, and recommended against — see §10.

---

### `reveal` — escape hatch

```
text:      "I can't prove the next step from what's on the board. If you'd
            like to keep moving: row {r}, column {c} is {digit}."
secondary: "Revealed"
```

---

## 5. Highlight spec

One shape, four channels, so `Board`/`Cell` need exactly one new prop each.

```ts
export interface HintHighlight {
  /** Cells carrying the conclusion. Strongest emphasis. */
  focus: CellIndex[]
  /** Cells supplying the reason. Secondary emphasis. */
  support: CellIndex[]
  /** 0-based rows to tint as a band. */
  rows: number[]
  /** 0-based columns to tint as a band. */
  cols: number[]
  /** `Cage.id`s to outline in the accent colour. */
  cages: number[]
  /** Dim every cell not named by focus/support/rows/cols/cages. */
  dimRest: boolean
  /** Per-cell pencil digits to render struck through. */
  strike: Array<{ cell: CellIndex; digits: number[] }>
}
```

Rendering conventions, in precedence order per cell: `focus` > `support` >
row/col/cage band > dimmed. `strike` is drawn inside the cell's pencil-mark
grid and only for digits actually in `marks[cell]` (or in the auto-filled set,
see §7.2).

| technique | `focus` | `support` | `rows` / `cols` | `cages` | `dimRest` | `strike` |
|---|---|---|---|---|---|---|
| `freebie-cage` | the one cell | — | — | that cage | true | — |
| `last-cell-in-unit` | the empty cell | the unit's filled cells | the unit | — | true | — |
| `single-cage-combination` (placed) | all cage cells | — | — | that cage | true | — |
| `single-cage-combination` (narrowed) | cage cells that lose candidates | other cage cells | — | that cage | true | removed digits per cell |
| `naked-single` | the cell | reason `'peers'`: the filled peers in its row+col. reason `'cage'`: the other cage cells. `'mixed'`: both | reason ≠ `'cage'`: its row and col | its cage | true | — |
| `hidden-single` | the cell | every other cell of the unit | the unit | — | true | — |
| `unit-sum-innie` | the leftover cell | all cells of the fully-inside cages | the unit | those cages | true | — |
| `unit-sum-outie` | the outside cell | cells of the fully-inside cages **and** the straddling cage's in-unit cells | the unit | inside cages + straddling cage | true | — |
| `cage-locks-line` | cells losing the digit | the cage's cells in that unit | the unit | that cage | true | the locked digits |
| `unit-sum-bound` | the bounded cell | all other cells of the unit | the unit | cages fully inside the unit | true | removed digits |
| `line-locks-cage` | the cage cells that lose candidates | the unit's cells that can hold the digit | the unit | that cage | true | removed digits |
| `naked-set` | the unit's other cells that lose candidates | the `k` set cells | the unit | — | true | the set's digits |
| `hidden-set` | the `k` cells | the unit's other cells | the unit | — | true | removed digits |
| `unit-parity` | cells losing candidates | the unit | the unit | cages with known parity | true | removed digits |
| `x-wing` | cells losing the digit | the four corner cells | both rows and both cols | — | true | the digit |
| `reveal` | the cell | — | — | — | true | — |

Accessibility: put `text` in an `aria-live="polite"` region. Append a
disambiguator to the aria-label of highlighted cells — `", hint focus"` /
`", hint context"` — so screen-reader users can find them without sight of
colour. Never rely on colour alone: `focus` also gets a ring, `dimRest` also
reduces opacity.

---

## 6. Hint selection policy

```
findHint(puzzle, values, marks, opts) -> HintResult
```

### 6.1 Algorithm

```
 1. If every cell of `values` is filled and equals puzzle.solution
      -> return { kind: 'solved' }

 2. wrong := [ i | values[i] != null && values[i] !== puzzle.solution[i] ]
    If wrong is non-empty
      -> return { kind: 'mistake', cells: wrong }
    (Deduction from a poisoned grid is worthless; bail before doing any.)

 3. book := candidate fixpoint of rules (A)+(B), seeded from `values`.
    If any book[i] === 0 (contradiction)
      -> return { kind: 'mistake', cells: wrong }   // wrong is empty here only
                                                    // if the puzzle is broken;
                                                    // see §8.2
    visible := per §2.

 4. For rank r in RANKS ascending, capped at opts.maxRank ?? Infinity:
      D := detect(technique r, puzzle, values, book, visible)
           // detectors return only NOVEL deductions:
           //   place     -> values[cell] == null
           //   eliminate -> removes >=1 digit from visible[cell] for >=1 cell
      D := D filter (d => !opts.recent.includes(signature(d)))
      If D is non-empty
        -> return { kind: 'hint', hint: pick(D) }

 5. If step 4 found candidates at some rank but all were filtered out by
    `recent`, re-run step 4 once with `recent` empty. (Never return "stuck"
    just because the player pressed hint repeatedly.)

 6. -> return { kind: 'stuck' }   // caller may then ask for kind:'reveal'
```

`RANKS` is the sorted list of ranks of the techniques the build actually
implements (§10). Detectors are pure and independent; ordering between them is
entirely the rank number.

### 6.2 `pick(D)` — tie-breaking within a rank

Apply in order, first discriminator wins:

1. **Placements before eliminations.** A hint that writes a digit is more
   satisfying and more legible than one that crosses digits off.
2. **Proximity to the player's attention.** If `opts.near != null` (normally
   `state.selected`), sort ascending by
   `chebyshev(rowOf(focus[0]), colOf(focus[0]), rowOf(near), colOf(near))`,
   using the minimum over all `focus` cells. Skip this step when `near` is
   null.
3. **More work done.** Prefer the deduction that places more cells, then the
   one that removes more candidate digits in total.
4. **Determinism.** Lowest `min(focus)` flat index. This must be a total order
   so the function is referentially transparent and testable.

### 6.3 Signatures and `recent`

```
signature(hint) = `${technique}|${[...focus].sort((a,b)=>a-b).join(',')}|${digits.join(',')}`
```

`digits` is the placed value(s) or the eliminated digits, sorted. The caller
keeps `recent` as a ring buffer of the last **3** signatures. Rationale for 3:
long enough to stop the engine circling a small cluster, short enough that a
player who undoes their way back can get the same hint again.

`recent` is cleared on `NEW_PUZZLE` and `RESET`, and the matching signature is
popped when the player undoes an `APPLY_HINT` (§7.3).

### 6.4 Cost

`findHint` is O(cells × cages × combos) — the same order as one `propagate()`
pass, which the solver already runs thousands of times per generated puzzle.
Measured against that budget it is free. Call it synchronously on demand;
memoize on `(puzzle, values)` identity so React re-renders don't recompute.
Do **not** compute hints eagerly on every keystroke.

---

## 7. Progressive disclosure

Two presses, as decided: **explain, then apply.**

### 7.1 State machine

Hint state is ephemeral UI state, like `selected`. It lives in `GameState` but
**not** in `HistorySnapshot`.

```ts
type HintPhase =
  | { kind: 'idle' }
  | { kind: 'shown'; hint: Hint }
  | { kind: 'message'; message: HintMessage }   // solved / mistake / stuck
```

| Event | From | To | Effect |
|---|---|---|---|
| press Hint | `idle` | `shown` or `message` | run `findHint` |
| press Hint | `shown` | `idle` | **apply** the hint; push its signature onto `recent` |
| press Hint | `message` | `idle` then immediately re-run | dismiss and retry (a mistake may have been fixed) |
| `SELECT` / `MOVE` | `shown` | `shown` | unchanged — moving the cursor to look at the highlight must not destroy it |
| `DIGIT` / `ERASE` / `UNDO` / `REDO` | any | `idle` | the board changed; the hint is stale |
| `NEW_PUZZLE` / `RESET` | any | `idle` | also clear `recent` |
| Escape, or click the hint banner's dismiss | `shown` / `message` | `idle` | — |

### 7.2 What "apply" writes

```ts
type HintApply =
  | { kind: 'place'; cells: Array<{ cell: CellIndex; value: number }> }
  | { kind: 'eliminate'; cells: Array<{ cell: CellIndex; digits: number[] }> }
```

**`place`** — for each entry: set `values[cell] = value`, clear
`marks[cell]`, and remove `value` from `marks` of every row and column peer of
`cell`. That last part is standard auto-clean and should be on by default; it
is the same work the player would do by hand, and skipping it leaves the board
in a state the player has to tidy. Recompute `status` exactly as the `DIGIT`
case does.

**`eliminate`** — for each entry: if `marks[cell]` is empty, **first fill it
with `visible[cell]`**, then remove `digits`. Without the fill step an
elimination hint on a bare cell produces no visible change at all, and the
player learns nothing. With it, the player sees the candidate set appear with
the ruled-out digits gone — which is exactly the pencil work the hint is
teaching. Never touch `values` in this branch.

A single `APPLY_HINT` action performs all of the above and calls
`pushHistory()` once, so the entire hint — including a multi-cell
`single-cage-combination` placement and its peer mark cleanup — is **one**
undo step.

```ts
| { type: 'APPLY_HINT'; apply: HintApply; visible: number[][] }
```

`visible` is passed in rather than recomputed inside the reducer so the reducer
stays a pure function of its inputs with no engine dependency.

### 7.3 Undo/redo interaction

- `HistorySnapshot` is unchanged (`values`, `marks`, `status`). Hint phase and
  `recent` are not restored by undo.
- On `UNDO`, if the snapshot being reverted was produced by `APPLY_HINT`, pop
  that signature off `recent`. Track this with a parallel
  `pastWasHint: boolean[]`, or by widening `HistorySnapshot` with an optional
  `hintSignature?: string`. The latter is cleaner and costs one field.
- `REDO` of a hint application pushes the signature back.
- Undoing *into* a hint's `shown` phase is not a thing — any `UNDO` sends the
  phase to `idle`.

### 7.4 Counting and limiting

**Recommendation: do not limit hints, and do not count them.** This app has no
scoring, no leaderboard, and no monetisation hook that a hint budget would
serve; a cap would only punish the learning use case the two-press design
exists for. Mature coaching-oriented apps trend the same way — SudoSketch's
Coach frames itself as "a companion, not a shortcut" with unlimited graduated
help, while hint *budgets* cluster in ad-supported casual apps where the limit
exists to sell refills.

If a "hints used" figure is ever wanted for a post-game summary, count applied
hints only (phase `shown` → apply), never explanations. Looking at a hint and
then solving the step yourself should cost nothing.

---

## 8. Degenerate cases

Exact strings. Each renders in the hint banner with the same layout as a normal
hint (`text` on top, `secondary` beneath).

### 8.1 Empty grid

**Not degenerate.** The ladder handles it: an empty grid almost always yields a
`freebie-cage` or a `single-cage-combination` hint at rank 10 or 30. The only
adjustment is that `opts.near` will be `null`, so §6.2 step 2 is skipped and
selection proximity does not bias the choice. No special wording.

If a puzzle somehow has no rank-10/30 opening, the ladder simply continues
upward — a `hidden-single` on an empty grid is perfectly reachable (see the
worked example in §4).

### 8.2 The grid contains an error

Fires whenever `values[i] !== solution[i]` for a filled cell — including errors
that are *not* yet a visible conflict, which `findConflicts()` cannot see.

Default wording (names the cell, not the correct digit):

```
text:      "Something on the board can't be right — row {r}, column {c}
            doesn't fit the puzzle. Clear it and I can pick up from there."
secondary: "Check this cell"
```

If more than one cell is wrong, name the **earliest by flat index** and add:

```
            "(There are {n} cells that don't fit; this is the first.)"
```

Behind `opts.revealMistakeCell: false` (for a stricter mode that refuses to
point):

```
text:      "Something on the board can't be right, so I can't work out the
            next step. Try undoing back to where you were sure."
secondary: "Check your work"
```

Highlight: `focus = wrong`, `dimRest = true`. **No apply step** — pressing hint
again dismisses and re-runs. Never auto-erase the player's digit; that is their
call.

Implementation note: comparing against `puzzle.solution` is exact and O(n²), and
`Puzzle.solution` is a required field, so there is no reason to detect
unsatisfiability by re-solving. Keep the `book[i] === 0` check in §6.1 step 3
as a defensive assert against a malformed puzzle, not as the primary path.

### 8.3 No logical step exists

```
text:      "I can't find a next step that follows from what's on the board.
            This one needs a leap — pick a cell with two options and see
            where it leads. Or I can just tell you one."
secondary: "No forced step"
```

The banner shows a **"Reveal a cell"** button. Pressing it returns the `reveal`
hint (§4), which places `puzzle.solution[cell]` for the cell chosen as: the
empty cell with the fewest `book` candidates, tie-broken by proximity to
`opts.near`, then by lowest index. Reveal is an ordinary `place` apply, so it
is one undo step like any other.

**Honesty note for the implementer:** because the generator guarantees a unique
solution, `kind: 'stuck'` does *not* prove the puzzle needs guessing — it
proves *our implemented ladder ran out*. With only the Tier 1 set (§10) this
will happen on some `hard`/`expert` puzzles. The wording above is deliberately
phrased as "I can't find" rather than "there is no", and the reveal button
means the player is never actually blocked. Log `kind: 'stuck'` occurrences in
development against the generator's `SolveStats.solvedByPropagation` to see how
often it bites.

### 8.4 Already solved

```
text:      "That's it — the grid is complete and correct. Nothing left to hint."
secondary: "Solved"
```

The Hint button should be disabled when `status === 'solved'`; this string is
the fallback for the race where it is pressed anyway.

---

## 9. API sketch

`src/engine/hints.ts` — pure, dependency-free, no React, unit-testable against
the fixture in `src/fixtures/samplePuzzle.ts`.

```ts
import type { CellIndex, Grid, Puzzle } from './types'

/** Pencil marks per cell, same shape as `game/state.ts`'s `Marks`. */
export type MarkSets = readonly (readonly number[])[]

export type TechniqueId =
  | 'freebie-cage'
  | 'last-cell-in-unit'
  | 'single-cage-combination'
  | 'naked-single'
  | 'hidden-single'
  | 'unit-sum-innie'
  | 'unit-sum-outie'
  | 'cage-locks-line'
  | 'unit-sum-bound'
  | 'line-locks-cage'
  | 'naked-set'
  | 'hidden-set'
  | 'unit-parity'
  | 'x-wing'
  | 'reveal'

/** Rank of each technique, ascending = easier. See docs/HINTS.md §3. */
export const TECHNIQUE_RANK: Record<TechniqueId, number>

/** Techniques this build actually implements, ascending by rank. */
export const ENABLED_TECHNIQUES: readonly TechniqueId[]

export interface HintHighlight {
  focus: CellIndex[]
  support: CellIndex[]
  rows: number[]
  cols: number[]
  cages: number[]
  dimRest: boolean
  strike: Array<{ cell: CellIndex; digits: number[] }>
}

export type HintApply =
  | { kind: 'place'; cells: Array<{ cell: CellIndex; value: number }> }
  | { kind: 'eliminate'; cells: Array<{ cell: CellIndex; digits: number[] }> }

export interface Hint {
  technique: TechniqueId
  rank: number
  /** Player-facing, jargon-free. */
  text: string
  /** The technique's proper name, e.g. "Hidden single". */
  secondary: string
  highlight: HintHighlight
  apply: HintApply
  /** Stable identity for the `recent` ring buffer. See §6.3. */
  signature: string
}

export type HintResult =
  | { kind: 'hint'; hint: Hint }
  | { kind: 'mistake'; cells: CellIndex[]; text: string; secondary: string }
  | { kind: 'stuck'; text: string; secondary: string }
  | { kind: 'solved'; text: string; secondary: string }

export interface HintOptions {
  /** Bias selection toward this cell; normally `state.selected`. */
  near?: CellIndex | null
  /** Signatures to skip. Ring buffer of the last 3 applied hints. */
  recent?: readonly string[]
  /** Never offer a technique ranked above this. Default: no cap. */
  maxRank?: number
  /** Name the offending cell on a mistake. Default true. */
  revealMistakeCell?: boolean
}

/**
 * The easiest deduction available from `values`, or a message explaining why
 * there isn't one. Pure: same inputs => identical output, including the
 * choice among equally-ranked candidates (§6.2 is a total order).
 *
 * `marks` never affects *what* is deduced, only whether a deduction is
 * novel enough to be worth showing (§2).
 */
export function findHint(
  puzzle: Puzzle,
  values: Grid,
  marks: MarkSets,
  opts?: HintOptions,
): HintResult

/**
 * Last-resort reveal, used by the "Reveal a cell" button on `kind: 'stuck'`.
 * Sources its digit from `puzzle.solution` — the only place in the hint
 * engine that reads it apart from mistake detection.
 */
export function revealHint(
  puzzle: Puzzle,
  values: Grid,
  opts?: Pick<HintOptions, 'near'>,
): Hint

/**
 * Candidate digits per cell after rules (A)+(B) to a fixpoint, seeded from
 * `values`. Exported because `APPLY_HINT` needs `visible` (§7.2) and because
 * a future "fill pencil marks" button is one call away.
 */
export function candidateSets(puzzle: Puzzle, values: Grid): number[][]

/** What the player can currently see, per §2. */
export function visibleSets(
  puzzle: Puzzle,
  values: Grid,
  marks: MarkSets,
): number[][]
```

Public types use `number[]` digit lists, not bitmasks — bitmasks stay internal
to `candidates.ts`. This keeps tests readable
(`expect(hint.apply).toEqual({ kind: 'place', cells: [{ cell: 15, value: 1 }] })`)
at negligible cost, since `findHint` runs once per button press.

### 9.1 Detector contract

Each technique is one function with a uniform shape, so the ladder in §6.1 is a
loop over a table:

```ts
interface DetectContext {
  puzzle: Puzzle
  size: number
  values: Grid
  /** Bitmask per cell, rules (A)+(B) fixpoint. */
  book: Int32Array
  /** Bitmask per cell, per §2. */
  visible: Int32Array
  /** Surviving combinations per cage, post-fixpoint. */
  combos: number[][][]
  /** cell -> index into puzzle.cages */
  cageOfCell: Int32Array
  /** unit key -> member cells; rows are 0..size-1, cols are size..2*size-1. */
  units: number[][]
}

type Detector = (ctx: DetectContext) => Hint[]
```

Detectors return **only novel** hints (§2) and must not mutate `ctx`. Test each
detector in isolation with a hand-built `DetectContext`, plus an integration
test per technique that drives `findHint` on the 4×4 fixture and asserts the
exact `text`.

### 9.2 UI wiring

- `GameState` gains `hint: HintPhase` and `recentHints: string[]`.
- `GameAction` gains `{ type: 'REQUEST_HINT'; result: HintResult }`,
  `{ type: 'APPLY_HINT'; apply: HintApply; visible: number[][]; signature: string }`,
  and `{ type: 'DISMISS_HINT' }`. `findHint` is called in `useGame`, not in the
  reducer, so the reducer stays engine-free and synchronously testable.
- `BoardProps` gains `highlight?: HintHighlight`; `CellProps` gains
  `hintRole?: 'focus' | 'support' | 'band' | 'dim'` and
  `strikeDigits?: readonly number[]`. Board derives per-cell roles from the
  highlight once, in a `useMemo`.
- Suggested keyboard shortcut: `H`. It is currently unbound in `useGame`'s
  handler, and pressing it twice is the whole interaction.

---

## 10. Recommended scope cut

### Tier 1 — implement now

| rank | id | Why |
|---|---|---|
| 10 | `freebie-cage` | Free. The natural opening hint on most puzzles. |
| 20 | `last-cell-in-unit` | Free. The friendliest sentence in the whole system. |
| 30 | `single-cage-combination` | Free — rule (A) already computes it. Teaches the one skill that distinguishes KenKen from Sudoku. |
| 40 | `naked-single` | Free. The workhorse. |
| 50 | `hidden-single` | Free — rule (C). The workhorse for anything above `easy`. |
| 60 | `unit-sum-innie` | **New code, ~60 lines.** The signature KenKen deduction. |
| 70 | `unit-sum-outie` | **New code, shares ~90% with innie.** Highest teaching value per line in the entire document. |
| 80 | `cage-locks-line` | Free — rule (D1) already exists and explains cleanly ("however this cage works out…"). |
| — | `reveal` | ~15 lines. Required so §8.3 is never a dead end. |

Six of the nine are already computed by `solver.ts`; the marginal cost is the
detector wrappers and the sentence templates. The genuinely new work is one
shared unit-sum module. **That is the whole build.**

This set covers every step of a typical `easy` or `medium` puzzle and the large
majority of `hard`. It also has the property that every hint in it either
places a digit or removes candidates for a reason a non-solver can restate in
one sentence — which is the actual product requirement.

### Tier 2 — defer

| id | Why deferred |
|---|---|
| `line-locks-cage` (D2) | **Already implemented in the solver**, so detection is nearly free — but its conclusion is a *combination* pruning whose player-visible effect is indirect ("the cage's options shrank, and therefore three cells lost a digit"). Two hops of reasoning is one too many. Cheap to promote later if the stuck rate demands it; write the detector, leave it out of `ENABLED_TECHNIQUES`. |
| `unit-sum-bound` | New code, and it shares the innie/outie plumbing, so it is the cheapest Tier 2 item. Deferred only because bound reasoning ("has to be between 2 and 6") is a noticeably harder sentence than "must be 3". Add it the moment `kind: 'stuck'` shows up in real play. |
| `naked-set` | New code. Almost always duplicates a conclusion that `cage-locks-line` or `single-cage-combination` already reaches with better wording (see the §4 example where both fire on the same cells). Low marginal deduction, real implementation cost. |
| `hidden-set` | New code. Fires rarely on 4×4–6×6, which is where most play happens. Explains poorly. |
| `unit-parity` | New code. The published parity strategies are, for a single cage, already subsumed by combination enumeration (§1); the cross-cage form fires rarely and its sentence is arithmetic-heavy. Weakest value/effort ratio of anything here. |
| `x-wing` | **Recommend against implementing at all.** X-Wing pays off in Sudoku because the box constraint creates the two-home structure it needs. KenKen has no boxes, cages are small and irregular, and cage-combination pruning kills most two-home patterns before an X-Wing could see them. On a 4×4–6×6 grid it is close to unreachable. If a puzzle is hard enough to need it, `reveal` is the better answer. |
| Multi-unit cage splitting (2-row/3-row blocks, `2T`/`3T`) | The general form of innies/outies. Combinatorially much larger to search, and the explanation ("these two rows together add to 20…") is a real step up in difficulty. Single-unit innies/outies capture most of the value. |
| Rule of `N!` (multiplicative unit total) | The multiplicative analogue of the row-sum rule. Mathematically valid, essentially never fires on generated puzzles because `÷` and `−` cages break the product chain. Skip. |

### Guidance if the ladder proves too short

Order of promotion, best value first: `unit-sum-bound` → `line-locks-cage` →
`naked-set`. Do not promote on speculation — instrument `kind: 'stuck'` in
development first, and check whether the stuck states cluster around a specific
missing technique or are simply puzzles that need a branch.

---

## 11. Sources

Techniques:

- [SudokuWiki — Innies and Outies](https://www.sudokuwiki.org/Innies_and_Outies) —
  the clearest statement of the unit-total deduction: sum the cages entirely
  inside a unit, subtract from the unit total, and the remainder is the one
  uncovered cell. Also the source for the multi-unit generalisation (`2T`,
  `3T`) that §10 defers. Written for Killer Sudoku, where the unit total is
  always 45; §3.1 restates it for arbitrary `N` and, crucially, corrects it for
  KenKen's non-additive operators.
- [SudokuWiki — Rule of 21](https://www.sudokuwiki.org/Rule_of_21) —
  the same idea named for 6×6 KenKen (`1+2+3+4+5+6 = 21`), plus the
  multiplicative "Rule of 720" that §10 rejects.
- [SudokuWiki — Cage Unit Overlap](https://www.sudokuwiki.org/Cage_Unit_Overlap) —
  the cage-confinement family; matches the solver's existing rules (D1)/(D2).
- [SudokuWiki — Cage Splitting](https://www.sudokuwiki.org/Cage_Splitting) —
  the block/straddling-cage generalisation. Source for the deferred multi-unit
  item and for the min/max bounding logic behind `unit-sum-bound`.
- [SudokuWiki — KenKen Combinations](https://www.sudokuwiki.org/KenKen_Combinations) —
  cage combination enumeration, and specifically the "dog leg" observation that
  a bent cage may repeat a digit where a straight one may not. `enumerateCageCombos`
  already handles this correctly via its per-row/per-column bitmasks.
- [SudokuWiki — KenKen Parity Strategy](https://www.sudokuwiki.org/KenKen_Parity_Strategy) —
  the cross-cage parity argument behind `unit-parity`.
- [Conceptis — CalcuDoku techniques](https://www.conceptispuzzles.com/index.aspx?uri=puzzle/calcudoku/techniques) —
  a ~20-technique taxonomy (Unique Block, Single Candidate, Hidden Single,
  Grid Remainder, Intra Block, Advanced). Its "Grid Remainder" group is the
  innie/outie family under another name; its "Intra Block" group is min/max
  bounding within one cage, which §1 argues is subsumed by enumeration. Useful
  mainly as a completeness check on the ladder.
- [KenKenPuzzle.com — How To for Experts](https://www.kenkenpuzzle.com/howto_hard) —
  the trademark holder's own worked examples. Confirms row/column-total
  deduction and unique cage combinations as the two techniques an official
  source teaches first for hard puzzles.
- [kenkenpuzzle.online — Strategies](https://kenkenpuzzle.online/strategies/) —
  a difficulty-ordered list (hidden singles → naked pairs/triples → cage
  analysis → row/column sum → parity → cross-cage). Corroborates the broad
  ordering of §3; low trust individually (unofficial fan site), used only as a
  second opinion on ordering.
- [Reflections in a Cracked Glass — KenKen hints](https://reflectionsinacrackedglass.com/explorations-articles-theater-game-hints-stories/puzzles-and-sci-fi/secrets-kenken-masters-kenken-hints/) —
  a human solver's practical rule list. Its "automatic" cages (`2÷ → {1,2}`,
  `11+ in a 6×6 → {5,6}`) are exactly `single-cage-combination`, and it is a
  good source for how experienced players actually phrase these steps.
- [bit-player — KenKen-friendly numbers](http://bit-player.org/2010/kenken-friendly-numbers/) —
  prime-factor reasoning for `×` cages, including why `1` as a factor drives so
  much of the combinatorial variety. Supports §1's claim that factor reasoning
  is a *wording* concern, not a separate deduction.

Hint UX:

- [SudoSketch Coach](https://www.sudosketch.com/sudoku-coach.html) — the
  "companion, not a shortcut" framing, one-idea-at-a-time disclosure, and the
  explicit `Nudge` → `Look` → `Show me` escalation. Closest published analogue
  to the two-press design specified here; source for §7.4's
  no-limit recommendation.
- [sudoku.coach](https://sudokucoach.app/) — the convention of pairing a
  *named* technique with a plain-English restatement and highlighted cells
  rather than a bare answer. The pattern behind this document's `text` /
  `secondary` split.
- [Hintoku](https://apps.apple.com/us/app/hintoku-your-sudoku-coach/id6744828400) —
  hints that "escalate one tap at a time, from a tiny nudge to a full
  walkthrough"; direct precedent for press-to-explain / press-to-apply.
- [Nielsen Norman / IxDF — Progressive disclosure](https://ixdf.org/literature/topics/progressive-disclosure) —
  the underlying interaction pattern (Nielsen, 1995): show the minimum first,
  reveal detail only on request.

Flagged as unverified:

- The `unit-sum-innie` example in §4 is **schematic** (a hypothetical 5×5),
  not drawn from a verified fixture — the 4×4 fixture in `docs/KENKEN.md`
  happens to contain no unit whose fully-inside cages all have singleton sums
  and leave exactly one cell. The `unit-sum-outie` and `unit-sum-bound`
  examples **are** computed against that fixture's verified unique solution and
  can be turned into tests as written.
- The technique *ranks* are this document's own proposal. No source publishes a
  difficulty ordering for KenKen techniques specifically; the ordering is
  reasoned from explanation complexity (how many facts a sentence has to carry)
  and cross-checked loosely against kenkenpuzzle.online's list. Expect to tune
  ranks 60–110 against real play.
- The claim that combination enumeration subsumes single-cage parity,
  divisibility, prime-factor and min/max techniques is this document's own
  analysis of `enumerateCageCombos`, not a sourced claim. It follows directly
  from the function being exhaustive over the cage's legal assignments, but it
  is worth an explicit test: assert that no published single-cage trick
  produces an elimination that rule (A) misses.
