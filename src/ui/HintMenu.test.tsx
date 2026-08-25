import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HintMenu } from './HintMenu';
import type { HintMenuProps } from './HintMenu';

/** The parent owns `open`, so the tests supply the state the component lacks. */
function HintMenuHarness(props: Partial<Omit<HintMenuProps, 'open' | 'onOpenChange'>>) {
  const [open, setOpen] = useState(false);
  return (
    <HintMenu
      text={null}
      canCheck
      canCombine
      onCorrectness={() => 0}
      onTip={() => {}}
      onNumber={() => true}
      onCombinations={() => ({ cageLabel: '2÷', lines: [] })}
      {...props}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

const trigger = () => screen.getByRole('button', { name: 'Hint' });
const choice = (name: string) => screen.getByRole('button', { name });

describe('HintMenu', () => {
  it('opens on the four choices, focused on the first', async () => {
    const user = userEvent.setup();
    render(<HintMenuHarness />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(trigger());

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Hint');
    for (const name of ['Correctness', 'Tip', 'Number', 'Combinations']) {
      expect(choice(name)).toBeInTheDocument();
    }
    expect(choice('Correctness')).toHaveFocus();
  });

  /*
   * Like Tip: the check has a sentence either way, so it replaces the choices
   * with it rather than closing. The board carries the rest of the answer.
   */
  it('Correctness runs the check and says what it found, in the same panel', async () => {
    const user = userEvent.setup();
    const onCorrectness = vi.fn(() => 2);
    render(<HintMenuHarness onCorrectness={onCorrectness} />);

    await user.click(trigger());
    await user.click(choice('Correctness'));

    expect(onCorrectness).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('The 2 marked cells are incorrect')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Correctness' })).not.toBeInTheDocument();
  });

  it('says so, and only so, when the check finds nothing wrong', async () => {
    const user = userEvent.setup();
    render(<HintMenuHarness onCorrectness={() => 0} text="a tip nobody asked for" />);

    await user.click(trigger());
    await user.click(choice('Correctness'));

    expect(screen.getByText('Everything is correct')).toBeInTheDocument();
    // Its own sentence, not whatever the ladder last had to say.
    expect(screen.queryByText('a tip nobody asked for')).not.toBeInTheDocument();
  });

  it('counts one wrong cell in the singular', async () => {
    const user = userEvent.setup();
    render(<HintMenuHarness onCorrectness={() => 1} />);

    await user.click(trigger());
    await user.click(choice('Correctness'));

    expect(screen.getByText('The marked cell is incorrect')).toBeInTheDocument();
  });

  /* Nothing filled in is nothing to judge. §4.2.1: the choice loses its ink. */
  it('disables Correctness on an empty board, and only Correctness', async () => {
    const user = userEvent.setup();
    const onCorrectness = vi.fn(() => 0);
    render(<HintMenuHarness canCheck={false} onCorrectness={onCorrectness} />);

    await user.click(trigger());
    expect(choice('Correctness')).toBeDisabled();
    expect(choice('Tip')).toBeEnabled();
    expect(choice('Number')).toBeEnabled();

    await user.click(choice('Correctness'));
    expect(onCorrectness).not.toHaveBeenCalled();
    expect(choice('Correctness')).toBeInTheDocument();
  });

  /* A disabled button is not a tab stop, so entry focus falls to the next one -
     Combinations, which sits second in the row. */
  it('opens focused on Combinations when Correctness is disabled', async () => {
    const user = userEvent.setup();
    render(<HintMenuHarness canCheck={false} />);

    await user.click(trigger());
    expect(choice('Combinations')).toHaveFocus();
  });

  it('Tip replaces the choices with the sentence, in the same panel', async () => {
    const user = userEvent.setup();
    const onTip = vi.fn();
    render(<HintMenuHarness onTip={onTip} text="This cell has to be 2" />);

    await user.click(trigger());
    await user.click(choice('Tip'));

    expect(onTip).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('This cell has to be 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tip' })).not.toBeInTheDocument();
  });

  /*
   * The button the player pressed has just been replaced by prose. Left alone,
   * focus falls back to the body and the panel loses its keyboard flow - and
   * landing on the sentence is also what reads it out.
   */
  it('focus follows the sentence in, and Escape is the way back out', async () => {
    const user = userEvent.setup();
    render(<HintMenuHarness text="Only 1 can go here in row 4" />);

    await user.click(trigger());
    await user.click(choice('Tip'));
    expect(screen.getByText('Only 1 can go here in row 4')).toHaveFocus();

    // The tip screen has no focusable control of its own, so Escape closes it.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Number writes its digit and closes', async () => {
    const user = userEvent.setup();
    const onNumber = vi.fn(() => true);
    render(<HintMenuHarness onNumber={onNumber} />);

    await user.click(trigger());
    await user.click(choice('Number'));

    expect(onNumber).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /* Nothing to place is still an answer, and swallowing the press is not. */
  it('Number with nothing to place stays open and says so', async () => {
    const user = userEvent.setup();
    render(<HintMenuHarness onNumber={() => false} text="Every step is already taken" />);

    await user.click(trigger());
    await user.click(choice('Number'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Every step is already taken')).toBeInTheDocument();
  });

  /* Like Tip: the list has something to show, so it replaces the choices with
     it rather than closing. There is nothing to write on the board. */
  it('Combinations lists the cage, possible ones first, in the same panel', async () => {
    const user = userEvent.setup();
    const onCombinations = vi.fn(() => ({
      cageLabel: '2÷',
      lines: [
        { text: '2 ÷ 1', possible: true },
        { text: '4 ÷ 2', possible: true },
        { text: '6 ÷ 3', possible: false },
      ],
    }));
    render(<HintMenuHarness onCombinations={onCombinations} />);

    await user.click(trigger());
    await user.click(choice('Combinations'));

    expect(onCombinations).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Ways to make 2÷')).toBeInTheDocument();
    expect(screen.getByText('2 ÷ 1')).toBeInTheDocument();
    expect(screen.getByText('4 ÷ 2')).toBeInTheDocument();
    // The list took the panel over; the choices are gone.
    expect(screen.queryByRole('button', { name: 'Combinations' })).not.toBeInTheDocument();
  });

  /* Ruled-out combinations carry a spoken tail, so the state never rests on the
     strike-through colour alone. */
  it('marks a ruled-out combination for assistive tech', async () => {
    const user = userEvent.setup();
    const onCombinations = vi.fn(() => ({
      cageLabel: '2÷',
      lines: [
        { text: '2 ÷ 1', possible: true },
        { text: '6 ÷ 3', possible: false },
      ],
    }));
    render(<HintMenuHarness onCombinations={onCombinations} />);

    await user.click(trigger());
    await user.click(choice('Combinations'));

    expect(screen.getByText('6 ÷ 3, ruled out')).toBeInTheDocument();
  });

  /* No selection, no cage to list. §4.2.1: the choice loses its ink. */
  it('disables Combinations when nothing is selected', async () => {
    const user = userEvent.setup();
    const onCombinations = vi.fn(() => null);
    render(<HintMenuHarness canCombine={false} onCombinations={onCombinations} />);

    await user.click(trigger());
    expect(choice('Combinations')).toBeDisabled();

    await user.click(choice('Combinations'));
    expect(onCombinations).not.toHaveBeenCalled();
    expect(choice('Combinations')).toBeInTheDocument();
  });

  /* A cage too big to enumerate says so rather than showing an empty list. */
  it('falls back to a note when there are too many combinations', async () => {
    const user = userEvent.setup();
    render(<HintMenuHarness onCombinations={() => ({ cageLabel: '20+', lines: null })} />);

    await user.click(trigger());
    await user.click(choice('Combinations'));

    expect(screen.getByText('Too many combinations to list')).toBeInTheDocument();
  });

  /* The popover unmounts its children on close, which is the whole reset. */
  it('reopening starts back at the choices', async () => {
    const user = userEvent.setup();
    render(<HintMenuHarness text="This cell has to be 2" />);

    await user.click(trigger());
    await user.click(choice('Tip'));
    expect(screen.getByText('This cell has to be 2')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(trigger());

    expect(choice('Tip')).toBeInTheDocument();
    expect(screen.queryByText('This cell has to be 2')).not.toBeInTheDocument();
  });
});
