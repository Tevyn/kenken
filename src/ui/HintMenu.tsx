import { useEffect, useRef, useState } from 'react'
import { CorrectnessIcon, HintIcon, NumberIcon, TipIcon } from './icons'
import { Popover } from './Popover'
import './HintMenu.css'

/* The panel is named by its own heading, which both screens keep. */
const HEADING_ID = 'kk-hint-menu-heading'

interface ChoicesProps {
  text: string | null
  onCorrectness: () => void
  onTip: () => void
  onNumber: () => boolean
  onClose: () => void
}

/**
 * The panel's contents: three choices, or the sentence one of them produced.
 *
 * Its own component so which screen is showing lives and dies with the open
 * panel — the popover unmounts its children on close, so reopening always
 * starts back at the three choices with nothing to reset.
 */
function HintChoices({ text, onCorrectness, onTip, onNumber, onClose }: ChoicesProps) {
  const [explaining, setExplaining] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)

  /*
   * The button that was focused has just been replaced by prose, so focus has
   * to be placed again or it falls back to the body and the panel loses its
   * keyboard flow. Landing on the sentence itself is also what reads it out:
   * a live region inside a dialog the reader has only just entered competes
   * with the dialog's own announcement.
   */
  useEffect(() => {
    if (explaining) textRef.current?.focus()
  }, [explaining])

  return (
    <>
      <h2 className="kk-popover__heading" id={HEADING_ID}>
        Hint
      </h2>

      {explaining ? (
        <p className="kk-hint-menu__text" ref={textRef} tabIndex={-1}>
          {text}
        </p>
      ) : (
        <div className="kk-hint-menu__choices">
          {/*
            Correctness gets out of the way immediately: its whole answer is
            painted on the board, and a panel parked over the action row would
            be covering part of what it just said.
          */}
          <button
            type="button"
            className="kk-control kk-control--stack kk-hint-menu__choice"
            onClick={() => {
              onCorrectness()
              onClose()
            }}
          >
            <CorrectnessIcon size={22} />
            <span className="kk-control__label">Correctness</span>
          </button>
          <button
            type="button"
            className="kk-control kk-control--stack kk-hint-menu__choice"
            onClick={() => {
              onTip()
              setExplaining(true)
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
              if (onNumber()) onClose()
              else setExplaining(true)
            }}
          >
            <NumberIcon size={22} />
            <span className="kk-control__label">Number</span>
          </button>
        </div>
      )}
    </>
  )
}

export interface HintMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The sentence the game currently has to offer, or null when it has none. */
  text: string | null
  /** Judge every filled cell against the solution. */
  onCorrectness: () => void
  /** Explain the easiest step available, in words and on the board. */
  onTip: () => void
  /** Write the next digit. Reports false when there was none to write. */
  onNumber: () => boolean
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
 * off the screen, and the button is the last of five, so rightward is off the
 * edge. It lands over Undo, Redo, Erase and Notes, which are unusable while a
 * modal panel is open anyway.
 */
export function HintMenu({
  open,
  onOpenChange,
  text,
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
        onCorrectness={onCorrectness}
        onTip={onTip}
        onNumber={onNumber}
        onClose={() => onOpenChange(false)}
      />
    </Popover>
  )
}
