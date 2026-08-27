import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WinOverlay } from './WinOverlay';

function baseProps() {
  return {
    onMenu: vi.fn(),
    onNewGame: vi.fn(),
    onDismiss: vi.fn(),
  };
}

describe('WinOverlay', () => {
  it('renders nothing while the puzzle is unsolved', () => {
    const { container } = render(<WinOverlay visible={false} {...baseProps()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces the win in a modal panel named by its heading', () => {
    render(<WinOverlay visible {...baseProps()} />);

    const dialog = screen.getByRole('dialog', { name: 'Nice solve!' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Nice solve!' })).toBeInTheDocument();
  });

  it('offers the header’s own two moves', () => {
    render(<WinOverlay visible {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New game' })).toBeInTheDocument();
  });

  it('Menu leaves for the menu without dismissing in place', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<WinOverlay visible {...props} />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(props.onMenu).toHaveBeenCalledTimes(1);
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it('New game starts a fresh puzzle of the same shape', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<WinOverlay visible {...props} />);

    await user.click(screen.getByRole('button', { name: 'New game' }));
    expect(props.onNewGame).toHaveBeenCalledTimes(1);
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it('the corner close button dismisses it', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<WinOverlay visible {...props} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Escape dismisses it', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<WinOverlay visible {...props} />);

    await user.keyboard('{Escape}');
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('a press on the backdrop dismisses it, so the finished board can be looked at', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const { container } = render(<WinOverlay visible {...props} />);

    // The backdrop is the overlay root itself, everything outside the panel.
    const backdrop = container.querySelector('.kk-win') as HTMLElement;
    await user.click(backdrop);
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('a press inside the panel does not', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<WinOverlay visible {...props} />);

    await user.click(screen.getByRole('heading', { name: 'Nice solve!' }));
    expect(props.onDismiss).not.toHaveBeenCalled();
  });
});
