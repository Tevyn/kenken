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
const closeButton = () => screen.getByRole('button', { name: 'Close Settings' });

describe('Popover', () => {
  it('carries a close button', async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);

    expect(screen.queryByRole('button', { name: 'Close Settings' })).not.toBeInTheDocument();

    await user.click(trigger());
    expect(closeButton()).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toContainElement(closeButton());
  });

  it('the close button closes the panel', async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);

    await user.click(trigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(closeButton());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  /*
   * The press has to land as an inside press: the outside-click path
   * deliberately suppresses the focus restore, and it would strand focus on
   * the body for a player who pressed the panel's own button.
   */
  it('closing the panel with it returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);

    await user.click(trigger());
    await user.click(closeButton());
    expect(trigger()).toHaveFocus();
  });

  it('names the panel it closes rather than saying only "close"', async () => {
    const user = userEvent.setup();
    render(<PopoverHarness label="New game" />);

    await user.click(screen.getByRole('button', { name: 'New game' }));
    expect(screen.getByRole('button', { name: 'Close New game' })).toBeInTheDocument();
  });

  it('opens focused on the panel content, never on the way out of it', async () => {
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

  it('takes entry focus itself when it is the only control in the panel', async () => {
    const user = userEvent.setup();
    render(
      <PopoverHarness>
        <p>Just prose.</p>
      </PopoverHarness>,
    );

    await user.click(trigger());
    expect(closeButton()).toHaveFocus();
  });

  it('joins the Tab cycle as its last stop, and the cycle still wraps', async () => {
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

    await user.tab();
    expect(closeButton()).toHaveFocus();

    // Off the end of the panel is the top of the panel, not the page behind it.
    await user.tab();
    expect(first).toHaveFocus();

    await user.tab({ shift: true });
    expect(closeButton()).toHaveFocus();

    expect(screen.getByRole('button', { name: 'outside' })).not.toHaveFocus();
  });
});
