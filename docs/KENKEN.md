# KenKen — Engineering Reference

KenKen (also sold/branded as Calcudoku, MathDoku, Mathdoku, KenDoku) is a
number-placement puzzle invented by Japanese math teacher Tetsuya Miyamoto in
2004. This document is a precise reference for implementing a generator,
solver, and playable UI. It is written from verified sources (see
[Sources](#5-sources)) plus one worked example that was checked by exhaustive
computer search, not just by hand.

---

## 1. Rules

### 1.1 Grid and base constraint

- The grid is `N x N` for some N, commonly 3–9 (KenKen.com publishes 3x3
  through 9x9; some sites go up to 9x9 as the practical maximum for a daily
  human-solvable puzzle).
- Cells are filled with the digits `1..N`.
- **Latin square constraint**: each digit `1..N` appears exactly once in
  every row and exactly once in every column. (Unlike Sudoku there are no
  fixed sub-block constraints — cages take that role instead.)

### 1.2 Cages

- The grid is partitioned into **cages**: groups of one or more
  orthogonally-connected cells, marked by heavy/bold outlines.
- Every cage (except single-cell cages) displays a **target number** and an
  **operation** (`+`, `−`, `×`, `÷`). The values placed in the cage's cells
  must combine, via that operation, to produce the target.
- A cage's cells need not be aligned in a row/column and can be any
  polyomino shape (straight, L-shaped, etc.), as long as the cells are
  edge-connected.

### 1.3 Operations

| Op | Cage size | Rule | Notes |
|----|-----------|------|-------|
| `+` addition | any size ≥ 1 | sum of all cell values == target | order-independent |
| `×` multiplication | any size ≥ 1 | product of all cell values == target | order-independent |
| `−` subtraction | **2 cells only** (standard convention) | `\|a − b\| == target` | order-independent because it's an absolute difference |
| `÷` division | **2 cells only** (standard convention) | `max(a,b) / min(a,b) == target`, and it must divide evenly | order-independent for the same reason |
| (none) | 1 cell ("freebie") | the single value **is** the target | no operator shown; only one legal placement |

Key details, confirmed by multiple sources (Wikipedia, KenKenPuzzle.com FAQ):

- **Division cages require the larger value to be an exact multiple of the
  smaller** — e.g. a 2-cell `2÷` cage can hold `{1,2}`, `{2,4}`, `{3,6}`
  (N≥6), etc., never a non-integer ratio.
- **Digits may repeat within a cage**, as long as the repeated cells are not
  in the same row or column (the Latin-square constraint is the only thing
  that ever forbids repetition — cages themselves place no
  "no-repeat" restriction). This is explicit in the KenKenPuzzle.com FAQ:
  *"a number may be repeated within a cage as long as it is not repeated
  within the same row or column."*
- **Single-cell cages** ("freebies") show just a bare number with no
  operator; the only legal value for that cell is the number itself.

### 1.4 Subtraction/division cage size — where sources disagree

This is the one point where sources genuinely diverge, and it matters for
implementation:

- **Standard convention** (Wikipedia, KenKenPuzzle.com/original NYT-syndicated
  KenKen, most implementations): subtraction and division cages are
  **restricted to exactly two cells**, because those operations are not
  associative/commutative across more than two operands, so there's no
  canonical way to combine 3+ values.
- **Variant convention** (seen in some independently-authored puzzles, and
  explicitly discussed in secondary sources): a small number of setters
  publish subtraction/division cages with **3+ cells**, computed by sorting
  the cage's values from largest to smallest and applying the operation
  left-to-right, e.g. a 3-cell `1−` cage containing `{4,2,1}` reads as
  `4 − 2 − 1 = 1`. Division analogously would be
  `max ÷ next ÷ next ÷ ...` applied to the sorted-descending sequence.
- Several generator write-ups (e.g. discussions of the no-op variant) note a
  related simplifying rule used to keep generation tractable: **cages with 3
  or more cells are restricted to addition or multiplication only**. This
  sidesteps the associativity ambiguity entirely and is the most common
  practical choice.

**Recommendation for this implementation**: adopt the standard convention as
the default —

- `−` and `÷` cages are always exactly 2 cells.
- Cages with 3+ cells only ever use `+` or `×`.
- Optionally expose the "extended subtraction/division" variant (sorted
  descending, left-to-right) behind a config flag for users who want it, but
  do not enable it by default, since it is non-standard and slightly
  confusing to solvers.

### 1.5 Variant: "No-Op" KenKen

A published variant (offered e.g. by KenKenPuzzle.com to subscribers, and by
mathdoku.com) shows the cage's **target number but hides the operator**. The
solver must deduce both the operator and the digit placement. The same
underlying rules apply (including "3+ cell cages are + or × only," which
becomes a solving aid in this variant since it prunes the operator search
space for larger cages). This is a good "hard mode" UI toggle to implement
on top of a normal generator: just don't render the operator glyph, and
verify in the solver that the puzzle stays uniquely solvable without it
(stronger requirement than normal — see §2.4).

Other minor variants exist (e.g. restricting the digit set to non-consecutive
values like even numbers only) but are not standard and are not required for
a baseline implementation.

### 1.6 Worked 4×4 example (verified test fixture)

This example was **not** simply hand-checked against one solution — it was
verified by **exhaustive computer enumeration of all 576 order-4 Latin
squares**, confirming that exactly one of them satisfies every cage
constraint below. That is strictly stronger than manual spot-checking (an
earlier draft of this example, produced by hand, turned out to have two
solutions due to a row-swap symmetry that is easy to miss by eye — a good
cautionary example of why generators must run a real uniqueness solver
rather than trust visual inspection).

Cage layout (letters denote cage membership; no wall is drawn between two
cells of the same cage):

```
+-----+-----+-----+-----+
|  E  |  A  |  D     D  |
+     +     +-----+-----+
|  E  |  A  |  B  |  F  |
+-----+-----+     +     +
|  G  |  C  |  B  |  F  |
+     +     +-----+-----+
|  G  |  C     C  |  H  |
+-----+-----+-----+-----+
```

Cage definitions (row, col are 1-indexed, row 1 = top, col 1 = left):

| Cage | Cells | Op | Target |
|------|-------|----|--------|
| A | (1,2), (2,2) | × | 8 |
| B | (2,3), (3,3) | − | 3 |
| C | (3,2), (4,2), (4,3) | × | 6 |
| D | (1,3), (1,4) | + | 7 |
| E | (1,1), (2,1) | ÷ | 3 |
| F | (2,4), (3,4) | − | 1 |
| G | (3,1), (4,1) | × | 8 |
| H | (4,4) | (freebie) | 1 |

Unique solution:

```
1  2  3  4
3  4  1  2
2  1  4  3
4  3  2  1
```

Spot-check of every cage against the solution:

- A: 2×4 = 8 ✓
- B: |1−4| = 3 ✓
- C: 1×3×2 = 6 ✓
- D: 3+4 = 7 ✓
- E: max(1,3)/min(1,3) = 3 ✓
- F: |2−3| = 1 ✓
- G: 2×4 = 8 ✓
- H: 1 ✓

A human solver would find this fairly mechanically: freebie H fixes
`(4,4)=1` immediately; cage E's `3÷` on 2 cells in `{1..4}` only admits the
unordered pair `{1,3}`; cage G's `8×` only admits `{2,4}`; column 1 then
must hold `{1,2,3,4}` using `{1,3}` (rows 1–2) and `{2,4}` (rows 3–4);
cage C's `6×` over 3 cells only factors as `1×2×3`, which combined with row
3/4 elimination pins `(3,1)=2, (4,1)=4`; the rest falls out by row/column
elimination. (Full mechanical derivation was also cross-checked by the
exhaustive solve above, so both methods agree.)

---

## 2. Puzzle generation

Generation is a four-step pipeline: build a solved Latin square → partition
it into cages → assign operations/targets from the solution values → verify
the puzzle (as posed, without the solution) has exactly one solution.

### 2.1 Step 1 — Generate the solution Latin square

Two common approaches:

**A. Permute a cyclic base square.**
Start from the canonical cyclic Latin square `L[r][c] = ((r + c) mod N) + 1`,
then apply a random permutation of the N row indices, a random permutation
of the N column indices, and a random permutation (relabeling) of the N
symbols. This is O(N²) and trivial to implement.

*Important caveat*: this does **not** sample uniformly from the full space
of order-N Latin squares. Every square reachable this way is "isotopic" to
the cyclic square, but the total number of order-N Latin squares grows much
faster than the number of row/column/symbol permutations (`(N!)^3`), and for
N ≥ 5 most Latin squares are not isotopic to the cyclic one at all. In
practice this means: (a) puzzles generated this way are structurally fine
(the Latin square is completely valid), but (b) if you generate many
puzzles this way, the underlying solution grids will be statistically less
diverse than true uniform sampling would produce — an attentive player who
sees many puzzles might notice recurring structural patterns. For a
few-puzzles-per-day consumer app this is a non-issue; for a puzzle
*database* meant to feel infinite/varied, prefer approach B or a proper
uniform sampler (e.g. Jacobson–Matthews Markov chain).

**B. Randomized backtracking fill.**
Fill cells in some (ideally randomized) order, at each step choosing
uniformly among the digits still legal for that cell (not used yet in its
row or column), backtracking on dead ends. This explores a much larger and
more representative slice of the Latin square space and is still fast for
N ≤ 9 (order-9 Latin squares are plentiful and backtracking rarely needs to
backtrack far if you randomize the candidate order at each cell). This is
the recommended default.

Neither approach is perfectly uniform without extra care (true uniform
sampling is a genuinely hard research problem — see Jacobson–Matthews and
probabilistic divide-and-conquer methods in §5), but randomized backtracking
is good enough for puzzle generation purposes and is simple to implement
correctly.

### 2.2 Step 2 — Partition into cages

Standard approach: **randomized flood-fill / region growth**.

1. Maintain a set of unassigned cells (initially all `N²` cells).
2. While unassigned cells remain:
   a. Pick a random unassigned cell as a new cage's seed.
   b. Pick a target size for this cage, drawn from a configured **cage-size
      distribution** (e.g. weighted toward 2–3 cells, a small tail up to
      4–5, and a small proportion of 1-cell freebies).
   c. Grow the cage by repeatedly picking a random unassigned cell adjacent
      (orthogonally) to the current cage region and adding it, until the
      cage reaches its target size or has no legal neighbor left (dead end —
      accept the smaller cage and move on).
3. Optionally, do a cleanup pass merging any leftover 1-cell cages that
   weren't intentionally chosen as freebies (a flood-fill can strand
   isolated single cells at the end); merge each into an adjacent cage
   rather than leaving unintended freebies, or accept it as a freebie if
   your freebie quota allows it.

An equivalent formulation from an existing open-source implementation
(CanCan, see §5): build a random adjacency graph over the grid graph (each
grid edge included with some probability / process), take connected
components, and cap component size by a randomly chosen max per component.
This is algorithmically the same idea as flood-fill growth.

**Effect of cage-size distribution on difficulty**: more, smaller cages
(dominated by 1–2 cell cages) means more direct constraints and fewer
combinatorial possibilities per cage → easier. Fewer, larger cages (3–5+
cells) create bigger combination spaces per cage and require the solver to
juggle more candidates simultaneously → harder. A useful generator exposes
this distribution directly as a tunable difficulty knob (see §4).

A concrete example of a configurable distribution (from CanCan's default
config, as a starting point): cage sizes `{1: 5%, 2: 35%, 3: 35%, 4: 20%,
5: 5%}` with an overall single-cell-cage cap around 10–20% of all cages
(too many freebies makes the puzzle trivially easy and is explicitly called
out by generator authors as something to filter out).

### 2.3 Step 3 — Assign operation and target per cage

For each cage, given the known solution values in its cells:

- **1 cell**: no operator; target = the value. Always legal.
- **2 cells** `{a, b}`, `a ≠ b` in general (though they *can* be equal if not
  in the same row/col — rare but must be handled):
  - `+`: target = `a + b`. Always legal.
  - `×`: target = `a * b`. Always legal.
  - `−`: target = `|a − b|`. Always legal (and if `a == b`, target is `0`,
    which is a degenerate/uninteresting cage some generators avoid by simply
    not offering `−` when `a == b`).
  - `÷`: legal only if `max(a,b) % min(a,b) == 0`; target =
    `max(a,b) / min(a,b)`. Division is the operation most likely to be
    inapplicable to a given pair, so always check legality before offering
    it as a candidate.
  - Randomly choose among the legal operators for that pair (optionally
    weighted — see difficulty bias below).
- **3+ cells**: restrict to `+` (target = sum) and `×` (target = product),
  per the standard-convention recommendation in §1.4. Randomly choose
  between the two (both are always legal for any set of values 1..N).

**Difficulty bias in operator selection**:
- Skewing choice toward `−`/`÷` on 2-cell cages, and away from `+`, makes
  puzzles harder because subtraction/division are less "additive-obvious"
  and interact less predictably with row/column sums.
- Minimizing the frequency of 1-cell freebie cages (which hand the solver a
  free value) is one of the single biggest difficulty levers.
- Larger cages (more cells) increase the size of the candidate-combination
  set the solver must consider, increasing difficulty (see §3).

### 2.4 Step 4 — Verify uniqueness

There is **no guarantee** that a random cage/operator assignment yields a
uniquely-solvable puzzle — this must be checked explicitly:

1. Strip the solution; keep only the grid size, cage shapes, operators, and
   targets (i.e. what the player would actually see).
2. Run a full solver (see §3) that **counts solutions and stops early once
   it finds a second one** (never search for "all" solutions — stop at 2 for
   speed).
3. If the count is not exactly 1, the puzzle is invalid. Standard remedies,
   roughly in order of how "local" the fix is (try cheap fixes before
   regenerating from scratch):
   - **Re-roll the operator/target** for one or more cages that are
     suspected sources of ambiguity (e.g. cages touching the cells where
     multiple solutions differ from each other — the solver can report this
     from the two solutions it found).
   - **Split a cage** (break an ambiguous cage into two smaller ones) to
     add a constraint.
   - **Merge two adjacent cages** into one larger cage (fewer, more
     constraining cages can also fix ambiguity, though this less often helps
     than splitting).
   - **Change an operator** on a cage without changing its shape, if a
     different operator for the same value set breaks the symmetry (note:
     this doesn't help against operations that are inherently
     order-independent per cage — the ambiguity is almost always an
     *inter-cage* symmetry, not an intra-cage one, since every valid KenKen
     operation only depends on the *set* of values in its own cage).
   - **Regenerate the cage partition from scratch** (cheapest to implement,
     costs the most generation time) if local repairs don't converge
     quickly (e.g. after a handful of failed local repair attempts).
4. Repeat until unique, with a sane iteration cap (regenerate the whole
   Latin square if cage repair keeps failing — this should be rare with a
   reasonable cage-size distribution).

This matches the documented approach of essentially every open-source KenKen
generator surveyed (CanCan, kenny, etc.): generate → solve-and-count →
discard/repair non-unique puzzles.

### 2.5 "No repeated digit in cage" option

Some generators/players expose an optional stricter rule: **no digit may
repeat anywhere within a cage**, even across different rows/columns (this is
the Killer-Sudoku convention, not the standard KenKen/Calcudoku one).
Effects of enabling it:

- It's a strictly *additional* constraint on top of standard rules, so it
  can only reduce (never increase) the number of valid completions for a
  given cage shape/target — meaning generation may need more retries to hit
  uniqueness, but puzzles are generally a bit easier to prune, since the
  solver gets a free elimination rule ("this cage's cells are pairwise
  distinct") it can use even without doing arithmetic.
- It's a good option to expose as a checkbox but should **default to off**,
  since it is not the standard KenKen rule (confirmed by Wikipedia and
  KenKenPuzzle.com FAQ, both of which explicitly allow repeats within a cage
  as long as row/column constraints hold).

---

## 3. Solving algorithm

A solver is needed both to power a "check my answer" / "give me a hint" UI
feature and, critically, as the uniqueness oracle used during generation
(§2.4). It must be fast enough to run many times per generated puzzle.

### 3.1 Recommended architecture: cage-candidate CSP + backtracking

This is the approach used by essentially all serious open-source
implementations surveyed (kenny, CanCan, chanioxaris/kenken-solver):

1. **Model as a CSP**: one variable per cell, domain `{1..N}` initially.
2. **Precompute per-cage candidate combinations**: for each cage, enumerate
   every combination of N values (with repetition allowed per §1.3, subject
   to the cage's own row/column layout ruling out same-row/col repeats
   within the cage) that satisfies the cage's operator/target. Store these
   as the cage's initial "solution list." For a k-cell cage, this is at most
   `C(N,k)` or `P(N,k)`-ish in size depending on whether order matters for
   that operator — cheap for the cage sizes used in practice (≤ 5–6 cells).
3. **Constraint propagation** (run to fixpoint before/interleaved with
   search):
   - **Row/column elimination**: when a cell is solved, remove that value
     from the domain of every other cell in its row and column (standard
     Latin-square propagation, identical to Sudoku).
   - **Naked singles**: if a cell's domain shrinks to one value, solve it.
   - **Hidden singles**: if a row/column has only one cell whose domain
     still contains a given value, that cell must take that value.
   - **Cage combination pruning**: remove any cage candidate-combination
     that is no longer consistent with the current cell domains (e.g. it
     requires a value no longer in some cell's domain, or it's
     inconsistent with a cell that's already solved to a different value).
     If a cage is reduced to exactly one remaining candidate combination,
     solve all its cells accordingly.
   - **Cage confinement** (a KenKen-specific analogue of Sudoku's "pointing
     pairs/triples"): if *every* remaining candidate combination for a cage
     places a particular digit only within a specific row-segment or
     column-segment of that cage (i.e. the digit is confined to cells of
     the cage that all share a row, or all share a column), then that digit
     can be eliminated from every *other* cell in that row/column outside
     the cage. This is one of the most powerful non-backtracking KenKen
     techniques and is what lets human solvers avoid guessing on most
     published puzzles.
   - **Preemptive/naked sets**: if k cells in a row/column collectively
     have domains covering only k distinct values, remove those values from
     every other cell in that row/column (generalization of naked
     pairs/triples).
4. **Backtracking search** when propagation stalls: pick an unsolved
   variable (cell or cage-combination choice — either granularity works;
   picking whichever cage has the fewest remaining candidate combinations
   is a good move-ordering heuristic, i.e. a form of **minimum remaining
   values (MRV)**), try each remaining option, re-run propagation, recurse,
   and backtrack on contradiction (an empty domain anywhere, or a cage with
   zero remaining valid combinations).

### 3.2 Performance data point

A CSP comparison (chanioxaris/kenken-solver, see §5) measured assignment
counts for different search strategies on the same puzzles:

| Grid | Plain backtracking | Backtracking + MRV | Forward checking | FC + MRV | Maintaining Arc Consistency (MAC) |
|------|--------------------:|--------------------:|------------------:|---------:|-----------------------------------:|
| 6×6  | 947 | (fewer) | (fewer) | (fewer) | 73 |
| 7×7  | 2,600 | (fewer) | (fewer) | (fewer) | 66 |

The exact intermediate columns weren't recoverable from the source, but the
headline finding is clear and expected: **plain backtracking is an order of
magnitude worse than backtracking with constraint propagation** (MAC-style
arc consistency, which is essentially "cage combination pruning + row/col
elimination to fixpoint before every guess," cut required assignments by
~90–97% in their measurements). Implication: don't ship plain backtracking;
always interleave propagation.

### 3.3 What makes 9×9 slow, and how to keep generation fast

- **Cage candidate explosion**: larger grids permit larger cages with more
  candidate combinations each (a 5-cell cage on a 9×9 grid has vastly more
  candidate value-combinations than the same size cage on a 4×4 grid).
  Bound this by capping max cage size more conservatively as N grows (see
  the difficulty table in §4 — cap around 4–5 cells even at 9×9 for
  reasonable generation latency).
- **Latin square space is much larger**: order-9 Latin squares are
  astronomically numerous, which is good for variety but means naive
  backtracking fill can occasionally be slow on adversarial cell orderings;
  randomizing candidate order per cell (as recommended in §2.1) keeps this
  fast in practice (order-9 backtracking fill is still sub-millisecond to
  low-millisecond scale on modern hardware).
- **Uniqueness verification is the dominant cost**: the solver must run to
  completion (or find a 2nd solution) for every candidate puzzle, and
  poorly-pruned puzzles can force deep backtracking during *this* check.
  Mitigations:
  - Always run full constraint propagation (§3.1) before falling back to
    search, and use MRV-style cage ordering — this is what separates the
    947-assignment vs 73-assignment results above.
  - Cap the uniqueness-solver's search with a node/time budget; if it's
    taking too long, treat as "probably not uniquely/efficiently solvable,
    regenerate" rather than letting one pathological puzzle stall the whole
    generation pipeline.
  - Generate cages with a size/shape distribution that keeps candidate
    counts per cage small (a handful of 2-cell and 3-cell cages resolve very
    fast); avoid many large (5+) cages at once, especially at 8×8/9×9.
  - Because generation = (build Latin square) + (partition + assign,
    cheap) + (solve-and-count, the expensive part) run in a retry loop, the
    practical way to keep *total* generation under ~1–2 seconds is to keep
    each individual solve-and-count fast (bounded, well-propagated) rather
    than trying to guarantee success on the first attempt — a handful of
    sub-100ms failed attempts before landing a unique puzzle is a
    perfectly fine generation strategy.

---

## 4. Difficulty rating

### 4.1 What actually drives perceived difficulty

Across sources (KenKen.com's own difficulty framing, generator READMEs, and
solver-technique discussions), the recurring factors are:

1. **Grid size (N)** — the single biggest lever. Larger N means more cells,
   more simultaneous constraints to track, and (per §3.3) larger solver
   search spaces.
2. **Cage size distribution** — more/larger cages (3–5+ cells) require
   juggling bigger candidate-combination sets; small (1–2 cell) cages are
   nearly free information.
3. **Freebie (1-cell cage) ratio** — freebies are literally given digits;
   more of them makes a puzzle strictly easier (this is explicitly called
   out by CanCan's authors as something to cap).
4. **Operator mix** — subtraction/division cages (especially 2-cell ones
   with few legal value pairs) can be very constraining and easy, *or*, when
   combined with ambiguity from other cages, can be genuinely tricky;
   addition/multiplication on larger cages tends to open up more candidate
   combinations and is generally what makes higher grid sizes feel hard.
   Practically: a higher proportion of `−`/`÷` cages relative to `+`/`×`
   tends to *reduce* difficulty (tighter constraints, fewer candidates per
   cage), which is somewhat counter-intuitive but falls out directly from
   candidate-combination counting.
5. **Number of cages** — fewer, larger cages generally raise difficulty
   (more combinations to track per cage); more, smaller cages lower it.
6. **Solver effort required** — the most *direct* and reliable difficulty
   signal, and the one a generator should ultimately calibrate against:
   how much backtracking search (beyond pure constraint propagation) the
   solver from §3 needs to finish the puzzle. A puzzle solvable by
   propagation alone (naked/hidden singles, cage pruning, cage confinement,
   preemptive sets) with zero guesses is "easy/medium" no matter its size;
   one that requires deep or repeated backtracking is "hard/expert."

### 4.2 Concrete scoring scheme

Define a **solver-effort score** as the primary difficulty signal, computed
by running the §3 solver instrumented to count:

- `P` = number of propagation-only deductions used (free, roughly difficulty-neutral)
- `B` = number of backtracking guesses (branch points) needed
- `D` = maximum backtracking depth reached

```
effort = B * 3 + D * 2
```
(weights are a reasonable starting point; tune against real playtesting —
the key property to preserve is that puzzles solvable by propagation alone
score near 0, and effort grows roughly with both breadth and depth of
required search.)

Combine `effort` with the structural generation parameters (grid size,
max cage size, freebie count, allowed operators) to define named tiers.
Recommended defaults per grid size:

| Grid (N) | Tier | Max cage size | Freebie count (of total cages) | Allowed ops | Target `effort` |
|---|---|---|---|---|---|
| 3 | Easy | 2 | 1–2 | `+`, `×` only | 0 |
| 4 | Easy | 2 | 1–2 | `+`, `×`, `−` | 0 |
| 4 | Medium | 3 | 0–1 | all 4 | 0–3 |
| 4 | Hard | 3 | 0 | all 4, bias toward `−`/`÷` avoided (favor `+`/`×` on 3-cell cages) | 4–10 |
| 5 | Easy | 3 | 1–2 | `+`, `×`, `−` | 0 |
| 5 | Medium | 3 | 0–1 | all 4 | 0–5 |
| 5 | Hard | 4 | 0 | all 4 | 6–15 |
| 6 | Medium | 3 | 0–1 | all 4 | 0–6 |
| 6 | Hard | 4 | 0 | all 4 | 7–18 |
| 6 | Expert | 4–5 | 0 | all 4, cage-size skewed larger | 19+ |
| 7 | Hard | 4 | 0 | all 4 | 0–20 |
| 7 | Expert | 5 | 0 | all 4, cage-size skewed larger | 21+ |
| 8 | Hard | 4 | 0 | all 4 | 0–25 |
| 8 | Expert | 5 | 0 | all 4, cage-size skewed larger | 26+ |
| 9 | Hard | 4 | 0 | all 4 | 0–30 |
| 9 | Expert | 5 | 0 | all 4, cage-size skewed larger | 31+ |

Notes on the table:

- "Freebie count" is a hard cap enforced at the cage-generation step
  (§2.2/§2.3), not just a bias — reject/re-partition if exceeded.
- Below N=4, `−`/`÷` are of limited value (a 3×3 grid only has values 1–3,
  so division cages are nearly always trivial `2÷` on `{1,2}` or `{2,... }`
  pairs) — 3×3 "Easy" is really the only sensible tier for that size; don't
  bother offering a 3×3 "Hard."
- At N ≥ 6, allow (don't require) max cage size to creep up to 5 for
  Expert — this is the main lever left once operator mix and freebie count
  are already maxed out toward difficulty, per §3.3's warning that large
  cages are also the main generation-latency cost, so bound it there.
  Push cage-size distribution weight toward 3–4 cells generally, keeping a
  regeneration budget (§2.4/§3.3) so occasional large 5-cell cages don't
  blow the generation time budget.
- Tiers deliberately overlap in `effort` range in a soft way in this table
  (e.g. Hard's floor is Medium's ceiling) — treat the table as a starting
  point to bucket a continuous `effort` score, and tune the exact cutoffs
  against real solve-time/playtest data rather than treating these numbers
  as fixed truth.

---

## 5. Sources

- [Wikipedia — KenKen](https://en.wikipedia.org/wiki/KenKen) — general
  encyclopedia article; used for core rules (Latin square constraint,
  cage/operator definitions, standard 2-cell restriction on
  subtraction/division, digit-repeat-within-cage rule, single-cell freebie
  behavior, and Miyamoto/2004 history). High trust for the rules baseline;
  cross-checked against the official site below.
- [KenKenPuzzle.com FAQ](https://www.kenkenpuzzle.com/faq) — the official
  KenKen publisher's FAQ. Used to directly confirm the digit-repeat-within-
  cage rule ("a number may be repeated within a cage as long as it is not
  repeated within the same row or column") and that puzzles are generated
  and uniqueness-checked by an internal tool ("the Kenerator"). Highest
  trust for rules (it's the trademark holder's own site).
- [KenKenPuzzle.com — How To for Experts](https://www.kenkenpuzzle.com/howto_hard) —
  official worked solving-technique examples (cage combination narrowing,
  row/column total deduction). High trust, official source, but example-based
  rather than a formal spec.
- [KenKenPuzzle.com — NO-OP samples](https://www.kenkenpuzzle.com/noopsamples) /
  related search results on the NO-OP variant (mathdoku.com, Cornell math
  circle lecture notes) — used for §1.5's description of the operator-hidden
  variant and the "3+ cell cages must be +/×" simplifying convention.
  Medium-high trust (official site plus an academic lecture-notes page).
- [Cornell — "Variations on KenKen" lecture notes](https://pi.math.cornell.edu/~mec/KenKen/Lecture_2.html) —
  academic (Cornell Math Circle) treatment of KenKen variants. Medium trust,
  used only for corroborating the no-op variant and noting other minor
  variants (restricted digit sets) exist but aren't standard.
- [GitHub — wpm/CanCan](https://github.com/wpm/CanCan) (and its
  [README](https://raw.githubusercontent.com/wpm/CanCan/master/README.md)) —
  open-source KenKen solver/generator explicitly modeled on Peter Norvig's
  Sudoku solver. Used for the cage-size-distribution generation parameters
  (example distribution `{1:5%, 2:35%, 3:35%, 4:20%, 5:5%}`), the
  single-cell-cage proportion knob, and the generate → solve-and-count →
  discard-if-not-unique pipeline description. Medium-high trust
  (working, published open-source implementation) though the README is
  terse about some internals.
- [GitHub — camsteffen/kenny](https://github.com/camsteffen/kenny) (and its
  README) — open-source Rust KenKen solver/generator. Used for the
  eight-rule constraint-propagation description in §3.1 (row/col
  elimination, single-remaining-cage-solution, hidden singles, cage
  combination pruning, cage confinement/"collective constraint,"
  preemptive/naked sets, cage-vector intersection, domain-conflict pruning)
  and for confirming backtracking-on-stall as the standard fallback and
  that multi-solution puzzles are discarded. Medium-high trust
  (working, published open-source implementation with an explicit,
  well-documented rule list — this was the single best source for solver
  technique names/definitions).
- [GitHub — chanioxaris/kenken-solver](https://github.com/chanioxaris/kenken-solver) —
  open-source Python KenKen solver framed explicitly as a CSP, comparing
  plain backtracking, MRV, forward checking, FC+MRV, and MAC. Used for the
  §3.2 performance comparison table (947 vs 73 assignments on 6×6; 2,600 vs
  66 on 7×7) demonstrating the value of constraint propagation over plain
  search. Medium trust (small student/personal project, but the
  methodology — a direct empirical comparison — is sound and the numbers
  are internally consistent).
- Web search aggregation on Latin square generation methods (Rosetta Code
  "Random Latin squares," and academic papers on uniform Latin square
  sampling incl. Jacobson–Matthews-style methods) — used for §2.1's
  discussion of cyclic-permutation vs backtracking-fill generation and the
  non-uniformity caveat for the cyclic method. Medium trust (search-result
  synthesis rather than a single authoritative fetch — the specific claim
  "cyclic-permutation sampling is not uniform over all Latin squares" is
  mathematically well-established and safe to rely on even though the
  underlying academic PDFs were not individually fetched and read in full).
- General web-search synthesis on KenKen difficulty framing by grid size
  (various KenKen-adjacent puzzle sites, e.g. classivolearn.org,
  playbrain.games, thepuzzlelabs.com) — used only as soft corroboration
  that "difficulty broadly tracks grid size, with subtraction appearing at
  4×4+ and all four operators plus multi-cell cages at 5×5+." **Low trust**
  (SEO/content-mill puzzle sites, not authoritative) — the concrete
  difficulty scheme in §4.2 is this document's own proposal, informed by
  but not copied from these sources, and should be validated against real
  playtesting rather than treated as externally verified.
- Local verification scripts (exhaustive enumeration of all 576 order-4
  Latin squares to check the §1.6 worked example for uniqueness) — not a
  web source, but the actual proof of that section's central claim. Highest
  trust (exhaustive computer search, not sampling or hand-checking).

### Flagged as unverified / not independently confirmed

- The exact intermediate columns of the chanioxaris backtracking/MRV/FC
  table (§3.2) beyond the "plain BT" and "MAC" extremes could not be
  recovered cleanly from the fetched page; only the two endpoints are
  reported with confidence.
- Grokipedia's KenKen page and the Penny Dell "How to Solve KenKen" PDF were
  attempted but were unreachable (403 / DNS failure respectively) in this
  research session and are **not** used as sources above, despite appearing
  in search results.
- The precise weighting formula in §4.2 (`effort = B*3 + D*2`) and the exact
  numeric `effort` thresholds per tier in the §4.2 table are this document's
  own proposed scheme, not sourced from any generator's published
  methodology — no source surveyed disclosed a concrete, reusable difficulty
  formula. Treat the table as a well-reasoned starting point requiring
  calibration, not a verified industry standard.
