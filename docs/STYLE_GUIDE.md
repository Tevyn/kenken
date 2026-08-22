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

| Zone | Contents | Sizing |
|---|---|---|
| **Header** | Wordmark, puzzle meta, new game, settings | Fixed height, hugs the top |
| **Play** | The board, centred | `flex: 1` — absorbs all leftover height |
| **Controls** | Hint slot, action row, digit pad | Fixed height, anchored to the bottom |

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

`size` digits, one row, no wrapping, at any board size on any phone. A 9×9
wrapping to 6 + 3 reads as a broken layout.

Achieve it with `grid-template-columns: repeat(var(--size), minmax(0, 1fr))`
and let key **width** shrink freely. The 44px touch-target floor is met by
**height**, not width: a 32px × 48px key is a legal target and a 9-across row
is comfortable on a 375px screen.

### 1.4 Reserved slots

Any element that appears and disappears during play reserves its space.
Specifically the hint banner: it sits between the board and the controls and
must hold a `min-height` while idle. It previously collapsed to `0`, so an
arriving hint shoved the entire keypad down under the player's thumb at the
exact moment they were reading.

### 1.5 Spacing scale

4px base. Use only these steps; do not invent intermediate values.

| Token | Value | Use |
|---|---|---|
| `--sp-1` | 4px | Icon-to-label, inside a key |
| `--sp-2` | 8px | Between sibling keys, chips |
| `--sp-3` | 12px | Inside a panel, list rows |
| `--sp-4` | 16px | Page gutter, panel padding |
| `--sp-5` | 24px | Between groups (action row / digit pad) |
| `--sp-6` | 32px | Between zones |

The current stylesheet uses 4/8/10/12/14/18/20 with no system. Every one of
those must resolve to a step above.

### 1.6 Radius scale

Three tiers only.

| Token | Value | Applies to |
|---|---|---|
| `--r-sm` | 6px | Inline chips, marks, small controls |
| `--r-md` | 10px | Keys, buttons, triggers |
| `--r-lg` | 14px | Panels, popovers, the board |

---

## 2. Colour

### 2.1 The rule

**One hue carries every interactive and player-owned meaning: blue.** It is
navy in light mode and light blue in dark mode — the same token, two
renderings, so every rule that references `--accent` is written once.

The accent means exactly one thing: *this is interactive, or this is yours*. It
is never decorative, never used to draw the eye to something the player did not
ask about, and never applied to more than one element per zone at rest.

Everything else is neutral grey. Only two colours break the monochrome, and
both are status, not accent: red for a proven error, green for the win state.

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
--accent-hover     #26467d
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
--accent-hover     #a3c5f5
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
  outline**: **3:1**. These carry meaning — the cage structure *is* the puzzle.
- **Cell dividers inside a cage are exempt.** They subdivide, they do not
  inform: the grid is legible from the cage structure and the digits alone, and
  pushing a hairline to 3:1 makes it compete with the cage borders it is
  supposed to sit beneath. They take `--border-strong` and are allowed to be
  quiet. This is the one deliberate exception in the document.
- Disabled controls are exempt from the text floor but must still clear **3:1**
  on their glyph, because they still have to be *identifiable*.

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
  *colour slots* are, so `light-dark()` still reaches inside one.
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

| Level | Light | Dark |
|---|---|---|
| **Flat** — the page | `--bg`, no shadow | `--bg`, no shadow |
| **Raised** — board, keys, cards | `--surface` + 1px `--border` | `--surface` (lighter than bg) + 1px `--border` |
| **Floating** — popovers | `--surface` + cast shadow | Lighter surface + shadow + 1px top highlight |

A "recessed" treatment must use `--surface-sunken`. Painting a well in `--bg`
paints nothing — the action row's strip did exactly that in both themes and was
invisible.

---

## 4. Controls

### 4.1 Button hierarchy

Exactly three levels, and **at most one accent-filled button is visible at rest
anywhere in the app.**

| Level | Treatment | Use |
|---|---|---|
| **Primary** | Accent fill, `--accent-contrast` label | The single action that commits what the player is doing. Inside a popover: *Start game*. |
| **Neutral** | `--surface` + `--border`, `--text` label | Everything else with a resting affordance: digit keys, icon actions, header triggers. |
| **Quiet** | Transparent, `--text-muted`, no border | Dismiss, close, tertiary links. |

Consequences for what exists today:

- **`New game` demotes to neutral.** A saturated pill is the brightest thing on
  screen, and the action it advertises is *discard the puzzle you are solving*.
  Escape hatches are quiet; state is loud.
- **The hint button is neutral at rest.** It was permanently tinted, so it
  glowed before there was any hint to give. It takes the accent only when
  **armed** — a hint is explained on the board and the next press applies it.
  That is the one moment it is the primary action.

### 4.2 Disabled means less, never more

A disabled control **removes** contrast. It never gains chrome a neutral
control does not have.

Today's action row has this exactly backwards: disabled Undo and Redo render as
filled, bordered boxes while enabled Erase and Pencil render as bare glyphs on
nothing. The disabled buttons look like the real buttons.

The fix is two rules:

- Every enabled icon action carries the neutral resting treatment — a surface
  and a border — so it reads as pressable. No bare glyphs.
- Disabled drops to `--text-muted` on `--surface` with `--border` unchanged,
  plus `cursor: not-allowed`. Same silhouette, less contrast.

### 4.3 Toggles

Two idioms, and a rule for which is which:

- **A mode the player flips constantly, mid-solve** → an icon button with
  `aria-pressed`, accent-filled when on. Pencil-mark mode.
- **A preference the player sets once** → a track-and-knob switch, in a
  settings panel with a label and help text. Auto-clear marks.

Never use one where the other belongs. A mode toggle in a popover is a
preference; a preference on the toolbar is a mode.

### 4.4 Touch targets

44 × 44px minimum for anything tappable, met by the *union* of the control's
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

| State | Channel | Treatment |
|---|---|---|
| In selected row/column | Fill | `--accent-soft` at lowest strength |
| In selected cage | Fill | `--accent-soft`, one step stronger |
| **Selected** | Fill | `--accent-soft`, full strength — always the strongest fill on the board |
| Hint band | Fill | Accent, very low strength (only ever while dimmed) |
| Hint support | Fill | Accent, low strength |
| **Hint focus** | Ring | Accent ring, inset |
| **Error** | Ring + text | `--danger` ring, `--danger` value at weight 700 |
| Hint dim | Opacity | Everything not named by the hint drops to ~0.4 |

Precedence: **the error ring always wins the ring channel.** Fill and ring are
different channels, so a cell that is selected, wrong, and a hint's focus still
reads as all three.

### 5.2 Why hints share the accent hue

Hints previously had their own teal family, on the reasoning that "the hint
points here" must never read as "you have this selected."

That separation is no longer needed, because a hint changes the *whole board*:
`dimRest` drops every uninvolved cell to 40% opacity. Nothing else in the app
does that, so hint mode is unmistakable from context before colour is even
considered. Within that mode, geometry separates the two meanings — **selection
is a fill, the hint's conclusion is a ring** — and the hint banner names the
conclusion in prose besides.

One hue, one meaning. If in practice the ring and the fill turn out to be
confusable on a real board, the fallback is to make the hint ring dashed rather
than to reintroduce a second hue.

---

## 6. Feedback and copy

- **The hint banner** is the app's voice: full sentences, plain English,
  explain before applying. It reserves its slot (§1.4) and its text lives in an
  `aria-live="polite"` region.
- **Errors are shown on the cells**, not narrated in a banner. The board's live
  region announces them for screen readers only.
- **Never punish.** No "wrong!", no counters, no red banners. An error is a red
  ring and a red digit; that is the whole message.

### 6.1 Puzzle meta

The header carries a single muted line beside the wordmark — `9×9 · Medium` —
so the player can always see what they are playing. Nothing on screen currently
says this at all.

*(This replaces the four-column status strip, which we cut. If even one line
feels like too much chrome, the alternative is to move it into the New game
popover as the current-state readout and let the board speak for itself.)*

---

## 7. Typography

One family: the `system-ui` stack.

| Role | Size | Weight |
|---|---|---|
| Wordmark | 20px | 600 |
| Puzzle meta | 13px | 500, `--text-muted` |
| Panel heading | 13px | 700, uppercase, `0.08em`, `--text-muted` |
| Body / hint text | 15px | 400 |
| Help text | 13px | 400, `--text-muted` |
| Key label | 18px | 600 |
| Cell value | `--cell × 0.5` | 500 |
| Cage label | `max(10px, --cell × 0.22)` | 600 |

The wordmark drops from 30px. It was the largest text on the page and the least
useful information on it.

---

## 8. Motion

Restrained. Motion confirms an action; it never announces one.

- State transitions (hover, press, toggle): `150ms ease`.
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
