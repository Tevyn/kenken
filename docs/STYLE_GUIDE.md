# Style guide

The visual and interaction rules for the KenKen app. Written to be implemented
from and to be argued with: every rule states what it is, and the non-obvious
ones state why.

**Posture: casual-polished.** A consumer puzzle app. Visible state, legible
controls, generous whitespace, one accent colour, no theming beyond light and
dark. Not an enthusiast tool — we buy discoverability with screen space rather
than putting every mode on screen at once.

**The game is calm and untimed.** No timer, no score, no mistake limit. Live
error checking and the explain-first hint system exist to teach; a fail state
would fight them. Nothing in the UI may imply the player is being graded.

---

## 1. Layout

### 1.1 The three zones

The app is a full-height column of three zones, in this order:

| Zone         | Contents                                  | Sizing                                  |
| ------------ | ----------------------------------------- | --------------------------------------- |
| **Header**   | Wordmark, puzzle meta, new game, settings | Fixed height, hugs the top              |
| **Play**     | The board, centred                        | `flex: 1` — absorbs all leftover height |
| **Controls** | Action row, digit pad                     | Fixed height, anchored to the bottom    |

The controls are **anchored to the bottom of the viewport**, in the thumb zone.
The play zone takes whatever height is left and centres the board inside it.
Nothing may leave a large unclaimed band at the bottom of the screen — the
top-aligned layout left ~290px of dead space on a 4×4 at 375×812, which put the
digit pad in the middle of the screen and out of thumb reach.

The shell's height comes from `min-height: 100%` against `#root`, **not
`100svh`**. Where the visual and layout viewports disagree — an embedded pane,
a desktop browser mid-zoom — `svh` resolves to the smaller of the two and the
column stops short, stranding the controls mid-page with exactly the dead space
this shell exists to remove.

### 1.2 The board fills its column

The board is the subject of the page. It must never be visually out-massed by
the controls beneath it.

- The board is sized by a **board budget**, not by a cell cap:
  `--board: min(100cqw, 30rem)`, `--cell: calc(var(--board) / var(--size))`.
- A cell may grow to at most `84px`, so a 3×3 does not become a billboard, and
  may shrink to at most `26px`, below which the grid stops being usable.
- The board's **border-box** width — cells plus the heavy outer border — must
  fit the content column. Sizing the border outside the budget made a 9×9
  356px wide in a 351px column and produced a horizontal scrollbar under the
  keypad. Set `box-sizing: border-box` on the grid and include the border in
  the budget.

### 1.3 The digit pad is always exactly one row

`size` digits **plus the Erase key**, one row, no wrapping, at any board size on
any phone. A 9×9 wrapping to 6 + 3 reads as a broken layout.

Erase is the row's last key because that is where the hand already is while
entering values — it is the digit you press to take a digit back, and it belongs
with them rather than up in the action row with Undo and Hint. So the row is
`size + 1` keys wide: ten across at 9×9.

Achieve it with `grid-template-columns: repeat(var(--keys), minmax(0, 1fr))`
and let key **width** shrink freely. The 44px touch-target floor is met by
**height**, not width: a 34px × 56px key is a legal target and a 10-across row
is comfortable on a 375px screen.

`--keys` is computed in JS and set on the element, never derived in CSS. The
integer argument to `repeat()` does not accept `calc()` in every engine, so
`repeat(calc(var(--size) + 1), ...)` is not safe to rely on — the count is known
where the row is rendered, so the arithmetic happens there.

### 1.4 Reserved slots

Any element that appears and disappears **inside the layout flow** reserves its
space. The hint banner is the case this rule was written for: it sat between the
board and the controls, collapsed to `0` while idle, and an arriving hint shoved
the entire keypad down under the player's thumb at the exact moment they started
reading.

That banner is gone. The hint now arrives in a popover, floating over the
action row instead of displacing it — which is the other way to satisfy the
rule, and the better one where it is available: an element that is not in the
flow cannot push anything. What stays forbidden is
the third option, a flow element that grows from nothing.

### 1.5 Spacing scale

4px base. Use only these steps; do not invent intermediate values.

| Token    | Value | Use                                     |
| -------- | ----- | --------------------------------------- |
| `--sp-1` | 4px   | Icon-to-label, inside a key             |
| `--sp-2` | 8px   | Between sibling keys, chips             |
| `--sp-3` | 12px  | Inside a panel, list rows               |
| `--sp-4` | 16px  | Page gutter, panel padding              |
| `--sp-5` | 24px  | Between groups (action row / digit pad) |
| `--sp-6` | 32px  | Between zones                           |

The current stylesheet uses 4/8/10/12/14/18/20 with no system. Every one of
those must resolve to a step above.

### 1.6 Radius scale

Three tiers only.

| Token    | Value | Applies to                          |
| -------- | ----- | ----------------------------------- |
| `--r-sm` | 6px   | Inline chips, marks, small controls |
| `--r-md` | 10px  | Keys, buttons, triggers             |
| `--r-lg` | 14px  | Large cards                         |

The board is **square-cornered** and takes no radius. A rounded grid reads as a
card that contains a puzzle; the board is the puzzle.

**Popover panels are square-cornered too, for the same reason** (§3). Nothing
in the app currently claims `--r-lg`; it stays in the scale as the step a card
would take, not as a licence to round a panel.

---

## 2. Colour

### 2.1 The rule

**One hue carries every interactive and player-owned meaning: blue.** It is
navy in light mode and light blue in dark mode — the same token, two
renderings, so every rule that references `--accent` is written once.

The accent means exactly one thing: _this is interactive, or this is yours_. It
is never decorative and never used to draw the eye to something the player did
not ask about. It is applied as **ink** — the colour of the glyph or the word
itself — and as a fill only for board state and state badges (§4.1).

Everything else is neutral grey. Two colours break the monochrome, and both are
status rather than accent: **red is "this is wrong", green is "this is right".**

Red carries more than one claim, deliberately. It is a proven contradiction — a
repeated digit, a cage that can no longer be completed — _and_ an entry the
correctness check found disagrees with the solution. The two are reached
differently and are not the same size of claim, but they are the same news to a
player, so they get one hue and are told apart by shape (§5.1), never by a
second colour.

Green is the win state, and now only that. It used to ring a cell the check
confirmed as well; that is gone, because a check has no business congratulating
the player on work they did themselves. A digit the hint panel placed is _not_
green either: it is an ordinary entry made on the player's behalf, so it takes
the accent like everything else they own.

### 2.2 Tokens

**Light**

```
--bg               #f4f5f7   neutral off-white page
--surface          #ffffff   board cells, keys, panels
--surface-sunken   #eceef1   recessed wells (must differ from --bg to exist)
--text             #1c2128
--text-muted       #5c6470
--border           #d5d9e0   hairlines, resting key edges
--border-strong    #aeb5c0
--structure        #1c2128   heavy grid: cage borders, board outline
--accent           #2f5596   lighter navy   (7.3:1 on white)
--accent-soft      #e3eaf6   "this is the current choice", selection fill
--accent-contrast  #ffffff
--danger           #c0362c
--success          #1f7a45
```

**Dark**

```
--bg               #121417   neutral off-black page
--surface          #1b1e23   steps UP from --bg
--surface-sunken   #0d0f12
--text             #dde1e7
--text-muted       #949ba6
--border           #2b2f36
--border-strong    #464c56
--structure        #6b7480   grey, NOT near-white  (3.5:1 on --surface)
--accent           #8ab4f0   light blue
--accent-soft      #1e2b40
--accent-contrast  #101318
--danger           #f08a80
--success          #5fd08a
```

### 2.3 Dark mode is a translation, not an inversion

Two rules make dark mode behave:

1. **The board surface always steps up from the page**, in both themes. The
   play area is a lit surface the player works on; it is never darker than the
   page around it.
2. **Structure is grey in dark, near-black in light** — it is never the
   brightest thing on screen. Painting `--structure` at `#f4f3f8` turned a 9×9
   into a glowing white wireframe with the cells reading as holes.

### 2.4 Contrast floors

Non-negotiable, and the reason several tokens above are darker or lighter than
they look like they need to be:

- Body and value text: **4.5:1** against its own background.
- Cage labels, pencil marks, muted help text: **4.5:1**. These are small; they
  do not get the large-text exemption.
- Focus rings, switch tracks, icon strokes, and **cage borders and the board
  outline**: **3:1**. These carry meaning — the cage structure _is_ the puzzle.
- **Cell dividers inside a cage are exempt.** They subdivide, they do not
  inform: the grid is legible from the cage structure and the digits alone, and
  pushing a hairline to 3:1 makes it compete with the cage borders it is
  supposed to sit beneath. They take `--border-strong` and are allowed to be
  quiet. This is the one deliberate exception in the document.
- Disabled controls are exempt from the text floor but must still clear **3:1**
  on their glyph, because they still have to be _identifiable_.

### 2.5 How the token layer is built

Two tiers, in `src/index.css`, and the split is what makes a palette swap cheap.

**Tier 1 — anchors.** The only place a hex literal is allowed. One line per
role, both themes on that line: `--accent: light-dark(#2f5596, #8ab4f0)`.
Roughly fifteen lines, and they are the entire swap surface.

**Tier 2 — derived.** No colour of its own. Every value is mixed out of an
anchor: `--cell-selected: color-mix(in oklab, var(--accent) 30%, var(--surface))`.
Because the anchors are themselves light/dark pairs, **one derivation rule
gives the correct polarity in both themes** — an accent mixed into `--surface`
is a pale tint on white and a muted shade on near-black, with no second rule to
keep in sync.

Consequences worth stating:

- Changing the accent hue is a one-line edit. Selection, cage highlight, row
  and column bands, soft states, and every hint fill re-derive from it.
- A colour that needs its own `@media (prefers-color-scheme: dark)` override is
  an anchor that was written wrong. Exactly one declaration legitimately lives
  in that block — `--hint-dim-opacity`, because an opacity is a number and
  `light-dark()` takes colours only. A shadow is not a colour either, but its
  _colour slots_ are, so `light-dark()` still reaches inside one.
- **The theme setting is this architecture, exposed.** `light-dark()` resolves
  against `color-scheme`, so `:root[data-theme='dark'] { color-scheme: dark }`
  re-themes the app without redeclaring a single token, and `system` is the
  attribute's absence. See `Theme` in `src/game/preferences.ts`.
- Any three-state override (a manual choice that must beat the OS in **both**
  directions) guards the media query with `:root:not([data-theme='light'])` and
  repeats itself under `:root[data-theme='dark']`.
- Component stylesheets consume tier-2 names only, and never a literal.

---

## 3. Elevation

Three levels. Elevation is how far something is from the page, and it is
signalled differently per theme because a black shadow on a black page is
invisible.

| Level                           | Light                                                  | Dark                                           |
| ------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| **Flat** — the page             | `--bg`, no shadow                                      | `--bg`, no shadow                              |
| **Raised** — board, keys, cards | `--surface` + 1px `--border`                           | `--surface` (lighter than bg) + 1px `--border` |
| **Floating** — popovers         | `--surface` + 1px `--cell-border` + `--shadow-popover` | Same, with every shadow layer pushed harder    |

A "recessed" treatment must use `--surface-sunken`. Painting a well in `--bg`
paints nothing — the action row's strip did exactly that in both themes and was
invisible.

**A popover panel is the board, moved.** Same surface, same square corners, and
the board's own line around it. It is not a card with a look of its own: the
page has exactly one object in it, and a panel is another instance of that
object rather than a second visual language. What this replaces — a rounded,
tinted surface with a hairline border and a lit top edge — was that second
language, and it made a menu read as chrome floating over the puzzle instead of
as part of it.

**The line is the gridline, not the frame.** 1px in `--cell-border` — what
Cell.css draws between two cells — and not `--frame` in `--cell-border-heavy`,
which the panel used to take. `--frame` resolves to ~4px at 30rem: correct
around a whole grid, a slab around a menu, with the content reading as trapped
inside it. A panel is still the board; it wears the board's quieter line.

**Depth is the shadow's job, and only the shadow's.** There is no scrim. Dimming
the page is a fine way to say _modal_ and a poor way to say _floating_ — it
takes the puzzle away from a player who is mid-way through reading it, and every
panel here opens over a board that is still the subject. `--shadow-popover` does
the separating in both themes: three layers (contact, lift, ambient), pushed
harder in dark, where black over a near-black page separates far less per unit
of alpha and there is no heavy frame to fall back on.

A transparent press shield still spans the page under an open panel. It paints
nothing; it exists so a press aimed outside the panel closes it and stops there,
rather than also selecting the cell under the finger.

Panels are **centred**, never hung off their trigger. All three — New game,
Settings and Hint — are wide enough that anchoring one to a corner left it
lopsided, and centring puts the choice where the player is already looking.

**A panel opened by a trigger carries a close button**, in the same corner every
time, and it is the last stop in the panel's Tab cycle rather than the first —
entry focus belongs on the content, not on the way out. Escape and a press
outside do the same job, but neither is visible, and a player using a pointer
should not have to guess. It stays small: an escape hatch is never the loudest
thing on the panel (§10.3). A panel with no trigger is not always a popover and
does not get one automatically — the solved dialog offers the move that follows
instead, and a dismiss button beside it would make leaving look like a decision.

---

## 4. Controls

### 4.1 The accent is ink, not chrome

**One rule, held everywhere: blue means touchable.** Every control is bare blue
ink on the page — a blue word or a blue glyph. No border, no fill, no surface.
Everything informational is grey or near-black: the wordmark, cage labels,
entered values, hint prose, panel headings, and the labels _under_ toolbar
icons.

Reading the screen is therefore a colour test rather than a shape test. That is
not decoration, it is what makes the rest of the layout possible — ten bare keys
fit one row on a 375px phone because a numeral needs room for its ink, where a
bordered key needs room for its box.

Shared implementation: `.kk-control` in `src/index.css`, plus
`.kk-control--stack` and `.kk-control__label` for the glyph-over-label form. A
control that does not use them is a bug.

**Every icon control wears the same stack**, wherever it sits: the four toolbar
actions, the three header controls, the eleven choices in the New Game wizard
and the three theme options are all the same kind of thing, so New game, Restart
and Settings are glyph-over-label at 56px exactly like Undo and Redo, and a size
tile is glyph-over-label exactly like both. A control styled as its own species
is the bug this rule exists to prevent.

There are exactly two things in the app that are not this stack, and both are
deliberate: the digit keys, which are bare numerals because the numeral _is_ the
glyph, and the Erase key beside them (§4.2). Everything else that can be pressed
wears a glyph over a grey label.

**Where an action goes** follows what it acts on. The keypad's row edits the
grid you are solving — a cell, a digit, a step. The header's three act on the
puzzle itself: start a different one, wind this one back to empty, or change how
the app behaves. Restart is in the header for that reason, not on the keypad.

**Unavailable is `aria-disabled` when the press is what disables it.** Restart
and the New Game trigger both take focus into a commit that makes them
unavailable; the real `disabled` attribute would drop focus on `<body>` in that
same commit, so they stay focusable and the handler guards instead. Undo and
Redo, which nothing focuses on the way in, use the real attribute.

**A glyph may carry information, not just identity.** The wizard's size tiles
draw the actual n×n grid, so the picture answers the question the button is
asking. Where a glyph is a _picture of the product_ it comes from real data and
must not lie about it: a size tile draws n-1 dividers because the board has n
columns, never a stylised grid that merely suggests one. Nothing informational
is computed during a render.

**But a picture of the product is not automatically the better glyph**, and the
difficulty tiles are where that broke down. They used to draw the real baked
cage layout for the chosen size and difficulty — honest data pointed the wrong
way. This generator builds harder puzzles out of _fewer, larger_ cages (9/7/6/5
cages at 4×4; 42/35/29/24 at 9×9), so the tile emptied out as the word beneath
it got scarier and the row read as a ramp running backwards. Above 6×6 it
carried nothing at all: 42 cages in a 32px box is a 1.73px stroke on a 2.67px
cell pitch, which is woven texture, not a grid divided into cages.

**So they now draw a legend rather than a measurement.** A fixed 4×4 board
carries one tinted cage that grows 1 → 2 → 3 → 4 cells across the four
difficulties, and it ignores the size chosen in step one — the heading above the
tiles is the only place that size appears, which is why it is tested and not
merely written. The ordering and the endpoints stay true of the engine: easy is
the only difficulty thick with one-cell cages and holds nothing bigger than
three, while hard and expert contain no single-cell cage at all and hold 47
cages of four or more between them. The 1-2-3-4 ramp itself is drawn for
legibility, not measured, and `DifficultyIcon` says so at the definition.
**Where a glyph is a legend, label it one where it is defined**, so the next
reader does not mistake it for data — and where it is data, it must survive
every size it will be asked to draw.

|                        | Treatment                                                                         |
| ---------------------- | --------------------------------------------------------------------------------- |
| **Rest**               | `--accent` ink, transparent background, no border                                 |
| **Hover / press**      | `--accent-soft` fill — the one _transient_ fill, gone the moment the finger lifts |
| **Disabled**           | `--text-muted` ink, nothing else changes                                          |
| **Current in a group** | 2px underline at 5px offset, via `aria-current` / `aria-pressed`                  |

This replaces an earlier three-level hierarchy built on fills. There is no
"primary button": the commit press in the New Game wizard is blue like
everything else, because a wizard's last step is unambiguous from context.

**A fill now means exactly two things**, and never a control at rest:

1. The board's own state — selection, row/column/cage highlights, hint roles.
2. A state badge (§4.2).

### 4.2 State is spelled out, not tinted

A tint cannot be read. It requires knowing what the untinted version looked
like, which a first-time player does not.

- **A persistent toggle carries a literal `OFF`/`ON` badge**, visible in both
  states, on the glyph's shoulder. Notes is the live case. `aria-pressed`
  carries the same fact for assistive tech.
- **A transient state renames the control**, where a control has one. Hint used
  to become **Apply** while an explained hint waited for a second press; that
  press is gone, and Hint now opens a panel and says nothing else. The rule
  stands for the next control that needs it — an `OFF` badge on something that
  is not a toggle would be nonsense.
- **Every icon action carries a visible text label**, and that label is the
  accessible name. No `aria-label` duplicating a glyph nobody can read, and no
  `title`, so nothing hovers.

**The Erase key is the one exception, and it is deliberate.** It sits on the
digit row (§1.3) as a bare eraser glyph with an `aria-label`. A label under it
would have to be matched by labels under the numerals beside it or it reads as
the odd key out, and either way it forces the whole row taller for one key. The
exception is bought by the glyph: an eraser on a digit pad is read without being
named. It does not generalise — an icon control **anywhere else** carries its
label, and a second unlabelled glyph is a bug, not a precedent.

Labels stay grey even when the glyph above them is blue: a label names the
control, it is not a second thing to press.

### 4.2.1 Disabled removes, never adds

A disabled control **removes** ink. It never gains chrome an enabled one lacks.

The pre-`.kk-control` action row had this exactly backwards — disabled Undo and
Redo rendered as filled, bordered boxes while enabled Erase and Notes rendered
as bare glyphs, so the dead buttons looked like the live ones.

### 4.3 Toggles

Two idioms, and a rule for which is which:

- **A mode the player flips constantly, mid-solve** → an icon button with
  `aria-pressed`, accent-filled when on. Pencil-mark mode.
- **A preference the player sets once** → a track-and-knob switch, in a
  settings panel with a label and help text. Auto-clear marks.

Never use one where the other belongs. A mode toggle in a popover is a
preference; a preference on the toolbar is a mode.

### 4.4 Touch targets

44 × 44px minimum for anything tappable, met by the _union_ of the control's
box — padding counts, and height alone may carry the floor when width is
constrained (§1.3).

---

## 5. The board

- **Cage borders and the board outline share `--structure`.** The outline is
  the heavier of the two so the board's boundary always reads as the strongest
  line on the grid.
- **Cell dividers are `--border`** — a hairline, visibly subordinate to cage
  structure. A KenKen grid has no boxes, so there is no third weight.
- **Every detail scales off `--cell`** — label size, border widths, mark size,
  ring thickness. This is already right and must stay: it is why the grid holds
  together from 3×3 to 9×9.
- **Cage labels** sit top-left of the anchor cell, `max(10px, --cell × 0.22)`,
  `--text-muted`, and must clear 4.5:1. Operator glyphs use the conventional
  forms: `+`, `−`, `×`, `÷`, and a bare number for a freebie.

### 5.1 Cell state, and what wins

A cell can be several things at once. These are additive layers, resolved by
channel so they never have to fight for one property:

| State                  | Channel | Treatment                                                                 |
| ---------------------- | ------- | ------------------------------------------------------------------------- |
| In selected row/column | Fill    | `--accent-soft` at lowest strength                                        |
| In selected cage       | Fill    | `--accent-soft`, one step stronger                                        |
| **Selected**           | Fill    | `--accent-soft`, full strength — always the strongest fill on the board   |
| Hint band              | Fill    | Accent, very low strength (only ever while dimmed)                        |
| Hint support           | Fill    | Accent, low strength                                                      |
| **Hint focus**         | Ring    | Accent ring, inset                                                        |
| **Error**              | Text    | `--danger` value, at the grid's ordinary weight                           |
| **Incorrect**          | Corner  | `--danger` flag in the top-right corner. Held until _that cell_ is edited |
| Placed by a hint       | Text    | `--accent` value. Gone on the player's next move                          |
| Hint dim               | Opacity | Everything not named by the hint drops to ~0.4                            |

Precedence: nothing has to win, because **no two rows in that table share a
channel.** A cell that is selected, wrong, and a hint's focus reads as all
three — accent fill, red digit, accent ring. Errors used to take the ring as
well, and a tint besides, so they had to be declared the winner of a contest
that no longer happens.

**A confirmed cell gets nothing.** There is no Correct row here any more. The
check used to ring one in `--success`, which was the app taking a bow for work
the player did; the only news a check has is what is wrong.

**An error is the digit, and nothing around it.** Two 3s in a row are already
visible as two 3s; the app's job is to point, not to alarm. A ring, a tint and a
bold red value said the same thing three times over one ordinary slip, and the
extra weight pulled the eye to the mistakes ahead of the cell the player is
actually working in. Recolouring the value alone lands the message on the
offending digit and nowhere else.

**Error and incorrect are claims of different sizes, and the shape is what
separates them.** A conflict is impossible under every solution; a rejected
entry is merely not _the_ answer. Both are `--danger`, so "wrong" means one
thing on this board, and the smaller claim takes the smaller mark. The two can
land on one cell at once, and the accessible name then says `conflict` — the
stronger of them.

**Incorrect is the one state with a channel to itself, and it needs one.** It
outlives the press that produced it, so it can still be on a cell the player has
since selected, or that a later hint has ringed — it cannot afford a channel
something else might want. The top-right corner is free (the cage label is
top-_left_) and nothing else on the board uses it. That also keeps the mark off
the digit, which stays in the player's own ink: the entry is theirs, and only
the verdict about it belongs to the app. A placed digit is safe in the text
channel for the reason it always was — it is by construction correct, so it
never has to argue with a red value it would otherwise collide with, and it says
"filled in for you" in the cell's accessible name rather than leaning on the
colour alone.

### 5.2 Why hints share the accent hue

Hints previously had their own teal family, on the reasoning that "the hint
points here" must never read as "you have this selected."

That separation is no longer needed, because a hint changes the _whole board_:
`dimRest` drops every uninvolved cell to 40% opacity. Nothing else in the app
does that, so hint mode is unmistakable from context before colour is even
considered. Within that mode, geometry separates the two meanings — **selection
is a fill, the hint's conclusion is a ring** — and the hint panel names the
conclusion in prose besides.

One hue, one meaning. If in practice the ring and the fill turn out to be
confusable on a real board, the fallback is to make the hint ring dashed rather
than to reintroduce a second hue.

---

## 6. Feedback and copy

- **The hint panel** is the app's voice: one short sentence, plain English, no
  technique names. It floats over the action row rather than sitting in the
  layout (§1.4), and focus moves onto the sentence as it arrives, which is what
  reads it aloud — a live region inside a dialog the reader has only just
  entered competes with the dialog's own announcement.
- **Errors are shown on the cells**, not narrated in a banner. The board's live
  region announces them for screen readers only.
- **Never punish.** No "wrong!", no counters, no red banners. An error is a red
  digit; that is the whole message.
- **Solving opens a panel, not a banner.** It says `Solved` / `Nice work.` and
  offers the one move that follows — New game, which opens the wizard rather
  than deciding a size for you. It dismisses like any other panel (Escape, or a
  press outside) and leaves the finished grid on screen. The banner it replaces
  pushed the keypad down at the moment the game ended and then never left.

### 6.1 Puzzle meta

The header carries one muted line under the wordmark — `9×9 Medium`. Grey,
13px, sentence case, understated. No separator between the two: they are one
answer, not a list. It answers "what am I playing", which nothing
on screen said before: neither the size nor the difficulty appeared anywhere
outside the New Game wizard.

It is deliberately _not_ a status strip. The game is untimed and unscored, so
this is the only state the header carries, and it must never grow into a row of
counters.

The visible text is split from the announced text — `9×9` reads aloud as "nine
times nine", so a `.kk-sr-only` sibling says "Playing 9 by 9, medium" instead.

---

## 7. Typography

One family: the `system-ui` stack.

| Role             | Size                       | Weight                             |
| ---------------- | -------------------------- | ---------------------------------- |
| Wordmark         | 20px                       | 600                                |
| Puzzle meta      | 13px                       | 500, `--text-muted`                |
| Panel heading    | 13px                       | 500, sentence case, `--text-muted` |
| Body / hint text | 15px                       | 400                                |
| Help text        | 13px                       | 400, `--text-muted`                |
| Key label        | 18px                       | 600                                |
| Cell value       | `--cell × 0.5`             | 500                                |
| Cage label       | `max(10px, --cell × 0.22)` | 600                                |
| Digit key        | `clamp(22px, …, 32px)`     | 500                                |

**A panel heading is the puzzle meta line**, to the pixel: the same grey, the
same 13px, the same sentence case. It used to be 700 uppercase at `0.08em`,
which made the word "Size" louder than the sizes underneath it. Section labels
inside a panel (the theme picker's legend) take the same line — the controls
carry the weight, the labels only name them.

**The digit keys are set as game digits.** The 4 on the keypad and the 4 it
writes into the board are the same numeral at the same weight, because they are
the same thing — which is also why the key carries no box: a numeral needs room
for its ink, not for a border (§4.1).

**The wizard's options are not.** They were briefly set as large digits, on the
same reasoning, but they are glyph-over-label tiles now (§4) — the tile draws
the grid you are choosing, so the type under it is the stack's grey label and
the picture carries the choice.

The wordmark drops from 30px. It was the largest text on the page and the least
useful information on it.

---

## 8. Motion

Restrained. Motion confirms an action; it never announces one.

- State transitions (press, toggle): `150ms ease`.
- Popover open and close: `180ms ease-out`.
- The board itself never animates. Values appear instantly.
- All of it collapses under `prefers-reduced-motion: reduce`.

---

## 9. Accessibility floors

These are not aspirations; a change that breaks one is a regression.

- Contrast per §2.4.
- **Colour is never the only channel.** Every state in §5.1 pairs colour with
  geometry, opacity, or text, and highlighted cells name their role in the
  accessible name (`", hint focus"`, `", hint context"`).
- Every control has an accessible name; stateful controls expose their state
  (`aria-pressed`, `aria-current`, `aria-disabled`).
- `:focus-visible` is a 3px `--accent` outline at `2px` offset, and it survives
  every cell state — including error and hint focus.
- The board is a `role="grid"` with `aria-rowindex` / `aria-colindex`, and its
  live region sits outside the grid.

---

## 10. Do-not list

Each of these is a bug that shipped.

1. Do not paint a recessed surface in `--bg`. It is invisible. Use `--surface-sunken`.
2. Do not give a disabled control chrome that its enabled sibling lacks.
3. Do not let a destructive or escape action be the loudest thing on screen.
4. Do not tint a control for a state it is not currently in.
5. Do not let a conditional element collapse to `0` height inside the layout flow.
6. Do not size a bordered box by its content box when it has to fit a column.
7. Do not let the accent appear more than once per zone at rest.
8. Do not invert dark mode. Translate it: surfaces still step up, structure stays grey.
