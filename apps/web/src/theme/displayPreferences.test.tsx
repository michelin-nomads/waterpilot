import { act, fireEvent, render, screen } from '@testing-library/react';

import { PREFERS_DARK_QUERY } from '../lib/useMediaQuery';
import { DisplayMenu } from '../shell/DisplayMenu';
import { setMediaQuery } from '../test/mediaQueryMock';
import {
  DEFAULT_DISPLAY_PREFERENCES,
  DISPLAY_STORAGE_KEY,
  parseDisplayPreferences,
  readDisplayPreferences,
} from './displayPreferences';
import { DisplayPreferencesProvider } from './DisplayPreferencesProvider';

const root = document.documentElement;

function renderMenu(storage?: Storage | null) {
  render(
    <DisplayPreferencesProvider storage={storage}>
      <DisplayMenu />
    </DisplayPreferencesProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /display/i }));
}

describe('stored display preferences', () => {
  it('falls back to the default theme when the stored one is unknown', () => {
    expect(parseDisplayPreferences('{"theme":"neon"}')).toEqual({ theme: 'system' });
  });

  it('ignores a palette saved by an earlier version: Estuary is the only palette', () => {
    expect(parseDisplayPreferences('{"theme":"dark","palette":"grove"}')).toEqual({
      theme: 'dark',
    });
  });

  it('returns defaults for unparsable or missing values', () => {
    expect(parseDisplayPreferences('not json')).toEqual(DEFAULT_DISPLAY_PREFERENCES);
    expect(parseDisplayPreferences(null)).toEqual(DEFAULT_DISPLAY_PREFERENCES);
  });

  it('survives storage that throws on read', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    } as unknown as Storage;
    expect(readDisplayPreferences(throwing)).toEqual(DEFAULT_DISPLAY_PREFERENCES);
  });
});

describe('DisplayPreferencesProvider + DisplayMenu', () => {
  it('follows the OS colour scheme while the theme preference is "system"', () => {
    renderMenu();
    expect(root.dataset.theme).toBe('light');
    act(() => setMediaQuery(PREFERS_DARK_QUERY, true));
    expect(root.dataset.theme).toBe('dark');
  });

  it('offers only light, dark and system, with no palette choice', () => {
    renderMenu();
    expect(screen.getAllByRole('radio').map((radio) => radio.parentElement?.textContent)).toEqual([
      'System',
      'Light',
      'Dark',
    ]);
    expect(screen.queryByText('Palette')).not.toBeInTheDocument();
    expect(screen.queryByText('Theme')).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    expect(root.dataset.palette).toBe('estuary');
  });

  it('persists the chosen theme', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('radio', { name: /dark/i }));
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.palette).toBe('estuary');
    expect(JSON.parse(window.localStorage.getItem(DISPLAY_STORAGE_KEY) ?? '{}')).toEqual({
      theme: 'dark',
    });
  });

  it('an explicit light theme ignores the OS dark preference', () => {
    setMediaQuery(PREFERS_DARK_QUERY, true);
    renderMenu();
    fireEvent.click(screen.getByRole('radio', { name: /light/i }));
    expect(root.dataset.theme).toBe('light');
  });

  it('restores the saved preference on the next load', () => {
    window.localStorage.setItem(DISPLAY_STORAGE_KEY, '{"theme":"dark","palette":"grove"}');
    renderMenu();
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.palette).toBe('estuary');
    expect(screen.getByRole('radio', { name: /dark/i })).toBeChecked();
  });

  it('tells the user when storage is blocked instead of pretending to save', () => {
    renderMenu(null);
    fireEvent.click(screen.getByRole('radio', { name: /dark/i }));
    expect(root.dataset.theme).toBe('dark');
    expect(screen.getByText(/lasts for this tab only/i)).toBeInTheDocument();
  });

  it('syncs a change made in another tab', () => {
    renderMenu();
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: DISPLAY_STORAGE_KEY,
          newValue: '{"theme":"dark"}',
        }),
      );
    });
    expect(root.dataset.theme).toBe('dark');
  });

  it('closes on Escape and returns focus to the trigger', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: /display/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    screen.getByRole('radio', { name: /dark/i }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });
});
