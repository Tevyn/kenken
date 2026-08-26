import { useCallback, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import type { Difficulty } from '../engine/types';
import { ChevronLeftIcon, ChevronRightIcon, NewGameIcon } from './icons';
import { Popover } from './Popover';
import './HowToPlayMenu.css';

/* The panel is named by its heading. */
const HEADING_ID = 'kk-howtoplay-heading';

/** The game the "New 3×3" button on the last page starts: the gentlest one. */
const STARTER_SIZE = 3;
const STARTER_DIFFICULTY: Difficulty = 'easy';

/** A page will animate its scroll only where motion is welcome and possible. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface MiniBoardProps {
  /** Column count; rows are derived from `cages.length`. */
  cols: number;
  /** Cage id per cell, row-major. Neighbours sharing an id share a cage. */
  cages: readonly number[];
  /** Cage id → label, drawn in the corner of that cage's top-left cell. */
  labels?: Record<number, string>;
  /** Value per cell, row-major; a missing entry leaves the cell empty. */
  values?: readonly (number | null | undefined)[];
  /** Cell indices to tint, for drawing the eye to the cells a rule is about. */
  highlight?: readonly number[];
  /** The whole diagram's accessible description — it reads as one image. */
  ariaLabel: string;
}

/**
 * A miniature KenKen grid, drawn with the real board's own lines: a hairline
 * between cells of one cage, the heavy `--cell-border-heavy` between cages and
 * around the edge, cage labels in the corner. It exists only to illustrate the
 * rules panel, so it is a static picture — `role="img"` with a spoken
 * description — rather than the interactive `Board`, which is bound to the game
 * state a cover screen has none of.
 */
function MiniBoard({
  cols,
  cages,
  labels = {},
  values = [],
  highlight = [],
  ariaLabel,
}: MiniBoardProps) {
  const rows = cages.length / cols;
  const highlighted = new Set(highlight);
  /* Each cage's label rides its first cell in reading order. */
  const anchor = new Map<number, number>();
  cages.forEach((id, i) => {
    if (!anchor.has(id)) anchor.set(id, i);
  });

  return (
    <div
      className="kk-mini"
      style={{ '--mini-cols': cols } as CSSProperties}
      role="img"
      aria-label={ariaLabel}
    >
      {cages.map((id, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const classes = ['kk-mini__cell'];
        // Outer edges are the frame's job; only draw the lines *between* cells,
        // heavy where two cages meet and hairline within one.
        if (col < cols - 1)
          classes.push(cages[i + 1] === id ? 'kk-mini__cell--thin-r' : 'kk-mini__cell--cage-r');
        if (row < rows - 1)
          classes.push(cages[i + cols] === id ? 'kk-mini__cell--thin-b' : 'kk-mini__cell--cage-b');
        if (highlighted.has(i)) classes.push('kk-mini__cell--tint');
        const label = anchor.get(id) === i ? labels[id] : undefined;
        const value = values[i];
        return (
          <div key={i} className={classes.join(' ')}>
            {label != null && <span className="kk-mini__label">{label}</span>}
            {value != null && <span className="kk-mini__value">{value}</span>}
          </div>
        );
      })}
    </div>
  );
}

interface Page {
  /** The illustration for this rule — a mini-board, or a pair of them. */
  figure: ReactNode;
  /** The rule itself, in the words the panel has always used. */
  caption: ReactNode;
}

/**
 * The rules, in the order a new player needs them: the grid constraint first,
 * then what a cage is — outlines of every shape and size — then the odd
 * one-cell freebie those introduce, then how an operation cage resolves (and
 * that order is free for − and ÷), and last the repeat that surprises people.
 * Each rule now travels with a picture of itself.
 *
 * Deliberately the *rules* only — nothing about the keypad, hints, or notes.
 * Those controls carry their own labels and are self-explanatory (the cover's
 * own copy makes the same split), so teaching them here would only bury the
 * sentences that actually matter under things the player can already see.
 */
const PAGES: readonly Page[] = [
  {
    figure: (
      <MiniBoard
        cols={3}
        cages={[0, 0, 0, 0, 0, 0, 0, 0, 0]}
        values={[1, 2, 3, 2, 3, 1, 3, 1, 2]}
        highlight={[0, 1, 2, 3, 6]}
        ariaLabel="A 3 by 3 grid where the highlighted top row and left column each hold 1, 2 and 3 exactly once."
      />
    ),
    caption: (
      <>
        Fill the grid so every row and every column holds each number from 1 to the grid’s size
        exactly once, with no repeats in any line.
      </>
    ),
  },
  {
    figure: (
      <MiniBoard
        cols={3}
        cages={[0, 0, 1, 2, 0, 1, 2, 2, 3]}
        labels={{ 0: '6+', 1: '2÷', 2: '6×', 3: '3' }}
        ariaLabel="A grid divided by heavy outlines into four cages: two three-cell L-shapes, a two-cell cage, and a single-cell cage."
      />
    ),
    caption: (
      <>
        Heavy outlines divide the grid into cages. Each shows a target, most with an operation: +,
        −, ×, or ÷.
      </>
    ),
  },
  {
    figure: (
      <MiniBoard
        cols={1}
        cages={[0]}
        labels={{ 0: '4' }}
        values={[4]}
        ariaLabel="A single-cell cage labelled 4, with a 4 already placed in it."
      />
    ),
    caption: (
      <>
        A cage showing just a number, with no operation, is a freebie: that number goes straight
        into its one cell.
      </>
    ),
  },
  {
    figure: (
      <MiniBoard
        cols={2}
        cages={[0, 0]}
        labels={{ 0: '3+' }}
        values={[1, 2]}
        ariaLabel="A 3 plus cage holding a 1 and a 2, which add up to 3."
      />
    ),
    caption: (
      <>The numbers you place in a cage must combine, using that operation, to make the target.</>
    ),
  },
  {
    figure: (
      <div className="kk-howto__pair">
        <MiniBoard
          cols={2}
          cages={[0, 0]}
          labels={{ 0: '1−' }}
          values={[3, 2]}
          ariaLabel="A 1 minus cage holding a 3 then a 2."
        />
        <span className="kk-howto__pair-sep" aria-hidden="true">
          =
        </span>
        <MiniBoard
          cols={2}
          cages={[0, 0]}
          labels={{ 0: '1−' }}
          values={[2, 3]}
          ariaLabel="The same 1 minus cage holding a 2 then a 3 — both orderings are accepted."
        />
      </div>
    ),
    caption: <>Order doesn’t matter: − and ÷ use the difference and the quotient.</>,
  },
  {
    figure: (
      <MiniBoard
        cols={2}
        cages={[0, 0, 0, 0]}
        labels={{ 0: '8+' }}
        values={[2, 3, 1, 2]}
        highlight={[0, 3]}
        ariaLabel="A single cage holding 2, 3, 1 and 2; the two highlighted 2s sit in different rows and columns."
      />
    ),
    caption: (
      <>
        A number may repeat inside a cage, as long as it never repeats within the same row or
        column.
      </>
    ),
  },
];

const LAST = PAGES.length - 1;

interface HowToPlayCarouselProps {
  /** Start a fresh game — used by the last page's "New 3×3" button. */
  onStartGame: (size: number, difficulty: Difficulty) => void;
}

/**
 * The rules as a swipeable carousel: one rule per page, a picture of it above
 * the words, dots that both count the pages and say which is showing, and a
 * previous/next arrow flanking the illustration. A page is reached by swiping
 * (touch or trackpad), by pressing a dot or an arrow, or with the arrow keys.
 * The previous arrow is absent on the first page; on the last, the next arrow
 * gives way to a "New 3×3" button that drops the reader straight into a game.
 */
function HowToPlayCarousel({ onStartGame }: HowToPlayCarouselProps) {
  const trackRef = useRef<HTMLOListElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  /** Slide the track to a page and mark it current; optionally chase focus to its dot. */
  const goTo = useCallback((next: number, focusDot = false) => {
    const clamped = Math.max(0, Math.min(LAST, next));
    setIndex(clamped);
    const track = trackRef.current;
    if (track) {
      const left = clamped * track.clientWidth;
      if (typeof track.scrollTo === 'function') {
        track.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      } else {
        track.scrollLeft = left;
      }
    }
    if (focusDot) {
      dotsRef.current?.querySelectorAll<HTMLButtonElement>('button')[clamped]?.focus();
    }
  }, []);

  /* A swipe moves the track directly; read the current page back off its offset. */
  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const next = Math.round(track.scrollLeft / track.clientWidth);
    setIndex((current) => (current === next ? current : next));
  }, []);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      let next: number | null = null;
      if (event.key === 'ArrowRight') next = index + 1;
      else if (event.key === 'ArrowLeft') next = index - 1;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = LAST;
      if (next === null) return;
      event.preventDefault();
      goTo(next, true);
    },
    [index, goTo],
  );

  /*
   * An arrow that reaches an edge leaves focus nowhere useful: the first page
   * drops the previous arrow entirely, and the last hides the next arrow as it
   * crossfades to "New 3×3" (aria-hidden and untabbable, though still mounted so
   * the fade can play). Either would strand focus on `<body>` or on an inert
   * control. Hand it to the now-current dot instead; a move that stays
   * mid-carousel leaves focus on the arrow, which persists.
   */
  const onPrev = useCallback(() => goTo(index - 1, index - 1 === 0), [index, goTo]);
  const onNext = useCallback(() => goTo(index + 1, index + 1 === LAST), [index, goTo]);

  const atFirst = index === 0;
  const atLast = index === LAST;

  return (
    <div className="kk-howto" onKeyDown={onKeyDown}>
      <h2 className="kk-howto__title" id={HEADING_ID}>
        How to play
      </h2>

      <div className="kk-howto__dots" ref={dotsRef} role="group" aria-label="Steps">
        {PAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            className="kk-howto__dot"
            aria-label={`Step ${i + 1} of ${PAGES.length}`}
            aria-current={i === index || undefined}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      <div
        className={`kk-howto__viewport${atFirst ? ' kk-howto__viewport--first' : ''}${
          atLast ? ' kk-howto__viewport--last' : ''
        }`}
      >
        {/*
          Kept mounted on the first page too, just faded out, so arriving at or
          leaving that page crossfades the Back arrow rather than popping it
          (HowToPlayMenu.css). Hidden, it is aria-hidden and untabbable.
        */}
        <button
          type="button"
          className="kk-control kk-control--stack kk-howto__nav kk-howto__nav--prev kk-howto__prev"
          onClick={onPrev}
          aria-hidden={atFirst || undefined}
          tabIndex={atFirst ? -1 : undefined}
        >
          <ChevronLeftIcon size={22} />
          <span className="kk-control__label">Back</span>
        </button>

        <ol className="kk-howto__track" ref={trackRef} onScroll={onScroll}>
          {PAGES.map((page, i) => (
            <li key={i} className="kk-howto__page" aria-current={i === index || undefined}>
              <div className="kk-howto__figure">{page.figure}</div>
              <p className="kk-howto__caption">{page.caption}</p>
            </li>
          ))}
        </ol>

        {/*
          Both live in the "next" slot at once, stacked, so leaving the last page
          for the last can crossfade between them (HowToPlayMenu.css): the Next
          arrow fades out over the slide, then the "New 3×3" button fades in once
          it lands. The one that isn't showing is aria-hidden and untabbable so
          only the visible control is reachable.
        */}
        <button
          type="button"
          className="kk-control kk-control--stack kk-howto__nav kk-howto__nav--next kk-howto__next"
          onClick={onNext}
          aria-hidden={atLast || undefined}
          tabIndex={atLast ? -1 : undefined}
        >
          <ChevronRightIcon size={22} />
          <span className="kk-control__label">Next</span>
        </button>
        <button
          type="button"
          className="kk-control kk-control--stack kk-howto__nav kk-howto__nav--next kk-howto__start"
          aria-label={`Start a new ${STARTER_SIZE} by ${STARTER_SIZE} game`}
          onClick={() => onStartGame(STARTER_SIZE, STARTER_DIFFICULTY)}
          aria-hidden={!atLast || undefined}
          tabIndex={atLast ? undefined : -1}
        >
          <NewGameIcon size={22} />
          <span className="kk-control__label" aria-hidden="true">
            New 3×3
          </span>
        </button>
      </div>
    </div>
  );
}

export interface HowToPlayMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The trigger's contents — supplied by the cover, so the button matches its siblings. */
  trigger: ReactNode;
  /** Class on the trigger button, paired with `trigger`. */
  triggerClassName?: string;
  /** Start a fresh game — the last page offers a one-tap "New 3×3". */
  onStartGame: (size: number, difficulty: Difficulty) => void;
}

/**
 * "How to play": a popover of the game's rules. Cover-only — the header's
 * controls are self-explanatory, so this lives with the other things a player
 * reaches for before a game rather than during one.
 */
export function HowToPlayMenu({
  open,
  onOpenChange,
  trigger,
  triggerClassName,
  onStartGame,
}: HowToPlayMenuProps) {
  return (
    <Popover
      label="How to play"
      panelLabelledBy={HEADING_ID}
      trigger={trigger}
      triggerClassName={triggerClassName}
      open={open}
      onOpenChange={onOpenChange}
    >
      {/*
        A fresh carousel each time the panel opens: the panel unmounts its
        children on close, so the child's page index resets to the first rule
        rather than reopening wherever it was last left.
      */}
      <HowToPlayCarousel onStartGame={onStartGame} />
    </Popover>
  );
}
