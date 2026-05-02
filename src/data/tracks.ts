import type { CoverClass, MusicTrack } from '../types';

export const fallbackTracks: MusicTrack[] = [
  {
    id: 'neon-afterhours',
    title: 'Neon Afterhours',
    artist: 'Mira Sol',
    album: 'City Lines',
    duration: '0:24',
    durationMs: 24_000,
    plays: '2.4M',
    mood: 'Late night',
    coverClass: 'neon',
    audio: require('../../assets/audio/neon-afterhours.wav'),
  },
  {
    id: 'coastal-static',
    title: 'Coastal Static',
    artist: 'North Pier',
    album: 'Low Tide Radio',
    duration: '0:24',
    durationMs: 24_000,
    plays: '986K',
    mood: 'Focus',
    coverClass: 'coast',
    audio: require('../../assets/audio/coastal-static.wav'),
  },
  {
    id: 'velvet-signal',
    title: 'Velvet Signal',
    artist: 'Juno Ray',
    album: 'Soft Machines',
    duration: '0:24',
    durationMs: 24_000,
    plays: '1.1M',
    mood: 'Groove',
    coverClass: 'velvet',
    audio: require('../../assets/audio/velvet-signal.wav'),
  },
  {
    id: 'summer-loop',
    title: 'Summer Loop',
    artist: 'The Halcyon Room',
    album: 'Warm Start',
    duration: '0:24',
    durationMs: 24_000,
    plays: '742K',
    mood: 'Bright',
    coverClass: 'summer',
    audio: require('../../assets/audio/summer-loop.wav'),
  },
  {
    id: 'blue-hour-drive',
    title: 'Blue Hour Drive',
    artist: 'Cassian Vale',
    album: 'Second Avenue',
    duration: '0:24',
    durationMs: 24_000,
    plays: '1.8M',
    mood: 'Drive',
    coverClass: 'blue',
    audio: require('../../assets/audio/blue-hour-drive.wav'),
  },
];

export const mixes = [
  {
    title: 'Signal Blend',
    detail: 'A warm run of electronic, pop, and indie picks.',
    coverClass: 'summer' as CoverClass,
  },
  {
    title: 'Night Current',
    detail: 'Lower light, deeper bass, smoother transitions.',
    coverClass: 'velvet' as CoverClass,
  },
  {
    title: 'Focus Crate',
    detail: 'Steady tracks for shipping work without friction.',
    coverClass: 'coast' as CoverClass,
  },
];

export const waveformHeights = [
  32, 58, 46, 74, 38, 82, 50, 66, 42, 88, 56, 70, 36, 64, 92, 48, 78, 40,
];
