import type { ChangeEvent } from 'react'
import type { Theme } from '../game/preferences'
import { THEMES } from '../game/preferences'
import { MenuIcon } from './icons'
import { Popover } from './Popover'
import './SettingsMenu.css'

export interface SettingsMenuProps {
  /** Whether entering a value also strips it from the row/column peers' notes. */
  autoClearMarks: boolean
  onAutoClearMarksChange: (enabled: boolean) => void
  /** Which palette to paint, or `system` to follow the OS. */
  theme: Theme
  onThemeChange: (theme: Theme) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

/** The gear button and the preferences it opens. */
export function SettingsMenu({
  autoClearMarks,
  onAutoClearMarksChange,
  theme,
  onThemeChange,
  open,
  onOpenChange,
}: SettingsMenuProps) {
  function handleAutoClearMarksChange(event: ChangeEvent<HTMLInputElement>) {
    onAutoClearMarksChange(event.target.checked)
  }

  function handleThemeChange(event: ChangeEvent<HTMLInputElement>) {
    onThemeChange(event.target.value as Theme)
  }

  return (
    <Popover
      label="Settings"
      panelLabelledBy="kk-settings-heading"
      trigger={
        <>
          <MenuIcon size={22} />
          <span className="kk-control__label">Settings</span>
        </>
      }
      triggerClassName="kk-control--stack"
      open={open}
      onOpenChange={onOpenChange}
    >
      <h2 className="kk-popover__heading kk-settings__heading" id="kk-settings-heading">
        Settings
      </h2>

      {/*
        Three bare choices over a real radio group: arrow-key navigation,
        roving focus and the "3 of 3" announcement all come from the inputs,
        the same way the switch below is a real checkbox under paint.

        The current one is marked with an underline rather than a filled pill -
        a fill would read as chrome, and the accent now means ink (§4).
      */}
      <fieldset className="kk-theme">
        <legend className="kk-theme__legend">Theme</legend>
        <div className="kk-theme__options">
          {THEMES.map((option) => (
            <label className="kk-control kk-theme__option" key={option}>
              <input
                className="kk-theme__input"
                type="radio"
                name="kk-theme"
                value={option}
                checked={theme === option}
                onChange={handleThemeChange}
              />
              <span className="kk-theme__text">{THEME_LABELS[option]}</span>
            </label>
          ))}
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
            aria-describedby="kk-auto-clear-marks-help"
            onChange={handleAutoClearMarksChange}
          />
          <span className="kk-switch__track" aria-hidden="true">
            <span className="kk-switch__knob" />
          </span>
        </label>
        <p className="kk-settings__help" id="kk-auto-clear-marks-help">
          Erase notes that a newly entered digit rules out in that row and column
        </p>
      </div>
    </Popover>
  )
}
