import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createAudioPlayer,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioSource,
} from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFriendlyError, requestJson } from './src/api/client';
import { IconButton } from './src/components/IconButton';
import { OtpInput } from './src/components/OtpInput';
import { TrackArt } from './src/components/TrackArt';
import {
  apiBaseUrl,
  googleAndroidClientId,
  googleIosClientId,
  googleWebClientId,
  sessionStorageKey,
} from './src/config';
import { fallbackTracks, mixes, waveformHeights } from './src/data/tracks';
import type {
  ActivePanel,
  Album,
  AlbumsResponse,
  AuthResponse,
  AuthView,
  ForgotPasswordResponse,
  Artist,
  ArtistsResponse,
  MusicTrack,
  Playlist,
  PlaylistResponse,
  PlaylistsResponse,
  QueueActionResponse,
  QueueItem,
  QueueResponse,
  RepeatMode,
  SessionState,
  SessionUser,
  ThemeMode,
  TracksResponse,
} from './src/types';
import {
  formatMillis,
  getRuntimeLabel,
  normalizeAlbum,
  normalizeArtist,
  normalizePlaylist,
  normalizeQueueItem,
  normalizeTrack,
  uniqueTracksById,
} from './src/utils/music';

WebBrowser.maybeCompleteAuthSession();

// Responsive design utilities
const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;
const isMediumScreen = screenWidth >= 380 && screenWidth < 480;
const themeStorageKey = 'sonik-theme-mode';

type AppTheme = {
  mode: ThemeMode;
  background: string;
  surface: string;
  surfaceStrong: string;
  surfaceSoft: string;
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

const appThemes: Record<ThemeMode, AppTheme> = {
  dark: {
    mode: 'dark',
    background: '#120f18',
    surface: 'rgba(29,23,35,0.86)',
    surfaceStrong: 'rgba(16,18,24,0.9)',
    surfaceSoft: 'rgba(248,244,236,0.06)',
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

function getAudioSourceForTrack(
  track: MusicTrack,
  activeSession: SessionState | null,
): AudioSource {
  if (!activeSession) {
    return null;
  }

  if (track.streamUrl) {
    return { uri: `${apiBaseUrl}${track.streamUrl}` };
  }

  return track.audio ?? null;
}

function buildArtistsFromTracks(tracks: MusicTrack[]): Artist[] {
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

function buildAlbumsFromTracks(tracks: MusicTrack[]): Album[] {
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

export default function App() {
  const systemColorScheme = useColorScheme();
  const completedTrackRef = useRef('');
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    systemColorScheme === 'light' ? 'light' : 'dark',
  );
  const [view, setView] = useState<AuthView>('login');
  const [activePanel, setActivePanel] = useState<ActivePanel>('flow');
  const [session, setSession] = useState<SessionState | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [libraryTracks, setLibraryTracks] = useState<MusicTrack[]>(fallbackTracks);
  const [favoriteTracks, setFavoriteTracks] = useState<MusicTrack[]>([]);
  const [recentTracks, setRecentTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artists, setArtists] = useState<Artist[]>(
    buildArtistsFromTracks(fallbackTracks),
  );
  const [albums, setAlbums] = useState<Album[]>(
    buildAlbumsFromTracks(fallbackTracks),
  );
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isTrackDetailOpen, setIsTrackDetailOpen] = useState(false);
  const [isPlaylistPickerOpen, setIsPlaylistPickerOpen] = useState(false);
  const [isTrackActionSheetOpen, setIsTrackActionSheetOpen] = useState(false);
  const [actionSheetMode, setActionSheetMode] = useState<'actions' | 'playlists'>(
    'actions',
  );
  const [actionTrackId, setActionTrackId] = useState('');
  const [addToPlaylistId, setAddToPlaylistId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState(fallbackTracks[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [progress, setProgress] = useState(0);
  const [soundPosition, setSoundPosition] = useState(0);
  const [soundDuration, setSoundDuration] = useState(
    fallbackTracks[0].durationMs ?? 0,
  );
  const [durationByTrackId, setDurationByTrackId] = useState<
    Record<string, string>
  >({});
  const [progressTrackWidth, setProgressTrackWidth] = useState(1);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('library');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });
  const [registerForm, setRegisterForm] = useState({
    profileName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [resetForm, setResetForm] = useState({
    newPassword: '',
  });
  const [otpForm, setOtpForm] = useState({
    email: '',
    otp: '',
  });
  const [otpStep, setOtpStep] = useState<'email' | 'verify'>('email');
  const [emailStatus, setEmailStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle');
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [isDeleteAccountConfirming, setIsDeleteAccountConfirming] = useState(false);
  const [isAdminViewOpen, setIsAdminViewOpen] = useState(false);
  const [adminUploadForm, setAdminUploadForm] = useState({
    title: '',
    artist: '',
    album: '',
    genre: '',
    mood: '',
  });
  const [adminAudioFile, setAdminAudioFile] =
    useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [adminCoverFile, setAdminCoverFile] =
    useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [isAdminUploading, setIsAdminUploading] = useState(false);
  const [adminPendingDeleteId, setAdminPendingDeleteId] = useState<string | null>(null);
  const theme = appThemes[themeMode];
  const styles = useMemo(() => createStyles(theme), [theme]);
  const iconButtonColors = useMemo(
    () => ({
      ghostIcon: theme.text,
      solidIcon: theme.accentText,
      ghostBackground: theme.surfaceSoft,
      ghostBorder: theme.border,
      solidBackground: theme.accent,
      solidBorder: theme.accent,
    }),
    [theme],
  );

  const currentTracks = useMemo(() => {
    if (selectedPlaylistId.startsWith('artist:')) {
      const artist = artists.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(7),
      );

      return artist?.tracks.length ? artist.tracks : libraryTracks;
    }

    if (selectedPlaylistId.startsWith('album:')) {
      const album = albums.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(6),
      );

      return album?.tracks.length ? album.tracks : libraryTracks;
    }

    if (selectedPlaylistId === 'favorites') {
      return favoriteTracks.length ? favoriteTracks : libraryTracks;
    }

    if (selectedPlaylistId === 'recent') {
      return recentTracks.length ? recentTracks : libraryTracks;
    }

    const playlist = playlists.find(
      (candidate) => candidate.id === selectedPlaylistId,
    );

    if (playlist) {
      return playlist.tracks.length ? playlist.tracks : libraryTracks;
    }

    return libraryTracks;
  }, [
    albums,
    artists,
    favoriteTracks,
    libraryTracks,
    playlists,
    recentTracks,
    selectedPlaylistId,
  ]);

  const visibleTracks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return currentTracks;
    }

    return currentTracks.filter((track) =>
      [track.title, track.artist, track.album, track.mood]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [currentTracks, searchQuery]);
  const selectedTrack = useMemo(
    () =>
      libraryTracks.find((track) => track.id === selectedTrackId) ??
      fallbackTracks[0],
    [libraryTracks, selectedTrackId],
  );
  const selectedPlaylist = useMemo(
    () =>
      playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null,
    [playlists, selectedPlaylistId],
  );
  const selectedSourceLabel = useMemo(() => {
    if (selectedPlaylistId.startsWith('artist:')) {
      const artist = artists.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(7),
      );

      return artist ? `Artist: ${artist.name}` : 'Artist';
    }

    if (selectedPlaylistId.startsWith('album:')) {
      const album = albums.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(6),
      );

      return album ? `Album: ${album.title}` : 'Album';
    }

    if (selectedPlaylistId === 'favorites') {
      return 'Liked Songs';
    }

    if (selectedPlaylistId === 'recent') {
      return 'Recent Plays';
    }

    return selectedPlaylist?.name ?? 'Library';
  }, [albums, artists, selectedPlaylist, selectedPlaylistId]);
  const addTargetPlaylist = selectedPlaylist ?? playlists[0] ?? null;
  const detailAddTargetPlaylist =
    playlists.find((playlist) => playlist.id === addToPlaylistId) ??
    playlists[0] ??
    null;
  const isSelectedTrackInDetailTarget = Boolean(
    detailAddTargetPlaylist?.tracks.some((track) => track.id === selectedTrackId),
  );
  const selectedRuntimeLabel = getRuntimeLabel(
    soundDuration,
    durationByTrackId[selectedTrack.id] ?? selectedTrack.duration,
  );
  const sourceFilters = useMemo(
    () => [
      { id: 'library', label: 'Home', count: libraryTracks.length },
      { id: 'favorites', label: 'Liked', count: favoriteTracks.length },
      { id: 'recent', label: 'Recent', count: recentTracks.length },
    ],
    [favoriteTracks.length, libraryTracks.length, recentTracks.length],
  );
  const isSelectedTrackLiked = favoriteTracks.some(
    (track) => track.id === selectedTrackId,
  );
  const actionTrack = useMemo(
    () =>
      libraryTracks.find((track) => track.id === actionTrackId) ??
      currentTracks.find((track) => track.id === actionTrackId) ??
      null,
    [actionTrackId, currentTracks, libraryTracks],
  );
  const actionArtist = useMemo(
    () =>
      actionTrack
        ? artists.find((artist) => artist.name === actionTrack.artist) ?? null
        : null,
    [actionTrack, artists],
  );
  const actionAlbum = useMemo(
    () =>
      actionTrack
        ? albums.find(
            (album) =>
              album.title === actionTrack.album &&
              album.artist === actionTrack.artist,
          ) ?? null
        : null,
    [actionTrack, albums],
  );
  const queuePreviewTracks = queueItems.length
    ? queueItems.map((queueItem) => queueItem.track)
    : visibleTracks.filter((track) => track.id !== selectedTrack.id);
  const audioSource = useMemo<AudioSource>(() => {
    return getAudioSourceForTrack(selectedTrack, session);
  }, [selectedTrack, session]);
  const player = useAudioPlayer(audioSource, { updateInterval: 500 });
  const playerStatus = useAudioPlayerStatus(player);
  const isSoundLoading = Boolean(
    session && (!playerStatus.isLoaded || playerStatus.isBuffering),
  );

  const googleEnabled = useMemo(
    () =>
      Boolean(
        googleWebClientId.trim() ||
          googleIosClientId.trim() ||
          googleAndroidClientId.trim(),
      ),
    [],
  );

  const [googleRequest, googleResponse, promptGoogleSignIn] =
    Google.useIdTokenAuthRequest(
      {
        webClientId: googleWebClientId || undefined,
        iosClientId: googleIosClientId || undefined,
        androidClientId: googleAndroidClientId || undefined,
        scopes: ['openid', 'profile', 'email'],
        selectAccount: true,
      },
      {
        scheme: 'sonik',
      },
    );

  useEffect(() => {
    void Promise.all([
      requestJson<TracksResponse>('/tracks'),
      requestJson<ArtistsResponse>('/tracks/artists').catch(() => null),
      requestJson<AlbumsResponse>('/tracks/albums').catch(() => null),
    ])
      .then(([tracksPayload, artistsPayload, albumsPayload]) => {
        if (!tracksPayload.tracks.length) {
          return;
        }

        const nextTracks = tracksPayload.tracks.map(normalizeTrack);
        setLibraryTracks(nextTracks);
        setArtists(
          artistsPayload?.artists.length
            ? artistsPayload.artists.map(normalizeArtist)
            : buildArtistsFromTracks(nextTracks),
        );
        setAlbums(
          albumsPayload?.albums.length
            ? albumsPayload.albums.map(normalizeAlbum)
            : buildAlbumsFromTracks(nextTracks),
        );
        setSelectedTrackId(nextTracks[0].id);
        setProgress(0);
        setSoundPosition(0);
        setSoundDuration(nextTracks[0].durationMs ?? 0);
        setIsPlaying(false);
      })
      .catch(() => {
        setNoticeMessage('Local tracks could not be loaded from the backend yet.');
      });
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(themeStorageKey).then((storedTheme) => {
      if (storedTheme === 'light' || storedTheme === 'dark') {
        setThemeMode(storedTheme);
      }
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(themeStorageKey, themeMode);
  }, [themeMode]);

  useEffect(() => {
    void AsyncStorage.getItem(sessionStorageKey)
      .then(async (storedSession) => {
        if (!storedSession) {
          return;
        }

        const parsedSession = JSON.parse(storedSession) as SessionState;
        const payload = await requestJson<{ user: SessionUser }>('/auth/me', {
          headers: {
            Authorization: `Bearer ${parsedSession.accessToken}`,
          },
        });

        setSession({
          ...parsedSession,
          user: payload.user,
        });
      })
      .catch(() => {
        void AsyncStorage.removeItem(sessionStorageKey);
      })
      .finally(() => {
        setIsBootstrapping(false);
      });
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    void refreshPersonalLibrary(session);
  }, [session]);

  useEffect(() => {
    if (!playlists.length) {
      setAddToPlaylistId('');
      return;
    }

    setAddToPlaylistId((current) =>
      playlists.some((playlist) => playlist.id === current)
        ? current
        : playlists[0].id,
    );
  }, [playlists]);

  useEffect(() => {
    if (!visibleTracks.length) {
      return;
    }

    if (!visibleTracks.some((track) => track.id === selectedTrackId)) {
      setSelectedTrackId(visibleTracks[0].id);
      setIsPlaying(false);
    }
  }, [selectedTrackId, visibleTracks]);

  useEffect(() => {
    if (googleResponse?.type !== 'success') {
      return;
    }

    const idToken =
      googleResponse.params.id_token || googleResponse.authentication?.idToken;

    if (!idToken) {
      setErrorMessage('Google sign-in could not be completed.');
      return;
    }

    void handleGoogleToken(idToken);
  }, [googleResponse]);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: false,
    });
  }, []);

  useEffect(() => {
    if (session && !audioSource) {
      setErrorMessage('This track does not have a backend audio file yet.');
    }
  }, [audioSource, session]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const tracksNeedingRuntime = visibleTracks
      .filter(
        (track) =>
          !durationByTrackId[track.id] &&
          (!track.duration || track.duration === '--:--'),
      )
      .slice(0, 24);

    if (!tracksNeedingRuntime.length) {
      return undefined;
    }

    let isCancelled = false;
    const cleanupTasks: Array<() => void> = [];

    tracksNeedingRuntime.forEach((track) => {
      const source = getAudioSourceForTrack(track, session);

      if (!source) {
        return;
      }

      const metadataPlayer = createAudioPlayer(source, {
        updateInterval: 250,
      });
      let isCleanedUp = false;

      const cleanup = () => {
        if (isCleanedUp) {
          return;
        }

        isCleanedUp = true;
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        metadataPlayer.remove();
      };
      const readRuntime = () => {
        const duration = Math.round((metadataPlayer.duration || 0) * 1000);

        if (!duration || isCancelled) {
          return;
        }

        const runtimeLabel = formatMillis(duration);
        setDurationByTrackId((current) =>
          current[track.id] === runtimeLabel
            ? current
            : {
                ...current,
                [track.id]: runtimeLabel,
              },
        );
        cleanup();
      };
      const intervalId = setInterval(readRuntime, 250);
      const timeoutId = setTimeout(cleanup, 7000);

      cleanupTasks.push(cleanup);
      readRuntime();
    });

    return () => {
      isCancelled = true;
      cleanupTasks.forEach((cleanup) => cleanup());
    };
  }, [durationByTrackId, session, visibleTracks]);

  useEffect(() => {
    completedTrackRef.current = '';
    setProgress(0);
    setSoundPosition(0);
    setSoundDuration(selectedTrack.durationMs ?? 0);
  }, [selectedTrack.durationMs, selectedTrack.id]);

  useEffect(() => {
    if (!session || !audioSource) {
      return;
    }

    if (isPlaying) {
      player.play();
      return;
    }

    player.pause();
  }, [audioSource, isPlaying, player, session]);

  useEffect(() => {
    if (!session || !playerStatus.isLoaded) {
      return;
    }

    updatePlaybackStatus();
  }, [
    playerStatus.currentTime,
    playerStatus.didJustFinish,
    playerStatus.duration,
    playerStatus.isLoaded,
    playerStatus.playing,
    playerStatus.playing,
    session,
  ]);

  useEffect(() => {
    if (view !== 'register-otp' || otpStep !== 'email') {
      return;
    }
    const email = otpForm.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus('idle');
      return;
    }
    setEmailStatus('checking');
    clearTimeout(emailCheckTimer.current);
    emailCheckTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/auth/check-email?email=${encodeURIComponent(email)}`,
        );
        const data = await response.json();
        setEmailStatus(data.available ? 'available' : 'taken');
      } catch {
        setEmailStatus('idle');
      }
    }, 500);
    return () => clearTimeout(emailCheckTimer.current);
  }, [otpForm.email, view, otpStep]);

  function clearFeedback() {
    setErrorMessage('');
    setNoticeMessage('');
  }

  function handleApiError(error: unknown) {
    setErrorMessage(getFriendlyError(error, view));
  }

  function authHeaders(activeSession = session): Record<string, string> {
    return activeSession
      ? {
          Authorization: `Bearer ${activeSession.accessToken}`,
        }
      : {};
  }

  async function requestAuthorizedJson<T>(
    path: string,
    init?: RequestInit,
    activeSession = session,
  ) {
    return requestJson<T>(path, {
      ...init,
      headers: {
        ...authHeaders(activeSession),
        ...((init?.headers ?? {}) as Record<string, string>),
      },
    });
  }

  async function refreshPersonalLibrary(activeSession = session) {
    if (!activeSession) {
      return;
    }

    const [favoritesPayload, recentPayload, playlistsPayload, queuePayload] =
      await Promise.all([
        requestAuthorizedJson<TracksResponse>(
          '/tracks/favorites/me',
          undefined,
          activeSession,
        ),
        requestAuthorizedJson<TracksResponse>(
          '/tracks/recent/me',
          undefined,
          activeSession,
        ),
        requestAuthorizedJson<PlaylistsResponse>(
          '/playlists',
          undefined,
          activeSession,
        ),
        requestAuthorizedJson<QueueResponse>(
          '/tracks/queue/me',
          undefined,
          activeSession,
        ),
      ]);

    setFavoriteTracks(favoritesPayload.tracks.map(normalizeTrack));
    setRecentTracks(uniqueTracksById(recentPayload.tracks.map(normalizeTrack)));

    const nextPlaylists = playlistsPayload.playlists.map(normalizePlaylist);
    setPlaylists(nextPlaylists);
    setQueueItems(queuePayload.queue.map(normalizeQueueItem));
    setSelectedPlaylistId((current) =>
      current === 'library' ||
      current === 'favorites' ||
      current === 'recent' ||
      current.startsWith('artist:') ||
      current.startsWith('album:') ||
      nextPlaylists.some((playlist) => playlist.id === current)
        ? current
        : 'library',
    );
  }

  function updatePlaybackStatus() {
    if (!playerStatus.isLoaded) {
      return;
    }

    const duration = Math.round(
      (playerStatus.duration || 0) * 1000 || selectedTrack.durationMs || 0,
    );
    const position = Math.round((playerStatus.currentTime || 0) * 1000);

    setSoundPosition(position);
    setSoundDuration(duration);
    setProgress(duration ? Math.min(100, (position / duration) * 100) : 0);

    if (duration > 0) {
      const runtimeLabel = formatMillis(duration);

      setDurationByTrackId((current) =>
        current[selectedTrackId] === runtimeLabel
          ? current
          : {
              ...current,
              [selectedTrackId]: runtimeLabel,
            },
      );
    }

    if (
      playerStatus.didJustFinish &&
      completedTrackRef.current !== selectedTrackId
    ) {
      completedTrackRef.current = selectedTrackId;
      void recordCurrentPlay(true);

      if (repeatMode === 'one') {
        void player.seekTo(0).then(() => player.play());
        return;
      }

      selectNextTrack();
    }
  }

  function selectTrack(trackId: string, forcePlay = false) {
    if (trackId === selectedTrackId && !forcePlay) {
      setIsPlaying((current) => !current);
      return;
    }

    if (trackId === selectedTrackId) {
      void player.seekTo(0).catch(() => undefined);
    }

    setSelectedTrackId(trackId);
    setProgress(0);
    setSoundPosition(0);
    setIsPlaying(true);
  }

  function openTrackDetail(trackId: string) {
    if (trackId !== selectedTrackId) {
      selectTrack(trackId);
    }

    // setIsTrackDetailOpen(true);
  }

  function closeTrackDetail() {
    setIsPlaylistPickerOpen(false);
    setIsTrackDetailOpen(false);
  }

  function openPlaylistPicker() {
    if (detailAddTargetPlaylist) {
      setAddToPlaylistId(detailAddTargetPlaylist.id);
    }

    setIsPlaylistPickerOpen((current) => !current);
  }

  function selectPlaylist(playlistId: string) {
    setSelectedPlaylistId(playlistId);
    setSearchQuery('');
    setProgress(0);
    setSoundPosition(0);
    setIsPlaying(false);
  }

  function selectArtist(artistId: string) {
    setSelectedPlaylistId(`artist:${artistId}`);
    setSearchQuery('');
    setActivePanel('flow');
    setProgress(0);
    setSoundPosition(0);
    setIsPlaying(false);
  }

  function selectAlbum(albumId: string) {
    setSelectedPlaylistId(`album:${albumId}`);
    setSearchQuery('');
    setActivePanel('flow');
    setProgress(0);
    setSoundPosition(0);
    setIsPlaying(false);
  }

  function selectNextTrack() {
    const queuedItem = queueItems[0];

    if (queuedItem) {
      setQueueItems((current) =>
        current.filter((item) => item.id !== queuedItem.id),
      );
      void requestAuthorizedJson<QueueResponse>(
        `/tracks/queue/${queuedItem.id}`,
        {
          method: 'DELETE',
        },
      )
        .then((payload) =>
          setQueueItems(payload.queue.map(normalizeQueueItem)),
        )
        .catch(() => undefined);
      selectTrack(queuedItem.track.id, true);
      return;
    }

    const playbackTracks = visibleTracks.length ? visibleTracks : currentTracks;

    if (!playbackTracks.length) {
      return;
    }

    if (isShuffle && playbackTracks.length > 1) {
      const nextChoices = playbackTracks.filter(
        (track) => track.id !== selectedTrackId,
      );
      const nextTrack =
        nextChoices[Math.floor(Math.random() * nextChoices.length)];
      selectTrack(nextTrack.id, true);
      return;
    }

    const currentIndex = playbackTracks.findIndex(
      (track) => track.id === selectedTrackId,
    );
    const nextIndex = currentIndex + 1;

    if (nextIndex >= playbackTracks.length && repeatMode === 'off') {
      setIsPlaying(false);
      return;
    }

    const nextTrack = playbackTracks[nextIndex % playbackTracks.length];
    selectTrack(nextTrack.id, true);
  }

  function selectPreviousTrack() {
    const playbackTracks = visibleTracks.length ? visibleTracks : currentTracks;

    if (!playbackTracks.length) {
      return;
    }

    const currentIndex = playbackTracks.findIndex(
      (track) => track.id === selectedTrackId,
    );
    const previousTrack =
      playbackTracks[
        (currentIndex - 1 + playbackTracks.length) % playbackTracks.length
      ];
    selectTrack(previousTrack.id, true);
  }

  function togglePlayback() {
    if (!audioSource) {
      setErrorMessage('This track does not have a backend audio file yet.');
      return;
    }

    setIsPlaying((current) => !current);
  }

  function toggleRepeatMode() {
    setRepeatMode((current) => (current === 'one' ? 'off' : 'one'));
  }

  async function seekToRatio(ratio: number) {
    const nextPosition = Math.round(
      Math.max(0, Math.min(1, ratio)) * soundDuration,
    );

    setSoundPosition(nextPosition);
    setProgress(soundDuration ? (nextPosition / soundDuration) * 100 : 0);
    await player.seekTo(nextPosition / 1000);
  }

  async function toggleLikeTrack(trackId: string) {
    if (!session) {
      return;
    }

    const isFavorite = favoriteTracks.some((track) => track.id === trackId);

    try {
      if (isFavorite) {
        await requestAuthorizedJson(`/tracks/${trackId}/favorite`, {
          method: 'DELETE',
        });
        setFavoriteTracks((current) =>
          current.filter((track) => track.id !== trackId),
        );
      } else {
        await requestAuthorizedJson(`/tracks/${trackId}/favorite`, {
          method: 'POST',
        });
        const track = libraryTracks.find((candidate) => candidate.id === trackId);

        if (track) {
          setFavoriteTracks((current) => [track, ...current]);
        }
      }
    } catch (error) {
      handleApiError(error);
    }
  }

  async function createPlaylist() {
    const name = newPlaylistName.trim();

    if (!session || !name) {
      return;
    }

    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>('/playlists', {
        method: 'POST',
        body: JSON.stringify({
          name,
        }),
      });

      const playlist = normalizePlaylist(payload.playlist);
      setPlaylists((current) => [playlist, ...current]);
      setSelectedPlaylistId(playlist.id);
      setAddToPlaylistId(playlist.id);
      setNewPlaylistName('');
    } catch (error) {
      handleApiError(error);
    }
  }

  async function deletePlaylist(playlistId: string) {
    if (!session) {
      return;
    }

    try {
      await requestAuthorizedJson(`/playlists/${playlistId}`, {
        method: 'DELETE',
      });

      setPlaylists((current) => {
        const nextPlaylists = current.filter(
          (playlist) => playlist.id !== playlistId,
        );

        if (selectedPlaylistId === playlistId) {
          setSelectedPlaylistId('library');
        }

        return nextPlaylists;
      });
    } catch (error) {
      handleApiError(error);
    }
  }

  async function addTrackToPlaylist(trackId: string, playlistId?: string) {
    const targetPlaylist = playlistId
      ? playlists.find((playlist) => playlist.id === playlistId)
      : addTargetPlaylist;

    if (!session || !targetPlaylist) {
      return;
    }

    if (targetPlaylist.tracks.some((track) => track.id === trackId)) {
      setAddToPlaylistId(targetPlaylist.id);
      setIsPlaylistPickerOpen(false);
      closeTrackActionSheet();
      return;
    }

    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>(
        `/playlists/${targetPlaylist.id}/tracks/${trackId}`,
        {
          method: 'POST',
        },
      );
      const playlist = normalizePlaylist(payload.playlist);

      setPlaylists((current) =>
        current.map((candidate) =>
          candidate.id === playlist.id ? playlist : candidate,
        ),
      );
      setAddToPlaylistId(playlist.id);
      setIsPlaylistPickerOpen(false);
      closeTrackActionSheet();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function addCurrentTrackToPlaylist(playlistId?: string) {
    await addTrackToPlaylist(selectedTrackId, playlistId);
  }

  function openTrackActionSheet(trackId: string) {
    setActionTrackId(trackId);
    setActionSheetMode('actions');
    setIsTrackActionSheetOpen(true);
  }

  function closeTrackActionSheet() {
    setIsTrackActionSheetOpen(false);
    setActionSheetMode('actions');
  }

  async function enqueueTrack(trackId: string, mode: 'next' | 'end') {
    if (!session) {
      return;
    }

    try {
      const payload = await requestAuthorizedJson<QueueActionResponse>(
        `/tracks/${trackId}/queue`,
        {
          method: 'POST',
          body: JSON.stringify({
            mode,
          }),
        },
      );

      setQueueItems(payload.queue.map(normalizeQueueItem));
      closeTrackActionSheet();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function shareTrack(track: MusicTrack) {
    await Share.share({
      message: `${track.title} by ${track.artist} on Sonik`,
      title: track.title,
    }).catch(() => undefined);
    closeTrackActionSheet();
  }

  function goToActionArtist() {
    if (!actionArtist) {
      return;
    }

    selectArtist(actionArtist.id);
    closeTrackActionSheet();
    closeTrackDetail();
  }

  function goToActionAlbum() {
    if (!actionAlbum) {
      return;
    }

    selectAlbum(actionAlbum.id);
    closeTrackActionSheet();
    closeTrackDetail();
  }

  async function createPlaylistAndAddCurrentTrack() {
    const name = newPlaylistName.trim();

    if (!session || !name) {
      return;
    }

    try {
      const createPayload = await requestAuthorizedJson<PlaylistResponse>(
        '/playlists',
        {
          method: 'POST',
          body: JSON.stringify({
            name,
          }),
        },
      );
      const createdPlaylist = normalizePlaylist(createPayload.playlist);

      setPlaylists((current) => [createdPlaylist, ...current]);
      setSelectedPlaylistId(createdPlaylist.id);
      setAddToPlaylistId(createdPlaylist.id);
      setNewPlaylistName('');

      const addPayload = await requestAuthorizedJson<PlaylistResponse>(
        `/playlists/${createdPlaylist.id}/tracks/${selectedTrackId}`,
        {
          method: 'POST',
        },
      );
      const playlistWithTrack = normalizePlaylist(addPayload.playlist);

      setPlaylists((current) =>
        current.map((candidate) =>
          candidate.id === playlistWithTrack.id ? playlistWithTrack : candidate,
        ),
      );
      setIsPlaylistPickerOpen(false);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function removeTrackFromPlaylist(playlistId: string, trackId: string) {
    if (!session) {
      return;
    }

    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>(
        `/playlists/${playlistId}/tracks/${trackId}`,
        {
          method: 'DELETE',
        },
      );
      const playlist = normalizePlaylist(payload.playlist);

      setPlaylists((current) =>
        current.map((candidate) =>
          candidate.id === playlist.id ? playlist : candidate,
        ),
      );
    } catch (error) {
      handleApiError(error);
    }
  }

  async function recordCurrentPlay(completed: boolean) {
    if (!session || !selectedTrack.streamUrl) {
      return;
    }

    await requestAuthorizedJson(`/tracks/${selectedTrack.id}/recent`, {
      method: 'POST',
      body: JSON.stringify({
        progressSeconds: Math.floor(soundPosition / 1000),
        completed,
      }),
    }).catch(() => undefined);

    await refreshPersonalLibrary().catch(() => undefined);
  }

  async function persistSession(nextSession: SessionState) {
    await AsyncStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  async function handleLogin() {
    clearFeedback();
    setIsSubmitting(true);

    try {
      const payload = await requestJson<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });

      await persistSession({
        accessToken: payload.accessToken,
        tokenType: payload.tokenType,
        user: payload.user,
      });
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword() {
    clearFeedback();
    setIsSubmitting(true);

    try {
      const payload = await requestJson<AuthResponse>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(resetForm),
      });

      await persistSession({
        accessToken: payload.accessToken,
        tokenType: payload.tokenType,
        user: payload.user,
      });
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendOtp(purpose: 'signup' | 'reset' = 'signup') {
    clearFeedback();

    if (purpose === 'signup') {
      if (!registerForm.profileName || !registerForm.password) {
        setErrorMessage('Please fill in all fields.');
        return;
      }
      if (registerForm.password !== registerForm.confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
      if (emailStatus === 'taken') {
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = await requestJson<{ message: string; devOtp?: string }>(
        '/auth/send-otp',
        {
          method: 'POST',
          body: JSON.stringify({ email: otpForm.email, purpose }),
        },
      );

      setOtpStep('verify');
      const devSuffix = payload.devOtp ? ` (dev: ${payload.devOtp})` : '';
      setNoticeMessage(`Verification code sent to ${otpForm.email}${devSuffix}`);
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtpForSignup() {
    clearFeedback();
    setIsSubmitting(true);

    try {
      const payload = await requestJson<AuthResponse>('/auth/verify-otp-signup', {
        method: 'POST',
        body: JSON.stringify({
          profileName: registerForm.profileName,
          email: otpForm.email,
          password: registerForm.password,
          otp: otpForm.otp,
        }),
      });

      await persistSession({
        accessToken: payload.accessToken,
        tokenType: payload.tokenType,
        user: payload.user,
      });
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtpForPasswordReset() {
    clearFeedback();
    setIsSubmitting(true);

    try {
      const payload = await requestJson<AuthResponse>(
        '/auth/verify-otp-reset-password',
        {
          method: 'POST',
          body: JSON.stringify({
            email: otpForm.email,
            otp: otpForm.otp,
            newPassword: resetForm.newPassword,
          }),
        },
      );

      await persistSession({
        accessToken: payload.accessToken,
        tokenType: payload.tokenType,
        user: payload.user,
      });
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!session) {
      return;
    }

    setIsSubmitting(true);

    try {
      await requestAuthorizedJson('/auth/account', {
        method: 'DELETE',
      });

      await handleLogout();
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
      setIsDeleteAccountConfirming(false);
    }
  }

  async function refreshLibraryTracks() {
    try {
      const [tracksPayload, artistsPayload, albumsPayload] = await Promise.all([
        requestJson<TracksResponse>('/tracks'),
        requestJson<ArtistsResponse>('/tracks/artists').catch(() => null),
        requestJson<AlbumsResponse>('/tracks/albums').catch(() => null),
      ]);
      const nextTracks = tracksPayload.tracks.map(normalizeTrack);
      setLibraryTracks(nextTracks);
      setArtists(
        artistsPayload?.artists.length
          ? artistsPayload.artists.map(normalizeArtist)
          : buildArtistsFromTracks(nextTracks),
      );
      setAlbums(
        albumsPayload?.albums.length
          ? albumsPayload.albums.map(normalizeAlbum)
          : buildAlbumsFromTracks(nextTracks),
      );
    } catch {
      // best-effort
    }
  }

  async function pickAdminAudio() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setAdminAudioFile({
      uri: asset.uri,
      name: asset.name ?? `audio-${Date.now()}.mp3`,
      mimeType: asset.mimeType ?? 'audio/mpeg',
    });
  }

  async function pickAdminCover() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setAdminCoverFile({
      uri: asset.uri,
      name: asset.name ?? `cover-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  }

  function clearAdminUploadForm() {
    setAdminUploadForm({
      title: '',
      artist: '',
      album: '',
      genre: '',
      mood: '',
    });
    setAdminAudioFile(null);
    setAdminCoverFile(null);
  }

  async function handleAdminUpload() {
    if (!session) return;
    if (!adminAudioFile) {
      setErrorMessage('Choose an audio file to upload.');
      return;
    }
    if (!adminUploadForm.title.trim()) {
      setErrorMessage('Give the track a title.');
      return;
    }
    clearFeedback();
    setIsAdminUploading(true);

    const payload = new FormData();
    payload.append('audio', {
      uri: adminAudioFile.uri,
      name: adminAudioFile.name,
      type: adminAudioFile.mimeType,
    } as unknown as Blob);
    if (adminCoverFile) {
      payload.append('cover', {
        uri: adminCoverFile.uri,
        name: adminCoverFile.name,
        type: adminCoverFile.mimeType,
      } as unknown as Blob);
    }
    payload.append('title', adminUploadForm.title.trim());
    if (adminUploadForm.artist.trim()) payload.append('artist', adminUploadForm.artist.trim());
    if (adminUploadForm.album.trim()) payload.append('album', adminUploadForm.album.trim());
    if (adminUploadForm.genre.trim()) payload.append('genre', adminUploadForm.genre.trim());
    if (adminUploadForm.mood.trim()) payload.append('mood', adminUploadForm.mood.trim());

    try {
      const response = await fetch(`${apiBaseUrl}/tracks/admin/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: payload,
      });
      const body = (await response.json().catch(() => null)) as
        | { message?: string | string[] }
        | null;
      if (!response.ok) {
        const message = Array.isArray(body?.message)
          ? body?.message.join(', ')
          : body?.message;
        throw new Error(message ?? 'Upload failed.');
      }
      setNoticeMessage(`"${adminUploadForm.title.trim()}" uploaded.`);
      clearAdminUploadForm();
      await refreshLibraryTracks();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Upload failed. Try again.',
      );
    } finally {
      setIsAdminUploading(false);
    }
  }

  async function handleAdminDeleteTrack(trackId: string) {
    if (!session) return;
    setAdminPendingDeleteId(trackId);
    setErrorMessage('');
    try {
      await requestAuthorizedJson(`/tracks/admin/${trackId}`, {
        method: 'DELETE',
      });
      setLibraryTracks((current) => current.filter((track) => track.id !== trackId));
      await refreshLibraryTracks();
    } catch (error) {
      handleApiError(error);
    } finally {
      setAdminPendingDeleteId(null);
    }
  }

  async function handleGoogleToken(idToken: string) {
    clearFeedback();
    setIsSubmitting(true);

    try {
      const payload = await requestJson<AuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({
          idToken,
        }),
      });

      await persistSession({
        accessToken: payload.accessToken,
        tokenType: payload.tokenType,
        user: payload.user,
      });
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    player.pause();

    await AsyncStorage.removeItem(sessionStorageKey);
    setSession(null);
    setFavoriteTracks([]);
    setRecentTracks([]);
    setPlaylists([]);
    setQueueItems([]);
    setSelectedPlaylistId('library');
    setView('login');
    setActivePanel('flow');
    setResetForm({
      newPassword: '',
    });
    setIsAdminViewOpen(false);
    clearFeedback();
  }

  async function openGoogleFlow() {
    clearFeedback();

    if (!googleEnabled || !googleRequest) {
      setErrorMessage('Google sign-in is not available right now.');
      return;
    }

    await promptGoogleSignIn();
  }

  function toggleThemeMode() {
    setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  if (isBootstrapping) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <View style={styles.bootCard}>
          <LinearGradient
            colors={[theme.accent, theme.secondary]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.brandMark}
          >
            <Text style={styles.brandMarkText}>S</Text>
          </LinearGradient>
          <ActivityIndicator color={theme.secondary} />
          <Text style={styles.bootText}>Opening Sonik</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (session && isAdminViewOpen && session.user.role === 'admin') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <ScrollView
          contentContainerStyle={styles.adminContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.adminHeader}>
            <Pressable
              onPress={() => {
                setIsAdminViewOpen(false);
                clearFeedback();
              }}
              style={styles.adminBackButton}
            >
              <Ionicons color={theme.text} name="chevron-back" size={20} />
              <Text style={styles.adminBackText}>Back</Text>
            </Pressable>
            <Text style={styles.adminTitle}>Admin panel</Text>
            <View style={{ width: 60 }} />
          </View>

          {errorMessage ? (
            <View style={[styles.feedback, styles.feedbackError]}>
              <Text style={styles.feedbackText}>{errorMessage}</Text>
            </View>
          ) : null}
          {noticeMessage ? (
            <View style={[styles.feedback, styles.feedbackNotice]}>
              <Text style={styles.feedbackText}>{noticeMessage}</Text>
            </View>
          ) : null}

          <View style={styles.adminCard}>
            <Text style={styles.adminCardTitle}>Upload a track</Text>
            <Text style={styles.caption}>
              Audio file is required. Cover image and metadata are optional.
            </Text>

            <TextInput
              onChangeText={(title) =>
                setAdminUploadForm((current) => ({ ...current, title }))
              }
              placeholder="Title (required)"
              placeholderTextColor={theme.muted}
              style={styles.input}
              value={adminUploadForm.title}
            />
            <TextInput
              onChangeText={(artist) =>
                setAdminUploadForm((current) => ({ ...current, artist }))
              }
              placeholder="Artist"
              placeholderTextColor={theme.muted}
              style={styles.input}
              value={adminUploadForm.artist}
            />
            <TextInput
              onChangeText={(album) =>
                setAdminUploadForm((current) => ({ ...current, album }))
              }
              placeholder="Album"
              placeholderTextColor={theme.muted}
              style={styles.input}
              value={adminUploadForm.album}
            />
            <TextInput
              onChangeText={(genre) =>
                setAdminUploadForm((current) => ({ ...current, genre }))
              }
              placeholder="Genre"
              placeholderTextColor={theme.muted}
              style={styles.input}
              value={adminUploadForm.genre}
            />
            <TextInput
              onChangeText={(mood) =>
                setAdminUploadForm((current) => ({ ...current, mood }))
              }
              placeholder="Mood"
              placeholderTextColor={theme.muted}
              style={styles.input}
              value={adminUploadForm.mood}
            />

            <Pressable
              onPress={() => {
                void pickAdminAudio();
              }}
              style={styles.filePickerButton}
            >
              <Ionicons color={theme.text} name="musical-notes" size={18} />
              <Text style={styles.filePickerText} numberOfLines={1}>
                {adminAudioFile ? adminAudioFile.name : 'Choose audio file'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void pickAdminCover();
              }}
              style={styles.filePickerButton}
            >
              <Ionicons color={theme.text} name="image" size={18} />
              <Text style={styles.filePickerText} numberOfLines={1}>
                {adminCoverFile ? adminCoverFile.name : 'Choose cover (optional)'}
              </Text>
            </Pressable>

            <Pressable
              disabled={isAdminUploading}
              onPress={() => {
                void handleAdminUpload();
              }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>
                {isAdminUploading ? 'Uploading…' : 'Upload track'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.adminCard}>
            <Text style={styles.adminCardTitle}>
              Library ({libraryTracks.length} track
              {libraryTracks.length === 1 ? '' : 's'})
            </Text>
            <Text style={styles.caption}>
              Remove a track to take it out of the shared library.
            </Text>

            {libraryTracks.length === 0 ? (
              <Text style={styles.caption}>No tracks yet. Upload one above.</Text>
            ) : (
              <View style={styles.adminGrid}>
                {libraryTracks.map((track) => (
                  <View key={track.id} style={styles.adminGridCard}>
                    <TrackArt track={track} size="medium" />
                    <Text style={styles.adminGridTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.adminGridSub} numberOfLines={1}>
                      {track.artist}
                    </Text>
                    <Pressable
                      disabled={adminPendingDeleteId === track.id}
                      onPress={() => {
                        void handleAdminDeleteTrack(track.id);
                      }}
                      style={styles.adminGridRemove}
                    >
                      <Text style={styles.adminGridRemoveText}>
                        {adminPendingDeleteId === track.id ? 'Removing…' : 'Remove'}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <View style={styles.playerScreen}>
          <ScrollView
            contentContainerStyle={styles.playerContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.appHeader}>
              <View style={styles.brandRow}>
                <LinearGradient
                  colors={[theme.accent, theme.secondary]}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={styles.brandMark}
                >
                  <Text style={styles.brandMarkText}>S</Text>
                </LinearGradient>
                <Text style={styles.brandName}>Sonik</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityLabel={`Switch to ${
                    themeMode === 'dark' ? 'light' : 'dark'
                  } mode`}
                  style={styles.themeButton}
                  onPress={toggleThemeMode}
                >
                  <Ionicons
                    color={theme.text}
                    name={themeMode === 'dark' ? 'sunny' : 'moon'}
                    size={18}
                  />
                </Pressable>
                <Pressable style={styles.logoutButton} onPress={handleLogout}>
                  <Ionicons color={theme.text} name="log-out-outline" size={20} />
                </Pressable>
              </View>
            </View>

            <View style={styles.searchPill}>
              <Ionicons color={theme.muted} name="search" size={18} />
              <TextInput
                autoCapitalize="none"
                onChangeText={setSearchQuery}
                placeholder="Search songs, artists, albums"
                placeholderTextColor={theme.muted}
                style={styles.searchInput}
                value={searchQuery}
              />
            </View>

            <View style={styles.panelTabs}>
              {[
                ['flow', 'Flow'],
                ['library', 'Library'],
                ['profile', 'Profile'],
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setActivePanel(value as ActivePanel)}
                  style={[
                    styles.panelTab,
                    activePanel === value ? styles.panelTabActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.panelTabLabel,
                      activePanel === value ? styles.panelTabLabelActive : null,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sourceScroller}
            >
              {sourceFilters.map(({ id, label, count }) => (
                <Pressable
                  key={id}
                  onPress={() => selectPlaylist(id)}
                  style={[
                    styles.sourceChip,
                    selectedPlaylistId === id ? styles.sourceChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.sourceChipLabel,
                      selectedPlaylistId === id
                        ? styles.sourceChipLabelActive
                        : null,
                    ]}
                  >
                    {label}
                  </Text>
                  <Text
                    style={[
                      styles.sourceChipCount,
                      selectedPlaylistId === id
                        ? styles.sourceChipCountActive
                        : null,
                    ]}
                  >
                    {count}
                  </Text>
                </Pressable>
              ))}
              {selectedPlaylistId.startsWith('artist:') ||
              selectedPlaylistId.startsWith('album:') ? (
                <Pressable style={[styles.sourceChip, styles.sourceChipActive]}>
                  <Text
                    style={[styles.sourceChipLabel, styles.sourceChipLabelActive]}
                    numberOfLines={1}
                  >
                    {selectedSourceLabel}
                  </Text>
                  <Text
                    style={[styles.sourceChipCount, styles.sourceChipCountActive]}
                  >
                    {currentTracks.length}
                  </Text>
                </Pressable>
              ) : null}
              {playlists.map((playlist, index) => (
                <Pressable
                  key={`source-playlist-${playlist.id}-${index}`}
                  onPress={() => selectPlaylist(playlist.id)}
                  style={[
                    styles.sourceChip,
                    selectedPlaylistId === playlist.id
                      ? styles.sourceChipActive
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.sourceChipLabel,
                      selectedPlaylistId === playlist.id
                        ? styles.sourceChipLabelActive
                        : null,
                    ]}
                  >
                    {playlist.name}
                  </Text>
                  <Text
                    style={[
                      styles.sourceChipCount,
                      selectedPlaylistId === playlist.id
                        ? styles.sourceChipCountActive
                        : null,
                    ]}
                  >
                    {playlist.trackCount}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {activePanel === 'flow' ? (
              <>
            <View style={styles.signalDeck}>
              <TrackArt track={selectedTrack} size="large" />
              <View style={styles.deckCopy}>
                <Text style={styles.eyebrow}>
                  Playing from {selectedSourceLabel}
                </Text>
                <Text style={styles.trackTitle}>{selectedTrack.title}</Text>
                <Text style={styles.trackArtist}>
                  {selectedTrack.artist} - {selectedTrack.album}
                </Text>
                <View style={styles.chipRow}>
                  <Text style={styles.chip}>{selectedTrack.mood}</Text>
                  <Text style={styles.chip}>{selectedTrack.plays} plays</Text>
                  <Text style={styles.chip}>{selectedRuntimeLabel}</Text>
                </View>
                <View style={styles.heroActionRow}>
                  <Pressable onPress={togglePlayback} style={styles.heroPlayButton}>
                    <LinearGradient
                      colors={[theme.accent, theme.secondary]}
                      end={{ x: 1, y: 1 }}
                      start={{ x: 0, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons
                      color={theme.accentText}
                      name={isPlaying ? 'pause' : 'play'}
                      size={18}
                    />
                    <Text style={styles.heroPlayLabel}>
                      {isPlaying ? 'Pause' : 'Play'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void toggleLikeTrack(selectedTrack.id)}
                    style={[
                      styles.heroSubtleButton,
                      isSelectedTrackLiked ? styles.heroSubtleButtonActive : null,
                    ]}
                  >
                    <Ionicons
                      color={isSelectedTrackLiked ? '#ff7a59' : theme.text}
                      name={isSelectedTrackLiked ? 'heart' : 'heart-outline'}
                      size={18}
                    />
                    <Text style={styles.heroSubtleLabel}>
                      {isSelectedTrackLiked ? 'Liked' : 'Like'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={!addTargetPlaylist}
                    onPress={() => void addCurrentTrackToPlaylist()}
                    style={[
                      styles.heroSubtleButton,
                      !addTargetPlaylist ? styles.heroSubtleButtonDisabled : null,
                    ]}
                  >
                    <Ionicons color={theme.text} name="add" size={18} />
                    <Text style={styles.heroSubtleLabel}>Add</Text>
                  </Pressable>
                </View>
                {/* {isSoundLoading ? (
                  <Text style={styles.caption}>Loading backend audio</Text>
                ) : null} */}
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Signal blends</Text>
              <Text style={styles.sectionAction}>Refresh</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mixScroller}
            >
              {mixes.map((mix) => (
                <View style={styles.mixCard} key={mix.title}>
                  <TrackArt track={{ coverClass: mix.coverClass }} size="small" />
                  <Text style={styles.mixTitle}>{mix.title}</Text>
                  <Text style={styles.mixDetail}>{mix.detail}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Track runway</Text>
              <Text style={styles.sectionAction}>
                {visibleTracks.length} tracks
              </Text>
            </View>
            <View style={styles.trackList}>
              {visibleTracks.map((track, index) => {
                const isSelected = track.id === selectedTrackId;

                return (
                  <Pressable
                    key={`runway-${track.id}-${index}`}
                    onLongPress={() => openTrackActionSheet(track.id)}
                    onPress={() => openTrackDetail(track.id)}
                    style={[
                      styles.trackRow,
                      isSelected ? styles.trackRowActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.trackNumber,
                        isSelected ? styles.trackNumberActive : null,
                      ]}
                    >
                      {isSelected && isPlaying ? '|||' : index + 1}
                    </Text>
                    <TrackArt track={track} size="small" />
                    <View style={styles.trackMeta}>
                      <Text style={styles.trackName} numberOfLines={1}>
                        {track.title}
                      </Text>
                      <Text style={styles.trackSubtext} numberOfLines={1}>
                        {track.artist} - {track.mood}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityLabel={
                        favoriteTracks.some((favorite) => favorite.id === track.id)
                          ? 'Unlike track'
                          : 'Like track'
                      }
                      onPress={(event) => {
                        event.stopPropagation();
                        void toggleLikeTrack(track.id);
                      }}
                      style={styles.rowIconButton}
                    >
                      <Ionicons
                        color={
                          favoriteTracks.some(
                            (favorite) => favorite.id === track.id,
                          )
                            ? '#ff7a59'
                            : theme.muted
                        }
                        name={
                          favoriteTracks.some(
                            (favorite) => favorite.id === track.id,
                          )
                            ? 'heart'
                            : 'heart-outline'
                        }
                        size={19}
                      />
                    </Pressable>
                    <Text style={styles.trackDuration}>
                      {durationByTrackId[track.id] ?? track.duration}
                    </Text>
                  </Pressable>
                );
              })}
              {!visibleTracks.length ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No tracks found</Text>
                  <Text style={styles.caption}>
                    Try a different song, artist, album, or mood.
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.queueCard}>
              <Text style={styles.sectionTitle}>Up next</Text>
              {queuePreviewTracks
                .slice(0, 3)
                .map((track, index) => (
                  <Pressable
                    key={`queue-${track.id}-${index}`}
                    onLongPress={() => openTrackActionSheet(track.id)}
                    onPress={() => openTrackDetail(track.id)}
                    style={styles.queueItem}
                  >
                    <TrackArt track={track} size="small" />
                    <View style={styles.trackMeta}>
                      <Text style={styles.trackName} numberOfLines={1}>
                        {track.title}
                      </Text>
                      <Text style={styles.trackSubtext} numberOfLines={1}>
                        {track.artist}
                      </Text>
                    </View>
                  </Pressable>
                ))}
            </View>
              </>
            ) : null}

            {activePanel === 'library' ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Liked songs</Text>
                  <Text style={styles.sectionAction}>
                    {favoriteTracks.length} saved
                  </Text>
                </View>
                <View style={styles.trackList}>
                  {favoriteTracks.length ? (
                    favoriteTracks.map((track, index) => (
                      <Pressable
                        key={`favorite-${track.id}-${index}`}
                        onLongPress={() => openTrackActionSheet(track.id)}
                        onPress={() => openTrackDetail(track.id)}
                        style={[
                          styles.trackRow,
                          track.id === selectedTrackId
                            ? styles.trackRowActive
                            : null,
                        ]}
                      >
                        <Ionicons color="#ff7a59" name="heart" size={19} />
                        <TrackArt track={track} size="small" />
                        <View style={styles.trackMeta}>
                          <Text style={styles.trackName} numberOfLines={1}>
                            {track.title}
                          </Text>
                          <Text style={styles.trackSubtext} numberOfLines={1}>
                            {track.artist} - {track.album}
                          </Text>
                        </View>
                        <Text style={styles.trackDuration}>
                          {durationByTrackId[track.id] ?? track.duration}
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>No liked songs yet</Text>
                      <Text style={styles.caption}>
                        Tap the heart in Profile to start building your library.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent plays</Text>
                  <Text style={styles.sectionAction}>
                    {recentTracks.length} listened
                  </Text>
                </View>
                <View style={styles.trackList}>
                  {recentTracks.length ? (
                    recentTracks.map((track, index) => (
                      <Pressable
                        key={`recent-${track.id}-${index}`}
                        onLongPress={() => openTrackActionSheet(track.id)}
                        onPress={() => openTrackDetail(track.id)}
                        style={[
                          styles.trackRow,
                          track.id === selectedTrackId
                            ? styles.trackRowActive
                            : null,
                        ]}
                      >
                        <Ionicons color={theme.secondary} name="time" size={19} />
                        <TrackArt track={track} size="small" />
                        <View style={styles.trackMeta}>
                          <Text style={styles.trackName} numberOfLines={1}>
                            {track.title}
                          </Text>
                          <Text style={styles.trackSubtext} numberOfLines={1}>
                            {track.artist} - {track.album}
                          </Text>
                        </View>
                        <Text style={styles.trackDuration}>
                          {durationByTrackId[track.id] ?? track.duration}
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>No recent plays yet</Text>
                      <Text style={styles.caption}>
                        Finished tracks will appear here automatically.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Artists</Text>
                  <Text style={styles.sectionAction}>
                    {artists.length} profiles
                  </Text>
                </View>
                <View style={styles.playlistGrid}>
                  {artists.map((artist) => (
                    <Pressable
                      key={`artist-${artist.id}`}
                      onPress={() => selectArtist(artist.id)}
                      style={styles.playlistCard}
                    >
                      <Text style={styles.playlistTitle}>{artist.name}</Text>
                      <Text style={styles.caption}>
                        {artist.trackCount} tracks - {artist.albumCount} albums
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Albums</Text>
                  <Text style={styles.sectionAction}>
                    {albums.length} releases
                  </Text>
                </View>
                <View style={styles.playlistGrid}>
                  {albums.map((album) => (
                    <Pressable
                      key={`album-${album.id}`}
                      onPress={() => selectAlbum(album.id)}
                      style={styles.playlistCard}
                    >
                      <Text style={styles.playlistTitle}>{album.title}</Text>
                      <Text style={styles.caption}>
                        {album.artist} - {album.trackCount} tracks
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Playlists</Text>
                  <Text style={styles.sectionAction}>{playlists.length} crates</Text>
                </View>
                <View style={styles.playlistGrid}>
                  {playlists.map((playlist, index) => (
                    <Pressable
                      key={`library-playlist-${playlist.id}-${index}`}
                      onPress={() => {
                        setSelectedPlaylistId(playlist.id);
                        setActivePanel('profile');
                      }}
                      style={styles.playlistCard}
                    >
                      <Text style={styles.playlistTitle}>{playlist.name}</Text>
                      <Text style={styles.caption}>
                        {playlist.trackCount} tracks
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {activePanel === 'profile' ? (
              <>
                <View style={styles.profileCard}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>
                      {session.user.profileName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.profileCopy}>
                    <Text style={styles.profileName}>
                      {session.user.profileName}
                    </Text>
                    <Text style={styles.caption}>{session.user.email}</Text>
                    {session.user.role === 'admin' ? (
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>ADMIN</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{favoriteTracks.length}</Text>
                    <Text style={styles.statLabel}>Liked</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{playlists.length}</Text>
                    <Text style={styles.statLabel}>Playlists</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{libraryTracks.length}</Text>
                    <Text style={styles.statLabel}>Library</Text>
                  </View>
                </View>

                <View style={styles.managementCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Current track</Text>
                    <Pressable onPress={() => toggleLikeTrack(selectedTrackId)}>
                      <Ionicons
                        color={isSelectedTrackLiked ? '#ff7a59' : theme.mutedStrong}
                        name={isSelectedTrackLiked ? 'heart' : 'heart-outline'}
                        size={24}
                      />
                    </Pressable>
                  </View>
                  <View style={styles.queueItem}>
                    <TrackArt track={selectedTrack} size="small" />
                    <View style={styles.trackMeta}>
                      <Text style={styles.trackName}>{selectedTrack.title}</Text>
                      <Text style={styles.trackSubtext}>
                        {selectedTrack.artist} - {selectedTrack.mood}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => void addCurrentTrackToPlaylist()}
                    style={styles.secondaryAction}
                  >
                    <Ionicons color={theme.text} name="add" size={18} />
                    <Text style={styles.secondaryActionLabel}>
                      Add to selected playlist
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.managementCard}>
                  <Text style={styles.sectionTitle}>Create playlist</Text>
                  <View style={styles.createPlaylistRow}>
                    <TextInput
                      onChangeText={setNewPlaylistName}
                      placeholder="Playlist name"
                      placeholderTextColor={theme.muted}
                      style={[styles.input, styles.playlistInput]}
                      value={newPlaylistName}
                    />
                    <Pressable onPress={createPlaylist} style={styles.addButton}>
                      <LinearGradient
                        colors={[theme.accent, theme.secondary]}
                        end={{ x: 1, y: 1 }}
                        start={{ x: 0, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <Ionicons color={theme.accentText} name="add" size={22} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.managementCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Manage playlists</Text>
                    {selectedPlaylist ? (
                      <Text style={styles.sectionAction}>
                        {selectedPlaylist.trackCount} tracks
                      </Text>
                    ) : null}
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.playlistScroller}
                  >
                    {playlists.map((playlist, index) => (
                      <Pressable
                        key={`manage-playlist-${playlist.id}-${index}`}
                        onPress={() => setSelectedPlaylistId(playlist.id)}
                        style={[
                          styles.playlistChip,
                          selectedPlaylist?.id === playlist.id
                            ? styles.playlistChipActive
                            : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.playlistChipText,
                            selectedPlaylist?.id === playlist.id
                              ? styles.playlistChipTextActive
                              : null,
                          ]}
                        >
                          {playlist.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {selectedPlaylist ? (
                    <>
                      {selectedPlaylist.tracks.length ? (
                        selectedPlaylist.tracks.map((track, index) => (
                          <View
                            style={styles.playlistTrackRow}
                            key={`playlist-track-${track.id}-${index}`}
                          >
                            <Pressable
                              onLongPress={() => openTrackActionSheet(track.id)}
                              onPress={() => openTrackDetail(track.id)}
                              style={styles.playlistTrackPressable}
                            >
                              <TrackArt track={track} size="small" />
                              <View style={styles.trackMeta}>
                                <Text style={styles.trackName} numberOfLines={1}>
                                  {track.title}
                                </Text>
                                <Text
                                  style={styles.trackSubtext}
                                  numberOfLines={1}
                                >
                                  {track.artist}
                                </Text>
                              </View>
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                removeTrackFromPlaylist(
                                  selectedPlaylist.id,
                                  track.id,
                                )
                              }
                              style={styles.removeButton}
                            >
                              <Ionicons
                                color={theme.danger}
                                name="remove"
                                size={18}
                              />
                            </Pressable>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.caption}>
                          This playlist is empty. Add the current track when it
                          fits the mood.
                        </Text>
                      )}

                      <Pressable
                        onPress={() => deletePlaylist(selectedPlaylist.id)}
                        style={styles.deletePlaylistButton}
                      >
                        <Text style={styles.deletePlaylistText}>
                          Delete playlist
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text style={styles.caption}>
                      Create a playlist to start collecting tracks.
                    </Text>
                  )}
                </View>

                <View style={styles.managementCard}>
                  <Pressable
                    onPress={() => setIsDeleteAccountConfirming(true)}
                    style={[styles.deletePlaylistButton, styles.deleteAccountButton]}
                  >
                    <Ionicons
                      color={theme.danger}
                      name="trash-outline"
                      size={18}
                    />
                    <Text style={[styles.deletePlaylistText, styles.deleteAccountText]}>
                      Delete Account
                    </Text>
                  </Pressable>
                  {session.user.role === 'admin' ? (
                    <Pressable
                      onPress={() => setIsAdminViewOpen(true)}
                      style={({ pressed }) => [
                        styles.adminButton,
                        pressed && styles.adminButtonPressed,
                      ]}
                    >
                      <LinearGradient
                        colors={[theme.accent, theme.secondary]}
                        end={{ x: 1, y: 1 }}
                        start={{ x: 0, y: 0 }}
                        style={styles.adminButtonGradient}
                      >
                        <Ionicons
                          color={theme.accentText}
                          name="cloud-upload"
                          size={14}
                        />
                        <Text style={styles.adminButtonText}>Admin panel</Text>
                      </LinearGradient>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : null}
          </ScrollView>

          <Modal
            animationType="slide"
            onRequestClose={closeTrackActionSheet}
            transparent
            visible={isTrackActionSheetOpen}
          >
            <Pressable
              onPress={closeTrackActionSheet}
              style={styles.sheetBackdrop}
            >
              <Pressable
                onPress={(event) => event.stopPropagation()}
                style={styles.actionSheet}
              >
                <View style={styles.sheetDragHandle} />
                {actionTrack ? (
                  <>
                    <View style={styles.actionSheetHeader}>
                      <TrackArt track={actionTrack} size="small" />
                      <View style={styles.trackMeta}>
                        <Text style={styles.trackName} numberOfLines={1}>
                          {actionTrack.title}
                        </Text>
                        <Text style={styles.trackSubtext} numberOfLines={1}>
                          {actionTrack.artist} - {actionTrack.album}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sheetDivider} />

                    {actionSheetMode === 'actions' ? (
                      <View style={styles.actionSheetList}>
                        <Pressable
                          onPress={() => void enqueueTrack(actionTrack.id, 'next')}
                          style={styles.actionSheetOption}
                        >
                          <Ionicons
                            color={theme.text}
                            name="play-skip-forward"
                            size={20}
                          />
                          <Text style={styles.actionSheetOptionText}>
                            Play next
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void enqueueTrack(actionTrack.id, 'end')}
                          style={styles.actionSheetOption}
                        >
                          <Ionicons
                            color={theme.text}
                            name="list"
                            size={20}
                          />
                          <Text style={styles.actionSheetOptionText}>
                            Add to queue
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void shareTrack(actionTrack)}
                          style={styles.actionSheetOption}
                        >
                          <Ionicons
                            color={theme.text}
                            name="share-outline"
                            size={20}
                          />
                          <Text style={styles.actionSheetOptionText}>Share</Text>
                        </Pressable>
                        <Pressable
                          disabled={!actionArtist}
                          onPress={goToActionArtist}
                          style={[
                            styles.actionSheetOption,
                            !actionArtist ? styles.actionSheetOptionDisabled : null,
                          ]}
                        >
                          <Ionicons
                            color={actionArtist ? theme.text : theme.muted}
                            name="person-outline"
                            size={20}
                          />
                          <Text style={styles.actionSheetOptionText}>
                            Go to artist
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={!actionAlbum}
                          onPress={goToActionAlbum}
                          style={[
                            styles.actionSheetOption,
                            !actionAlbum ? styles.actionSheetOptionDisabled : null,
                          ]}
                        >
                          <Ionicons
                            color={actionAlbum ? theme.text : theme.muted}
                            name="albums-outline"
                            size={20}
                          />
                          <Text style={styles.actionSheetOptionText}>
                            Go to album
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setActionSheetMode('playlists')}
                          style={styles.actionSheetOption}
                        >
                          <Ionicons
                            color={theme.text}
                            name="add-circle-outline"
                            size={20}
                          />
                          <Text style={styles.actionSheetOptionText}>
                            Save to playlist
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.actionSheetList}>
                        <Pressable
                          onPress={() => setActionSheetMode('actions')}
                          style={styles.actionSheetOption}
                        >
                          <Ionicons
                            color={theme.text}
                            name="chevron-back"
                            size={20}
                          />
                          <Text style={styles.actionSheetOptionText}>
                            Save to playlist
                          </Text>
                        </Pressable>

                        {playlists.length ? (
                          playlists.map((playlist) => {
                            const isSaved = playlist.tracks.some(
                              (track) => track.id === actionTrack.id,
                            );

                            return (
                              <Pressable
                                key={`sheet-playlist-${playlist.id}`}
                                onPress={() =>
                                  void addTrackToPlaylist(
                                    actionTrack.id,
                                    playlist.id,
                                  )
                                }
                                style={styles.actionSheetOption}
                              >
                                <Ionicons
                                  color={theme.text}
                                  name={isSaved ? 'checkmark' : 'musical-notes'}
                                  size={20}
                                />
                                <View style={styles.trackMeta}>
                                  <Text
                                    style={styles.actionSheetOptionText}
                                    numberOfLines={1}
                                  >
                                    {playlist.name}
                                  </Text>
                                  <Text style={styles.trackSubtext}>
                                    {isSaved ? 'Already saved' : 'Save here'}
                                  </Text>
                                </View>
                              </Pressable>
                            );
                          })
                        ) : (
                          <Text style={styles.caption}>
                            Create a playlist from Profile first.
                          </Text>
                        )}
                      </View>
                    )}
                  </>
                ) : null}
              </Pressable>
            </Pressable>
          </Modal>

          <Modal
            animationType="slide"
            onRequestClose={closeTrackDetail}
            presentationStyle="fullScreen"
            visible={isTrackDetailOpen}
          >
            <SafeAreaView style={styles.detailScreen}>
              <View style={styles.detailHeader}>
                <Pressable
                  accessibilityLabel="Close track details"
                  onPress={closeTrackDetail}
                  style={styles.detailHeaderButton}
                >
                  <Ionicons color={theme.text} name="chevron-down" size={24} />
                </Pressable>
                <View style={styles.detailHeaderCopy}>
                  <Text style={styles.detailEyebrow}>Playing from</Text>
                  <Text style={styles.detailSource} numberOfLines={1}>
                    {selectedSourceLabel}
                  </Text>
                </View>
                <View style={styles.detailHeaderActions}>
                  <Pressable
                    accessibilityLabel={
                      isSelectedTrackLiked ? 'Unlike track' : 'Like track'
                    }
                    onPress={() => void toggleLikeTrack(selectedTrack.id)}
                    style={styles.detailHeaderButton}
                  >
                    <Ionicons
                      color={isSelectedTrackLiked ? '#ff7a59' : theme.text}
                      name={isSelectedTrackLiked ? 'heart' : 'heart-outline'}
                      size={23}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="More actions"
                    onPress={() => openTrackActionSheet(selectedTrack.id)}
                    style={styles.detailHeaderButton}
                  >
                    <Ionicons
                      color={theme.text}
                      name="ellipsis-vertical"
                      size={20}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.detailBody}>
                <TrackArt track={selectedTrack} size="large" />
                <View style={styles.detailTrackCopy}>
                  <Text style={styles.detailTitle} numberOfLines={3}>
                    {selectedTrack.title}
                  </Text>
                  <Text style={styles.detailArtist} numberOfLines={2}>
                    {selectedTrack.artist} - {selectedTrack.album}
                  </Text>
                </View>
                <View style={styles.chipRow}>
                  <Text style={styles.chip}>{selectedTrack.mood}</Text>
                  <Text style={styles.chip}>{selectedTrack.plays} plays</Text>
                  <Text style={styles.chip}>{selectedRuntimeLabel}</Text>
                </View>
              </View>

              <View style={styles.detailFooter}>
                <View style={styles.progressMeta}>
                  <Text style={styles.progressText}>
                    {formatMillis(soundPosition)}
                  </Text>
                  <Pressable
                    accessibilityLabel="Seek track"
                    onLayout={(event) =>
                      setProgressTrackWidth(event.nativeEvent.layout.width)
                    }
                    onPress={(event) =>
                      void seekToRatio(
                        event.nativeEvent.locationX / progressTrackWidth,
                      )
                    }
                    style={styles.progressTrack}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progress}%` as `${number}%` },
                      ]}
                    />
                  </Pressable>
                  <Text style={styles.progressText}>{selectedRuntimeLabel}</Text>
                </View>

                <View style={styles.detailTransportRow}>
                  <IconButton
                    icon="shuffle"
                    label="Shuffle"
                    colors={iconButtonColors}
                    onPress={() => setIsShuffle((current) => !current)}
                    variant={isShuffle ? 'solid' : 'ghost'}
                  />
                  <IconButton
                    icon="play-skip-back"
                    label="Previous track"
                    colors={iconButtonColors}
                    onPress={selectPreviousTrack}
                  />
                  <Pressable
                    accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                    onPress={togglePlayback}
                    style={styles.detailPlayButton}
                  >
                    <LinearGradient
                      colors={[theme.accent, theme.secondary]}
                      end={{ x: 1, y: 1 }}
                      start={{ x: 0, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons
                      color={theme.accentText}
                      name={isPlaying ? 'pause' : 'play'}
                      size={34}
                    />
                  </Pressable>
                  <IconButton
                    icon="play-skip-forward"
                    label="Next track"
                    colors={iconButtonColors}
                    onPress={selectNextTrack}
                  />
                  <IconButton
                    icon="repeat"
                    label="Repeat one"
                    colors={iconButtonColors}
                    onPress={toggleRepeatMode}
                    variant={repeatMode === 'one' ? 'solid' : 'ghost'}
                  />
                </View>

                <Pressable
                  onPress={openPlaylistPicker}
                  style={[
                    styles.detailSecondaryAction,
                    isPlaylistPickerOpen ? styles.detailSecondaryActionActive : null,
                  ]}
                >
                  <Ionicons
                    color={theme.text}
                    name={isPlaylistPickerOpen ? 'chevron-down' : 'add'}
                    size={18}
                  />
                  <Text style={styles.secondaryActionLabel}>
                    {isSelectedTrackInDetailTarget ? 'Added' : 'Add to playlist'}
                  </Text>
                </Pressable>

                {isPlaylistPickerOpen ? (
                  <View style={styles.playlistPickerPanel}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Add to playlist</Text>
                      <Text style={styles.sectionAction}>
                        {playlists.length} crates
                      </Text>
                    </View>

                    {playlists.length ? (
                      <View style={styles.detailPlaylistList}>
                        {playlists.map((playlist, index) => {
                          const isCurrentTarget = playlist.id === addToPlaylistId;
                          const isAlreadyAdded = playlist.tracks.some(
                            (track) => track.id === selectedTrackId,
                          );

                          return (
                            <Pressable
                              key={`detail-playlist-${playlist.id}-${index}`}
                              onPress={() => {
                                setAddToPlaylistId(playlist.id);
                                void addCurrentTrackToPlaylist(playlist.id);
                              }}
                              style={[
                                styles.detailPlaylistItem,
                                isCurrentTarget
                                  ? styles.detailPlaylistItemActive
                                  : null,
                              ]}
                            >
                              <View style={styles.playlistItemIcon}>
                                <Ionicons
                                  color={theme.accentText}
                                  name={isAlreadyAdded ? 'checkmark' : 'musical-notes'}
                                  size={18}
                                />
                              </View>
                              <View style={styles.trackMeta}>
                                <Text style={styles.trackName} numberOfLines={1}>
                                  {playlist.name}
                                </Text>
                                <Text style={styles.trackSubtext}>
                                  {playlist.trackCount} tracks
                                </Text>
                              </View>
                              <Text style={styles.sectionAction}>
                                {isAlreadyAdded ? 'Added' : 'Add'}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.caption}>
                        Create a playlist to save this track.
                      </Text>
                    )}

                    <View style={styles.createPlaylistRow}>
                      <TextInput
                        onChangeText={setNewPlaylistName}
                        placeholder="New playlist"
                        placeholderTextColor={theme.muted}
                        style={[styles.input, styles.playlistInput]}
                        value={newPlaylistName}
                      />
                      <Pressable
                        onPress={createPlaylistAndAddCurrentTrack}
                        style={styles.addButton}
                      >
                        <LinearGradient
                          colors={[theme.accent, theme.secondary]}
                          end={{ x: 1, y: 1 }}
                          start={{ x: 0, y: 0 }}
                          style={StyleSheet.absoluteFill}
                        />
                        <Ionicons color={theme.accentText} name="add" size={22} />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            </SafeAreaView>
          </Modal>

          <Modal
            animationType="fade"
            onRequestClose={() => setIsDeleteAccountConfirming(false)}
            transparent
            visible={isDeleteAccountConfirming}
          >
            <Pressable
              onPress={() => setIsDeleteAccountConfirming(false)}
              style={styles.confirmationBackdrop}
            >
              <Pressable
                onPress={(event) => event.stopPropagation()}
                style={styles.confirmationDialog}
              >
                <View style={styles.confirmationHeader}>
                  <Ionicons
                    color={theme.danger}
                    name="warning"
                    size={32}
                  />
                  <Text style={styles.confirmationTitle}>Delete Account?</Text>
                </View>
                <Text style={styles.confirmationMessage}>
                  This will permanently delete your account and all associated data including playlists, liked songs, and listening history. This action cannot be undone.
                </Text>
                <View style={styles.confirmationActions}>
                  <Pressable
                    onPress={() => setIsDeleteAccountConfirming(false)}
                    style={[styles.confirmationButton, styles.confirmationCancelButton]}
                  >
                    <Text style={styles.confirmationCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    disabled={isSubmitting}
                    onPress={handleDeleteAccount}
                    style={[styles.confirmationButton, styles.confirmationDeleteButton]}
                  >
                    <Text style={styles.confirmationDeleteText}>
                      {isSubmitting ? 'Deleting...' : 'Delete'}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          <View style={styles.nowBar}>
            <Pressable
              onPress={() => setIsTrackDetailOpen(true)}
              style={styles.nowTrack}
            >
              <TrackArt track={selectedTrack} size="small" />
              <View style={styles.trackMeta}>
                <Text style={styles.nowTitle} numberOfLines={1}>
                  {selectedTrack.title}
                </Text>
                <Text style={styles.trackSubtext} numberOfLines={1}>
                  {selectedTrack.artist}
                </Text>
              </View>
            </Pressable>

            <View style={styles.transportRow}>
              <IconButton
                icon="shuffle"
                label="Shuffle"
                colors={iconButtonColors}
                onPress={() => setIsShuffle((current) => !current)}
                variant={isShuffle ? 'solid' : 'ghost'}
              />
              <IconButton
                icon="play-skip-back"
                label="Previous track"
                colors={iconButtonColors}
                onPress={selectPreviousTrack}
              />
              <IconButton
                icon={isPlaying ? 'pause' : 'play'}
                label={isPlaying ? 'Pause' : 'Play'}
                colors={iconButtonColors}
                onPress={togglePlayback}
                variant="solid"
              />
              <IconButton
                icon="play-skip-forward"
                label="Next track"
                colors={iconButtonColors}
                onPress={selectNextTrack}
              />
              <IconButton
                icon="repeat"
                label="Repeat one"
                colors={iconButtonColors}
                onPress={toggleRepeatMode}
                variant={repeatMode === 'one' ? 'solid' : 'ghost'}
              />
            </View>

            <View style={styles.progressMeta}>
              <Text style={styles.progressText}>
                {formatMillis(soundPosition)}
              </Text>
              <Pressable
                accessibilityLabel="Seek track"
                onLayout={(event) =>
                  setProgressTrackWidth(event.nativeEvent.layout.width)
                }
                onPress={(event) =>
                  void seekToRatio(
                    event.nativeEvent.locationX / progressTrackWidth,
                  )
                }
                style={styles.progressTrack}
              >
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress}%` as `${number}%` },
                  ]}
                />
              </Pressable>
              <Text style={styles.progressText}>{selectedRuntimeLabel}</Text>
            </View>

          </View>
        </View>
      </SafeAreaView>
    );
  }

  const authTitle =
    view === 'login'
      ? 'Sign in to Sonik'
      : view === 'register-otp'
        ? 'Create your account'
        : 'Reset your password';

  const authCopy =
    view === 'login'
      ? 'Your library, playlists, and playback stay in sync.'
      : view === 'register-otp'
        ? 'Verify your email with a one-time code, then choose a password.'
        : 'We will send a code to your email if the account exists.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.accessContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.appHeader}>
          <View style={styles.brandRow}>
            <LinearGradient
              colors={[theme.accent, theme.secondary]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.brandMark}
            >
              <Text style={styles.brandMarkText}>S</Text>
            </LinearGradient>
            <Text style={styles.brandName}>Sonik</Text>
          </View>
          <Pressable
            accessibilityLabel={`Switch to ${
              themeMode === 'dark' ? 'light' : 'dark'
            } mode`}
            style={styles.themeButton}
            onPress={toggleThemeMode}
          >
            <Ionicons
              color={theme.text}
              name={themeMode === 'dark' ? 'sunny' : 'moon'}
              size={18}
            />
            <Text style={styles.themeButtonLabel}>
              {themeMode === 'dark' ? 'Light' : 'Dark'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.previewDeck}>
          <TrackArt track={selectedTrack} size="large" />
          <Text style={styles.previewTitle}>
            Music that keeps moving with you.
          </Text>
          <Text style={styles.previewCopy}>
            Browse, collect, and play your favorite tracks from one account.
          </Text>
        </View>

        <View style={styles.authCard}>
          <View style={styles.tabRow}>
            {[
              ['login', 'Sign in'],
              ['register-otp', 'Create'],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => {
                  clearFeedback();
                  if (value === 'register-otp') {
                    setRegisterForm({
                      profileName: '',
                      email: '',
                      password: '',
                      confirmPassword: '',
                    });
                    setOtpForm({ email: '', otp: '' });
                    setOtpStep('email');
                  }
                  setView(value as AuthView);
                }}
                style={[
                  styles.tabButton,
                  view === value ? styles.tabButtonActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    view === value ? styles.tabLabelActive : null,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.cardTitle}>{authTitle}</Text>
          <Text style={styles.caption}>{authCopy}</Text>

          {errorMessage ? (
            <View style={[styles.feedback, styles.feedbackError]}>
              <Text style={styles.feedbackText}>{errorMessage}</Text>
            </View>
          ) : null}
          {noticeMessage ? (
            <View style={[styles.feedback, styles.feedbackNotice]}>
              <Text style={styles.feedbackText}>{noticeMessage}</Text>
            </View>
          ) : null}

          {view === 'login' ? (
            <>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={(email) =>
                  setLoginForm((current) => ({ ...current, email }))
                }
                placeholder="listener@sonik.app"
                placeholderTextColor={theme.muted}
                style={styles.input}
                value={loginForm.email}
              />
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={(password) =>
                  setLoginForm((current) => ({ ...current, password }))
                }
                placeholder="Password"
                placeholderTextColor={theme.muted}
                secureTextEntry
                style={styles.input}
                value={loginForm.password}
              />
              <Pressable
                disabled={isSubmitting}
                onPress={handleLogin}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isSubmitting ? 'Signing in' : 'Sign in'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  clearFeedback();
                  setOtpForm({ email: loginForm.email, otp: '' });
                  setOtpStep('email');
                  setResetForm({ newPassword: '' });
                  setView('forgot-otp');
                }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>Forgot password?</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  clearFeedback();
                  setRegisterForm({
                    profileName: '',
                    email: '',
                    password: '',
                    confirmPassword: '',
                  });
                  setOtpForm({ email: '', otp: '' });
                  setOtpStep('email');
                  setView('register-otp');
                }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>
                  Don&apos;t have an account? Create one
                </Text>
              </Pressable>
            </>
          ) : null}

          {view === 'register-otp' ? (
            <>
              <Text style={styles.otpTitle}>Create Your Account</Text>
              {otpStep === 'email' ? (
                <>
                  <TextInput
                    onChangeText={(profileName) =>
                      setRegisterForm((current) => ({
                        ...current,
                        profileName,
                      }))
                    }
                    placeholder="Profile name"
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                    value={registerForm.profileName}
                  />
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onChangeText={(email) => setOtpForm((current) => ({ ...current, email }))}
                    placeholder="Email address"
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                    value={otpForm.email}
                  />
                  {emailStatus === 'checking' && (
                    <Text style={{ color: theme.muted, marginTop: 4, fontSize: 13, alignSelf: 'flex-start', paddingLeft: 16 }}>Checking availability…</Text>
                  )}
                  {emailStatus === 'taken' && (
                    <Text style={{ color: theme.danger, marginTop: 4, fontSize: 13, alignSelf: 'flex-start', paddingLeft: 16 }}>This email is already registered. Please sign in instead.</Text>
                  )}
                  {emailStatus === 'available' && (
                    <Text style={{ color: theme.secondary, marginTop: 4, fontSize: 13, alignSelf: 'flex-start', paddingLeft: 16 }}>✓ Email is available</Text>
                  )}
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={(password) =>
                      setRegisterForm((current) => ({
                        ...current,
                        password,
                      }))
                    }
                    placeholder="Create password"
                    placeholderTextColor={theme.muted}
                    secureTextEntry
                    style={styles.input}
                    value={registerForm.password}
                  />
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={(confirmPassword) =>
                      setRegisterForm((current) => ({
                        ...current,
                        confirmPassword,
                      }))
                    }
                    placeholder="Confirm password"
                    placeholderTextColor={theme.muted}
                    secureTextEntry
                    style={styles.input}
                    value={registerForm.confirmPassword}
                  />
                  <Pressable
                    disabled={
                      isSubmitting ||
                      !registerForm.profileName ||
                      !otpForm.email ||
                      !registerForm.password ||
                      !registerForm.confirmPassword ||
                      registerForm.password !== registerForm.confirmPassword ||
                      emailStatus === 'checking' ||
                      emailStatus === 'taken'
                    }
                    onPress={() => {
                      void handleSendOtp('signup');
                    }}
                    style={[
                      styles.primaryButton,
                      (isSubmitting ||
                        !registerForm.profileName ||
                        !otpForm.email ||
                        !registerForm.password ||
                        !registerForm.confirmPassword ||
                        registerForm.password !== registerForm.confirmPassword ||
                        emailStatus === 'checking' ||
                        emailStatus === 'taken') &&
                        styles.disabledButton,
                    ]}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isSubmitting ? 'Sending code' : 'Send verification code'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.otpSubtitle}>
                    Enter the verification code sent to {otpForm.email}
                  </Text>
                  <OtpInput
                    autoFocus
                    disabled={isSubmitting}
                    onChange={(otp) =>
                      setOtpForm((current) => ({ ...current, otp }))
                    }
                    value={otpForm.otp}
                    cellColors={{
                      background: theme.field,
                      border: theme.border,
                      borderActive: theme.text,
                      text: theme.text,
                      placeholder: theme.muted,
                    }}
                  />
                  <Pressable
                    disabled={isSubmitting || otpForm.otp.length !== 6}
                    onPress={handleVerifyOtpForSignup}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isSubmitting ? 'Creating account' : 'Verify & create'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={isSubmitting}
                    onPress={() => {
                      void handleSendOtp('signup');
                    }}
                    style={styles.textButton}
                  >
                    <Text style={styles.textButtonLabel}>Resend code</Text>
                  </Pressable>
                </>
              )}
              <Pressable
                onPress={() => {
                  clearFeedback();
                  setView('login');
                }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>Back to sign in</Text>
              </Pressable>
            </>
          ) : null}

          {view === 'forgot-otp' ? (
            <>
              <Text style={styles.otpTitle}>Reset Password</Text>
              {otpStep === 'email' ? (
                <>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={otpForm.email}
                    placeholder="Email address"
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                    editable={false}
                  />
                  <Pressable
                    disabled={isSubmitting}
                    onPress={() => {
                      void handleSendOtp('reset');
                    }}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isSubmitting ? 'Sending code' : 'Send reset code'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.otpSubtitle}>
                    Enter the verification code sent to {otpForm.email}
                  </Text>
                  <OtpInput
                    autoFocus
                    disabled={isSubmitting}
                    onChange={(otp) =>
                      setOtpForm((current) => ({ ...current, otp }))
                    }
                    value={otpForm.otp}
                    cellColors={{
                      background: theme.field,
                      border: theme.border,
                      borderActive: theme.text,
                      text: theme.text,
                      placeholder: theme.muted,
                    }}
                  />
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={(newPassword) =>
                      setResetForm((current) => ({
                        ...current,
                        newPassword,
                      }))
                    }
                    placeholder="New password"
                    placeholderTextColor={theme.muted}
                    secureTextEntry
                    style={styles.input}
                    value={resetForm.newPassword}
                  />
                  <Pressable
                    disabled={
                      isSubmitting || otpForm.otp.length !== 6 || !resetForm.newPassword
                    }
                    onPress={handleVerifyOtpForPasswordReset}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isSubmitting ? 'Updating password' : 'Verify & reset'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={isSubmitting}
                    onPress={() => {
                      void handleSendOtp('reset');
                    }}
                    style={styles.textButton}
                  >
                    <Text style={styles.textButtonLabel}>Resend code</Text>
                  </Pressable>
                </>
              )}
              <Pressable
                onPress={() => {
                  clearFeedback();
                  setView('login');
                }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>Back to sign in</Text>
              </Pressable>
            </>
          ) : null}

          {view === 'login' && googleEnabled ? (
            <Pressable
              disabled={isSubmitting || !googleRequest}
              onPress={openGoogleFlow}
              style={styles.googleButton}
            >
              <Ionicons color={theme.text} name="logo-google" size={18} />
              <Text style={styles.googleButtonLabel}>Continue with Google</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  accessContent: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
  },
  playerScreen: {
    flex: 1,
  },
  playerContent: {
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingTop: isSmallScreen ? 8 : 12,
    paddingBottom: isSmallScreen ? 200 : 210,
    gap: isSmallScreen ? 12 : 16,
  },
  appHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  brandMark: {
    alignItems: 'center',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 40,
  },
  brandMarkText: {
    color: theme.accentText,
    fontSize: 18,
    fontWeight: '900',
  },
  brandName: {
    color: theme.text,
    fontSize: isSmallScreen ? 18 : isMediumScreen ? 20 : 22,
    fontWeight: '900',
  },
  headerPill: {
    borderColor: theme.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    color: theme.mutedStrong,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  themeButton: {
    alignItems: 'center',
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  themeButtonLabel: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '900',
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  searchPill: {
    alignItems: 'center',
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  searchInput: {
    color: theme.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 48,
    paddingVertical: 0,
  },
  panelTabs: {
    backgroundColor: theme.surfaceSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  panelTab: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  panelTabActive: {
    backgroundColor: theme.secondary,
  },
  panelTabLabel: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  panelTabLabelActive: {
    color: theme.accentText,
  },
  sourceScroller: {
    gap: 8,
    paddingRight: 16,
  },
  sourceChip: {
    alignItems: 'center',
    borderColor: theme.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 13,
  },
  sourceChipActive: {
    backgroundColor: theme.text,
    borderColor: theme.text,
  },
  sourceChipLabel: {
    color: theme.mutedStrong,
    fontSize: 13,
    fontWeight: '900',
  },
  sourceChipLabelActive: {
    color: theme.background,
  },
  sourceChipCount: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  sourceChipCountActive: {
    color: '#4b3f36',
  },
  previewDeck: {
    alignItems: 'flex-start',
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  previewTitle: {
    color: theme.text,
    fontSize: 35,
    fontWeight: '900',
    lineHeight: 38,
  },
  previewCopy: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  authCard: {
    backgroundColor: theme.surfaceStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  tabRow: {
    backgroundColor: theme.surfaceSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: isSmallScreen ? 38 : 42,
  },
  tabButtonActive: {
    backgroundColor: theme.text,
  },
  tabLabel: {
    color: theme.muted,
    fontSize: isSmallScreen ? 11 : 13,
    fontWeight: '900',
  },
  tabLabelActive: {
    color: theme.background,
  },
  eyebrow: {
    color: theme.secondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: theme.text,
    fontSize: 25,
    fontWeight: '900',
  },
  caption: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: theme.field,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.text,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonLabel: {
    color: theme.accentText,
    fontSize: 15,
    fontWeight: '900',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 52,
  },
  googleButtonLabel: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '800',
  },
  textButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  textButtonLabel: {
    color: theme.mutedStrong,
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  feedback: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackError: {
    backgroundColor: 'rgba(255,111,125,0.12)',
    borderColor: 'rgba(255,111,125,0.24)',
  },
  feedbackNotice: {
    backgroundColor: 'rgba(85,214,194,0.1)',
    borderColor: 'rgba(85,214,194,0.24)',
  },
  feedbackText: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
  },
  signalDeck: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: isSmallScreen ? 12 : 16,
    alignItems: 'center',
  },
  deckCopy: {
    gap: 8,
    width: '100%',
    alignItems: 'center',
  },
  trackTitle: {
    color: theme.text,
    fontSize: isSmallScreen ? 26 : isMediumScreen ? 30 : 34,
    fontWeight: '900',
    lineHeight: isSmallScreen ? 30 : isMediumScreen ? 34 : 38,
    textAlign: 'center',
  },
  trackArtist: {
    color: theme.muted,
    fontSize: isSmallScreen ? 13 : 15,
    lineHeight: isSmallScreen ? 18 : 22,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    borderColor: theme.border,
    borderRadius: 999,
    borderWidth: 1,
    color: theme.mutedStrong,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 6,
  },
  heroPlayButton: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    overflow: 'hidden',
    paddingHorizontal: 17,
  },
  heroPlayLabel: {
    color: theme.accentText,
    fontSize: 13,
    fontWeight: '900',
  },
  heroSubtleButton: {
    alignItems: 'center',
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  heroSubtleButtonActive: {
    backgroundColor: 'rgba(255,122,89,0.13)',
    borderColor: 'rgba(255,122,89,0.28)',
  },
  heroSubtleButtonDisabled: {
    opacity: 0.45,
  },
  heroSubtleLabel: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '900',
  },
  waveCard: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(85,214,194,0.08)',
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    height: 108,
    padding: 14,
  },
  waveBar: {
    backgroundColor: theme.secondary,
    borderRadius: 999,
    flex: 1,
    minHeight: 20,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: theme.text,
    fontSize: isSmallScreen ? 17 : isMediumScreen ? 19 : 21,
    fontWeight: '900',
  },
  sectionAction: {
    color: theme.mutedStrong,
    fontSize: isSmallScreen ? 11 : 13,
    fontWeight: '800',
  },
  mixScroller: {
    gap: 10,
    paddingRight: 16,
  },
  mixCard: {
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
    width: 164,
  },
  mixTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '900',
  },
  mixDetail: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  trackList: {
    gap: 8,
  },
  trackRow: {
    alignItems: 'center',
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.surfaceSoft,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: isSmallScreen ? 8 : 10,
    minHeight: isSmallScreen ? 56 : 64,
    paddingHorizontal: isSmallScreen ? 8 : 10,
  },
  trackRowActive: {
    backgroundColor: 'rgba(85,214,194,0.12)',
    borderColor: 'rgba(85,214,194,0.26)',
  },
  trackNumber: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '900',
    width: 24,
  },
  trackNumberActive: {
    color: theme.secondary,
  },
  trackMeta: {
    flex: 1,
    minWidth: 0,
  },
  trackName: {
    color: theme.text,
    fontSize: isSmallScreen ? 13 : 15,
    fontWeight: '900',
  },
  trackSubtext: {
    color: theme.muted,
    fontSize: isSmallScreen ? 11 : 12,
    marginTop: 2,
  },
  trackDuration: {
    color: theme.muted,
    fontSize: isSmallScreen ? 11 : 12,
    fontWeight: '800',
  },
  rowIconButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  queueCard: {
    backgroundColor: 'rgba(245,193,93,0.08)',
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  queueItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
  },
  emptyCard: {
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '900',
  },
  playlistGrid: {
    gap: 10,
  },
  playlistCard: {
    backgroundColor: 'rgba(245,193,93,0.08)',
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  playlistTitle: {
    color: theme.text,
    fontSize: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    fontWeight: '900',
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  profileAvatar: {
    alignItems: 'center',
    backgroundColor: theme.secondary,
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  profileAvatarText: {
    color: theme.accentText,
    fontSize: 24,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: theme.text,
    fontSize: isSmallScreen ? 18 : isMediumScreen ? 20 : 22,
    fontWeight: '900',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: theme.secondary,
  },
  roleBadgeText: {
    color: theme.accentText,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  statValue: {
    color: theme.text,
    fontSize: 23,
    fontWeight: '900',
  },
  statLabel: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  managementCard: {
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  secondaryAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  secondaryActionLabel: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '900',
  },
  createPlaylistRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  playlistInput: {
    flex: 1,
  },
  addButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },
  playlistScroller: {
    gap: 8,
    paddingRight: 12,
  },
  playlistChip: {
    borderColor: theme.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  playlistChipActive: {
    backgroundColor: theme.text,
  },
  playlistChipText: {
    color: theme.mutedStrong,
    fontSize: 13,
    fontWeight: '900',
  },
  playlistChipTextActive: {
    color: theme.background,
  },
  playlistTrackRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  playlistTrackPressable: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,111,125,0.1)',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  deletePlaylistButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  deletePlaylistText: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  deleteAccountButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
    alignSelf: 'auto',
  },
  deleteAccountText: {
    textDecorationLine: 'none',
    fontWeight: '600',
  },
  adminButton: {
    alignSelf: 'center',
    borderRadius: 999,
    marginTop: 8,
    overflow: 'hidden',
  },
  adminButtonPressed: {
    opacity: 0.85,
  },
  adminButtonGradient: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  adminButtonText: {
    color: theme.accentText,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  adminContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  adminBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingRight: 8,
  },
  adminBackText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
  },
  adminTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '900',
  },
  adminCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  adminCardTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '800',
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderColor: theme.border,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: theme.field,
  },
  filePickerText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  adminGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  adminGridCard: {
    width: '47%',
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  adminGridTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '800',
  },
  adminGridSub: {
    color: theme.muted,
    fontSize: 12,
  },
  adminGridRemove: {
    marginTop: 4,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  adminGridRemoveText: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  otpTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  otpSubtitle: {
    color: theme.muted,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: 'bold',
  },
  confirmationBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  confirmationDialog: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.surfaceStrong,
    borderColor: theme.borderStrong,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  confirmationHeader: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  confirmationTitle: {
    color: theme.danger,
    fontSize: 18,
    fontWeight: '700',
  },
  confirmationMessage: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  confirmationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationCancelButton: {
    backgroundColor: theme.surfaceSoft,
  },
  confirmationCancelText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmationDeleteButton: {
    backgroundColor: theme.dangerSoft,
  },
  confirmationDeleteText: {
    color: theme.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  sheetBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: theme.surfaceStrong,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '82%',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 18,
  },
  sheetDragHandle: {
    alignSelf: 'center',
    backgroundColor: theme.borderStrong,
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
    width: 36,
  },
  actionSheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  sheetDivider: {
    backgroundColor: theme.border,
    height: 1,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  actionSheetList: {
    gap: 0,
  },
  actionSheetOption: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    gap: 18,
    minHeight: 52,
    paddingHorizontal: 20,
  },
  actionSheetOptionDisabled: {
    opacity: 0.4,
  },
  actionSheetOptionText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  detailScreen: {
    backgroundColor: theme.background,
    flex: 1,
    paddingHorizontal: isSmallScreen ? 18 : 24,
    paddingVertical: 16,
  },
  detailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  detailHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  detailHeaderButton: {
    alignItems: 'center',
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  detailHeaderCopy: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
  },
  detailEyebrow: {
    color: theme.secondary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  detailSource: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  detailBody: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  detailTrackCopy: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  detailTitle: {
    color: theme.text,
    fontSize: isSmallScreen ? 27 : 32,
    fontWeight: '900',
    lineHeight: isSmallScreen ? 32 : 37,
    textAlign: 'center',
  },
  detailArtist: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  detailFooter: {
    gap: 14,
    paddingBottom: 12,
  },
  detailTransportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: isSmallScreen ? 13 : 17,
    justifyContent: 'center',
  },
  detailPlayButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: isSmallScreen ? 68 : 76,
    justifyContent: 'center',
    overflow: 'hidden',
    width: isSmallScreen ? 68 : 76,
  },
  detailSecondaryAction: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  detailSecondaryActionActive: {
    backgroundColor: 'rgba(85,214,194,0.13)',
    borderColor: 'rgba(85,214,194,0.28)',
  },
  playlistPickerPanel: {
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  detailPlaylistList: {
    gap: 8,
    maxHeight: 180,
  },
  detailPlaylistItem: {
    alignItems: 'center',
    backgroundColor: theme.field,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 10,
  },
  detailPlaylistItemActive: {
    borderColor: 'rgba(85,214,194,0.34)',
  },
  playlistItemIcon: {
    alignItems: 'center',
    backgroundColor: theme.accent,
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  nowBar: {
    backgroundColor: theme.surfaceStrong,
    borderColor: theme.border,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    bottom: 0,
    gap: isSmallScreen ? 8 : 10,
    left: 0,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingTop: isSmallScreen ? 8 : 12,
    paddingBottom: isSmallScreen ? 12 : 16,
    position: 'absolute',
    right: 0,
  },
  nowTrack: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: isSmallScreen ? 8 : 10,
  },
  nowTitle: {
    color: theme.text,
    fontSize: isSmallScreen ? 13 : 15,
    fontWeight: '900',
  },
  transportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: isSmallScreen ? 14 : 18,
    justifyContent: 'center',
  },
  progressMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  progressText: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: '800',
    width: 34,
  },
  progressTrack: {
    backgroundColor: theme.border,
    borderRadius: 999,
    flex: 1,
    height: 5,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: theme.secondary,
    borderRadius: 999,
    height: '100%',
  },
  bootCard: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  bootText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '800',
  },
});
