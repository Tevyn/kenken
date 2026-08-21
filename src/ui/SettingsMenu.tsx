import type { ChangeEvent } from 'react'
import { MenuIcon } from './icons'
import { Popover } from './Popover'
import './SettingsMenu.css'

export interface SettingsMenuProps {
  /** Whether entering a value also strips it from the row/column peers' pencil marks. */
  autoClearMarks: boolean
  onAutoClearMarksChange: (enabled: boolean) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The gear button and the preferences it opens. */
export function SettingsMenu({
  autoClearMarks,
  onAutoClearMarksChange,
  open,
  onOpenChange,
}: SettingsMenuProps) {
  function handleAutoClearMarksChange(event: ChangeEvent<HTMLInputElement>) {
    onAutoClearMarksChange(event.target.checked)
  }

  return (
    <Popover
      label="Settings"
      panelLabelledBy="kk-settings-heading"
      trigger={<MenuIcon size={22} />}
      triggerClassName="kk-settings__trigger"
      open={open}
      onOpenChange={onOpenChange}
    >
      <h2 className="kk-popover__heading kk-settings__heading" id="kk-settings-heading">
        Settings
      </h2>

      <div className="kk-settings__setting">
        {/*
          A real checkbox under the track and knob: keyboard, focus and
          assistive-tech behaviour come from the input, and `role="switch"`
          announces it as the on/off control it looks like.
        */}
        <label className="kk-switch" htmlFor="kk-auto-clear-marks">
          <span className="kk-switch__text">Auto-clear marks</span>
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
          Erase pencil marks that a newly entered digit rules out in that row and column
        </p>
      </div>
    </Popover>
  )
}
