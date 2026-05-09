import type { Album, Artist, Language, MusicTrack } from '../types';

export function buildArtistsFromTracks(tracks: MusicTrack[]): Artist[] {
  const artistsByName = new Map<string, MusicTrack[]>();

  tracks.forEach((track) => {
    const artistTracks = artistsByName.get(track.artist) ?? [];
    artistTracks.push(track);
    artistsByName.set(track.artist, artistTracks);
  });

  return [...artistsByName.entries()]
    .map(([name, artistTracks], index) => ({
      id: `artist-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      trackCount: artistTracks.length,
      albumCount: new Set(artistTracks.map((track) => track.album)).size,
      tracks: artistTracks,
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

export function buildLanguagesFromTracks(tracks: MusicTrack[]): Language[] {
  const byLanguage = new Map<string, MusicTrack[]>();

  tracks.forEach((track) => {
    if (!track.language?.trim()) return;
    const langTracks = byLanguage.get(track.language) ?? [];
    langTracks.push(track);
    byLanguage.set(track.language, langTracks);
  });

  return [...byLanguage.entries()]
    .map(([name, langTracks], index) => ({
      id: `lang-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      trackCount: langTracks.length,
      tracks: langTracks,
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

export function buildAlbumsFromTracks(tracks: MusicTrack[]): Album[] {
  const albumsByKey = new Map<string, MusicTrack[]>();

  tracks.forEach((track) => {
    const key = `${track.album}\u0000${track.artist}`;
    const albumTracks = albumsByKey.get(key) ?? [];
    albumTracks.push(track);
    albumsByKey.set(key, albumTracks);
  });

  return [...albumsByKey.entries()]
    .map(([key, albumTracks], index) => {
      const [title, artist] = key.split('\u0000');

      return {
        id: `album-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        artist,
        trackCount: albumTracks.length,
        tracks: albumTracks,
      };
    })
    .sort((first, second) => first.title.localeCompare(second.title));
}
