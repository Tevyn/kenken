import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Popover } from './Popover';
import type { PopoverProps } from './Popover';

/** The parent owns `open`, so the tests supply the state the component lacks. */
function PopoverHarness({
  label = 'Settings',
  children,
  ...rest
}: Partial<Omit<PopoverProps, 'open' | 'onOpenChange'>>) {
  const [open, setOpen] = useState(false);
  return (
    <Popover label={label} trigger={label} open={open} onOpenChange={setOpen} {...rest}>
      {children ?? (
        <>
          <button type="button">First</button>
          <button type="button">Second</button>
        </>
      )}
    </Popover>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Settings' });

describe('Popover', () => {
  /*
   * There is no close button: every panel is dismissed by Escape or a press
   * outside, and both are covered here and in Controls.test. This asserts the
   * absence so a stray × cannot creep back into the chrome unnoticed.
   */
  it('carries no close button', async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);

    await user.click(trigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Close/ })).not.toBeInTheDocument();
  });

  it('Escape closes the panel and hands focus back to the trigger', async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);

    await user.click(trigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveFocus();
  });

  it('opens focused on the panel content', async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);

    await user.click(trigger());
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('still opens on the current choice when the panel marks one', async () => {
    const user = userEvent.setup();
    render(
      <PopoverHarness>
        <button type="button">First</button>
        <button type="button" aria-current="true">
          Current
        </button>
      </PopoverHarness>,
    );

    await user.click(trigger());
    expect(screen.getByRole('button', { name: 'Current' })).toHaveFocus();
  });

  /*
   * A panel with nothing focusable — the hint panel's tip screen is the real
   * case — has no entry target, so focus stays on the trigger rather than
   * falling to the body. Escape is then the only way back out, which the
   * tap-out model already relies on.
   */
  it('leaves focus on the trigger when the panel has nothing focusable', async () => {
    const user = userEvent.setup();
    render(
      <PopoverHarness>
        <p>Just prose.</p>
      </PopoverHarness>,
    );

    await user.click(trigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('keeps Tab inside the panel, and the cycle wraps', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <PopoverHarness />
        <button type="button">outside</button>
      </div>,
    );

    await user.click(trigger());
    const first = screen.getByRole('button', { name: 'First' });

    await user.tab();
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus();

    // Off the end of the panel is the top of the panel, not the page behind it.
    await user.tab();
    expect(first).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus();

    expect(screen.getByRole('button', { name: 'outside' })).not.toHaveFocus();
  });
});
