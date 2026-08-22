import { useCallback, useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import './Popover.css'

/** Anything that can hold focus inside a panel, in DOM order. */
const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'

export interface PopoverProps {
  /** Accessible name for the trigger button. */
  label: string
  /** Trigger button contents — an icon, optionally followed by a text label. */
  trigger: ReactNode
  /**
   * Id of the element naming the popover surface — normally its own heading.
   * Falls back to `label` when omitted.
   */
  panelLabelledBy?: string
  open: boolean
  /**
   * Called with the next open state. The parent owns `open` so that opening one
   * popover can close the other.
   */
  onOpenChange: (open: boolean) => void
  /**
   * Marks the trigger as unavailable. Rendered as `aria-disabled` rather than
   * the `disabled` attribute so the button stays focusable: closing the panel
   * restores focus to it, and a real `disabled` would silently drop focus on
   * `<body>` whenever the same commit both closes the popover and disables the
   * trigger.
   */
  disabled?: boolean
  /** Extra class on the trigger button, for per-popover styling. */
  triggerClassName?: string
  children: ReactNode
}

/**
 * A button plus the modal panel it opens, rendered next to it in the DOM.
 *
 * Shared by every popover in the app so the mechanics only exist once:
 * `Escape` and outside clicks close it, focus moves into the panel on open and
 * back to the trigger on close, and Tab cycles within the panel while it is
 * open. The panel owns the keyboard outright — the game's window-level
 * shortcuts stand down while one is open — so it is announced as
 * `aria-modal`.
 */
export function Popover({
  label,
  trigger,
  panelLabelledBy,
  open,
  onOpenChange,
  disabled = false,
  triggerClassName,
  children,
}: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  /*
   * Set when a press outside the popover closed it: the player is already
   * pointing somewhere else, so yanking focus back to the trigger would fight
   * whatever they just clicked.
   */
  const skipRestore = useRef(false)

  useEffect(() => {
    if (open) {
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      )
      /*
       * The option already marked as current is the one the player is oriented
       * by, so start there rather than at whatever happens to be first.
       *
       * A checked radio counts as current, and not only for orientation: in a
       * radio group the checked input is the group's only tab stop, so landing
       * on any other one is actively wrong.
       */
      const current = focusable.find((element) => {
        const value = element.getAttribute('aria-current')
        if (value !== null && value !== 'false') return true
        return element instanceof HTMLInputElement && element.type === 'radio' && element.checked
      })
      ;(current ?? focusable[0])?.focus()
    } else if (wasOpen.current && !skipRestore.current) {
      triggerRef.current?.focus()
    }
    wasOpen.current = open
    skipRestore.current = false
  }, [open])

  useEffect(() => {
    if (!open) return
    /*
     * Defensive: a skip request belongs to the close it was raised for. The
     * effect above clears it on every close, but an owner that ignored or
     * deferred one would leave it latched, so every fresh open starts clean.
     */
    skipRestore.current = false

    function onMouseDown(event: MouseEvent) {
      // The trigger lives inside the root, so its own press closes the popover
      // through the click handler instead of reopening it right after this.
      if (rootRef.current?.contains(event.target as Node)) return
      skipRestore.current = true
      onOpenChange(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      /*
       * Captured on the document, ahead of the target, so the game's global
       * Escape handler never sees it: while a popover is open the key closes
       * the popover and nothing else.
       */
      event.stopPropagation()
      event.preventDefault()
      onOpenChange(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, onOpenChange])

  /** Keep Tab inside the panel: last wraps to first, first wraps back to last. */
  const onPanelKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (event.shiftKey ? active === first : active === last) {
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus()
    }
  }, [])

  return (
    <div className="kk-popover" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={triggerClassName ? `kk-popover__trigger ${triggerClassName}` : 'kk-popover__trigger'}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (disabled) return
          onOpenChange(!open)
        }}
      >
        {trigger}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="kk-popover__panel"
          role="dialog"
          aria-modal="true"
          aria-label={panelLabelledBy ? undefined : label}
          aria-labelledby={panelLabelledBy}
          onKeyDown={onPanelKeyDown}
        >
          {children}
        </div>
      )}
    </div>
  )
}
