import { PopoverPanel } from './Popover'
import './WinDialog.css'

const HEADING_ID = 'kk-win-heading'

export interface WinDialogProps {
  /** True once the grid matches the solution and the dialog has not been dismissed. */
  visible: boolean
  /** Dismissal — Escape, or a press outside. The puzzle stays solved. */
  onDismiss: () => void
  /** Hands off to the new-game wizard, which owns the size and difficulty choice. */
  onNewGame: () => void
}

/**
 * The solved state, as a panel like every other.
 *
 * It used to be a green banner wedged under the board, which pushed the keypad
 * down at the exact moment the game ended and then sat there for good. As a
 * panel it arrives over the finished grid, says one thing, offers the one move
 * that follows, and gets out of the way on Escape or a press outside — the
 * board is still there to look at.
 *
 * There is no dismiss button: closing is the same gesture it is on every other
 * panel, and a second button beside "New game" would make leaving the dialog
 * look like a decision.
 */
export function WinDialog({ visible, onDismiss, onNewGame }: WinDialogProps) {
  return (
    <PopoverPanel open={visible} onClose={onDismiss} labelledBy={HEADING_ID}>
      <div className="kk-win">
        <h2 className="kk-popover__heading" id={HEADING_ID}>
          Solved
        </h2>
        {/*
          The panel takes focus when it opens, which announces it — but the
          congratulation is the message, not the name, so it is a live region
          in its own right.
        */}
        <p className="kk-win__text" role="status">
          Nice work.
        </p>
        <button type="button" className="kk-control kk-win__action" onClick={onNewGame}>
          New game
        </button>
      </div>
    </PopoverPanel>
  )
}
