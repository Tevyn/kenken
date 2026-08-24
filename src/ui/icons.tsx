import type { ReactNode, SVGProps } from 'react'
import type { Difficulty, Puzzle } from '../engine/types'
import { MAX_SIZE, MIN_SIZE, colOf, rowOf } from '../engine/types'
import { computeCellEdges } from './cageBorders'

/**
 * Shared props for every icon: an optional pixel `size` (default 20) plus
 * anything else `<svg>` accepts (className, style, onClick, ...).
 */
export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

/**
 * Renders the shared Lucide-style svg shell (24x24 viewBox, 2px round
 * stroke, no fill) around one icon's glyph paths. Icons are always
 * decorative — the buttons that host them carry their own aria-label — so
 * every icon is forced hidden from assistive tech and out of tab order.
 */
function IconBase({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/**
 * Hint: a lightbulb. The conventional glyph for a puzzle hint (NYT Sudoku's
 * hint button, Lucide/Material's `lightbulb`) — it reads as "an idea", while
 * a magic wand implies the app solves the step for you and a question mark
 * reads as generic help rather than a puzzle nudge.
 *
 * This is Lucide's `lightbulb` verbatim, chosen over several hand-drawn
 * alternatives for its airier body: the shoulders curve back in over a wide
 * neck rather than pinching, which keeps the envelope open at render size
 * instead of silting up into a solid teardrop.
 *
 * The bulb is left empty on purpose. A plain circle for the envelope reads
 * as a clock face, and any filament drawn inside it — a chevron especially
 * — reads as a dropdown caret rather than a filament. The previous glyph
 * was exactly that mistake.
 *
 * The two base bars are detached from the body, which is normally the thing
 * to avoid: the previous glyph's neck stopped short above a bar that floated
 * with nothing to relate to, and the result read as a trophy. It works here
 * because the bars are evenly spaced and centred under a balanced body, so
 * they read as screw threads seen edge-on. They do stay two distinct dashes
 * at 22px — verified on the pixel grid, not assumed — but they are the first
 * thing to check if this icon is ever rendered smaller than 20px.
 */
export function HintIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </IconBase>
  )
}

/**
 * Erase: a rubber-eraser block, tilted ~40deg over a ground line. Sudoku
 * apps (Sudoku.com, Good Sudoku) put a rubber-eraser glyph on the "clear
 * this cell" key rather than a backspace-with-x, which reads as text
 * editing rather than board editing. The tilt (the same rotated-group trick
 * `MarksIcon` uses) is load-bearing: axis-aligned, the block's corner
 * chamfer disappears into the stroke's own round join at render size and it
 * reads as a card/book icon instead of an eraser being dragged.
 */
export function EraseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <g transform="rotate(-40 12 12)">
        <rect x="6" y="7" width="12" height="8" rx="1.5" />
        <line x1="12" y1="7" x2="12" y2="15" />
      </g>
      <line x1="4" y1="18" x2="20" y2="18" />
    </IconBase>
  )
}

/**
 * Undo: a compact corner-hook, arrowhead trailing into a curl that drops
 * into a vertical tail. Structurally this is Lucide's `corner-up-left`
 * shape (not a full swept rotate-arrow) — it stays legible as one
 * continuous stroke at 20px, where the boxier arrow-uturn glyph turns to
 * mush.
 */
export function UndoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M11 4 5 10l6 6" />
      <path d="M5 10h8a6 6 0 0 1 6 6v5" />
    </IconBase>
  )
}

/** Redo: `UndoIcon` mirrored left-to-right, same corner-hook language. */
export function RedoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M13 4 19 10l-6 6" />
      <path d="M19 10h-8a6 6 0 0 0-6 6v5" />
    </IconBase>
  )
}

/**
 * Pencil marks: a single tilted pencil. Plain `pencil` is the small-size
 * winner over `pencil-square` (whose frame turns to mush at 20px) and over
 * a dot-grid (easily mistaken for the digit keypad itself). Sized to ~14
 * units so its optical weight matches its toolbar neighbours instead of
 * dominating the row, with the ferrule pulled well clear of the eraser-end
 * cap so the two strokes don't fuse into a solid band at render size.
 */
export function MarksIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <g transform="rotate(45 12 12)">
        <rect x="9.3" y="3.9" width="5.4" height="12.6" rx="1.35" />
        <line x1="9.3" y1="9" x2="14.7" y2="9" />
        <path d="M9.3 16.5 12 21 14.7 16.5" />
      </g>
    </IconBase>
  )
}

/**
 * Menu: three horizontal sliders with offset toggles (Lucide
 * `sliders-horizontal`). The button opens a settings popover of adjustable
 * options, so sliders read unambiguously as "options" — a gear's teeth
 * turn to mush at a 1.83px stroke width and 22px render size, and a sun
 * (circle-plus-rays, which the previous glyph was structurally identical
 * to) reads as a theme toggle. Sliders are all straight lines at generous
 * spacing, so they survive small sizes, and carry no circular mass to
 * collide with the lightbulb hint icon.
 */
export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="21" y1="4" x2="14" y2="4" />
      <line x1="10" y1="4" x2="3" y2="4" />
      <line x1="21" y1="12" x2="12" y2="12" />
      <line x1="8" y1="12" x2="3" y2="12" />
      <line x1="21" y1="20" x2="16" y2="20" />
      <line x1="12" y1="20" x2="3" y2="20" />
      <line x1="14" y1="2" x2="14" y2="6" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="16" y1="18" x2="16" y2="22" />
    </IconBase>
  )
}

/**
 * New game: a clockwise refresh loop. Puzzle apps use a circular-arrow
 * "regenerate" glyph for starting a fresh puzzle, kept visually distinct
 * from the shorter undo/redo corner-hooks by sweeping ~300deg — nearly the
 * whole circle — before the head.
 *
 * The head is a chevron whose tip sits at the stroke's terminus with both
 * legs raked back along the direction of travel, so the eye picks up the
 * rotation. An axis-aligned L-bracket parked on the circle is the trap the
 * previous version fell into: its opening faces away from the travel
 * direction, and two straight legs meeting at 90deg on the arc read as a
 * prong jabbed into the side of a ring, not an arrow.
 *
 * The tail flares tangentially past the circle (Lucide's `rotate-cw` trick)
 * so the head has clearance. A chevron seated directly on the arc has its
 * back legs running nearly parallel to the curve, and at 20px the notch
 * between them silts up into a blob. The same reason the splay is ~38deg
 * rather than a square 45deg: the wider corner closes at render size.
 */
export function NewGameIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 12A9 9 0 1 1 12 3c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M16.4 7.4 21 8 20.4 3.4" />
    </IconBase>
  )
}

/**
 * Restart: the same loop as `NewGameIcon`, mirrored to run anticlockwise.
 *
 * The two sit side by side in the header, which is normally a reason to pick
 * unrelated glyphs — but they *are* related, and the pair is honest about it:
 * one starts a fresh puzzle, the other winds this one back to the start. Every
 * control in the app carries a visible label under its glyph (STYLE_GUIDE.md
 * §4.2), so the word does the naming and the glyph only has to say which
 * family the action belongs to.
 *
 * Anticlockwise is the direction that means "back" here, the same way
 * `UndoIcon` leads left and `RedoIcon` leads right; the head is the same raked
 * chevron on the same tangential flare, for the reasons in `NewGameIcon`.
 */
export function RestartIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12a9 9 0 1 0 9-9c-2.52 0-4.93 1-6.74 2.74L3 8" />
      <path d="M7.6 7.4 3 8l.6-4.6" />
    </IconBase>
  )
}

/**
 * Correctness: a tick and a cross, side by side — the marks a teacher puts
 * down the margin of a page. It is the pairing that carries the meaning: a
 * lone tick is the universal "done / you win" glyph, and this control is
 * offered *before* the puzzle is finished, on a board that may be entirely
 * wrong. Two opposed marks say "some of these are right and some are not",
 * which is exactly what the check reports.
 *
 * Nothing else in the set uses a diagonal, so it is unmistakable next to the
 * corner-hooks and boxes it sits beside.
 *
 * The 4-unit trench between the two marks is load-bearing, not padding: the
 * tick's rising arm ends level with the cross's top-left terminus, so at 22px
 * a narrower gap closes and the pair reads as one scribble. Both marks are
 * held to ~7 units for the same reason — drawn full-width they collide before
 * the icon is small enough to matter.
 */
export function CorrectnessIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2.5 12.5 5.5 15.5 10 8.5" />
      <path d="m14 9 7 7" />
      <path d="m21 9-7 7" />
    </IconBase>
  )
}

/**
 * Tip: a speech bubble. This choice explains the next deduction *in words*,
 * so the glyph is the app talking, not the idea itself.
 *
 * Deliberately not a reuse of `HintIcon`. The lightbulb is already on the
 * button that opens this menu, so putting it inside the menu too would offer
 * the player the same glyph twice, one nested in the other, with no way to
 * tell the category from the choice. That is the whole reason a third icon is
 * drawn here rather than the obvious one reused.
 *
 * Lucide's `message-square`, kept empty. Two short lines of "text" inside are
 * the conventional way to say prose, and they are the trap: the body's
 * interior is ~11 units, so two rules inside it land ~3 units apart and fuse
 * into a grey band at a 1.83px stroke. The tail does the work instead — it is
 * what separates this from `EraseIcon`'s block, which is otherwise the same
 * quadrilateral seen at a tilt.
 */
export function TipIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </IconBase>
  )
}

/**
 * Number: a board with one cell filled in. The choice writes a single correct
 * digit into the grid, and the grid is the thing the app is about, so the
 * icon shows the board and the one square that changes.
 *
 * No numeral is drawn. Any digit picked would be a lie about which one the
 * engine is going to place, and a "1" reads as a count besides.
 *
 * The filled square is the one fill in the icon set, and it is why the glyph
 * works: an outlined inner square inside an outlined cell is two nested
 * rectangles 1.8px apart, which silts up long before 22px. It spans the cell's
 * clear interior exactly (the grid lines are 2 units wide, so 10..14), so it
 * reads as a cell that has been coloured in rather than as a dot parked in
 * one. It carries `stroke="none"` because the inherited 2-unit stroke would
 * grow it back out over the lines around it.
 *
 * Square corners, no `rx`: the board takes no radius (STYLE_GUIDE.md §1.6),
 * and it is also what keeps this from reading as `EraseIcon`'s rounded block.
 */
export function NumberIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="18" height="18" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <rect x="10" y="10" width="4" height="4" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

/*
 * ---------------------------------------------------------------------------
 * Grid glyphs
 * ---------------------------------------------------------------------------
 *
 * `GridIcon` and `CagedGridIcon` are the one place in this file where the
 * glyph is *parameterised*, and that is what makes them hard: the same icon
 * has to hold together at n=3, where a cell is a third of the box, and at n=9,
 * where a cell is a twelfth of it and the render size is still ~22-28px.
 *
 * The trap is `IconBase`'s inherited `strokeWidth={2}`. Every other icon in
 * this file wants it; a 9x9 grid drawn with it does not. Eight internal
 * dividers, 2 units wide, laid across an 18-unit span is 16 units of ink in 18
 * units of space — the interior silts up into a solid block and the icon reads
 * as a filled square, which is the *opposite* of what a size-9 button should
 * say. `IconBase` itself is untouched: its svg-level `strokeWidth=2` is exactly
 * the weight the outer square wants, and the internal lines override it per
 * element. No new prop, and every existing icon renders byte-identically.
 *
 * The second trap is subtler and cost a full round of screenshots to find.
 * Scaling the divider down *proportionally* — a duty cycle against the cell
 * pitch, which is the obvious fix and the one this file shipped first — does
 * not work at the sizes these buttons actually render at. At 22px one viewBox
 * unit is 0.92 device pixels, so a "correctly" thinned 0.5-unit divider is a
 * 0.46px stroke, and the rasteriser spreads a 0.46px stroke across *two* pixel
 * columns at ~23% each. With a 1.83px pitch there is no pixel left uninked:
 * every column gets a share, and the interior comes out as a flat translucent
 * wash. Verified, not assumed — at 24px a proportionally-thinned 9x9 rendered
 * as a literally uniform block, worse than the 8x8 beside it.
 *
 * So the dividers are drawn the way the board draws them, and the way hairlines
 * have to be drawn at this scale: **one device-independent pixel, snapped to
 * the pixel grid, at reduced opacity**. See `DIVIDER_*` below.
 *
 * The rest follows the board rather than a generic grid glyph:
 *
 *   - In `CagedGridIcon` the outer square is the heaviest line (STYLE_GUIDE §5: "the board's
 *     boundary always reads as the strongest line on the grid"). It is a
 *     constant 2 units at every n, which is also what keeps a 3x3 and a 9x9
 *     button looking like the same family — the frame carries nearly all of
 *     the icon's optical mass, so freezing it freezes the mass. It stays in
 *     viewBox units, unlike the dividers, so the frame still matches the
 *     stroke weight of every other icon in this file at any render size.
 *   - `GridIcon` gives that up on purpose and draws its frame as a hairline
 *     too, so a size tile is a single uniform weight throughout. See
 *     `gridFrame` for why.
 *   - Square corners, not `rx`. `Board.css` argues this explicitly: "a rounded
 *     grid reads as a card containing a puzzle rather than as the puzzle
 *     itself". That needs `strokeLinejoin="miter"` on the rect specifically,
 *     because the shell sets `round` globally and a round join on a 2-wide
 *     stroke rounds all four corners at radius 1.
 *
 * Everything is `stroke="currentColor"` by inheritance and `fill="none"` from
 * the shell, so the glyph is accent-blue ink like every other control (§4.1),
 * and `aria-hidden` like every other icon — the size/difficulty button that
 * hosts it carries the name.
 */

/**
 * The outer square's *centre line*, so the drawn frame's outer edge lands on
 * 2 and 22 for every n — the same 20-unit envelope Lucide's `grid-*` glyphs
 * use, and the same envelope regardless of n.
 *
 * Half-stroke inset is the thing to get right here: a rect whose path runs at
 * x=3 with a 2-wide stroke paints from x=2 to x=4. Drawing the path at x=2
 * instead would bleed the frame to x=1 and cost a unit of margin on every
 * side. The interior is then measured centre-line to centre-line (3..21), not
 * inside-edge to inside-edge, which buys the grid 18 units of pitch space
 * instead of 14 — at n=9 that is the difference between a 1.83px cell and a
 * 1.43px cell at a 22px render, and 1.43px is where the thing dies.
 */
const GRID_MIN = 3
const GRID_MAX = 21
const GRID_SPAN = GRID_MAX - GRID_MIN
/** Matches `IconBase`'s svg-level width, so the frame needs no override. */
const OUTER_STROKE = 2

/**
 * Cell dividers: a hairline, in the literal sense.
 *
 * `vector-effect="non-scaling-stroke"` takes the width out of viewBox units
 * and puts it in the outer viewport's, so `strokeWidth={1}` is **1 CSS pixel
 * at every render size** — the icon's geometry scales, its hairlines do not.
 * That is not a trick; it is precisely what `Cell.css` does on the real board,
 * where the divider is a flat `border-right: 1px solid` that stays 1px whether
 * `--cell` is 26px or 84px. The icon is a picture of that object, so it should
 * be built the same way.
 *
 * `shape-rendering="crispEdges"` is the half that actually rescues n=9. Grid
 * pitch at a 22px render is 1.83 device pixels — never an integer — so without
 * snapping, each divider straddles a pixel boundary at a different phase and
 * the interior degenerates into the flat wash described above. Snapped, every
 * divider is one hard-edged pixel column with real gaps between, and the
 * difference at n=8/n=9 is the difference between a grid and a swatch.
 *
 * Opacity carries the weight hierarchy instead of width, because at 22px there
 * is nowhere below 1px left to go. §5 makes dividers `--border` while cage
 * borders and the outline take `--structure`; an icon has one colour by
 * contract (§4.1), so the only honest translation of "a lighter token" is a
 * lighter alpha. 0.55 against the frame's solid ink is the same relationship,
 * and §2.4 explicitly exempts dividers from the 3:1 floor precisely so they
 * can be this quiet.
 *
 * Sub-pixel widths were tried first and rejected on screenshots at 22/24/28px;
 * so was crisp snapping at proportional widths, which still washed out at n=9
 * because the *width*, not the phase, was the problem.
 */
const DIVIDER_STROKE = 1
const DIVIDER_OPACITY = 0.55

/**
 * The hairline treatment itself, hoisted because two callers wear it now: the
 * dividers at every n, and `GridIcon`'s outer frame. See `gridFrame`.
 */
const HAIRLINE = {
  strokeWidth: DIVIDER_STROKE,
  strokeOpacity: DIVIDER_OPACITY,
  vectorEffect: 'non-scaling-stroke',
  shapeRendering: 'crispEdges',
} as const

/**
 * Cage borders: proportional to the cell pitch, floored, capped at the frame.
 *
 * 0.45 duty means two cage borders one cell apart still leave 55% of the pitch
 * clear, which is what stops a heavily-caged board from closing up. The cap is
 * `OUTER_STROKE`: a cage border may reach the frame's weight but never exceed
 * it (§5). It hits that cap at n=3 and n=4, so at those sizes the glyph
 * deliberately runs **two** weights, not three — cage borders at outline
 * weight, dividers light. That is not a concession, it is what the board does:
 * `Cell.css` draws cage borders at `--cell * 0.045` while `Board.css` draws the
 * frame at `--board * 0.008`, which for a 6x6 is `--cell * 0.048`. A 7%
 * difference is not a third weight.
 *
 * The floor is 1.3 units, and it is the number that keeps three weights apart
 * at large n rather than the one that keeps cages from silting. Raw duty at
 * n=9 gives 0.9 units, which at a 22px render is 0.82px — *thinner* than the
 * 1px hairline it is supposed to dominate, so cage structure would have
 * inverted against the dividers at exactly the size where it matters most.
 * 1.3 units is 1.19px: still under the frame, still visibly over the hairline,
 * and the width difference is reinforced by the hairline's 0.55 alpha.
 */
const CAGE_DUTY = 0.45
const CAGE_MIN = 1.3

/** Trim float noise so `18/7` does not serialise 15 digits into the DOM. */
const round = (value: number) => Math.round(value * 1000) / 1000

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

interface GridMetrics {
  /** `n`, clamped to the sizes the engine actually supports. */
  size: number
  /** Centre-line coordinate of grid line `k`, `k` in `0..size`. */
  at: (k: number) => number
  /** Stroke width, in viewBox units, for a cage boundary at this size. */
  cage: number
}

/**
 * Derives every stroke width and coordinate for an n x n glyph.
 *
 * `n` is clamped rather than trusted: these icons sit on wizard buttons, and a
 * bad `n` (0, a float, a stray 12) must degrade to a drawable grid rather than
 * divide by zero or throw inside render.
 */
function gridMetrics(n: number): GridMetrics {
  const size = clamp(Math.round(n) || MIN_SIZE, MIN_SIZE, MAX_SIZE)
  const pitch = GRID_SPAN / size
  return {
    size,
    at: (k) => round(GRID_MIN + k * pitch),
    cage: round(clamp(CAGE_DUTY * pitch, CAGE_MIN, OUTER_STROKE)),
  }
}

/**
 * The `size - 1` internal dividers in each axis, full span, hairline weight.
 *
 * They run the whole 3..21 centre-line span rather than stopping at the
 * frame's inner edge, so their ends tuck underneath the outer stroke instead
 * of stopping short of it and leaving a visible gap at the frame — which at
 * n=9, where the gap would be a third of a cell, reads as a border of empty
 * margin inside the square.
 */
function gridDividers({ size, at }: GridMetrics) {
  const lines = []
  for (let k = 1; k < size; k += 1) {
    const p = at(k)
    lines.push(
      <line key={`v${k}`} x1={p} y1={GRID_MIN} x2={p} y2={GRID_MAX} {...HAIRLINE} />,
      <line key={`h${k}`} x1={GRID_MIN} y1={p} x2={GRID_MAX} y2={p} {...HAIRLINE} />,
    )
  }
  return lines
}

/**
 * The frame. Drawn last so it sits over every divider and cage terminus.
 *
 * Two weights, and which one a glyph takes is decided by how many weights it
 * has left to spend. `CagedGridIcon` runs a hierarchy — frame over cage over
 * divider — so its frame takes `outline` and anchors the top of it.
 * `GridIcon` has no cages and so nothing to rank: the only relationship left
 * is frame against divider, and ranking those two says nothing the glyph needs
 * to say, since the outer edge of an n x n grid is not more informative than
 * its interior. So it takes `hairline` and the whole glyph becomes one weight
 * — every line in a size tile drawn exactly the way the divider is, which is
 * also the way `Cell.css` draws a real cell edge.
 *
 * `hairline` carries the divider's 0.55 alpha as well as its width, because
 * splitting them would leave the frame a *different* stroke that merely
 * measures the same, which is the thing this is trying not to be.
 *
 * `strokeLinejoin="miter"` stays on both: the shell sets `round` globally and
 * `Board.css` is explicit that "a rounded grid reads as a card containing a
 * puzzle rather than as the puzzle itself". At hairline weight the join barely
 * shows, but it costs nothing and it keeps the two frames the same shape.
 */
function gridFrame(weight: 'outline' | 'hairline') {
  const stroke = weight === 'hairline' ? HAIRLINE : { strokeWidth: OUTER_STROKE }
  return (
    <rect
      x={GRID_MIN}
      y={GRID_MIN}
      width={GRID_SPAN}
      height={GRID_SPAN}
      strokeLinejoin="miter"
      {...stroke}
    />
  )
}

/**
 * Grid size: an empty n x n grid, no cages. Sits on the seven size buttons in
 * the New Game wizard, where the glyph *is* the information — the button says
 * "5x5" by drawing a 5x5 — so the cell count has to be countable, not merely
 * suggestive. See the block comment above for the stroke system.
 */
export interface GridIconProps extends IconProps {
  /** Grid order, 3..9. Values outside that are clamped, never thrown on. */
  n: number
}

export function GridIcon({ n, ...props }: GridIconProps) {
  const metrics = gridMetrics(n)
  return (
    <IconBase {...props}>
      {gridDividers(metrics)}
      {gridFrame('hairline')}
    </IconBase>
  )
}

/**
 * `computeCellEdges` wants a whole `Puzzle` but reads only `puzzle.size`. The
 * rest is inert filler so the icon can reuse the board's own adjacency rule
 * rather than re-deriving "different cage id to the right/below" a second
 * time — the alternative was a private copy of the walk that could silently
 * drift from the board it is a picture of.
 */
const gridShaped = (size: number): Puzzle => ({
  size,
  difficulty: 'easy',
  cages: [],
  solution: [],
  seed: '',
})

/**
 * Grid with cages: the same n x n grid, with cage boundaries overdrawn at
 * heavy weight on top of the light dividers. Sits on the four difficulty
 * buttons, where the glyph says "this is how chopped-up your board will be".
 *
 * Overdrawing is deliberate rather than drawing each cell edge once at its own
 * weight: it is exactly how the board composes (every cell paints a hairline
 * right/bottom border, cage cells paint a heavy one over it), and it keeps the
 * element count at `2(n-1)` full-span dividers plus only the boundary
 * segments, instead of `2n(n-1)` stubs.
 *
 * Only right and bottom edges are ever emitted — `computeCellEdges`' rule, and
 * the reason no boundary comes out doubled and no round cap stacks on another
 * round cap into a visible lump at cage corners.
 *
 * No labels, no digits, no operators. A cage label is `--cell * 0.22`, which
 * on a 24-unit box at a 24px render is a 0.5px numeral. The icon is about
 * structure; anything else in it is noise wearing a number's clothes.
 */
export interface CagedGridIconProps extends IconProps {
  n: number
  /** `cageIds[i]` is the cage id of cell `i`, in reading order. Length `n * n`. */
  cageIds: readonly number[]
}

export function CagedGridIcon({ n, cageIds, ...props }: CagedGridIconProps) {
  const metrics = gridMetrics(n)
  const { size, at, cage } = metrics

  /*
   * Defensive fallback, not an assertion: a wizard button rendering a
   * slightly wrong picture is a blemish, a wizard button throwing during
   * render unmounts the app behind an error boundary. A malformed layout
   * degrades to the plain grid, which is still true about the board's size.
   */
  if (cageIds.length !== size * size) return <GridIcon n={n} {...props} />

  const puzzle = gridShaped(size)
  const edges = []
  for (let index = 0; index < size * size; index += 1) {
    const { rightHeavy, bottomHeavy } = computeCellEdges(puzzle, cageIds, index)
    const row = rowOf(index, size)
    const col = colOf(index, size)
    if (rightHeavy) {
      const x = at(col + 1)
      edges.push(
        <line
          key={`r${index}`}
          x1={x}
          y1={at(row)}
          x2={x}
          y2={at(row + 1)}
          strokeWidth={cage}
        />,
      )
    }
    if (bottomHeavy) {
      const y = at(row + 1)
      edges.push(
        <line
          key={`b${index}`}
          x1={at(col)}
          y1={y}
          x2={at(col + 1)}
          y2={y}
          strokeWidth={cage}
        />,
      )
    }
  }

  return (
    <IconBase {...props}>
      {gridDividers(metrics)}
      {edges}
      {gridFrame('outline')}
    </IconBase>
  )
}

/**
 * Difficulty: a fixed 4x4 board carrying one cage, which grows from a single
 * cell at easy to a four-cell block at expert.
 *
 * This replaces a tile that drew the whole baked cage layout for the
 * size/difficulty pair, and it gives up two things on purpose.
 *
 * It gives up the played size. The tile no longer previews the board about to
 * be generated, because at n=9 it could not: 42 cages in a 32px box is 84-105
 * border segments on a 2.67px cell pitch, which reads as woven texture rather
 * than as a grid divided into cages. The heading directly above the tiles
 * already restates the chosen size in words and in digits, so nothing is lost
 * that the panel does not say twice.
 *
 * It gives up drawing the real layout, and that is the sharper trade. The old
 * tile was honest data pointed in a misleading direction: this generator makes
 * *harder* puzzles out of *fewer, larger* cages — 9/7/6/5 cages at 4x4 and
 * 42/35/29/24 at 9x9 — so the picture emptied out as the word beneath it got
 * scarier, and at 4x4 the four tiles differed by four segments out of fifteen
 * besides. Someone scanning the row read a ramp that ran backwards.
 *
 * What is drawn instead is a legend rather than a measurement, and this
 * comment says so instead of implying a correspondence that is not there. Its
 * ordering and its endpoints are real, though, which is what keeps it honest:
 * across the 28 baked layouts easy is the only difficulty thick with one-cell
 * cages (42 of them) and holds nothing bigger than three, while hard and
 * expert contain no single-cell cage at all and between them hold 47 cages of
 * four or more. "Easy hands you a free square, expert hands you a block" is a
 * true sentence about this engine, and 1-2-3-4 is the shortest way to draw it
 * four times running.
 *
 * The cage is tinted as well as outlined. §4.1 reserves fills for the board's
 * own state, which is exactly the claim being made here — this is a picture of
 * a cage sitting on a board, drawn the way `--cell-cage` paints one. Outline
 * alone was tried first and the ramp did not survive it: at 32px a two-cell
 * domino and a three-cell L differ by one notch in a line, where the tinted
 * versions differ by a third of their mass.
 *
 * Everything else is `CagedGridIcon`'s system untouched — hairline dividers so
 * the cells stay countable under the cage, the frame heaviest and drawn last
 * (§5), and square corners throughout.
 */
const DIFFICULTY_ORDER = 4

/**
 * Each cage as a closed ring of grid-*line* indices, `[column, row]`, so the
 * shapes are expressed in cells rather than in viewBox units and follow
 * `gridMetrics` if the envelope ever moves.
 *
 * All four are anchored on the same corner and grow into the same central 2x2
 * block, which is what makes the row read as one object at four sizes instead
 * of four unrelated shapes. The three-cell case is the only one with a choice
 * to make; the notch is put at the bottom right so the cage grows away from
 * its anchor in both axes, the way the two-cell and four-cell cases do.
 */
const DIFFICULTY_CAGE: Record<Difficulty, readonly (readonly [number, number])[]> = {
  easy: [
    [1, 1],
    [2, 1],
    [2, 2],
    [1, 2],
  ],
  medium: [
    [1, 1],
    [3, 1],
    [3, 2],
    [1, 2],
  ],
  hard: [
    [1, 1],
    [3, 1],
    [3, 2],
    [2, 2],
    [2, 3],
    [1, 3],
  ],
  expert: [
    [1, 1],
    [3, 1],
    [3, 3],
    [1, 3],
  ],
}

/**
 * The cage's fill alpha.
 *
 * `--cell-cage` mixes the accent into `--surface` at 14%, but that is a mix
 * into a cell background; this is a fill of the stroke colour over the page,
 * and 14% of it is invisible at 32px. 0.38 is where the four tiles' masses
 * separate at a glance in both themes while the hairline dividers still read
 * through the tint — below about 0.3 the ramp flattens out, above about 0.45
 * the dividers under the cage disappear and it stops looking like cells.
 */
const CAGE_TINT = 0.38

export interface DifficultyIconProps extends IconProps {
  difficulty: Difficulty
}

export function DifficultyIcon({ difficulty, ...props }: DifficultyIconProps) {
  const metrics = gridMetrics(DIFFICULTY_ORDER)
  const { at, cage } = metrics

  /*
   * Defensive in the same spirit as `CagedGridIcon`'s length check: this
   * arrives from a prop, and a tile drawing the wrong cage is a blemish where
   * a tile throwing mid-render takes the app down behind an error boundary.
   */
  const ring = DIFFICULTY_CAGE[difficulty] ?? DIFFICULTY_CAGE.easy
  const outline = `${ring
    .map(([col, row], index) => `${index === 0 ? 'M' : 'L'}${at(col)} ${at(row)}`)
    .join('')}Z`

  return (
    <IconBase {...props}>
      {gridDividers(metrics)}
      <path
        d={outline}
        fill="currentColor"
        fillOpacity={CAGE_TINT}
        strokeWidth={cage}
        strokeLinejoin="miter"
      />
      {gridFrame('outline')}
    </IconBase>
  )
}

/**
 * Theme — light: a sun, disc plus eight rays.
 *
 * `MenuIcon`'s comment rejected a sun for the *settings trigger* because "a
 * sun reads as a theme toggle". That objection is the endorsement here: this
 * is the theme control, and the two glyphs now sit in the same popover, so
 * they must not collide. They do not — `MenuIcon` became sliders, which are
 * all straight lines and carry no circular mass at all, and this is the one
 * glyph in the file built around a centred disc.
 *
 * Eight rays, not four: four reads as a compass rose or a plus sign inside a
 * ring. Rays detached and short (2 units, ending 4 units clear of the r=4
 * disc) rather than long spokes touching it: a ray that meets the disc turns
 * the whole thing into a wheel with an axle, and at a 22px render the junction
 * is where the ink pools first. The disc is stroked, never filled — a filled
 * sun is a solid blue dot at this size, indistinguishable from a bullet, and
 * §4.1 wants ink not chrome anyway.
 *
 * Shrinking the disc and lengthening the rays is the other tempting move and
 * the wrong one: past about r=3 the glyph stops being a sun and becomes a
 * sparkle, which every other product on earth uses to mean "AI".
 */
export function ThemeLightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
      <path d="m6.34 17.66-1.41 1.41" />
    </IconBase>
  )
}

/**
 * Theme — dark: a waning crescent, one closed outline.
 *
 * Drawn as a single path whose inner edge is a *shallower* arc than its outer
 * edge, so the crescent keeps a thick belly and thin horns. The obvious
 * construction — two circles of the same radius, offset — gives a crescent of
 * even thickness whose horns taper to nothing; at 22px the tips vanish into
 * the antialiasing and the shape reads as a bitten disc, or worse, a comma.
 *
 * The horns are cut at roughly the two- and eight-o'clock positions rather
 * than closing further toward a ring: a crescent thinner than about a third of
 * its diameter fuses into a single curved stroke and stops reading as a solid
 * body with a shadow on it.
 *
 * No stars. Two or three small dots beside the moon is the conventional
 * "night" glyph and it is a conventional mistake at icon size — the dots land
 * at under a pixel each, so they read as dirt on the screen rather than sky,
 * and they pull the moon off-centre to make room.
 */
export function ThemeDarkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </IconBase>
  )
}

/**
 * Theme — system: a display on a stand.
 *
 * "Follow the OS" has no glyph of its own, so the convention is the device
 * itself. The stand is the load-bearing part: a bare rounded rectangle is a
 * card, an image frame, or — next to `GridIcon` in this same app — an empty
 * board. The neck plus foot is the only thing that says "screen".
 *
 * Deliberately landscape (20x14) and rounded (rx=2), for exactly that reason:
 * `GridIcon`'s frame is a square-cornered 18x18, and the two would be one
 * glyph apart if this one were square too. The aspect ratio and the corner
 * radius are both doing disambiguation work, not decoration.
 *
 * The neck is 4 units and the foot 8, which keeps them apart at render size.
 * A shorter neck lets the round joins at the foot's ends swallow it and the
 * stand collapses into a single thick underline — which then reads as the
 * `aria-current` underline the style guide puts under the selected control in
 * a group (§4.1), inside the very popover where those underlines live.
 */
export function ThemeSystemIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M12 17v4" />
      <path d="M8 21h8" />
    </IconBase>
  )
}
