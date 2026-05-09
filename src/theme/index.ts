import type { ThemeMode } from '../types';

export type AppTheme = {
  mode: ThemeMode;
  background: string;
  surface: string;
  surfaceStrong: string;
  surfaceSoft: string;
  card: string;
  field: string;
  text: string;
  muted: string;
  mutedStrong: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentText: string;
  secondary: string;
  danger: string;
  dangerSoft: string;
};

export const appThemes: Record<ThemeMode, AppTheme> = {
  dark: {
    mode: 'dark',
    background: '#120f18',
    surface: 'rgba(29,23,35,0.86)',
    surfaceStrong: 'rgba(16,18,24,0.9)',
    surfaceSoft: 'rgba(248,244,236,0.06)',
    card: '#1d1723',
    field: 'rgba(7,12,18,0.72)',
    text: '#fbf7ef',
    muted: '#b8afaa',
    mutedStrong: '#d8d0c8',
    border: 'rgba(248,244,236,0.11)',
    borderStrong: 'rgba(248,244,236,0.16)',
    accent: '#f5c15d',
    accentText: '#160f0b',
    secondary: '#55d6c2',
    danger: '#ff9aa5',
    dangerSoft: 'rgba(255,111,125,0.1)',
  },
  light: {
    mode: 'light',
    background: '#f7f2ea',
    surface: 'rgba(255,252,247,0.92)',
    surfaceStrong: 'rgba(255,255,255,0.95)',
    surfaceSoft: 'rgba(26,20,16,0.055)',
    card: '#ffffff',
    field: 'rgba(255,255,255,0.88)',
    text: '#17120f',
    muted: '#6d625a',
    mutedStrong: '#3f352f',
    border: 'rgba(38,31,26,0.13)',
    borderStrong: 'rgba(38,31,26,0.2)',
    accent: '#c98413',
    accentText: '#fffaf3',
    secondary: '#108f82',
    danger: '#c93f4d',
    dangerSoft: 'rgba(201,63,77,0.1)',
  },
};
