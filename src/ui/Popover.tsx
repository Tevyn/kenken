import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AnimationEvent as ReactAnimationEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  RefObject,
} from 'react';
import './Popover.css';

/** Anything that can hold focus inside a panel, in DOM order. */
const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Whether an exit animation will actually run: motion is allowed, and there is
 * a real browser to run it in. Where it won't — a reader who asked for less
 * motion, or a test environment (jsdom has no `matchMedia`) — the closing panel
 * unmounts at once instead of waiting for an `animationend` that never comes.
 */
function exitAnimates(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

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
  /**
   * Keep the panel mounted through an exit animation. Off by default: a panel
   * just disappears on close. When on, the panel stays in the DOM after `open`
   * goes false and carries `data-state="closing"` until its own CSS animation
   * ends, then unmounts — so the stylesheet can slide it out. `data-state` is
   * `"open"` the rest of the time, which is also what the entry animation runs
   * on. Only the hint sheet uses this (HintMenu.css).
   */
  animated?: boolean;
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
  animated = false,
  children,
}: PopoverPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  /*
   * Whether the panel is in the DOM, which lags `open` on the way out only when
   * an exit animation has to finish first. Mount is immediate — the render-phase
   * update below lands before this commit paints, so the entry-focus effect
   * still finds the panel on the same commit `open` turned true. A non-animated
   * panel ignores this entirely and keys off `open`.
   */
  const [rendered, setRendered] = useState(open);
  if (animated && open && !rendered) setRendered(true);
  /*
   * Linger past the close only for a slide-out that will actually run. Where it
   * won't — a reader who asked for less motion, or a test with no `matchMedia`
   * — the panel is gone the moment `open` is, derived right here rather than
   * chased down through an effect.
   */
  const show = animated ? open || (rendered && exitAnimates()) : open;

  /*
   * The panel's own slide-out is what unmounts it. A child's animation ending,
   * or the slide-in ending, must not — hence the target check and the `!open`
   * guard, which also means a reopen mid-close simply cancels the unmount.
   */
  const handleAnimationEnd = useCallback(
    (event: ReactAnimationEvent<HTMLDivElement>) => {
      if (event.target !== panelRef.current) return;
      if (!open) setRendered(false);
    },
    [open],
  );

  /*
   * A safety net for the slide-out. `animationend` above is the exact unmount;
   * this only matters if that event never arrives — a backgrounded tab, say —
   * so the invisible shield can't be left sitting over the page for good. It
   * arms only while a panel is actually mid-slide-out.
   */
  useEffect(() => {
    if (!animated || open || !rendered || !exitAnimates()) return;
    const timer = window.setTimeout(() => setRendered(false), 400);
    return () => window.clearTimeout(timer);
  }, [animated, open, rendered]);
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
       *
       * The exception is focus still inside *this* panel: an animated panel
       * outlives its own close by the length of the slide-out (see `rendered`),
       * so the option that had focus is still here and still holds it. That is
       * focus the close orphaned — the panel is leaving — so it is reclaimed
       * too, ahead of the unmount that would otherwise drop it on `<body>`.
       */
      const active = document.activeElement;
      if (active === null || active === document.body || panelRef.current?.contains(active)) {
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

  if (!show) return null;

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
        data-state={open ? 'open' : 'closing'}
        onKeyDown={onPanelKeyDown}
        onAnimationEnd={handleAnimationEnd}
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
export type OpenMenu = 'new-game' | 'settings' | 'how-to-play' | 'hint' | null;

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
  /** Keep the panel mounted for a CSS exit animation. See `PopoverPanel`. */
  animated?: boolean;
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
 * There is deliberately no close button. Every panel is dismissed the same two
 * ways — Escape, or a press outside — so a visible × was a third way that only
 * these trigger-opened panels had, and the tap-out is discoverable enough on a
 * surface that floats over a shielded page.
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
  animated = false,
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
        animated={animated}
      >
        {children}
      </PopoverPanel>
    </div>
  );
}
