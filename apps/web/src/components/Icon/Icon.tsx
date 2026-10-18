import styles from './Icon.module.scss';

// 24×24 stroke icons drawn for WaterPilot (no icon-font or icon-library dependency).
const PATHS = {
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-6v-5m0-3h.01',
  close: 'M6 6l12 12M18 6 6 18',
  'chevrons-left': 'm11 6-6 6 6 6m7-12-6 6 6 6',
  'chevrons-right': 'm6 6 6 6-6 6m7-12 6 6-6 6',
  'chevron-right': 'm9 6 6 6-6 6',
  'chevron-down': 'm6 9 6 6 6-6',
  'arrow-right': 'M5 12h14m-6-6 6 6-6 6',
  play: 'm8 5 11 7-11 7V5Z',
  stop: 'M6 6h12v12H6z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  alert: 'M12 3 2 20h20L12 3Zm0 6v5m0 3h.01',
  'alert-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-14v5m0 3h.01',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  monitor: 'M3 5h18v11H3zM8 20h8m-4-4v4',
  palette:
    'M12 22a10 10 0 1 1 10-10c0 2.5-2 3.5-4 3.5h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22ZM7.5 11h.01M10 7h.01M15 7h.01M17 11h.01',
  adjustments: 'M3 6h18M8 3v6M3 12h18M16 9v6M3 18h18M11 15v6',
  droplet: 'M12 2.5S5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.5 12 2.5Z',
  sparkle:
    'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  users:
    'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20m6-9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm10 9v-1.5a3.5 3.5 0 0 0-2.5-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  file: 'M14 3H6v18h12V7l-4-4Zm0 0v4h4M9 13h6m-6 4h6',
  map: 'm9 4-6 2.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11v13.5',
  target:
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  external: 'M14 4h6v6m0-6-9 9M18 14v6H4V6h6',
  layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  truck:
    'M3 6h12v12H3zM15 10h4l3 4v4h-7M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6m12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  waves: 'M2 6q3-3 6 0t6 0 6 0M2 12q3-3 6 0t6 0 6 0M2 18q3-3 6 0t6 0 6 0',
  'wifi-off':
    'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.4-1.7M2 8.8a15 15 0 0 1 4.3-2.6M22 8.8A15 15 0 0 0 10.7 5M12 20h.01',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  wallet: 'M4 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4V6Zm0 0V5a1 1 0 0 1 1-1h11M16 13h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
  search: 'm21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4m8-4v4',
  home: 'm3 11 9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  mail: 'M3 5h18v14H3zM3 7l9 6.5L21 7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  'eye-off':
    'M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A16.6 16.6 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  bulb: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z',
  clipboard: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6m-6 4h4',
  'cloud-rain': 'M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2M8 19v2m4-2v2m4-2v2',
  'shield-check': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4',
  building:
    'M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1',
  groundwater: 'M12 3v9m-3-3 3 3 3-3M2 17q3-3 6 0t6 0 6 0M2 21q3-3 6 0t6 0 6 0',
  pencil: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Zm-2 2 4 4',
  edit: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Zm-2 2 4 4',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  /** Accessible label. Omit for decorative icons next to visible text. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Icon({ name, label, size = 'md', className }: IconProps) {
  return (
    <svg
      className={[styles.icon, styles[size], className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
