import { apiBaseUrl } from '../config';
import type {
  Album,
  ApiAlbum,
  ApiArtist,
  ApiLanguage,
  ApiLyricist,
  ApiPlaylist,
  ApiQueueItem,
  ApiSinger,
  ApiTrack,
  Artist,
  CoverClass,
  Language,
  Lyricist,
  MusicTrack,
  Playlist,
  QueueItem,
  Singer,
} from '../types';

export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://') || avatarUrl.startsWith('file://')) return avatarUrl;
  return `${apiBaseUrl}/uploads/avatars/${avatarUrl}`;
}

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
  const durationMs = parseDurationToMillis(track.duration);

  return {
    ...track,
    coverClass: normalizeCoverClass(track.coverClass),
    durationMs,
  };
}

export function normalizePlaylist(playlist: ApiPlaylist): Playlist {
  return {
    ...playlist,
    tracks: playlist.tracks.map(normalizeTrack),
  };
}

export function normalizeArtist(artist: ApiArtist): Artist {
  return {
    ...artist,
    tracks: artist.tracks.map(normalizeTrack),
  };
}

export function normalizeAlbum(album: ApiAlbum): Album {
  return {
    ...album,
    tracks: album.tracks.map(normalizeTrack),
  };
}

export function normalizeLanguage(language: ApiLanguage): Language {
  return {
    ...language,
    tracks: language.tracks.map(normalizeTrack),
  };
}

export function normalizeSinger(singer: ApiSinger): Singer {
  return {
    ...singer,
    tracks: (singer.tracks ?? []).map(normalizeTrack),
  };
}

export function normalizeLyricist(lyricist: ApiLyricist): Lyricist {
  return {
    ...lyricist,
    tracks: (lyricist.tracks ?? []).map(normalizeTrack),
  };
}

export function normalizeQueueItem(queueItem: ApiQueueItem): QueueItem {
  return {
    ...queueItem,
    track: normalizeTrack(queueItem.track),
  };
}

export function uniqueTracksById(tracks: MusicTrack[]) {
  const seenTrackIds = new Set<string>();

  return tracks.filter((track) => {
    if (seenTrackIds.has(track.id)) {
      return false;
    }

    seenTrackIds.add(track.id);
    return true;
  });
}

export function formatMillis(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return `${minutes}:${seconds}`;
}

export function parseDurationToMillis(duration?: string | null) {
  if (!duration || duration === '--:--') {
    return undefined;
  }

  const parts = duration
    .split(':')
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));

  if (!parts.length || parts.length > 3) {
    return undefined;
  }

  const seconds = parts.reduce((total, part) => total * 60 + part, 0);

  return seconds > 0 ? seconds * 1000 : undefined;
}

export function getRuntimeLabel(milliseconds: number, fallback?: string | null) {
  if (milliseconds > 0) {
    return formatMillis(milliseconds);
  }

  if (fallback && fallback !== '0:00') {
    return fallback;
  }

  return '--:--';
}
