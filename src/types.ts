import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps } from 'react';

export type AuthView = 'login' | 'register-otp' | 'forgot-otp';
export type ActivePanel = 'flow' | 'search' | 'library' | 'profile';
export type RepeatMode = 'off' | 'one';
export type CoverClass = 'neon' | 'coast' | 'velvet' | 'summer' | 'blue';
export type IconName = ComponentProps<typeof Ionicons>['name'];
export type ThemeMode = 'dark' | 'light';

export type UserRole = 'user';

export type SessionUser = {
  id: number;
  email: string;
  profileName: string;
  authProvider: 'local' | 'google' | 'hybrid';
  role: UserRole;
  googleConnected: boolean;
  birthday?: string | null;
  language?: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionState = {
  accessToken: string;
  tokenType: string;
  user: SessionUser;
};

export type AuthResponse = {
  message: string;
  accessToken: string;
  tokenType: string;
  user: SessionUser;
};

export type ForgotPasswordResponse = {
  message: string;
  devResetToken?: string;
  expiresAt?: string;
};

export type ApiErrorPayload = {
  message?: string | string[];
};

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationMs?: number;
  plays: string;
  mood: string;
  coverClass: CoverClass;
  coverUrl?: string | null;
  audio?: number;
  streamUrl?: string;
  singerId?: string;
  lyricistId?: string;
};

export type Playlist = {
  id: string;
  name: string;
  description?: string | null;
  trackCount: number;
  tracks: MusicTrack[];
};

export type Artist = {
  id: string;
  name: string;
  trackCount: number;
  albumCount: number;
  tracks: MusicTrack[];
};

export type Singer = {
  id: string;
  name: string;
  imageName: string | null;
  trackCount: number;
  tracks: MusicTrack[];
};

export type Lyricist = {
  id: string;
  name: string;
  imageName: string | null;
  trackCount: number;
  tracks: MusicTrack[];
};

export type Album = {
  id: string;
  title: string;
  artist: string;
  trackCount: number;
  tracks: MusicTrack[];
};

export type QueueItem = {
  id: string;
  position: number;
  track: MusicTrack;
};

export type ApiTrack = Omit<MusicTrack, 'coverClass' | 'audio' | 'durationMs'> & {
  coverClass: string;
  coverUrl?: string | null;
};

export type ApiArtist = Omit<Artist, 'tracks'> & {
  tracks: ApiTrack[];
};

export type ApiSinger = Omit<Singer, 'tracks'> & {
  tracks: ApiTrack[];
};

export type ApiLyricist = Omit<Lyricist, 'tracks'> & {
  tracks: ApiTrack[];
};

export type ApiAlbum = Omit<Album, 'tracks'> & {
  tracks: ApiTrack[];
};

export type ApiQueueItem = Omit<QueueItem, 'track'> & {
  track: ApiTrack;
};

export type TracksResponse = {
  tracks: ApiTrack[];
};

export type ArtistsResponse = {
  artists: ApiArtist[];
};

export type AlbumsResponse = {
  albums: ApiAlbum[];
};

export type PlaylistsResponse = {
  playlists: ApiPlaylist[];
};

export type PlaylistResponse = {
  playlist: ApiPlaylist;
};

export type QueueResponse = {
  queue: ApiQueueItem[];
};

export type QueueActionResponse = QueueResponse & {
  queueItem: ApiQueueItem;
  message: string;
};

export type ApiPlaylist = {
  id: string;
  name: string;
  description: string | null;
  trackCount: number;
  tracks: ApiTrack[];
};
