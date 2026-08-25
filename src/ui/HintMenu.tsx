import { useCallback, useEffect, useRef, useState } from 'react';
import type { CombinationsView } from '../game/useGame';
import { CombinationsIcon, CorrectnessIcon, HintIcon, NumberIcon, TipIcon } from './icons';
import { Popover } from './Popover';
import './HintMenu.css';

/* The panel is named by its own heading, which both screens keep. */
const HEADING_ID = 'kk-hint-menu-heading';

interface ChoicesProps {
  text: string | null;
  canCheck: boolean;
  canCombine: boolean;
  onCorrectness: () => number;
  onTip: () => void;
  onNumber: () => boolean;
  onCombinations: () => CombinationsView | null;
  onClose: () => void;
}

/**
 * Which screen the panel is on. Choosing is one-way until the panel closes, so
 * only one of the four can ever have been pressed: `game` shows whatever the
 * ladder last worked out, `own` a sentence the panel wrote itself, and
 * `combinations` the cage's combination list.
 */
type Screen =
  | { kind: 'choices' }
  | { kind: 'game' }
  | { kind: 'own'; text: string }
  | { kind: 'combinations'; view: CombinationsView };

const CHOICES: Screen = { kind: 'choices' };

/** The check's whole answer in words. The board carries the rest of it. */
function verdictText(wrong: number): string {
  if (wrong === 0) return 'Everything is correct';
  if (wrong === 1) return 'The marked cell is incorrect';
  return `The ${wrong} marked cells are incorrect`;
}

/**
 * The panel's contents: three choices, or the sentence one of them produced.
 *
 * Its own component so which screen is showing lives and dies with the open
 * panel — the popover unmounts its children on close, so reopening always
 * starts back at the three choices with nothing to reset.
 */
function HintChoices({
  text,
  canCheck,
  canCombine,
  onCorrectness,
  onTip,
  onNumber,
  onCombinations,
  onClose,
}: ChoicesProps) {
  const [screen, setScreen] = useState<Screen>(CHOICES);
  const contentRef = useRef<HTMLElement | null>(null);
  const setContent = useCallback((element: HTMLElement | null) => {
    contentRef.current = element;
  }, []);
  const explaining = screen.kind !== 'choices';

  /*
   * The button that was focused has just been replaced by content, so focus has
   * to be placed again or it falls back to the body and the panel loses its
   * keyboard flow. Landing on the content itself is also what reads it out:
   * a live region inside a dialog the reader has only just entered competes
   * with the dialog's own announcement. A callback ref rather than a typed one
   * because the content is a `<p>` for a sentence and a `<div>` for the
   * combination list, and only one is mounted at a time.
   */
  useEffect(() => {
    if (explaining) contentRef.current?.focus();
  }, [explaining]);

  return (
    <>
      <h2 className="kk-popover__heading" id={HEADING_ID}>
        Hint
      </h2>

      {screen.kind === 'combinations' ? (
        <CombinationList view={screen.view} setContent={setContent} />
      ) : screen.kind !== 'choices' ? (
        <p
          className="kk-hint-menu__text"
          ref={(element) => setContent(element)}
          tabIndex={-1}
        >
          {screen.kind === 'own' ? screen.text : text}
        </p>
      ) : (
        <div className="kk-hint-menu__choices">
          {/*
            Correctness has a sentence either way — a count of what is wrong, or
            the news that nothing is — so it stays open and says it, exactly as
            Tip does. It used to close on the press, back when its whole answer
            was painted on the board and a panel over the action row would have
            covered part of what it just said.

            Disabled on an empty board: there is nothing to judge, and the
            choice removes its ink rather than gaining chrome (§4.2.1). Tip and
            Number both have something to say about a blank grid, so neither
            goes with it.
          */}
          <button
            type="button"
            className="kk-control kk-control--stack kk-hint-menu__choice"
            disabled={!canCheck}
            onClick={() => setScreen({ kind: 'own', text: verdictText(onCorrectness()) })}
          >
            <CorrectnessIcon size={22} />
            <span className="kk-control__label">Correctness</span>
          </button>
          <button
            type="button"
            className="kk-control kk-control--stack kk-hint-menu__choice"
            onClick={() => {
              onTip();
              setScreen({ kind: 'game' });
            }}
          >
            <TipIcon size={22} />
            <span className="kk-control__label">Tip</span>
          </button>
          {/*
            A number that could not be found is still an answer, and the ladder
            has one — a mistake, a dead end, a finished grid. So the panel stays
            open and says it rather than swallowing the press.
          */}
          <button
            type="button"
            className="kk-control kk-control--stack kk-hint-menu__choice"
            onClick={() => {
              if (onNumber()) onClose();
              else setScreen({ kind: 'game' });
            }}
          >
            <NumberIcon size={22} />
            <span className="kk-control__label">Number</span>
          </button>
          {/*
            Combinations lists the digit sets the selected cell's cage could
            hold, so it needs a cage to talk about. Disabled with no selection,
            for the same reason Correctness is disabled on an empty board: the
            choice loses its ink rather than gaining chrome (§4.2.1). It stays
            open and shows its list, the way Tip stays open and shows its
            sentence — there is nothing to write on the board, so nothing to get
            out of the way of.
          */}
          <button
            type="button"
            className="kk-control kk-control--stack kk-hint-menu__choice"
            disabled={!canCombine}
            onClick={() => {
              const view = onCombinations();
              if (view) setScreen({ kind: 'combinations', view });
            }}
          >
            <CombinationsIcon size={22} />
            <span className="kk-control__label">Combinations</span>
          </button>
        </div>
      )}
    </>
  );
}

/**
 * The combination list, shown in place of the choices once Combinations is
 * pressed. A caption names the cage, then every combination in turn — the ones
 * the board still allows first, the ones it has ruled out struck through and
 * greyed below them (the engine has already sorted them that way).
 *
 * The list is a focus target of its own (`tabIndex={-1}`), like the tip
 * sentence, so pressing the choice does not orphan focus on the body. Ruled-out
 * lines carry both a strike-through and a spoken "(ruled out)" tail, so the
 * distinction never rests on colour alone (STYLE_GUIDE.md §2.4).
 */
function CombinationList({
  view,
  setContent,
}: {
  view: CombinationsView;
  setContent: (element: HTMLElement | null) => void;
}) {
  return (
    <div className="kk-combos" ref={setContent} tabIndex={-1}>
      <p className="kk-combos__caption">Ways to make {view.cageLabel}</p>
      {view.lines === null ? (
        <p className="kk-combos__note">Too many combinations to list</p>
      ) : (
        <ul className="kk-combos__list">
          {view.lines.map((line) => (
            <li
              key={line.text}
              className={
                line.possible
                  ? 'kk-combos__item'
                  : 'kk-combos__item kk-combos__item--ruled-out'
              }
            >
              <span aria-hidden={!line.possible || undefined}>{line.text}</span>
              {!line.possible && <span className="kk-sr-only">{line.text}, ruled out</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface HintMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The sentence the game currently has to offer, or null when it has none. */
  text: string | null;
  /** Whether the board has anything filled in for the check to judge. */
  canCheck: boolean;
  /** Whether a cell is selected, so a cage exists to list combinations for. */
  canCombine: boolean;
  /** Judge every filled cell against the solution. Reports how many were wrong. */
  onCorrectness: () => number;
  /** Explain the easiest step available, in words and on the board. */
  onTip: () => void;
  /** Write the next digit. Reports false when there was none to write. */
  onNumber: () => boolean;
  /** List the selected cell's cage combinations. Null when nothing is selected. */
  onCombinations: () => CombinationsView | null;
}

/**
 * The Hint button and the panel it opens.
 *
 * One press, four choices — the button no longer renames itself, because
 * nothing is ever armed behind it. What replaced the old second press is the
 * Number choice, which writes a digit outright; Combinations is the fourth,
 * listing the ways the selected cell's cage could be filled.
 *
 * The panel hangs off the button's left rather than below it: the controls are
 * anchored to the bottom of the viewport (STYLE_GUIDE.md §1.1), so downward is
 * off the screen, and the button is the last of four, so rightward is off the
 * edge. It lands over Undo, Redo and Notes, which are unusable while a modal
 * panel is open anyway — and beside, not on top of, the Hint button itself,
 * which stays where the player left it.
 */
export function HintMenu({
  open,
  onOpenChange,
  text,
  canCheck,
  canCombine,
  onCorrectness,
  onTip,
  onNumber,
  onCombinations,
}: HintMenuProps) {
  return (
    <Popover
      label="Hint"
      panelLabelledBy={HEADING_ID}
      className="kk-hint-menu"
      trigger={
        <>
          <HintIcon size={22} />
          <span className="kk-control__label">Hint</span>
        </>
      }
      triggerClassName="kk-control--stack kk-keypad__action"
      triggerKeyShortcuts="H"
      open={open}
      onOpenChange={onOpenChange}
    >
      <HintChoices
        text={text}
        canCheck={canCheck}
        canCombine={canCombine}
        onCorrectness={onCorrectness}
        onTip={onTip}
        onNumber={onNumber}
        onCombinations={onCombinations}
        onClose={() => onOpenChange(false)}
      />
    </Popover>
  );
}
