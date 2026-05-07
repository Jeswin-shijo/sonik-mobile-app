import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import { BlurView } from 'expo-blur';
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
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFriendlyError, requestJson } from './src/api/client';
import { IconButton } from './src/components/IconButton';
import { LibraryCollectionCard } from './src/components/LibraryCollectionCard';
import { OtpInput } from './src/components/OtpInput';
import { TrackArt } from './src/components/TrackArt';
import { languageOptions } from './src/constants/languages';
import { bottomTabs } from './src/constants/navigation';
import {
  apiBaseUrl,
  googleAndroidClientId,
  googleIosClientId,
  googleWebClientId,
  sessionStorageKey,
} from './src/config';
import { fallbackTracks, waveformHeights } from './src/data/tracks';
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
  Singer,
  Lyricist,
} from './src/types';
import { buildAlbumsFromTracks, buildArtistsFromTracks } from './src/utils/library';
import { getTranslation } from './src/utils/translations';
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

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

// Responsive design utilities
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const isSmallScreen = screenWidth < 380;
const isMediumScreen = screenWidth >= 380 && screenWidth < 480;
const collapsedPlayerTop = screenHeight - (isSmallScreen ? 138 : 146);
const detailBackgroundFadeHeight = isSmallScreen ? 132 : 160;
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
  const [singers, setSingers] = useState<Singer[]>([]);
  const [lyricists, setLyricists] = useState<Lyricist[]>([]);
  const [albums, setAlbums] = useState<Album[]>(
    buildAlbumsFromTracks(fallbackTracks),
  );
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
  const [likedPulseTrackId, setLikedPulseTrackId] = useState('');
  const tabSwitchAnim = useRef(new Animated.Value(0)).current;
  const contentSwitchAnim = useRef(new Animated.Value(1)).current;
  const likeScaleAnim = useRef(new Animated.Value(1)).current;
  const miniPlayerDragY = useRef(new Animated.Value(0)).current;
  const playerSheetY = useRef(new Animated.Value(collapsedPlayerTop)).current;
  const playerSheetOpacity = useRef(new Animated.Value(0)).current;
  const detailTrackSwipeX = useRef(new Animated.Value(0)).current;
  const detailTrackSwipeOpacity = useRef(new Animated.Value(1)).current;
  const miniPlayerTopYRef = useRef(collapsedPlayerTop);
  const miniPlayerRef = useRef<View>(null);
  const detailTouchStartX = useRef(0);
  const detailTouchStartY = useRef(0);
  const isDetailTouchDragging = useRef(false);
  const isDetailTrackSwiping = useRef(false);
  const [profileForm, setProfileForm] = useState({
    profileName: '',
    birthday: '',
    language: 'en',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  });

  const miniPlayerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy < -12 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2,
      onPanResponderGrant: () => {
        playerSheetOpacity.stopAnimation();
        playerSheetOpacity.setValue(0.18);
        measureMiniPlayerTop((topY) => {
          playerSheetY.setValue(topY);
        });
        playerSheetY.setValue(miniPlayerTopYRef.current);
        setIsTrackDetailOpen(true);
      },
      onPanResponderMove: (_, gestureState) => {
        const nextSheetY = Math.max(0, miniPlayerTopYRef.current + gestureState.dy);
        playerSheetY.setValue(nextSheetY);
        setDragOpenOpacity(nextSheetY);
        miniPlayerDragY.setValue(Math.max(-36, Math.min(0, gestureState.dy / 6)));
      },
      onPanResponderRelease: (_, gestureState) => {
        const releasedSheetY = Math.max(0, miniPlayerTopYRef.current + gestureState.dy);

        if (releasedSheetY < miniPlayerTopYRef.current * 0.64 || gestureState.vy < -0.55) {
          openPlayerSheet(releasedSheetY, false);
          return;
        }

        Animated.parallel([
          Animated.timing(playerSheetY, {
            toValue: miniPlayerTopYRef.current,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(playerSheetOpacity, {
            toValue: 0,
            duration: 140,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(miniPlayerDragY, {
            toValue: 0,
            friction: 7,
            tension: 120,
            useNativeDriver: true,
          }),
        ]).start(() => setIsTrackDetailOpen(false));
      },
    }),
  ).current;

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
  const playerBackdropOpacity = playerSheetY.interpolate({
    inputRange: [0, collapsedPlayerTop],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const detailInitialFadeOpacity = playerSheetY.interpolate({
    inputRange: [0, collapsedPlayerTop * 0.32],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const detailTopSolidOpacity = playerSheetY.interpolate({
    inputRange: [0, collapsedPlayerTop * 0.32],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const t = (key: string) => getTranslation(session?.user?.language, key);

  const currentTracks = useMemo(() => {
    if (selectedPlaylistId.startsWith('artist:')) {
      const artist = artists.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(7),
      );

      return artist?.tracks.length ? artist.tracks : libraryTracks;
    }

    if (selectedPlaylistId.startsWith('singer:')) {
      const singer = singers.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(7),
      );

      return singer?.tracks.length ? singer.tracks : libraryTracks;
    }

    if (selectedPlaylistId.startsWith('lyricist:')) {
      const lyricist = lyricists.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(9),
      );

      return lyricist?.tracks.length ? lyricist.tracks : libraryTracks;
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

    if (selectedPlaylistId.startsWith('singer:')) {
      const singer = singers.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(7),
      );

      return singer ? `Singer: ${singer.name}` : 'Singer';
    }

    if (selectedPlaylistId.startsWith('lyricist:')) {
      const lyricist = lyricists.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(9),
      );

      return lyricist ? `Lyricist: ${lyricist.name}` : 'Lyricist';
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
    : currentTracks.filter((track) => track.id !== selectedTrack.id);
  const activeTabIndex = bottomTabs.findIndex((tab) => tab.id === activePanel);
  const bottomTabWidth = (screenWidth - 16) / bottomTabs.length;
  const tabIndicatorTranslateX = tabSwitchAnim.interpolate({
    inputRange: bottomTabs.map((_, index) => index),
    outputRange: bottomTabs.map((_, index) => index * bottomTabWidth),
  });
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
      requestJson<{ singers: Singer[] }>('/people/singers').catch(() => null),
      requestJson<{ lyricists: Lyricist[] }>('/people/lyricists').catch(() => null),
      requestJson<AlbumsResponse>('/tracks/albums').catch(() => null),
    ])
      .then(([tracksPayload, artistsPayload, singersPayload, lyricistsPayload, albumsPayload]) => {
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
        if (singersPayload?.singers) {
          setSingers(singersPayload.singers);
        }
        if (lyricistsPayload?.lyricists) {
          setLyricists(lyricistsPayload.lyricists);
        }
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
        
        setProfileForm({
          profileName: payload.user.profileName,
          birthday: payload.user.birthday || '',
          language: payload.user.language || 'en',
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
    if (!currentTracks.length) {
      return;
    }

    if (!currentTracks.some((track) => track.id === selectedTrackId)) {
      setSelectedTrackId(currentTracks[0].id);
      setIsPlaying(false);
    }
  }, [currentTracks, selectedTrackId]);

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
    contentSwitchAnim.setValue(0);
    Animated.timing(tabSwitchAnim, {
      toValue: Math.max(activeTabIndex, 0),
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.timing(contentSwitchAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTabIndex, contentSwitchAnim, tabSwitchAnim]);

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

    const tracksNeedingRuntime = currentTracks
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
  }, [currentTracks, durationByTrackId, session]);

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
    selectTrack(trackId);
    // setIsTrackDetailOpen(true);
  }

  function getFallbackMiniPlayerTop() {
    return collapsedPlayerTop;
  }

  function measureMiniPlayerTop(callback?: (topY: number) => void) {
    const fallbackTopY = miniPlayerTopYRef.current || getFallbackMiniPlayerTop();
    const miniPlayerNode = miniPlayerRef.current;

    if (!miniPlayerNode?.measureInWindow) {
      callback?.(fallbackTopY);
      return fallbackTopY;
    }

    miniPlayerNode.measureInWindow((_x, y, _width, height) => {
      const measuredTopY =
        Number.isFinite(y) && y > 0
          ? y
          : screenHeight - Math.max(height || 0, isSmallScreen ? 64 : 72) - (isSmallScreen ? 70 : 74);

      miniPlayerTopYRef.current = measuredTopY;

      if (!isTrackDetailOpen) {
        playerSheetY.setValue(measuredTopY);
      }

      callback?.(measuredTopY);
    });

    return fallbackTopY;
  }

  function setDragOpenOpacity(sheetY: number) {
    const progress = 1 - sheetY / Math.max(miniPlayerTopYRef.current, 1);
    playerSheetOpacity.setValue(Math.max(0.18, Math.min(1, progress * 1.35)));
  }

  function openPlayerSheetFromMiniPlayer() {
    measureMiniPlayerTop((topY) => {
      openPlayerSheet(topY);
    });
  }

  function openPlayerSheet(startY = miniPlayerTopYRef.current, fadeIn = true) {
    playerSheetY.stopAnimation();
    playerSheetOpacity.stopAnimation();
    playerSheetY.setValue(startY);
    playerSheetOpacity.setValue(fadeIn ? 0 : 1);
    setIsTrackDetailOpen(true);

    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(playerSheetY, {
          toValue: 0,
          duration: fadeIn ? 260 : 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(playerSheetOpacity, {
          toValue: 1,
          duration: fadeIn ? 180 : 90,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(miniPlayerDragY, {
          toValue: 0,
          friction: 7,
          tension: 120,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }

  function closeTrackDetail() {
    setIsPlaylistPickerOpen(false);
    playerSheetY.stopAnimation();
    playerSheetOpacity.stopAnimation();
    Animated.parallel([
      Animated.timing(playerSheetY, {
        toValue: miniPlayerTopYRef.current,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(playerSheetOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      playerSheetY.setValue(miniPlayerTopYRef.current);
      playerSheetOpacity.setValue(0);
      setIsTrackDetailOpen(false);
    });
  }

  function handleMiniPlayerLayout(event: LayoutChangeEvent) {
    miniPlayerTopYRef.current = event.nativeEvent.layout.y;

    if (!isTrackDetailOpen) {
      playerSheetY.setValue(miniPlayerTopYRef.current);
    }
  }

  function getPrimaryTouch(event: GestureResponderEvent) {
    return event.nativeEvent.touches[0] ?? event.nativeEvent.changedTouches[0] ?? null;
  }

  function settleTrackDetailSheet() {
    Animated.parallel([
      Animated.spring(playerSheetY, {
        toValue: 0,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(playerSheetOpacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }

  function handleDetailTouchStart(event: GestureResponderEvent) {
    const touch = getPrimaryTouch(event);

    if (!touch) {
      return;
    }

    detailTouchStartX.current = touch.pageX;
    detailTouchStartY.current = touch.pageY;
    isDetailTouchDragging.current = false;
    isDetailTrackSwiping.current = false;
  }

  function handleDetailTouchMove(event: GestureResponderEvent) {
    const touch = getPrimaryTouch(event);

    if (!touch) {
      return;
    }

    const dx = touch.pageX - detailTouchStartX.current;
    const dy = touch.pageY - detailTouchStartY.current;

    if (dy <= 6 || Math.abs(dy) <= Math.abs(dx)) {
      if (
        currentTracks.length > 1 &&
        Math.abs(dx) > 10 &&
        Math.abs(dx) > Math.abs(dy) * 1.25
      ) {
        isDetailTrackSwiping.current = true;
        detailTrackSwipeX.setValue(Math.max(-42, Math.min(42, dx * 0.18)));
      }

      return;
    }

    isDetailTouchDragging.current = true;
    playerSheetY.setValue(Math.max(0, dy));
  }

  function handleDetailTouchEnd(event: GestureResponderEvent) {
    const touch = event.nativeEvent.changedTouches[0];
    const dx = touch ? touch.pageX - detailTouchStartX.current : 0;
    const dy = touch ? touch.pageY - detailTouchStartY.current : 0;

    if (isDetailTrackSwiping.current) {
      isDetailTrackSwiping.current = false;

      if (
        currentTracks.length > 1 &&
        Math.abs(dx) > screenWidth * 0.16 &&
        Math.abs(dx) > Math.abs(dy) * 1.35
      ) {
        swipeDetailTrack(dx < 0 ? 'next' : 'previous');
        return;
      }

      resetDetailTrackSwipe();
      return;
    }

    if (!isDetailTouchDragging.current) {
      return;
    }

    isDetailTouchDragging.current = false;

    if (dy > screenHeight * 0.08) {
      closeTrackDetail();
      return;
    }

    settleTrackDetailSheet();
  }

  function handleDetailTouchCancel() {
    if (isDetailTrackSwiping.current) {
      isDetailTrackSwiping.current = false;
      resetDetailTrackSwipe();
      return;
    }

    if (!isDetailTouchDragging.current) {
      return;
    }

    isDetailTouchDragging.current = false;
    settleTrackDetailSheet();
  }

  function resetDetailTrackSwipe() {
    Animated.parallel([
      Animated.spring(detailTrackSwipeX, {
        toValue: 0,
        friction: 8,
        tension: 130,
        useNativeDriver: true,
      }),
      Animated.timing(detailTrackSwipeOpacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }

  function swipeDetailTrack(direction: 'next' | 'previous') {
    const playbackTracks = currentTracks;

    if (playbackTracks.length <= 1) {
      resetDetailTrackSwipe();
      return;
    }

    const currentIndex = playbackTracks.findIndex(
      (track) => track.id === selectedTrackId,
    );
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      direction === 'next'
        ? fallbackIndex + 1
        : fallbackIndex - 1;

    if (nextIndex < 0 || nextIndex >= playbackTracks.length) {
      resetDetailTrackSwipe();
      return;
    }

    const exitX = direction === 'next' ? -screenWidth * 0.34 : screenWidth * 0.34;
    const enterX = direction === 'next' ? screenWidth * 0.22 : -screenWidth * 0.22;

    Animated.parallel([
      Animated.timing(detailTrackSwipeX, {
        toValue: exitX,
        duration: 110,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(detailTrackSwipeOpacity, {
        toValue: 0.45,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      selectTrack(playbackTracks[nextIndex].id, true);
      detailTrackSwipeX.setValue(enterX);
      detailTrackSwipeOpacity.setValue(0.45);
      Animated.parallel([
        Animated.spring(detailTrackSwipeX, {
          toValue: 0,
          friction: 8,
          tension: 135,
          useNativeDriver: true,
        }),
        Animated.timing(detailTrackSwipeOpacity, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }

  function openPlaylistPicker() {
    if (detailAddTargetPlaylist) {
      setAddToPlaylistId(detailAddTargetPlaylist.id);
    }

    setIsPlaylistPickerOpen((current) => !current);
  }

  function openCurrentTrackPlaylistSheet() {
    setActionTrackId(selectedTrackId);
    setActionSheetMode('playlists');
    setIsTrackActionSheetOpen(true);
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

  function selectSinger(singerId: string) {
    setSelectedPlaylistId(`singer:${singerId}`);
    setSearchQuery('');
    setActivePanel('flow');
    setProgress(0);
    setSoundPosition(0);
    setIsPlaying(false);
  }

  function selectLyricist(lyricistId: string) {
    setSelectedPlaylistId(`lyricist:${lyricistId}`);
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

    const playbackTracks = currentTracks;

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
    const playbackTracks = currentTracks;

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

  function handleLikePress(trackId: string) {
    setLikedPulseTrackId(trackId);
    likeScaleAnim.setValue(1);
    Animated.sequence([
      Animated.timing(likeScaleAnim, {
        toValue: 1.32,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(likeScaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setLikedPulseTrackId(''));
    void toggleLikeTrack(trackId);
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

  async function createPlaylistAndAddCurrentTrack(trackId = selectedTrackId) {
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
        `/playlists/${createdPlaylist.id}/tracks/${trackId}`,
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
      closeTrackActionSheet();
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

  async function handleUpdateProfile() {
    if (!session) return;
    setIsSubmitting(true);
    clearFeedback();
    try {
      const response = await fetch(`${apiBaseUrl}/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(profileForm),
      });

      if (!response.ok) {
        throw new Error('Could not update profile');
      }

      const data = await response.json();
      setSession({
        ...session,
        user: data.user,
      });
      setNoticeMessage('Profile updated successfully! ✨');
      setTimeout(() => {
        setIsSettingsOpen(false);
        setNoticeMessage('');
      }, 1500);
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleChangePassword() {
    if (!session) return;
    setIsSubmitting(true);
    clearFeedback();
    try {
      const response = await fetch(`${apiBaseUrl}/auth/change-password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(passwordForm),
      });

      if (!response.ok) {
        throw new Error('Could not change password');
      }

      setNoticeMessage('Password changed successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '' });
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!session) return;
    if (!isDeleteAccountConfirming) {
      setIsDeleteAccountConfirming(true);
      return;
    }
    setIsSubmitting(true);
    clearFeedback();
    try {
      const response = await fetch(`${apiBaseUrl}/auth/account`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Could not delete account');
      }

      await AsyncStorage.removeItem(sessionStorageKey);
      setSession(null);
      setView('login');
      setIsSettingsOpen(false);
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUploadAvatar() {
    if (!session) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      
      const formData = new FormData();
      formData.append('avatar', {
        uri: asset.uri,
        name: asset.name ?? `avatar-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      } as any);

      setIsSubmitting(true);
      clearFeedback();

      const response = await fetch(`${apiBaseUrl}/auth/profile/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Avatar upload failed');
      }

      const data = await response.json();
      setSession({
        ...session,
        user: data.user,
      });
      setNoticeMessage('Avatar updated successfully!');
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
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

  if (session && isSettingsOpen) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <View style={styles.settingsHeader}>
          <Pressable
            onPress={() => {
              setIsSettingsOpen(false);
              clearFeedback();
            }}
            style={styles.settingsBackButton}
          >
            <Ionicons color={theme.text} name="chevron-back" size={24} />
          </Pressable>
          <Text style={styles.settingsTitle}>{t('settings')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.settingsContent}
          showsVerticalScrollIndicator={false}
        >
          {errorMessage ? (
            <View style={[styles.feedback, styles.feedbackError, { marginHorizontal: 16, marginBottom: 16 }]}>
              <Text style={styles.feedbackText}>{errorMessage}</Text>
            </View>
          ) : null}
          {noticeMessage ? (
            <View style={[styles.feedback, styles.feedbackNotice, { marginHorizontal: 16, marginBottom: 16 }]}>
              <Text style={styles.feedbackText}>{noticeMessage}</Text>
            </View>
          ) : null}

          {/* Modern Profile Header Card */}
          <Pressable 
            onPress={() => void handleUploadAvatar()}
            style={({ pressed }) => [styles.modernSettingsProfileCard, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.modernAvatarContainer}>
              {session.user.avatarUrl ? (
                <Image
                  source={{ uri: session.user.avatarUrl }}
                  style={styles.modernAvatar}
                />
              ) : (
                <View style={[styles.modernAvatar, styles.spotifyAvatarPlaceholder]}>
                  <Text style={styles.modernAvatarInitial}>
                    {session.user.profileName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </View>
            
            <View style={styles.modernProfileMeta}>
              <Text style={styles.modernProfileName} numberOfLines={1}>{session.user.profileName}</Text>
              <Text style={styles.modernProfileSubtitle} numberOfLines={1}>{session.user.email}</Text>
            </View>
            
            <Ionicons name="chevron-forward" size={20} color={theme.muted} style={{ marginLeft: 'auto' }} />
          </Pressable>

          <View style={styles.spotifySettingsSection}>
            <Text style={styles.spotifySettingsSectionTitle}>{t('general')}</Text>
            
            <Text style={styles.fieldLabel}>{t('displayName')}</Text>
            <TextInput
              onChangeText={(text) => setProfileForm({ ...profileForm, profileName: text })}
              style={styles.spotifyInput}
              value={profileForm.profileName}
            />

            <Text style={styles.fieldLabel}>{t('birthday')}</Text>
            <TextInput
              onChangeText={(text) => setProfileForm({ ...profileForm, birthday: text })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.muted}
              style={styles.spotifyInput}
              value={profileForm.birthday}
            />

            <Text style={styles.fieldLabel}>{t('language')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.languageScroller}
            >
              {languageOptions.map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => setProfileForm({ ...profileForm, language: lang.code })}
                  style={[
                    styles.languageChip,
                    profileForm.language === lang.code
                      ? styles.languageChipActive
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.languageChipText,
                      profileForm.language === lang.code
                        ? styles.languageChipTextActive
                        : null,
                    ]}
                  >
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              disabled={isSubmitting}
              onPress={() => {
                void handleUpdateProfile();
              }}
              style={styles.settingsPrimaryAction}
            >
              <Text style={styles.settingsPrimaryActionText}>
                {isSubmitting ? 'Saving…' : t('saveProfile')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.spotifySettingsSection}>
            <Text style={styles.spotifySettingsSectionTitle}>{t('security')}</Text>
            
            <Text style={styles.fieldLabel}>Current Password</Text>
            <TextInput
              onChangeText={(text) => setPasswordForm({ ...passwordForm, currentPassword: text })}
              placeholderTextColor={theme.muted}
              secureTextEntry
              style={styles.spotifyInput}
              value={passwordForm.currentPassword}
            />
            
            <Text style={styles.fieldLabel}>New Password</Text>
            <TextInput
              onChangeText={(text) => setPasswordForm({ ...passwordForm, newPassword: text })}
              placeholderTextColor={theme.muted}
              secureTextEntry
              style={styles.spotifyInput}
              value={passwordForm.newPassword}
            />

            <Pressable
              disabled={isSubmitting || !passwordForm.currentPassword || !passwordForm.newPassword}
              onPress={() => {
                void handleChangePassword();
              }}
              style={[
                styles.settingsSecondaryAction,
                (isSubmitting ||
                  !passwordForm.currentPassword ||
                  !passwordForm.newPassword) &&
                  styles.disabledButton,
              ]}
            >
              <Text style={styles.settingsSecondaryActionText}>
                {isSubmitting ? 'Saving…' : t('changePassword')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.accountRemovalSection}>
            <View style={styles.accountRemovalCopy}>
              <Text style={styles.accountRemovalTitle}>{t('deleteAccount')}</Text>
              <Text style={styles.accountRemovalDescription}>
                Permanently remove your account and saved listening data.
              </Text>
            </View>
            <Pressable
              disabled={isSubmitting}
              onPress={() => {
                void handleDeleteAccount();
              }}
              style={styles.deleteAccountAction}
            >
              <Text style={styles.deleteAccountActionText}>
                {isSubmitting ? 'Deleting…' : isDeleteAccountConfirming ? 'Are you sure?' : t('deleteAccount')}
              </Text>
            </Pressable>
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
          <ScrollView
            contentContainerStyle={styles.playerContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.tabContentAnimator,
                {
                  opacity: contentSwitchAnim,
                  transform: [
                    {
                      translateY: contentSwitchAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
            {activePanel === 'flow' || activePanel === 'library' ? (
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
            ) : null}

            {activePanel === 'search' ? (
              <>
                <View style={styles.searchPanelHeader}>
                  <Text style={styles.eyebrow}>Search</Text>
                  <Text style={styles.sectionTitle}>Find your sound</Text>
                </View>
                <View style={styles.searchPill}>
                  <Ionicons color={theme.muted} name="search" size={18} />
                  <TextInput
                    autoCapitalize="none"
                    autoFocus
                    onChangeText={setSearchQuery}
                    placeholder="Search songs, artists, albums"
                    placeholderTextColor={theme.muted}
                    style={styles.searchInput}
                    value={searchQuery}
                  />
                </View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  <Text style={styles.sectionAction}>
                    {visibleTracks.length} tracks
                  </Text>
                </View>
                <View style={styles.trackList}>
                  {visibleTracks.map((track, index) => {
                    const isSelected = track.id === selectedTrackId;

                    return (
                      <Pressable
                        key={`search-${track.id}-${index}`}
                        onLongPress={() => openTrackActionSheet(track.id)}
                        onPress={() => openTrackDetail(track.id)}
                        style={[
                          styles.trackRow,
                          isSelected ? styles.trackRowActive : null,
                        ]}
                      >
                        <Ionicons
                          color={isSelected ? theme.secondary : theme.muted}
                          name="search"
                          size={18}
                        />
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
              </>
            ) : null}

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
                    {/* <Text style={styles.heroPlayLabel}>
                      {isPlaying ? 'Pause' : 'Play'}
                    </Text> */}
                  </Pressable>
                  <Pressable
                    onPress={() => handleLikePress(selectedTrack.id)}
                    style={[
                      styles.heroSubtleButton,
                      isSelectedTrackLiked ? styles.heroSubtleButtonActive : null,
                    ]}
                  >
                    <Animated.View
                      style={[
                        likedPulseTrackId === selectedTrack.id
                          ? { transform: [{ scale: likeScaleAnim }] }
                          : null,
                      ]}
                    >
                      <Ionicons
                        color={isSelectedTrackLiked ? '#ff7a59' : theme.text}
                        name={isSelectedTrackLiked ? 'heart' : 'heart-outline'}
                        size={18}
                      />
                    </Animated.View>
                    {/* <Text style={styles.heroSubtleLabel}>
                      {isSelectedTrackLiked ? 'Liked' : 'Like'}
                    </Text> */}
                  </Pressable>
                  <Pressable
                    onPress={openCurrentTrackPlaylistSheet}
                    style={styles.heroSubtleButton}
                  >
                    <Ionicons color={theme.text} name="add" size={18} />
                    {/* <Text style={styles.heroSubtleLabel}>Add</Text> */}
                  </Pressable>
                </View>
                {/* {isSoundLoading ? (
                  <Text style={styles.caption}>Loading backend audio</Text>
                ) : null} */}
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured artists</Text>
              <Text style={styles.sectionAction}>{artists.length} profiles</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.collectionScroller}
            >
              {artists.slice(0, 8).map((artist) => {
                const sampleTrack = artist.tracks[0];

                return (
                  <LibraryCollectionCard
                    artwork={
                      sampleTrack
                        ? { kind: 'track', track: sampleTrack }
                        : { kind: 'initial', label: artist.name }
                    }
                    colors={theme}
                    key={`flow-artist-${artist.id}`}
                    onPress={() => selectArtist(artist.id)}
                    subtitle={`Artist · ${artist.trackCount} tracks · ${artist.albumCount} albums`}
                    title={artist.name}
                  />
                );
              })}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Albums for you</Text>
              <Text style={styles.sectionAction}>{albums.length} releases</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.collectionScroller}
            >
              {albums.slice(0, 8).map((album) => {
                const sampleTrack = album.tracks[0];

                return (
                  <LibraryCollectionCard
                    artwork={
                      sampleTrack
                        ? { kind: 'track', track: sampleTrack }
                        : {
                            kind: 'icon',
                            icon: 'albums',
                            color: theme.accent,
                            backgroundColor: 'rgba(245,193,93,0.12)',
                          }
                    }
                    colors={theme}
                    key={`flow-album-${album.id}`}
                    onPress={() => selectAlbum(album.id)}
                    subtitle={`Album · ${album.artist} · ${album.trackCount} tracks`}
                    title={album.title}
                  />
                );
              })}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Track runway</Text>
              <Text style={styles.sectionAction}>
                {currentTracks.length} tracks
              </Text>
            </View>
            <View style={styles.trackList}>
              {currentTracks.map((track, index) => {
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
                        handleLikePress(track.id);
                      }}
                      style={styles.rowIconButton}
                    >
                      <Animated.View
                        style={[
                          likedPulseTrackId === track.id
                            ? { transform: [{ scale: likeScaleAnim }] }
                            : null,
                        ]}
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
                      </Animated.View>
                    </Pressable>
                    <Text style={styles.trackDuration}>
                      {durationByTrackId[track.id] ?? track.duration}
                    </Text>
                  </Pressable>
                );
              })}
              {!currentTracks.length ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No tracks here yet</Text>
                  <Text style={styles.caption}>
                    Pick a different library source to keep listening.
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
                <View style={styles.libraryOverviewCard}>
                  <View style={styles.libraryOverviewIcon}>
                    <Ionicons
                      color={theme.accentText}
                      name="library"
                      size={22}
                    />
                  </View>
                  <View style={styles.libraryOverviewCopy}>
                    <Text style={styles.libraryOverviewTitle}>Your Library</Text>
                    <Text style={styles.libraryOverviewMeta}>
                      {libraryTracks.length} tracks · {artists.length} artists · {albums.length} albums
                    </Text>
                  </View>
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('likedSongs')}</Text>
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
                  <Text style={styles.sectionTitle}>{t('recentPlays')}</Text>
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
                  <Text style={styles.sectionTitle}>{t('artists')}</Text>
                  <Text style={styles.sectionAction}>
                    {artists.length} profiles
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.collectionScroller}
                >
                  {artists.map((artist) => {
                    const sampleTrack = artist.tracks[0];

                    return (
                      <LibraryCollectionCard
                        artwork={
                          sampleTrack
                            ? { kind: 'track', track: sampleTrack }
                            : { kind: 'initial', label: artist.name }
                        }
                        colors={theme}
                        key={`artist-${artist.id}`}
                        onPress={() => selectArtist(artist.id)}
                        subtitle={`Artist · ${artist.trackCount} tracks · ${artist.albumCount} albums`}
                        title={artist.name}
                      />
                    );
                  })}
                </ScrollView>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('albums')}</Text>
                  <Text style={styles.sectionAction}>
                    {albums.length} releases
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.collectionScroller}
                >
                  {albums.map((album) => {
                    const sampleTrack = album.tracks[0];

                    return (
                      <LibraryCollectionCard
                        artwork={
                          sampleTrack
                            ? { kind: 'track', track: sampleTrack }
                            : {
                                kind: 'icon',
                                icon: 'albums',
                                color: theme.accent,
                                backgroundColor: 'rgba(245,193,93,0.12)',
                              }
                        }
                        colors={theme}
                        key={`album-${album.id}`}
                        onPress={() => selectAlbum(album.id)}
                        subtitle={`Album · ${album.artist} · ${album.trackCount} tracks`}
                        title={album.title}
                      />
                    );
                  })}
                </ScrollView>

                {singers.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{t('singers')}</Text>
                      <Text style={styles.sectionAction}>
                        {singers.length} profiles
                      </Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.collectionScroller}
                    >
                      {singers.map((singer) => (
                        <LibraryCollectionCard
                          artwork={
                            singer.imageName
                              ? {
                                  kind: 'image',
                                  uri: `${apiBaseUrl}/uploads/people/${singer.imageName}`,
                                  shape: 'round',
                                }
                              : { kind: 'initial', label: singer.name }
                          }
                          colors={theme}
                          key={`singer-${singer.id}`}
                          onPress={() => selectSinger(singer.id)}
                          subtitle={`Singer · ${singer.trackCount} tracks`}
                          title={singer.name}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}

                {lyricists.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{t('lyricists')}</Text>
                      <Text style={styles.sectionAction}>
                        {lyricists.length} profiles
                      </Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.collectionScroller}
                    >
                      {lyricists.map((lyricist) => (
                        <LibraryCollectionCard
                          artwork={
                            lyricist.imageName
                              ? {
                                  kind: 'image',
                                  uri: `${apiBaseUrl}/uploads/people/${lyricist.imageName}`,
                                }
                              : {
                                  kind: 'icon',
                                  icon: 'create',
                                  color: theme.secondary,
                                  backgroundColor: 'rgba(85,214,194,0.12)',
                                }
                          }
                          colors={theme}
                          key={`lyricist-${lyricist.id}`}
                          onPress={() => selectLyricist(lyricist.id)}
                          subtitle={`Lyricist · ${lyricist.trackCount} tracks`}
                          title={lyricist.name}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('crates')}</Text>
                  <Text style={styles.sectionAction}>{playlists.length} crates</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.collectionScroller}
                >
                  {playlists.map((playlist, index) => (
                    <LibraryCollectionCard
                      artwork={{
                        kind: 'icon',
                        icon: 'musical-notes',
                        color: theme.accentText,
                        backgroundColor: theme.accent,
                      }}
                      colors={theme}
                      key={`library-playlist-${playlist.id}-${index}`}
                      onPress={() => {
                        setSelectedPlaylistId(playlist.id);
                        setActivePanel('flow');
                      }}
                      subtitle={`Playlist · ${playlist.trackCount} tracks`}
                      title={playlist.name}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            {activePanel === 'profile' ? (
              <View style={styles.spotifyProfileContainer}>
                {/* Header Section */}
                <View style={styles.spotifyHeader}>
                  <Pressable 
                    onPress={() => setIsSettingsOpen(true)}
                    style={styles.spotifySettingsButton}
                  >
                    <Ionicons color={theme.text} name="settings-outline" size={24} />
                  </Pressable>
                  
                  <Pressable 
                    onPress={() => void handleUploadAvatar()}
                    style={({ pressed }) => [styles.spotifyAvatarContainer, pressed && { opacity: 0.8 }]}
                  >
                    {session.user.avatarUrl ? (
                      <Image
                        source={{ uri: session.user.avatarUrl }}
                        style={styles.spotifyAvatarLarge}
                      />
                    ) : (
                      <View style={[styles.spotifyAvatarLarge, styles.spotifyAvatarPlaceholder]}>
                        <Text style={styles.spotifyAvatarInitial}>
                          {session.user.profileName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.profileCameraBadge}>
                      <Ionicons name="camera" size={16} color="#fff" />
                    </View>
                  </Pressable>
                  
                  <Text style={styles.spotifyName}>{session.user.profileName}</Text>
                  
                  <Text style={styles.spotifyStatsInline}>
                    {favoriteTracks.length} Liked • {playlists.length} Playlists • {libraryTracks.length} Tracks
                  </Text>
                </View>

                {/* Playlists Section */}
                <View style={styles.spotifyPlaylistsSection}>
                  <Text style={styles.spotifySectionTitle}>Your Playlists</Text>
                  
                  {/* Create Playlist Row */}
                  <View style={styles.spotifyCreatePlaylistRow}>
                    <View style={styles.spotifyCreateIconContainer}>
                      <Ionicons color={theme.accentText} name="add" size={24} />
                    </View>
                    <TextInput
                      onChangeText={setNewPlaylistName}
                      placeholder="Name a new playlist..."
                      placeholderTextColor={theme.muted}
                      style={styles.spotifyCreateInput}
                      value={newPlaylistName}
                      onSubmitEditing={createPlaylist}
                    />
                    {newPlaylistName.trim().length > 0 && (
                      <Pressable onPress={createPlaylist} style={styles.spotifyCreateButton}>
                        <Text style={styles.spotifyCreateButtonText}>Create</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Playlists List */}
                  {playlists.length > 0 ? (
                    <View style={styles.spotifyPlaylistsList}>
                      {playlists.map((playlist, index) => (
                        <Pressable
                          key={`spotify-playlist-${playlist.id}-${index}`}
                          onPress={() => setSelectedPlaylistId(playlist.id)}
                          style={[
                            styles.spotifyPlaylistRow,
                            selectedPlaylist?.id === playlist.id && styles.spotifyPlaylistRowActive
                          ]}
                        >
                          <View style={styles.spotifyPlaylistCover}>
                            <Ionicons color={theme.muted} name="musical-notes" size={24} />
                          </View>
                          <View style={styles.spotifyPlaylistMeta}>
                            <Text style={styles.spotifyPlaylistName}>{playlist.name}</Text>
                            <Text style={styles.spotifyPlaylistSubtext}>{playlist.trackCount} tracks</Text>
                          </View>
                          <Pressable
                            onPress={() => deletePlaylist(playlist.id)}
                            style={styles.spotifyPlaylistDelete}
                          >
                            <Ionicons color={theme.muted} name="trash-outline" size={20} />
                          </Pressable>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.spotifyEmptyState}>
                      <Text style={styles.spotifyEmptyStateText}>You don't have any playlists yet.</Text>
                    </View>
                  )}

                  {/* Tracks of Selected Playlist */}
                  {selectedPlaylist && selectedPlaylist.tracks.length > 0 && (
                    <View style={styles.spotifySelectedPlaylistContainer}>
                      <Text style={styles.spotifySectionTitle}>{selectedPlaylist.name} Tracks</Text>
                      {selectedPlaylist.tracks.map((track, index) => (
                        <View
                          style={styles.playlistTrackRow}
                          key={`spotify-playlist-track-${track.id}-${index}`}
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
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ) : null}
            </Animated.View>
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

                        <View style={styles.sheetCreatePlaylistRow}>
                          <TextInput
                            onChangeText={setNewPlaylistName}
                            placeholder="New playlist"
                            placeholderTextColor={theme.muted}
                            style={styles.sheetCreatePlaylistInput}
                            value={newPlaylistName}
                          />
                          <Pressable
                            disabled={!newPlaylistName.trim()}
                            onPress={() =>
                              void createPlaylistAndAddCurrentTrack(actionTrack.id)
                            }
                            style={[
                              styles.sheetCreatePlaylistButton,
                              !newPlaylistName.trim() ? styles.disabledButton : null,
                            ]}
                          >
                            <Ionicons
                              color={theme.accentText}
                              name="add"
                              size={20}
                            />
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </>
                ) : null}
              </Pressable>
            </Pressable>
          </Modal>

          <Modal
            animationType="none"
            onRequestClose={closeTrackDetail}
            presentationStyle="overFullScreen"
            transparent
            visible={isTrackDetailOpen}
          >
            <View style={styles.playerModalRoot}>
              <AnimatedBlurView
                intensity={42}
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  { opacity: playerBackdropOpacity },
                ]}
                tint={themeMode === 'dark' ? 'dark' : 'light'}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor:
                      themeMode === 'dark'
                        ? 'rgba(8, 6, 14, 0.46)'
                        : 'rgba(255, 255, 255, 0.28)',
                    opacity: playerBackdropOpacity,
                  },
                ]}
              />
            <Animated.View
              onTouchCancel={handleDetailTouchCancel}
              onTouchEnd={handleDetailTouchEnd}
              onTouchMove={handleDetailTouchMove}
              onTouchStart={handleDetailTouchStart}
              style={{
                flex: 1,
                opacity: playerSheetOpacity,
                transform: [{ translateY: playerSheetY }],
              }}
            >
              <View
                pointerEvents="none"
                style={styles.detailBackgroundSolid}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.detailBackgroundTopSolid,
                  { opacity: detailTopSolidOpacity },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.detailBackgroundFade,
                  { opacity: detailInitialFadeOpacity },
                ]}
              >
                <LinearGradient
                  colors={[
                    themeMode === 'dark'
                      ? 'rgba(18, 15, 24, 0)'
                      : 'rgba(247, 242, 234, 0)',
                    theme.background,
                  ]}
                  locations={[0, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>
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
                    onPress={() => handleLikePress(selectedTrack.id)}
                    style={styles.detailHeaderButton}
                  >
                    <Animated.View
                      style={[
                        likedPulseTrackId === selectedTrack.id
                          ? { transform: [{ scale: likeScaleAnim }] }
                          : null,
                      ]}
                    >
                      <Ionicons
                        color={isSelectedTrackLiked ? '#ff7a59' : theme.text}
                        name={isSelectedTrackLiked ? 'heart' : 'heart-outline'}
                        size={23}
                      />
                    </Animated.View>
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

              <Animated.View
                style={[
                  styles.detailBody,
                  {
                    opacity: detailTrackSwipeOpacity,
                    transform: [{ translateX: detailTrackSwipeX }],
                  },
                ]}
              >
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
              </Animated.View>

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
                        onPress={() => void createPlaylistAndAddCurrentTrack()}
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
            </Animated.View>
            </View>
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

          <View style={styles.bottomTabBar}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bottomTabIndicator,
                {
                  width: bottomTabWidth - 8,
                  transform: [{ translateX: tabIndicatorTranslateX }],
                },
              ]}
            />
            {bottomTabs.map((tab) => {
              const isActive = activePanel === tab.id;
              const tabScale = tabSwitchAnim.interpolate({
                inputRange: bottomTabs.map((_, index) => index),
                outputRange: bottomTabs.map((_, index) =>
                  index === bottomTabs.findIndex((item) => item.id === tab.id)
                    ? 1.05
                    : 1,
                ),
              });

              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  key={tab.id}
                  onPress={() => setActivePanel(tab.id)}
                  style={[
                    styles.bottomTab,
                    isActive ? styles.bottomTabActive : null,
                  ]}
                >
                  <Animated.View style={{ transform: [{ scale: tabScale }] }}>
                    <Ionicons
                      color={isActive ? theme.accent : theme.muted}
                      name={tab.icon}
                      size={22}
                    />
                  </Animated.View>
                  <Text
                    style={[
                      styles.bottomTabLabel,
                      isActive ? styles.bottomTabLabelActive : null,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Animated.View
            {...miniPlayerPanResponder.panHandlers}
            onLayout={handleMiniPlayerLayout}
            ref={miniPlayerRef}
            style={[
              styles.nowBar,
              { transform: [{ translateY: miniPlayerDragY }] },
            ]}
          >
            <Pressable
              onPress={openPlayerSheetFromMiniPlayer}
              style={styles.miniPlayerPressable}
            >
              <TrackArt track={selectedTrack} size="small" />
              <View style={styles.miniTrackMeta}>
                <Text style={styles.nowTitle} numberOfLines={1}>
                  {selectedTrack.title}
                </Text>
                <Text style={styles.trackSubtext} numberOfLines={1}>
                  {selectedTrack.artist}
                </Text>
              </View>
              <View style={styles.miniTransportRow}>
                <Pressable onPress={selectPreviousTrack} style={styles.miniButton} hitSlop={10}>
                  <Ionicons color={theme.text} name="play-skip-back" size={20} />
                </Pressable>
                <Pressable onPress={togglePlayback} style={styles.miniButton} hitSlop={10}>
                  <Ionicons color={theme.text} name={isPlaying ? 'pause' : 'play'} size={24} />
                </Pressable>
                <Pressable onPress={selectNextTrack} style={styles.miniButton} hitSlop={10}>
                  <Ionicons color={theme.text} name="play-skip-forward" size={20} />
                </Pressable>
              </View>
            </Pressable>
            <View style={styles.miniProgressTrack}>
              <View
                style={[
                  styles.miniProgressFill,
                  { width: `${progress}%` as `${number}%` },
                ]}
              />
            </View>
          </Animated.View>
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
    paddingBottom: isSmallScreen ? 265 : 280,
    gap: isSmallScreen ? 12 : 16,
  },
  appHeader: {
    alignItems: 'center',
    backgroundColor: theme.background,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingTop: isSmallScreen ? 8 : 12,
    paddingBottom: 10,
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
  searchPanelHeader: {
    gap: 4,
    paddingTop: 4,
  },
  tabContentAnimator: {
    gap: isSmallScreen ? 12 : 16,
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
  disabledButton: {
    opacity: 0.5,
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
  collectionScroller: {
    gap: 10,
    paddingRight: 16,
  },
  libraryOverviewCard: {
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    padding: 15,
  },
  libraryOverviewIcon: {
    alignItems: 'center',
    backgroundColor: theme.accent,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  libraryOverviewCopy: {
    flex: 1,
    minWidth: 0,
  },
  libraryOverviewTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '900',
  },
  libraryOverviewMeta: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
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
  settingsContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 72,
    gap: 22,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
  },
  settingsBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginLeft: -10,
  },
  settingsBackText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
  },
  settingsTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '900',
  },
  settingsCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  settingsCardTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '800',
  },
  fieldLabel: {
    color: theme.mutedStrong,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: -6,
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
  spotifyProfileContainer: {
    flex: 1,
  },
  spotifyHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    position: 'relative',
  },
  spotifySettingsButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  spotifyAvatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  spotifyAvatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  spotifyAvatarPlaceholder: {
    backgroundColor: theme.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyAvatarInitial: {
    color: theme.accentText,
    fontSize: 48,
    fontWeight: '900',
  },
  spotifyName: {
    color: theme.text,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  spotifyStatsInline: {
    color: theme.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  spotifyPlaylistsSection: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  spotifySectionTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
    marginTop: 8,
  },
  spotifyCreatePlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  spotifyCreateIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: theme.accent,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyCreateInput: {
    flex: 1,
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    height: 48,
  },
  spotifyCreateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.surfaceSoft,
    borderRadius: 999,
  },
  spotifyCreateButtonText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '700',
  },
  spotifyPlaylistsList: {
    gap: 16,
  },
  spotifyPlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  spotifyPlaylistRowActive: {
    backgroundColor: theme.surfaceSoft,
    borderRadius: 8,
  },
  spotifyPlaylistCover: {
    width: 48,
    height: 48,
    backgroundColor: theme.surface,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyPlaylistMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  spotifyPlaylistName: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  spotifyPlaylistSubtext: {
    color: theme.muted,
    fontSize: 13,
  },
  spotifyPlaylistDelete: {
    padding: 8,
  },
  spotifyEmptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  spotifyEmptyStateText: {
    color: theme.muted,
    fontSize: 15,
  },
  spotifySelectedPlaylistContainer: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 16,
  },
  spotifySettingsSection: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: theme.mode === 'dark' ? 0.18 : 0.08,
    shadowRadius: 18,
  },
  spotifySettingsSectionTitle: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  spotifyInput: {
    backgroundColor: theme.field,
    borderColor: theme.border,
    borderRadius: 12,
    borderWidth: 1,
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  modernSettingsProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: theme.mode === 'dark' ? 0.2 : 0.08,
    shadowRadius: 20,
  },
  modernAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  modernAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  modernAvatarInitial: {
    color: theme.accentText,
    fontSize: 28,
    fontWeight: '900',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1db954',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.background,
  },
  profileCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1db954',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.background,
  },
  modernProfileMeta: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 16,
  },
  modernProfileName: {
    color: theme.text,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 3,
    letterSpacing: -0.5,
  },
  modernProfileSubtitle: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  languageScroller: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 2,
    paddingBottom: 2,
  },
  languageChip: {
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  languageChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  languageChipText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '800',
  },
  languageChipTextActive: {
    color: theme.accentText,
  },
  settingsPrimaryAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.accent,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 2,
    minHeight: 44,
    paddingHorizontal: 18,
  },
  settingsPrimaryActionText: {
    color: theme.accentText,
    fontSize: 14,
    fontWeight: '900',
  },
  settingsSecondaryAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 2,
    minHeight: 44,
    paddingHorizontal: 18,
  },
  settingsSecondaryActionText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '900',
  },
  accountRemovalSection: {
    alignItems: 'center',
    backgroundColor: theme.dangerSoft,
    borderColor: theme.mode === 'dark'
      ? 'rgba(255,154,165,0.28)'
      : 'rgba(201,63,77,0.2)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  accountRemovalCopy: {
    flex: 1,
    gap: 3,
  },
  accountRemovalTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '900',
  },
  accountRemovalDescription: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  deleteAccountAction: {
    alignItems: 'center',
    backgroundColor: theme.danger,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
  },
  deleteAccountActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
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
  sheetCreatePlaylistRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetCreatePlaylistInput: {
    backgroundColor: theme.field,
    borderColor: theme.border,
    borderRadius: 10,
    borderWidth: 1,
    color: theme.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  sheetCreatePlaylistButton: {
    alignItems: 'center',
    backgroundColor: theme.accent,
    borderRadius: 999,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  detailScreen: {
    flex: 1,
    paddingHorizontal: isSmallScreen ? 18 : 24,
    paddingVertical: 16,
  },
  detailBackgroundFade: {
    height: detailBackgroundFadeHeight,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  detailBackgroundSolid: {
    backgroundColor: theme.background,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: detailBackgroundFadeHeight,
  },
  detailBackgroundTopSolid: {
    backgroundColor: theme.background,
    height: detailBackgroundFadeHeight,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  detailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    position: 'relative',
  },
  detailHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    zIndex: 2,
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
    zIndex: 2,
  },
  detailHeaderCopy: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: isSmallScreen ? 92 : 108,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
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
  playerModalRoot: {
    flex: 1,
    overflow: 'hidden',
  },
  nowBar: {
    backgroundColor: theme.surfaceStrong,
    borderColor: theme.border,
    borderTopWidth: 1,
    bottom: isSmallScreen ? 70 : 74,
    left: 0,
    position: 'absolute',
    right: 0,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  bottomTabBar: {
    alignItems: 'center',
    backgroundColor: theme.surfaceStrong,
    borderColor: theme.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-around',
    left: 0,
    paddingBottom: 8,
    paddingHorizontal: 8,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
  },
  bottomTabIndicator: {
    backgroundColor: theme.surfaceSoft,
    borderColor: theme.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    bottom: 8,
    left: 8,
    position: 'absolute',
    top: 8,
  },
  bottomTab: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 54,
    zIndex: 1,
  },
  bottomTabActive: {
    borderColor: 'transparent',
  },
  bottomTabLabel: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  bottomTabLabelActive: {
    color: theme.accent,
  },
  miniPlayerPressable: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  miniTrackMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  nowTitle: {
    color: theme.text,
    fontSize: isSmallScreen ? 13 : 15,
    fontWeight: '900',
  },
  miniTransportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  miniButton: {
    padding: 4,
  },
  miniProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.surfaceSoft,
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: theme.secondary,
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
