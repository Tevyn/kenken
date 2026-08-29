import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Theme } from '../game/preferences';
import { THEMES } from '../game/preferences';
import { SettingsMenu } from './SettingsMenu';

/**
 * `Controls.test.tsx` covers what the theme picker *does*; this covers what it
 * is made of, now that each choice is a glyph over a caption rather than a
 * word on its own.
 */
function SettingsHarness(props: { theme?: Theme; onThemeChange?: (theme: Theme) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <SettingsMenu
      autoClearMarks
      onAutoClearMarksChange={vi.fn()}
      autoFillSingleCages={false}
      onAutoFillSingleCagesChange={vi.fn()}
      highlightWrongNotes={false}
      onHighlightWrongNotesChange={vi.fn()}
      theme={props.theme ?? 'system'}
      onThemeChange={props.onThemeChange ?? vi.fn()}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

const LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' };

const openSettings = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Settings' }));

describe('SettingsMenu theme tiles', () => {
  it('gives every theme its own glyph above the word', async () => {
    const user = userEvent.setup();
    render(<SettingsHarness />);
    await openSettings(user);

    const shapes = new Set<string>();
    for (const theme of THEMES) {
      const radio = screen.getByRole('radio', { name: LABELS[theme] });
      const tile = radio.closest('label');
      expect(tile).not.toBeNull();
      const svg = tile?.querySelector('svg');
      expect(svg).not.toBeNull();
      // Decorative: the label still names the control (§4.2).
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      shapes.add(svg?.innerHTML ?? '');
    }
    // Three distinct glyphs, not one repeated.
    expect(shapes.size).toBe(3);
  });

  it('keeps the word as the accessible name and the glyph inside the hit area', async () => {
    const user = userEvent.setup();
    render(<SettingsHarness theme="dark" />);
    await openSettings(user);

    const radio = screen.getByRole('radio', { name: 'Dark' });
    const tile = radio.closest('label') as HTMLElement;
    // The input is the tile's absolutely-positioned overlay, so it stays a
    // sibling of both the glyph and the text - which is what the `~` underline
    // selector and the full-tile tap target both depend on.
    expect(radio.parentElement).toBe(tile);
    expect(tile.querySelector('svg')?.parentElement).toBe(tile);
    expect(tile.querySelector('.kk-theme__text')?.parentElement).toBe(tile);
    expect(radio).toBeChecked();
  });

  it('still reports the choice through the radio, not the tile', async () => {
    const user = userEvent.setup();
    const onThemeChange = vi.fn();
    render(<SettingsHarness theme="system" onThemeChange={onThemeChange} />);
    await openSettings(user);

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onThemeChange).toHaveBeenCalledWith('dark');
  });
});
