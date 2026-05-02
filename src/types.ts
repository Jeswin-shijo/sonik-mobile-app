import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps } from 'react';

export type AuthView = 'login' | 'register' | 'forgot' | 'reset';
export type ActivePanel = 'flow' | 'library' | 'profile';
export type RepeatMode = 'off' | 'one';
export type CoverClass = 'neon' | 'coast' | 'velvet' | 'summer' | 'blue';
export type IconName = ComponentProps<typeof Ionicons>['name'];

export type SessionUser = {
  id: number;
  email: string;
  profileName: string;
  authProvider: 'local' | 'google' | 'hybrid';
  googleConnected: boolean;
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
};

export type Playlist = {
  id: string;
  name: string;
  description?: string | null;
  trackCount: number;
  tracks: MusicTrack[];
};

export type ApiTrack = Omit<MusicTrack, 'coverClass' | 'audio' | 'durationMs'> & {
  coverClass: string;
  coverUrl?: string | null;
};

export type TracksResponse = {
  tracks: ApiTrack[];
};

export type PlaylistsResponse = {
  playlists: ApiPlaylist[];
};

export type PlaylistResponse = {
  playlist: ApiPlaylist;
};

export type ApiPlaylist = {
  id: string;
  name: string;
  description: string | null;
  trackCount: number;
  tracks: ApiTrack[];
};
