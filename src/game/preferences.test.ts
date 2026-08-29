import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyTheme,
  loadAutoClearMarks,
  loadAutoFillSingleCages,
  loadTheme,
  saveAutoClearMarks,
  saveAutoFillSingleCages,
  saveTheme,
} from './preferences';

describe('preferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to true when nothing is stored', () => {
    expect(loadAutoClearMarks()).toBe(true);
  });

  it('round-trips true and false through save/load', () => {
    saveAutoClearMarks(false);
    expect(loadAutoClearMarks()).toBe(false);

    saveAutoClearMarks(true);
    expect(loadAutoClearMarks()).toBe(true);
  });

  it('falls back to the default when the stored value is unrecognised', () => {
    localStorage.setItem('kenken:autoClearMarks', 'nonsense');
    expect(loadAutoClearMarks()).toBe(true);
  });

  describe('auto-fill single cages', () => {
    it('defaults to false when nothing is stored', () => {
      expect(loadAutoFillSingleCages()).toBe(false);
    });

    it('round-trips true and false through save/load', () => {
      saveAutoFillSingleCages(true);
      expect(loadAutoFillSingleCages()).toBe(true);

      saveAutoFillSingleCages(false);
      expect(loadAutoFillSingleCages()).toBe(false);
    });

    it('falls back to false when the stored value is unrecognised', () => {
      localStorage.setItem('kenken:autoFillSingleCages', 'nonsense');
      expect(loadAutoFillSingleCages()).toBe(false);
    });
  });

  describe('with a throwing storage', () => {
    const originalLocalStorage = globalThis.localStorage;

    beforeEach(() => {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem() {
            throw new Error('storage disabled');
          },
          setItem() {
            throw new Error('storage disabled');
          },
        },
      });
    });

    afterEach(() => {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    });

    it('load falls back to the default instead of throwing', () => {
      expect(() => loadAutoClearMarks()).not.toThrow();
      expect(loadAutoClearMarks()).toBe(true);
    });

    it('save silently does nothing instead of throwing', () => {
      expect(() => saveAutoClearMarks(false)).not.toThrow();
    });

    it('auto-fill load falls back to false and save does not throw', () => {
      expect(() => loadAutoFillSingleCages()).not.toThrow();
      expect(loadAutoFillSingleCages()).toBe(false);
      expect(() => saveAutoFillSingleCages(true)).not.toThrow();
    });

    it('loadTheme falls back to system instead of throwing', () => {
      expect(loadTheme()).toBe('system');
    });

    it('saveTheme silently does nothing instead of throwing', () => {
      expect(() => saveTheme('dark')).not.toThrow();
    });
  });

  describe('theme', () => {
    afterEach(() => {
      document.documentElement.removeAttribute('data-theme');
    });

    it('defaults to system when nothing is stored', () => {
      expect(loadTheme()).toBe('system');
    });

    it('round-trips every choice through save/load', () => {
      for (const theme of ['light', 'dark', 'system'] as const) {
        saveTheme(theme);
        expect(loadTheme()).toBe(theme);
      }
    });

    it('falls back to system when the stored value is unrecognised', () => {
      localStorage.setItem('kenken:theme', 'chartreuse');
      expect(loadTheme()).toBe('system');
    });

    it('applyTheme sets data-theme for an explicit choice', () => {
      applyTheme('dark');
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

      applyTheme('light');
      expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    });

    /*
     * `system` is the absence of the attribute, not a third value: the base
     * `color-scheme: light dark` is what makes `light-dark()` follow the OS.
     */
    it('applyTheme removes data-theme for system', () => {
      applyTheme('dark');
      applyTheme('system');
      expect(document.documentElement).not.toHaveAttribute('data-theme');
    });
  });
});
