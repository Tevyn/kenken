import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import './Popover.css';

/** Anything that can hold focus inside a panel, in DOM order. */
const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

export interface PopoverPanelProps {
  open: boolean;
  /** Dismissal — Escape, or a press outside the panel. Never a commit. */
  onClose: () => void;
  /** Accessible name, used only when `labelledBy` is not given. */
  label?: string;
  /** Id of the element naming the panel — normally its own heading. */
  labelledBy?: string;
  /**
   * The control the panel hangs off, when it has one. It is exempt from the
   * outside-press check (its own click already toggles the panel) and takes
   * focus back when the panel closes.
   */
  anchorRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * The panel half of a popover: the surface, the press shield behind it, and the
 * modal mechanics.
 *
 * Split out from `Popover` because not every panel has a trigger — the solved
 * dialog opens because the puzzle was solved, not because anything was pressed
 * — and the mechanics are the same either way: `Escape` and outside presses
 * close it, focus moves in on open and back out on close, and Tab cycles
 * within it. The panel owns the keyboard outright while it is open, so it is
 * announced as `aria-modal`.
 */
export function PopoverPanel({
  open,
  onClose,
  label,
  labelledBy,
  anchorRef,
  children,
}: PopoverPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  /** Where focus was when the panel opened; the fallback when there is no anchor. */
  const returnTo = useRef<HTMLElement | null>(null);
  /*
   * Set when a press outside the panel closed it: the player is already
   * pointing somewhere else, so yanking focus back would fight whatever they
   * just clicked.
   */
  const skipRestore = useRef(false);

  useEffect(() => {
    if (open) {
      returnTo.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      );
      /*
       * The option already marked as current is the one the player is oriented
       * by, so start there rather than at whatever happens to be first.
       *
       * A checked radio counts as current, and not only for orientation: in a
       * radio group the checked input is the group's only tab stop, so landing
       * on any other one is actively wrong.
       */
      const current = focusable.find((element) => {
        const value = element.getAttribute('aria-current');
        if (value !== null && value !== 'false') return true;
        return element instanceof HTMLInputElement && element.type === 'radio' && element.checked;
      });
      (current ?? focusable[0])?.focus();
    } else if (wasOpen.current && !skipRestore.current) {
      /*
       * Only reclaim focus that the close orphaned. One panel can close by
       * opening another — the solved dialog hands off to the new-game wizard —
       * and the arriving panel places focus itself, in an effect that runs
       * before this one. Focus on anything but `<body>` therefore means someone
       * else already owns it, and taking it back would yank the player out of
       * the panel that just opened.
       */
      const active = document.activeElement;
      if (active === null || active === document.body) {
        /*
         * The anchor first, because it outlives the panel. The remembered
         * element is the fallback for an anchorless panel, and it can be gone
         * by now — the button that was pressed may have gone with the panel —
         * so it is only used while it is still in the document.
         */
        const target = anchorRef?.current ?? returnTo.current;
        if (target?.isConnected) target.focus();
      }
    }
    wasOpen.current = open;
    skipRestore.current = false;
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    /*
     * Defensive: a skip request belongs to the close it was raised for. The
     * effect above clears it on every close, but an owner that ignored or
     * deferred one would leave it latched, so every fresh open starts clean.
     */
    skipRestore.current = false;

    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      /*
       * The anchor's own press closes the panel through its click handler
       * instead of reopening it right after this. Only the anchor is exempt:
       * checking the whole popover root, as this used to, meant the shield —
       * a child of that root — counted as inside, so a press on the page
       * behind the panel did nothing at all.
       */
      if (anchorRef?.current?.contains(target)) return;
      skipRestore.current = true;
      onClose();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      /*
       * Captured on the document, ahead of the target, so the game's global
       * Escape handler never sees it: while a panel is open the key closes the
       * panel and nothing else.
       */
      event.stopPropagation();
      event.preventDefault();
      onClose();
    }

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, onClose, anchorRef]);

  /** Keep Tab inside the panel: last wraps to first, first wraps back to last. */
  const onPanelKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey ? active === first : active === last) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }, []);

  if (!open) return null;

  return (
    <>
      {/*
        A press shield, not a backdrop. It paints nothing — the panel's own
        shadow is what lifts it off the page, and dimming the board took the
        puzzle away from a player who is still reading it — but it covers the
        page so a press outside the panel closes it and does nothing else.
        Closing is handled by the document-level mousedown listener above, so
        this deliberately carries no handlers of its own.
      */}
      <div className="kk-popover__shield" aria-hidden="true" />
      <div
        ref={panelRef}
        className="kk-popover__panel"
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        onKeyDown={onPanelKeyDown}
      >
        {children}
      </div>
    </>
  );
}

/**
 * The app's one open-panel slot. Only ever one popover at a time, and it lives
 * here rather than with any of them because the third — the keypad's hint
 * panel — is nowhere near the two in the header, and all three share the slot
 * for the same reason: an open panel owns the keyboard, so whoever owns the
 * board's shortcuts has to know one is open.
 */
export type OpenMenu = 'new-game' | 'settings' | 'hint' | null;

export interface PopoverProps {
  /** Accessible name for the trigger button. */
  label: string;
  /** Trigger button contents — an icon, optionally followed by a text label. */
  trigger: ReactNode;
  /**
   * Id of the element naming the popover surface — normally its own heading.
   * Falls back to `label` when omitted.
   */
  panelLabelledBy?: string;
  open: boolean;
  /**
   * Called with the next open state. The parent owns `open` so that opening one
   * popover can close the other.
   */
  onOpenChange: (open: boolean) => void;
  /**
   * Marks the trigger as unavailable. Rendered as `aria-disabled` rather than
   * the `disabled` attribute so the button stays focusable: closing the panel
   * restores focus to it, and a real `disabled` would silently drop focus on
   * `<body>` whenever the same commit both closes the popover and disables the
   * trigger.
   */
  disabled?: boolean;
  /** Extra class on the trigger button, for per-popover styling. */
  triggerClassName?: string;
  /** Extra class on the popover root, for per-popover placement of the trigger. */
  className?: string;
  /** Keyboard shortcut that opens this panel, advertised on the trigger. */
  triggerKeyShortcuts?: string;
  children: ReactNode;
}

/**
 * A button plus the modal panel it opens, rendered next to it in the DOM.
 *
 * Every panel is centred over the page. There used to be a second, anchored
 * placement that hung the panel off its trigger; both header popovers are big
 * enough that dangling one from a corner left it lopsided, so the choice is
 * now put where the player is already looking and the option is gone.
 *
 * Every panel opened this way also carries the same close button in its
 * corner. Escape and a press outside both close it, but neither is visible;
 * the × is the way out that can be seen, in the same place every time.
 */
export function Popover({
  label,
  trigger,
  panelLabelledBy,
  open,
  onOpenChange,
  disabled = false,
  triggerClassName,
  className,
  triggerKeyShortcuts,
  children,
}: PopoverProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <div className={className ? `kk-popover ${className}` : 'kk-popover'}>
      <button
        type="button"
        ref={triggerRef}
        className={
          triggerClassName
            ? `kk-control kk-popover__trigger ${triggerClassName}`
            : 'kk-control kk-popover__trigger'
        }
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        aria-keyshortcuts={triggerKeyShortcuts}
        onClick={() => {
          if (disabled) return;
          onOpenChange(!open);
        }}
      >
        {trigger}
      </button>

      <PopoverPanel
        open={open}
        onClose={handleClose}
        label={label}
        labelledBy={panelLabelledBy}
        anchorRef={triggerRef}
      >
        {children}

        {/*
          Permanent chrome: every panel opened by a trigger gets one whether or
          not it asked, so the way out of a popover is in the same corner every
          time. Escape and a press outside the panel do the same thing, but a
          player using a pointer has to guess that either exists.

          It is deliberately the *last* focusable thing in the panel. The open
          effect falls back to `focusable[0]` when nothing is marked current,
          and a close button ahead of the content would make that fallback "the
          way out" — the panel would open with the player's finger on the exit.
          Last also keeps it clear of the panels whose entry focus lands on a
          current option they still reach first.

          `PopoverPanel` itself does not add one: a panel with no trigger is
          not always a popover. The solved dialog is the case in point — it
          offers the move that follows instead, and a dismiss button beside it
          would make leaving look like a decision.
        */}
        <button
          type="button"
          className="kk-control kk-popover__close"
          aria-label={`Close ${label}`}
          onClick={handleClose}
        >
          ×
        </button>
      </PopoverPanel>
    </div>
  );
}
