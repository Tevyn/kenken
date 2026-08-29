import type { ChangeEvent, ComponentType, ReactNode } from 'react';
import type { Theme } from '../game/preferences';
import { THEMES } from '../game/preferences';
import type { IconProps } from './icons';
import { MenuIcon, ThemeDarkIcon, ThemeLightIcon, ThemeSystemIcon } from './icons';
import { Popover } from './Popover';
import './SettingsMenu.css';

export interface SettingsMenuProps {
  /** Whether entering a value also strips it from the row/column peers' notes. */
  autoClearMarks: boolean;
  onAutoClearMarksChange: (enabled: boolean) => void;
  /** Whether the one-cell "freebie" cages are filled in for the player. */
  autoFillSingleCages: boolean;
  onAutoFillSingleCagesChange: (enabled: boolean) => void;
  /** Whether notes that cannot go where they are written are reddened. */
  highlightWrongNotes: boolean;
  onHighlightWrongNotesChange: (enabled: boolean) => void;
  /** Which palette to paint, or `system` to follow the OS. */
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Override the trigger's contents. The header wants the stacked glyph-over-
   * label control; the cover wants a plain text button. Same panel either way.
   */
  trigger?: ReactNode;
  /** Class on the trigger button, paired with `trigger`. Defaults to the stacked control. */
  triggerClassName?: string;
}

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const THEME_ICONS: Record<Theme, ComponentType<IconProps>> = {
  light: ThemeLightIcon,
  dark: ThemeDarkIcon,
  system: ThemeSystemIcon,
};

/**
 * A shade under the wizard's 32px tiles. These glyphs name a choice rather
 * than depict one — there is nothing in a sun to count — and three of them
 * across a panel that also holds a switch should not out-mass it.
 */
const THEME_ICON = 26;

/** The gear button and the preferences it opens. */
export function SettingsMenu({
  autoClearMarks,
  onAutoClearMarksChange,
  autoFillSingleCages,
  onAutoFillSingleCagesChange,
  highlightWrongNotes,
  onHighlightWrongNotesChange,
  theme,
  onThemeChange,
  open,
  onOpenChange,
  trigger,
  triggerClassName = 'kk-control--stack',
}: SettingsMenuProps) {
  function handleAutoClearMarksChange(event: ChangeEvent<HTMLInputElement>) {
    onAutoClearMarksChange(event.target.checked);
  }

  function handleAutoFillSingleCagesChange(event: ChangeEvent<HTMLInputElement>) {
    onAutoFillSingleCagesChange(event.target.checked);
  }

  function handleHighlightWrongNotesChange(event: ChangeEvent<HTMLInputElement>) {
    onHighlightWrongNotesChange(event.target.checked);
  }

  function handleThemeChange(event: ChangeEvent<HTMLInputElement>) {
    onThemeChange(event.target.value as Theme);
  }

  return (
    <Popover
      label="Settings"
      trigger={
        trigger ?? (
          <>
            <MenuIcon size={22} />
            <span className="kk-control__label">Settings</span>
          </>
        )
      }
      triggerClassName={triggerClassName}
      open={open}
      onOpenChange={onOpenChange}
    >
      {/*
        Three bare choices over a real radio group: arrow-key navigation,
        roving focus and the "3 of 3" announcement all come from the inputs,
        the same way the switch below is a real checkbox under paint.

        The current one is marked with an underline rather than a filled pill -
        a fill would read as chrome, and the accent now means ink (§4).
      */}
      <fieldset className="kk-theme">
        {/* A section label, so it takes the panel heading's line rather than a
            louder one of its own — the choices under it carry the weight. */}
        <legend className="kk-popover__heading kk-theme__legend">Theme</legend>
        <div className="kk-theme__options">
          {THEMES.map((option) => {
            const Icon = THEME_ICONS[option];
            return (
              <label className="kk-control kk-control--stack kk-theme__option" key={option}>
                {/*
                  Still the label's first child, still `inset: 0`, so it
                  covers the glyph as well as the word and the whole tile is
                  one hit target. The glyph sits between it and the text, which
                  the `~` underline selector is indifferent to.
                */}
                <input
                  className="kk-theme__input"
                  type="radio"
                  name="kk-theme"
                  value={option}
                  checked={theme === option}
                  onChange={handleThemeChange}
                />
                <Icon size={THEME_ICON} />
                <span className="kk-control__label kk-theme__text">{THEME_LABELS[option]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="kk-settings__setting">
        {/*
          A real checkbox under the track and knob: keyboard, focus and
          assistive-tech behaviour come from the input, and `role="switch"`
          announces it as the on/off control it looks like.
        */}
        <label className="kk-switch" htmlFor="kk-auto-clear-marks">
          <span className="kk-switch__text">Auto-clear notes</span>
          <input
            id="kk-auto-clear-marks"
            className="kk-switch__input"
            type="checkbox"
            role="switch"
            checked={autoClearMarks}
            onChange={handleAutoClearMarksChange}
          />
          <span className="kk-switch__track" aria-hidden="true">
            <span className="kk-switch__knob" />
          </span>
        </label>
      </div>

      <div className="kk-settings__setting">
        {/* Same switch, for the one-cell "freebie" cages: on, they are filled
            in for the player and kept filled as new games start. */}
        <label className="kk-switch" htmlFor="kk-auto-fill-single-cages">
          <span className="kk-switch__text">Auto-fill single cages</span>
          <input
            id="kk-auto-fill-single-cages"
            className="kk-switch__input"
            type="checkbox"
            role="switch"
            checked={autoFillSingleCages}
            onChange={handleAutoFillSingleCagesChange}
          />
          <span className="kk-switch__track" aria-hidden="true">
            <span className="kk-switch__knob" />
          </span>
        </label>
      </div>

      <div className="kk-settings__setting">
        {/* Same switch, for the red note highlight: on, a pencil mark for a digit
            a row or column peer already holds is drawn red. */}
        <label className="kk-switch" htmlFor="kk-highlight-wrong-notes">
          <span className="kk-switch__text">Highlight wrong notes</span>
          <input
            id="kk-highlight-wrong-notes"
            className="kk-switch__input"
            type="checkbox"
            role="switch"
            checked={highlightWrongNotes}
            onChange={handleHighlightWrongNotesChange}
          />
          <span className="kk-switch__track" aria-hidden="true">
            <span className="kk-switch__knob" />
          </span>
        </label>
      </div>
    </Popover>
  );
}
