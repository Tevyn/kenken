import type { ReactNode } from 'react';
import { Popover } from './Popover';
import './HowToPlayMenu.css';

/* The panel is named by its heading. */
const HEADING_ID = 'kk-howtoplay-heading';

/**
 * The rules, in the order a new player needs them: the grid constraint first,
 * then what a cage is, then how a cage resolves, then the two things that trip
 * people up (repeats within a cage, and freebies).
 *
 * Deliberately the *rules* only — nothing about the keypad, hints, or notes.
 * Those controls carry their own labels and are self-explanatory (the cover's
 * own copy makes the same split), so teaching them here would only bury the
 * five sentences that actually matter under things the player can already see.
 */
const STEPS: readonly ReactNode[] = [
  <>
    Fill the grid so every row and every column holds each number from 1 to the grid’s size exactly
    once — no repeats in any line.
  </>,
  <>
    Heavy outlines divide the grid into cages. Each cage shows a target and an operation: +, −, ×,
    or ÷.
  </>,
  <>
    The numbers you place in a cage must combine, using that operation, to make the target. Order
    doesn’t matter — − and ÷ use the difference and the quotient.
  </>,
  <>
    A number may repeat inside a cage, as long as it never repeats within the same row or column.
  </>,
  <>
    A cage showing just a number, with no operation, is a freebie: that number goes straight into
    its one cell.
  </>,
];

export interface HowToPlayMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The trigger's contents — supplied by the cover, so the button matches its siblings. */
  trigger: ReactNode;
  /** Class on the trigger button, paired with `trigger`. */
  triggerClassName?: string;
}

/**
 * "How to play": a popover of the game's rules. Cover-only — the header's
 * controls are self-explanatory, so this lives with the other things a player
 * reaches for before a game rather than during one.
 */
export function HowToPlayMenu({
  open,
  onOpenChange,
  trigger,
  triggerClassName,
}: HowToPlayMenuProps) {
  return (
    <Popover
      label="How to play"
      panelLabelledBy={HEADING_ID}
      trigger={trigger}
      triggerClassName={triggerClassName}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="kk-howto">
        <h2 className="kk-howto__title" id={HEADING_ID}>
          How to play
        </h2>
        <ol className="kk-howto__steps">
          {STEPS.map((step, index) => (
            <li key={index} className="kk-howto__step">
              {step}
            </li>
          ))}
        </ol>
      </div>
    </Popover>
  );
}
