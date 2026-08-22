import type { ReactNode, SVGProps } from 'react'

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
 * Two strokes, and the silhouette is doing all the work. The body is one
 * open path — a wide 300deg arc whose ends curve back inward — so the
 * shoulders pinch into a neck and the outline reads as a pear/teardrop. A
 * plain circle for the envelope is the trap: it reads as a clock face, and
 * any filament drawn inside it (a chevron especially) reads as a dropdown
 * caret rather than a filament, so the bulb is left empty.
 *
 * The base is a slightly tapered cup drawn from the two neck ends, so it is
 * physically joined to the body. Lucide's `lightbulb` floats its two base
 * bars free of the glyph above; at 22px they blur into a stray dash and the
 * whole thing reads as a trophy. One band, not two: a second thread line
 * only fits with ~2.7 units of clearance, which fuses into a solid block at
 * render size. The taper carries the screw-base read on its own.
 */
export function HintIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 16c0-1.4-.6-2.3-1.4-3.2a5.6 5.6 0 1 1 8.8 0c-.8.9-1.4 1.8-1.4 3.2" />
      <path d="M9 16l.7 4.3h4.6l.7-4.3" />
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
