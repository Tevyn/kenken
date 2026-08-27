import { useEffect, useRef } from 'react';
import { CloseIcon, HamburgerIcon, NewGameIcon } from './icons';
import './WinOverlay.css';

const HEADING_ID = 'kk-win-heading';

export interface WinOverlayProps {
  /** True once the board has finished celebrating and the solve is unacknowledged. */
  visible: boolean;
  /** Leave for the menu — the same move the header's Menu control makes. */
  onMenu: () => void;
  /** Start a fresh puzzle at the size and difficulty just played. */
  onNewGame: () => void;
  /** Dismissal — the corner close button, Escape, or a press on the backdrop. */
  onDismiss: () => void;
}

/**
 * The success screen: a translucent layer that fades over the whole page once
 * the board's finish animation has played out, with the congratulation and the
 * two moves that follow held in a column no wider than the board itself.
 *
 * It is not a `PopoverPanel`. The panels float as cards over a shield that
 * paints nothing, whereas this is the dimming layer itself — a full-screen wash
 * the finished board shows faintly through. So the modal mechanics it needs —
 * announce on open, dismiss on Escape or an outside press — are its own, and it
 * deliberately does not trap focus; nothing opens over the top of it.
 *
 * Its two actions are the header's own controls, reused verbatim: the Menu
 * hamburger and the New game loop, the same glyph-over-label controls that sit
 * in the toolbar, so the success screen offers the same two moves in the same
 * shape the player already knows. New game here skips the wizard — the size and
 * difficulty are the ones just solved — and Menu returns to the cover.
 */
export function WinOverlay({ visible, onMenu, onNewGame, onDismiss }: WinOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Announce the win by moving focus into the panel the moment it appears — the
  // same thing opening a popover does.
  useEffect(() => {
    if (visible) panelRef.current?.focus();
  }, [visible]);

  // Escape dismisses. Captured so the board's global Escape never sees it either.
  useEffect(() => {
    if (!visible) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      onDismiss();
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    // A press on the backdrop — anywhere but the panel — dismisses, the same way
    // a press outside a popover does.
    <div
      className="kk-win"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        ref={panelRef}
        className="kk-win__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={HEADING_ID}
        tabIndex={-1}
      >
        <button
          type="button"
          className="kk-control kk-win__close"
          aria-label="Close"
          onClick={onDismiss}
        >
          <CloseIcon size={22} />
        </button>

        <h2 className="kk-win__title" id={HEADING_ID}>
          Nice solve!
        </h2>

        <div className="kk-win__actions">
          <button type="button" className="kk-control kk-control--stack" onClick={onMenu}>
            <HamburgerIcon size={22} />
            <span className="kk-control__label">Menu</span>
          </button>

          <button type="button" className="kk-control kk-control--stack" onClick={onNewGame}>
            <NewGameIcon size={22} />
            <span className="kk-control__label">New game</span>
          </button>
        </div>
      </div>
    </div>
  );
}
