import { useEffect, useRef, useState } from 'react';
import { CorrectnessIcon, HintIcon, NumberIcon, TipIcon } from './icons';
import { Popover } from './Popover';
import './HintMenu.css';

/* The panel is named by its own heading, which both screens keep. */
const HEADING_ID = 'kk-hint-menu-heading';

interface ChoicesProps {
  text: string | null;
  canCheck: boolean;
  onCorrectness: () => number;
  onTip: () => void;
  onNumber: () => boolean;
  onClose: () => void;
}

/**
 * Which screen the panel is on. Choosing is one-way until the panel closes, so
 * only one of the three can ever have been pressed: `game` shows whatever the
 * ladder last worked out, `own` a sentence the panel wrote itself.
 */
type Screen = { kind: 'choices' } | { kind: 'game' } | { kind: 'own'; text: string };

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
function HintChoices({ text, canCheck, onCorrectness, onTip, onNumber, onClose }: ChoicesProps) {
  const [screen, setScreen] = useState<Screen>(CHOICES);
  const textRef = useRef<HTMLParagraphElement>(null);
  const explaining = screen.kind !== 'choices';

  /*
   * The button that was focused has just been replaced by prose, so focus has
   * to be placed again or it falls back to the body and the panel loses its
   * keyboard flow. Landing on the sentence itself is also what reads it out:
   * a live region inside a dialog the reader has only just entered competes
   * with the dialog's own announcement.
   */
  useEffect(() => {
    if (explaining) textRef.current?.focus();
  }, [explaining]);

  return (
    <>
      <h2 className="kk-popover__heading" id={HEADING_ID}>
        Hint
      </h2>

      {screen.kind !== 'choices' ? (
        <p className="kk-hint-menu__text" ref={textRef} tabIndex={-1}>
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
        </div>
      )}
    </>
  );
}

export interface HintMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The sentence the game currently has to offer, or null when it has none. */
  text: string | null;
  /** Whether the board has anything filled in for the check to judge. */
  canCheck: boolean;
  /** Judge every filled cell against the solution. Reports how many were wrong. */
  onCorrectness: () => number;
  /** Explain the easiest step available, in words and on the board. */
  onTip: () => void;
  /** Write the next digit. Reports false when there was none to write. */
  onNumber: () => boolean;
}

/**
 * The Hint button and the panel it opens.
 *
 * One press, three choices — the button no longer renames itself, because
 * nothing is ever armed behind it. What replaced the old second press is the
 * Number choice, which writes a digit outright.
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
  onCorrectness,
  onTip,
  onNumber,
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
        onCorrectness={onCorrectness}
        onTip={onTip}
        onNumber={onNumber}
        onClose={() => onOpenChange(false)}
      />
    </Popover>
  );
}
