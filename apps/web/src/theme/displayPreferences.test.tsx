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

function renderToggle(storage?: Storage | null) {
  render(
    <DisplayPreferencesProvider storage={storage}>
      <DisplayMenu />
    </DisplayPreferencesProvider>,
  );
  return screen.getByRole('button', { name: /display/i });
}

const isSunIcon = (btn: HTMLElement) =>
  btn.querySelector('path')?.getAttribute('d')?.startsWith('M12 17a5 5 0');
const isMoonIcon = (btn: HTMLElement) =>
  btn.querySelector('path')?.getAttribute('d')?.startsWith('M20 14.5A8 8');

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
  it('initially picks the system theme and follows the OS colour scheme', () => {
    const button = renderToggle();
    expect(root.dataset.theme).toBe('light');
    expect(isMoonIcon(button)).toBe(true);
    act(() => setMediaQuery(PREFERS_DARK_QUERY, true));
    expect(root.dataset.theme).toBe('dark');
    expect(isSunIcon(button)).toBe(true);
  });

  it('toggles from light to dark on click, changing moon to sunlight icon', () => {
    setMediaQuery(PREFERS_DARK_QUERY, false);
    const button = renderToggle();
    expect(root.dataset.theme).toBe('light');
    expect(isMoonIcon(button)).toBe(true);

    fireEvent.click(button);
    expect(root.dataset.theme).toBe('dark');
    expect(isSunIcon(button)).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(DISPLAY_STORAGE_KEY) ?? '{}')).toEqual({
      theme: 'dark',
    });
  });

  it('toggles from dark to light on click, changing sunlight to moon icon', () => {
    setMediaQuery(PREFERS_DARK_QUERY, true);
    const button = renderToggle();
    expect(root.dataset.theme).toBe('dark');
    expect(isSunIcon(button)).toBe(true);

    fireEvent.click(button);
    expect(root.dataset.theme).toBe('light');
    expect(isMoonIcon(button)).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(DISPLAY_STORAGE_KEY) ?? '{}')).toEqual({
      theme: 'light',
    });
  });

  it('an explicit light theme ignores the OS dark preference', () => {
    setMediaQuery(PREFERS_DARK_QUERY, true);
    const button = renderToggle();
    fireEvent.click(button); // switches to light
    expect(root.dataset.theme).toBe('light');
    expect(isMoonIcon(button)).toBe(true);
    act(() => setMediaQuery(PREFERS_DARK_QUERY, true));
    expect(root.dataset.theme).toBe('light');
  });

  it('restores the saved preference on the next load', () => {
    window.localStorage.setItem(DISPLAY_STORAGE_KEY, '{"theme":"dark","palette":"grove"}');
    const button = renderToggle();
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.palette).toBe('estuary');
    expect(isSunIcon(button)).toBe(true);
  });

  it('syncs a change made in another tab', () => {
    const button = renderToggle();
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: DISPLAY_STORAGE_KEY,
          newValue: '{"theme":"dark"}',
        }),
      );
    });
    expect(root.dataset.theme).toBe('dark');
    expect(isSunIcon(button)).toBe(true);
  });
});

