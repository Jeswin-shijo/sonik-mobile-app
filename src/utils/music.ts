import type { ApiPlaylist, ApiTrack, CoverClass, MusicTrack, Playlist } from '../types';

export function normalizeCoverClass(coverClass: string): CoverClass {
  const normalized = coverClass.replace(/^cover-/, '');

  if (
    normalized === 'neon' ||
    normalized === 'coast' ||
    normalized === 'velvet' ||
    normalized === 'summer' ||
    normalized === 'blue'
  ) {
    return normalized;
  }

  return 'neon';
}

export function normalizeTrack(track: ApiTrack): MusicTrack {
  return {
    ...track,
    coverClass: normalizeCoverClass(track.coverClass),
  };
}

export function normalizePlaylist(playlist: ApiPlaylist): Playlist {
  return {
    ...playlist,
    tracks: playlist.tracks.map(normalizeTrack),
  };
}

export function formatMillis(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return `${minutes}:${seconds}`;
}
