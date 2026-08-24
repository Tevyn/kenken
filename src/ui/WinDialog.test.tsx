import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WinDialog } from './WinDialog';

function baseProps() {
  return { onDismiss: vi.fn(), onNewGame: vi.fn() };
}

describe('WinDialog', () => {
  it('renders nothing while the puzzle is unsolved', () => {
    const { container } = render(<WinDialog visible={false} {...baseProps()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces the win in a modal panel named by its heading', () => {
    render(<WinDialog visible {...baseProps()} />);

    const dialog = screen.getByRole('dialog', { name: 'Solved' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(/nice work/i);
  });

  it('opens focused on the one move that follows', () => {
    render(<WinDialog visible {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'New game' })).toHaveFocus();
  });

  it('the new-game button hands off rather than dismissing', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<WinDialog visible {...props} />);

    await user.click(screen.getByRole('button', { name: 'New game' }));
    expect(props.onNewGame).toHaveBeenCalledTimes(1);
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it('Escape dismisses it', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<WinDialog visible {...props} />);

    await user.keyboard('{Escape}');
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('a press outside dismisses it, so the finished board can be looked at', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(
      <div>
        <WinDialog visible {...props} />
        <p>the board</p>
      </div>,
    );

    await user.click(screen.getByText('the board'));
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('a press inside it does not', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<WinDialog visible {...props} />);

    await user.click(screen.getByRole('heading', { name: 'Solved' }));
    expect(props.onDismiss).not.toHaveBeenCalled();
  });
});
