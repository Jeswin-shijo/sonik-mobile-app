import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import { io, Socket } from 'socket.io-client';
import * as ImagePicker from 'expo-image-picker';
import { AvatarCropModal } from '../components/AvatarCropModal';
import {
  createAudioPlayer,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioSource,
} from 'expo-audio';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, AppState, Easing, PanResponder, Share, useColorScheme } from 'react-native';
import { ApiRequestError, getFriendlyError, requestJson } from '../api/client';
import {
  apiBaseUrl,
  googleAndroidClientId,
  googleIosClientId,
  googleWebClientId,
  sessionStorageKey,
} from '../config';
import { fallbackTracks } from '../data/tracks';
import { appThemes, type AppTheme } from '../theme';
import type {
  ActivePanel,
  Album,
  AlbumsResponse,
  ApiLanguage,
  ApiLyricist,
  ApiSinger,
  Artist,
  ArtistsResponse,
  AuthResponse,
  AuthView,
  DetailEntity,
  DetailEntityKind,
  ForgotPasswordResponse,
  Language,
  LanguagesResponse,
  Lyricist,
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
  Singer,
  ThemeMode,
  TracksResponse,
} from '../types';
import { buildAlbumsFromTracks, buildArtistsFromTracks, buildLanguagesFromTracks } from '../utils/library';
import {
  formatMillis,
  getRuntimeLabel,
  normalizeAlbum,
  normalizeArtist,
  normalizeLanguage,
  normalizeLyricist,
  normalizePlaylist,
  normalizeQueueItem,
  normalizeSinger,
  normalizeTrack,
  uniqueTracksById,
} from '../utils/music';
import { getTranslation } from '../utils/translations';
import { collapsedPlayerTop, isSmallScreen, screenHeight, screenWidth, createStyles } from '../styles/createStyles';
import { bottomTabs } from '../constants/navigation';

WebBrowser.maybeCompleteAuthSession();

const themeStorageKey = 'sonik-theme-mode';
const downloadsStorageKey = 'sonik-downloaded-tracks';

function getAudioSourceForTrack(
  track: MusicTrack,
  activeSession: SessionState | null,
): AudioSource {
  if (!activeSession) return null;
  if (track.streamUrl) return { uri: `${apiBaseUrl}${track.streamUrl}` };
  return track.audio ?? null;
}

export type AppContextValue = {
  // theme
  theme: AppTheme;
  themeMode: ThemeMode;
  styles: ReturnType<typeof createStyles>;
  toggleThemeMode: () => void;

  // session / auth
  session: SessionState | null;
  isBootstrapping: boolean;
  view: AuthView;
  setView: (v: AuthView) => void;

  // ui state
  activePanel: ActivePanel;
  setActivePanel: (p: ActivePanel) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (v: boolean) => void;
  isTrackDetailOpen: boolean;
  isPlaylistPickerOpen: boolean;
  isTrackActionSheetOpen: boolean;
  actionSheetMode: 'actions' | 'playlists';
  setActionSheetMode: (m: 'actions' | 'playlists') => void;
  actionTrackId: string;
  addToPlaylistId: string;
  setAddToPlaylistId: (id: string) => void;
  isDeleteAccountConfirming: boolean;
  setIsDeleteAccountConfirming: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  newPlaylistName: string;
  setNewPlaylistName: (n: string) => void;

  // library
  libraryTracks: MusicTrack[];
  favoriteTracks: MusicTrack[];
  recentTracks: MusicTrack[];
  playlists: Playlist[];
  artists: Artist[];
  singers: Singer[];
  lyricists: Lyricist[];
  albums: Album[];
  languages: Language[];
  queueItems: QueueItem[];

  // player
  selectedTrackId: string;
  selectedTrack: MusicTrack;
  isPlaying: boolean;
  isShuffle: boolean;
  setIsShuffle: (v: boolean | ((c: boolean) => boolean)) => void;
  repeatMode: RepeatMode;
  progress: number;
  soundPosition: number;
  soundDuration: number;
  durationByTrackId: Record<string, string>;
  progressTrackWidth: number;
  setProgressTrackWidth: (w: number) => void;
  isSoundLoading: boolean;
  audioSource: AudioSource;

  // derived
  currentTracks: MusicTrack[];
  visibleTracks: MusicTrack[];
  selectedPlaylistId: string;
  setSelectedPlaylistId: (id: string) => void;
  selectedPlaylist: Playlist | null;
  selectedSourceLabel: string;
  isSelectedTrackLiked: boolean;
  isSelectedTrackInDetailTarget: boolean;
  addTargetPlaylist: Playlist | null;
  detailAddTargetPlaylist: Playlist | null;
  selectedRuntimeLabel: string;
  sourceFilters: Array<{ id: string; label: string; count: number }>;
  actionTrack: MusicTrack | null;
  actionArtist: Artist | null;
  actionAlbum: Album | null;
  queuePreviewTracks: MusicTrack[];
  likedPulseTrackId: string;

  // animation refs
  miniPlayerDragY: Animated.Value;
  playerSheetY: Animated.Value;
  playerSheetOpacity: Animated.Value;
  detailTrackSwipeX: Animated.Value;
  detailTrackSwipeOpacity: Animated.Value;
  tabSwitchAnim: Animated.Value;
  contentSwitchAnim: Animated.Value;
  likeScaleAnim: Animated.Value;
  playerBackdropOpacity: Animated.AnimatedInterpolation<number>;
  detailInitialFadeOpacity: Animated.AnimatedInterpolation<number>;
  detailTopSolidOpacity: Animated.AnimatedInterpolation<number>;
  tabIndicatorTranslateX: Animated.AnimatedInterpolation<number>;
  miniPlayerRef: React.RefObject<import('react-native').View | null>;
  miniPlayerPanResponder: ReturnType<typeof PanResponder.create>;

  // form state
  loginForm: { email: string; password: string };
  setLoginForm: React.Dispatch<React.SetStateAction<{ email: string; password: string }>>;
  registerForm: { profileName: string; email: string; password: string; confirmPassword: string };
  setRegisterForm: React.Dispatch<React.SetStateAction<{ profileName: string; email: string; password: string; confirmPassword: string }>>;
  resetForm: { newPassword: string };
  setResetForm: React.Dispatch<React.SetStateAction<{ newPassword: string }>>;
  otpForm: { email: string; otp: string };
  setOtpForm: React.Dispatch<React.SetStateAction<{ email: string; otp: string }>>;
  otpStep: 'email' | 'verify';
  setOtpStep: (s: 'email' | 'verify') => void;
  emailStatus: 'idle' | 'checking' | 'available' | 'taken';
  profileForm: { profileName: string; birthday: string; language: string };
  setProfileForm: React.Dispatch<React.SetStateAction<{ profileName: string; birthday: string; language: string }>>;
  passwordForm: { currentPassword: string; newPassword: string };
  setPasswordForm: React.Dispatch<React.SetStateAction<{ currentPassword: string; newPassword: string }>>;
  isSubmitting: boolean;
  errorMessage: string;
  noticeMessage: string;
  clearFeedback: () => void;

  // google
  googleEnabled: boolean;
  googleRequest: ReturnType<typeof Google.useIdTokenAuthRequest>[0];

  // icon button colors
  iconButtonColors: {
    ghostIcon: string;
    solidIcon: string;
    ghostBackground: string;
    ghostBorder: string;
    solidBackground: string;
    solidBorder: string;
  };

  // entity detail overlay
  detailEntity: DetailEntity | null;
  isEntityDetailOpen: boolean;
  openEntityDetail: (kind: DetailEntityKind, id: string) => void;
  closeEntityDetail: () => void;
  playEntityTracks: (kind: DetailEntityKind, id: string) => void;

  // queue view
  isQueueViewOpen: boolean;
  setIsQueueViewOpen: (v: boolean | ((c: boolean) => boolean)) => void;
  removeQueueItem: (queueItemId: string) => Promise<void>;
  clearAllQueue: () => Promise<void>;

  // backend search
  searchResults: MusicTrack[];
  isSearching: boolean;

  // pull-to-refresh
  isRefreshing: boolean;
  refreshLibrary: () => Promise<void>;

  // playlist rename
  updatePlaylistName: (id: string, name: string) => Promise<void>;

  // handlers
  t: (key: string) => string;
  handleLogin: () => Promise<void>;
  handleResetPassword: () => Promise<void>;
  handleSendOtp: (purpose?: 'signup' | 'reset') => Promise<void>;
  handleVerifyOtpForSignup: () => Promise<void>;
  handleVerifyOtpForPasswordReset: () => Promise<void>;
  handleGoogleToken: (idToken: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  openGoogleFlow: () => Promise<void>;
  handleUpdateProfile: () => Promise<void>;
  handleChangePassword: () => Promise<void>;
  handleDeleteAccount: () => Promise<void>;
  handleUploadAvatar: () => Promise<void>;
  selectTrack: (trackId: string, forcePlay?: boolean) => void;
  openTrackDetail: (trackId: string) => void;
  togglePlayback: () => void;
  toggleRepeatMode: () => void;
  seekToRatio: (ratio: number) => Promise<void>;
  selectNextTrack: () => void;
  selectPreviousTrack: () => void;
  handleLikePress: (trackId: string) => void;
  selectPlaylist: (id: string) => void;
  selectArtist: (id: string) => void;
  selectAlbum: (id: string) => void;
  selectLanguage: (id: string) => void;
  selectSinger: (id: string) => void;
  selectLyricist: (id: string) => void;
  createPlaylist: () => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addTrackToPlaylist: (trackId: string, playlistId?: string) => Promise<void>;
  addCurrentTrackToPlaylist: (playlistId?: string) => Promise<void>;
  createPlaylistAndAddCurrentTrack: (trackId?: string) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  enqueueTrack: (trackId: string, mode: 'next' | 'end') => Promise<void>;
  shareTrack: (track: MusicTrack) => Promise<void>;
  downloadedTrackIds: string[];
  downloadTrack: (trackId: string) => Promise<void>;

  // realtime
  notifications: { id: string; message: string; kind: 'info' | 'success' | 'warning' }[];
  dismissNotification: (id: string) => void;

  openTrackActionSheet: (trackId: string) => void;
  closeTrackActionSheet: () => void;
  goToActionArtist: () => void;
  goToActionAlbum: () => void;
  openCurrentTrackPlaylistSheet: () => void;
  openPlaylistPicker: () => void;
  openPlayerSheetFromMiniPlayer: () => void;
  closeTrackDetail: () => void;
  handleMiniPlayerLayout: (event: import('react-native').LayoutChangeEvent) => void;
  handleDetailTouchStart: (event: import('react-native').GestureResponderEvent) => void;
  handleDetailTouchMove: (event: import('react-native').GestureResponderEvent) => void;
  handleDetailTouchEnd: (event: import('react-native').GestureResponderEvent) => void;
  handleDetailTouchCancel: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const completedTrackRef = useRef('');

  const [themeMode, setThemeMode] = useState<ThemeMode>(
    systemColorScheme === 'light' ? 'light' : 'dark',
  );
  const [view, setView] = useState<AuthView>('landing');
  const [activePanel, setActivePanel] = useState<ActivePanel>('flow');
  const [session, setSession] = useState<SessionState | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [cropImage, setCropImage] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [libraryTracks, setLibraryTracks] = useState<MusicTrack[]>(fallbackTracks);
  const [favoriteTracks, setFavoriteTracks] = useState<MusicTrack[]>([]);
  const [recentTracks, setRecentTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artists, setArtists] = useState<Artist[]>(buildArtistsFromTracks(fallbackTracks));
  const [singers, setSingers] = useState<Singer[]>([]);
  const [lyricists, setLyricists] = useState<Lyricist[]>([]);
  const [albums, setAlbums] = useState<Album[]>(buildAlbumsFromTracks(fallbackTracks));
  const [languages, setLanguages] = useState<Language[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTrackDetailOpen, setIsTrackDetailOpen] = useState(false);
  const [isPlaylistPickerOpen, setIsPlaylistPickerOpen] = useState(false);
  const [isTrackActionSheetOpen, setIsTrackActionSheetOpen] = useState(false);
  const [actionSheetMode, setActionSheetMode] = useState<'actions' | 'playlists'>('actions');
  const [actionTrackId, setActionTrackId] = useState('');
  const [addToPlaylistId, setAddToPlaylistId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState(fallbackTracks[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [progress, setProgress] = useState(0);
  const [soundPosition, setSoundPosition] = useState(0);
  const [soundDuration, setSoundDuration] = useState(fallbackTracks[0].durationMs ?? 0);
  const [durationByTrackId, setDurationByTrackId] = useState<Record<string, string>>({});
  const [progressTrackWidth, setProgressTrackWidth] = useState(1);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('library');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    profileName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [resetForm, setResetForm] = useState({ newPassword: '' });
  const [otpForm, setOtpForm] = useState({ email: '', otp: '' });
  const [otpStep, setOtpStep] = useState<'email' | 'verify'>('email');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [isDeleteAccountConfirming, setIsDeleteAccountConfirming] = useState(false);
  const [likedPulseTrackId, setLikedPulseTrackId] = useState('');
  const [detailEntity, setDetailEntity] = useState<DetailEntity | null>(null);
  const [isEntityDetailOpen, setIsEntityDetailOpen] = useState(false);
  const [isQueueViewOpen, setIsQueueViewOpen] = useState(false);
  const [downloadedTrackIds, setDownloadedTrackIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; message: string; kind: 'info' | 'success' | 'warning' }[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profileForm, setProfileForm] = useState({
    profileName: '',
    birthday: '',
    language: 'en',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  });

  // Animated values
  const tabSwitchAnim = useRef(new Animated.Value(0)).current;
  const contentSwitchAnim = useRef(new Animated.Value(1)).current;
  const likeScaleAnim = useRef(new Animated.Value(1)).current;
  const miniPlayerDragY = useRef(new Animated.Value(0)).current;
  const playerSheetY = useRef(new Animated.Value(collapsedPlayerTop)).current;
  const playerSheetOpacity = useRef(new Animated.Value(0)).current;
  const detailTrackSwipeX = useRef(new Animated.Value(0)).current;
  const detailTrackSwipeOpacity = useRef(new Animated.Value(1)).current;
  const miniPlayerTopYRef = useRef(collapsedPlayerTop);
  const miniPlayerRef = useRef<import('react-native').View>(null);
  const detailTouchStartX = useRef(0);
  const detailTouchStartY = useRef(0);
  const isDetailTouchDragging = useRef(false);
  const isDetailTrackSwiping = useRef(false);

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
      const artist = artists.find((c) => c.id === selectedPlaylistId.slice(7));
      return artist?.tracks.length ? artist.tracks : libraryTracks;
    }
    if (selectedPlaylistId.startsWith('singer:')) {
      const singer = singers.find((c) => c.id === selectedPlaylistId.slice(7));
      return singer?.tracks.length ? singer.tracks : libraryTracks;
    }
    if (selectedPlaylistId.startsWith('lyricist:')) {
      const lyricist = lyricists.find((c) => c.id === selectedPlaylistId.slice(9));
      return lyricist?.tracks.length ? lyricist.tracks : libraryTracks;
    }
    if (selectedPlaylistId.startsWith('album:')) {
      const album = albums.find((c) => c.id === selectedPlaylistId.slice(6));
      return album?.tracks.length ? album.tracks : libraryTracks;
    }
    if (selectedPlaylistId.startsWith('language:')) {
      const lang = languages.find((c) => c.id === selectedPlaylistId.slice(9));
      return lang?.tracks.length ? lang.tracks : libraryTracks;
    }
    if (selectedPlaylistId === 'favorites') {
      return favoriteTracks.length ? favoriteTracks : libraryTracks;
    }
    if (selectedPlaylistId === 'recent') {
      return recentTracks.length ? recentTracks : libraryTracks;
    }
    if (selectedPlaylistId.startsWith('mood:')) {
      const mood = selectedPlaylistId.slice(5).toLowerCase();
      return libraryTracks.filter((t) => t.mood?.toLowerCase() === mood);
    }
    if (selectedPlaylistId.startsWith('genre:')) {
      const genre = selectedPlaylistId.slice(6).toLowerCase();
      return libraryTracks.filter((t) => t.genre?.toLowerCase() === genre);
    }
    const playlist = playlists.find((c) => c.id === selectedPlaylistId);
    if (playlist) return playlist.tracks.length ? playlist.tracks : libraryTracks;
    return libraryTracks;
  }, [albums, artists, favoriteTracks, languages, libraryTracks, lyricists, playlists, recentTracks, selectedPlaylistId, singers]);

  const visibleTracks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return activePanel === 'search' ? [] : currentTracks;
    if (activePanel === 'search' && searchResults.length) return searchResults;
    return currentTracks.filter((track) =>
      [track.title, track.artist, track.album, track.mood].join(' ').toLowerCase().includes(query),
    );
  }, [activePanel, currentTracks, searchQuery, searchResults]);

  const selectedTrack = useMemo(
    () => libraryTracks.find((track) => track.id === selectedTrackId) ?? fallbackTracks[0],
    [libraryTracks, selectedTrackId],
  );

  const selectedPlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId) ?? null,
    [playlists, selectedPlaylistId],
  );

  const selectedSourceLabel = useMemo(() => {
    if (selectedPlaylistId.startsWith('artist:')) {
      const artist = artists.find((c) => c.id === selectedPlaylistId.slice(7));
      return artist ? `Artist: ${artist.name}` : 'Artist';
    }
    if (selectedPlaylistId.startsWith('singer:')) {
      const singer = singers.find((c) => c.id === selectedPlaylistId.slice(7));
      return singer ? `Singer: ${singer.name}` : 'Singer';
    }
    if (selectedPlaylistId.startsWith('lyricist:')) {
      const lyricist = lyricists.find((c) => c.id === selectedPlaylistId.slice(9));
      return lyricist ? `Lyricist: ${lyricist.name}` : 'Lyricist';
    }
    if (selectedPlaylistId.startsWith('album:')) {
      const album = albums.find((c) => c.id === selectedPlaylistId.slice(6));
      return album ? `Album: ${album.title}` : 'Album';
    }
    if (selectedPlaylistId.startsWith('language:')) {
      const lang = languages.find((c) => c.id === selectedPlaylistId.slice(9));
      return lang ? `Language: ${lang.name}` : 'Language';
    }
    if (selectedPlaylistId === 'favorites') return 'Liked Songs';
    if (selectedPlaylistId === 'recent') return 'Recent Plays';
    if (selectedPlaylistId.startsWith('mood:')) return `Mood: ${selectedPlaylistId.slice(5)}`;
    if (selectedPlaylistId.startsWith('genre:')) return `Genre: ${selectedPlaylistId.slice(6)}`;
    return selectedPlaylist?.name ?? 'Library';
  }, [albums, artists, languages, lyricists, selectedPlaylist, selectedPlaylistId, singers]);

  const addTargetPlaylist = selectedPlaylist ?? playlists[0] ?? null;
  const detailAddTargetPlaylist = playlists.find((p) => p.id === addToPlaylistId) ?? playlists[0] ?? null;
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
  const isSelectedTrackLiked = favoriteTracks.some((track) => track.id === selectedTrackId);
  const actionTrack = useMemo(
    () =>
      libraryTracks.find((t) => t.id === actionTrackId) ??
      currentTracks.find((t) => t.id === actionTrackId) ??
      null,
    [actionTrackId, currentTracks, libraryTracks],
  );
  const actionArtist = useMemo(
    () => (actionTrack ? artists.find((a) => a.name === actionTrack.artist) ?? null : null),
    [actionTrack, artists],
  );
  const actionAlbum = useMemo(
    () =>
      actionTrack
        ? albums.find((a) => a.title === actionTrack.album && a.artist === actionTrack.artist) ?? null
        : null,
    [actionTrack, albums],
  );
  const queuePreviewTracks = queueItems.length
    ? queueItems.map((qi) => qi.track)
    : currentTracks.filter((t) => t.id !== selectedTrack.id);

  const activeTabIndex = bottomTabs.findIndex((tab) => tab.id === activePanel);
  const bottomTabWidth = (screenWidth - 16) / bottomTabs.length;
  const tabIndicatorTranslateX = tabSwitchAnim.interpolate({
    inputRange: bottomTabs.map((_, i) => i),
    outputRange: bottomTabs.map((_, i) => i * bottomTabWidth),
  });

  const audioSource = useMemo<AudioSource>(
    () => getAudioSourceForTrack(selectedTrack, session),
    [selectedTrack, session],
  );
  const player = useAudioPlayer(audioSource, { updateInterval: 500 });
  const playerStatus = useAudioPlayerStatus(player);
  const isSoundLoading = Boolean(session && (!playerStatus.isLoaded || playerStatus.isBuffering));

  const googleEnabled = useMemo(
    () => Boolean(googleWebClientId.trim() || googleIosClientId.trim() || googleAndroidClientId.trim()),
    [],
  );

  const [googleRequest, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest(
    {
      webClientId: googleWebClientId || undefined,
      iosClientId: googleIosClientId || undefined,
      androidClientId: googleAndroidClientId || undefined,
      scopes: ['openid', 'profile', 'email'],
      selectAccount: true,
    },
    { scheme: 'sonik' },
  );

  // ─── Helper functions ────────────────────────────────────────────────────────

  function clearFeedback() {
    setErrorMessage('');
    setNoticeMessage('');
  }

  function handleApiError(error: unknown) {
    setErrorMessage(getFriendlyError(error, view));
  }

  function authHeaders(activeSession = session): Record<string, string> {
    return activeSession ? { Authorization: `Bearer ${activeSession.accessToken}` } : {};
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
    if (!activeSession) return;

    const [favoritesPayload, recentPayload, playlistsPayload, queuePayload] = await Promise.all([
      requestAuthorizedJson<TracksResponse>('/tracks/favorites/me', undefined, activeSession),
      requestAuthorizedJson<TracksResponse>('/tracks/recent/me', undefined, activeSession),
      requestAuthorizedJson<PlaylistsResponse>('/playlists', undefined, activeSession),
      requestAuthorizedJson<QueueResponse>('/tracks/queue/me', undefined, activeSession),
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
      nextPlaylists.some((p) => p.id === current)
        ? current
        : 'library',
    );
  }

  function updatePlaybackStatus() {
    if (!playerStatus.isLoaded) return;

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
          : { ...current, [selectedTrackId]: runtimeLabel },
      );
    }

    if (playerStatus.didJustFinish && completedTrackRef.current !== selectedTrackId) {
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
    const prog = 1 - sheetY / Math.max(miniPlayerTopYRef.current, 1);
    playerSheetOpacity.setValue(Math.max(0.18, Math.min(1, prog * 1.35)));
  }

  function openPlayerSheetFromMiniPlayer() {
    measureMiniPlayerTop((topY) => openPlayerSheet(topY));
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

  function handleMiniPlayerLayout(event: import('react-native').LayoutChangeEvent) {
    miniPlayerTopYRef.current = event.nativeEvent.layout.y;
    if (!isTrackDetailOpen) {
      playerSheetY.setValue(miniPlayerTopYRef.current);
    }
  }

  function getPrimaryTouch(event: import('react-native').GestureResponderEvent) {
    return event.nativeEvent.touches[0] ?? event.nativeEvent.changedTouches[0] ?? null;
  }

  function settleTrackDetailSheet() {
    Animated.parallel([
      Animated.spring(playerSheetY, { toValue: 0, friction: 7, tension: 120, useNativeDriver: true }),
      Animated.timing(playerSheetOpacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }

  function handleDetailTouchStart(event: import('react-native').GestureResponderEvent) {
    const touch = getPrimaryTouch(event);
    if (!touch) return;
    detailTouchStartX.current = touch.pageX;
    detailTouchStartY.current = touch.pageY;
    isDetailTouchDragging.current = false;
    isDetailTrackSwiping.current = false;
  }

  function handleDetailTouchMove(event: import('react-native').GestureResponderEvent) {
    const touch = getPrimaryTouch(event);
    if (!touch) return;
    const dx = touch.pageX - detailTouchStartX.current;
    const dy = touch.pageY - detailTouchStartY.current;

    if (dy <= 6 || Math.abs(dy) <= Math.abs(dx)) {
      if (currentTracks.length > 1 && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        isDetailTrackSwiping.current = true;
        detailTrackSwipeX.setValue(Math.max(-42, Math.min(42, dx * 0.18)));
      }
      return;
    }

    isDetailTouchDragging.current = true;
    playerSheetY.setValue(Math.max(0, dy));
  }

  function handleDetailTouchEnd(event: import('react-native').GestureResponderEvent) {
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

    if (!isDetailTouchDragging.current) return;
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
    if (!isDetailTouchDragging.current) return;
    isDetailTouchDragging.current = false;
    settleTrackDetailSheet();
  }

  function resetDetailTrackSwipe() {
    Animated.parallel([
      Animated.spring(detailTrackSwipeX, { toValue: 0, friction: 8, tension: 130, useNativeDriver: true }),
      Animated.timing(detailTrackSwipeOpacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }

  function swipeDetailTrack(direction: 'next' | 'previous') {
    if (currentTracks.length <= 1) {
      resetDetailTrackSwipe();
      return;
    }
    const currentIndex = currentTracks.findIndex((t) => t.id === selectedTrackId);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = direction === 'next' ? fallbackIndex + 1 : fallbackIndex - 1;

    if (nextIndex < 0 || nextIndex >= currentTracks.length) {
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
      selectTrack(currentTracks[nextIndex].id, true);
      detailTrackSwipeX.setValue(enterX);
      detailTrackSwipeOpacity.setValue(0.45);
      Animated.parallel([
        Animated.spring(detailTrackSwipeX, { toValue: 0, friction: 8, tension: 135, useNativeDriver: true }),
        Animated.timing(detailTrackSwipeOpacity, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }

  const miniPlayerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy < -12 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2,
      onPanResponderGrant: () => {
        playerSheetOpacity.stopAnimation();
        playerSheetOpacity.setValue(0.18);
        measureMiniPlayerTop((topY) => playerSheetY.setValue(topY));
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

  function openPlaylistPicker() {
    if (detailAddTargetPlaylist) setAddToPlaylistId(detailAddTargetPlaylist.id);
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
    setDetailEntity({ kind: 'artist', id: artistId });
    setIsEntityDetailOpen(true);
  }

  function selectAlbum(albumId: string) {
    setDetailEntity({ kind: 'album', id: albumId });
    setIsEntityDetailOpen(true);
  }

  function selectLanguage(languageId: string) {
    setDetailEntity({ kind: 'language', id: languageId });
    setIsEntityDetailOpen(true);
  }

  function selectSinger(singerId: string) {
    setDetailEntity({ kind: 'singer', id: singerId });
    setIsEntityDetailOpen(true);
  }

  function selectLyricist(lyricistId: string) {
    setDetailEntity({ kind: 'lyricist', id: lyricistId });
    setIsEntityDetailOpen(true);
  }

  function openEntityDetail(kind: DetailEntityKind, id: string) {
    setDetailEntity({ kind, id });
    setIsEntityDetailOpen(true);
  }

  function closeEntityDetail() {
    setIsEntityDetailOpen(false);
  }

  function playEntityTracks(kind: DetailEntityKind, id: string) {
    if (kind === 'artist') setSelectedPlaylistId(`artist:${id}`);
    else if (kind === 'album') setSelectedPlaylistId(`album:${id}`);
    else if (kind === 'singer') setSelectedPlaylistId(`singer:${id}`);
    else if (kind === 'language') setSelectedPlaylistId(`language:${id}`);
    else setSelectedPlaylistId(`lyricist:${id}`);
    setSearchQuery('');
    setActivePanel('flow');
    setIsEntityDetailOpen(false);
    setProgress(0);
    setSoundPosition(0);
    setIsPlaying(false);
  }

  async function removeQueueItem(queueItemId: string) {
    if (!session) return;
    try {
      const payload = await requestAuthorizedJson<QueueResponse>(
        `/tracks/queue/${queueItemId}`,
        { method: 'DELETE' },
      );
      setQueueItems(payload.queue.map(normalizeQueueItem));
    } catch (error) {
      handleApiError(error);
    }
  }

  async function clearAllQueue() {
    if (!session) return;
    try {
      await requestAuthorizedJson<QueueResponse>('/tracks/queue/me', { method: 'DELETE' });
      setQueueItems([]);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function updatePlaylistName(playlistId: string, name: string) {
    if (!session || !name.trim()) return;
    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>(
        `/playlists/${playlistId}`,
        { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) },
      );
      const playlist = normalizePlaylist(payload.playlist);
      setPlaylists((current) => current.map((p) => (p.id === playlist.id ? playlist : p)));
    } catch (error) {
      handleApiError(error);
    }
  }

  function selectNextTrack() {
    const queuedItem = queueItems[0];
    if (queuedItem) {
      setQueueItems((current) => current.filter((item) => item.id !== queuedItem.id));
      void requestAuthorizedJson<QueueResponse>(`/tracks/queue/${queuedItem.id}`, { method: 'DELETE' })
        .then((payload) => setQueueItems(payload.queue.map(normalizeQueueItem)))
        .catch(() => undefined);
      selectTrack(queuedItem.track.id, true);
      return;
    }

    if (!currentTracks.length) return;

    if (isShuffle && currentTracks.length > 1) {
      const nextChoices = currentTracks.filter((t) => t.id !== selectedTrackId);
      const nextTrack = nextChoices[Math.floor(Math.random() * nextChoices.length)];
      selectTrack(nextTrack.id, true);
      return;
    }

    const currentIndex = currentTracks.findIndex((t) => t.id === selectedTrackId);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= currentTracks.length && repeatMode === 'off') {
      setIsPlaying(false);
      return;
    }

    selectTrack(currentTracks[nextIndex % currentTracks.length].id, true);
  }

  function selectPreviousTrack() {
    if (!currentTracks.length) return;
    const currentIndex = currentTracks.findIndex((t) => t.id === selectedTrackId);
    const previousTrack = currentTracks[(currentIndex - 1 + currentTracks.length) % currentTracks.length];
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
    const nextPosition = Math.round(Math.max(0, Math.min(1, ratio)) * soundDuration);
    setSoundPosition(nextPosition);
    setProgress(soundDuration ? (nextPosition / soundDuration) * 100 : 0);
    await player.seekTo(nextPosition / 1000);
  }

  async function toggleLikeTrack(trackId: string) {
    if (!session) return;
    const isFavorite = favoriteTracks.some((t) => t.id === trackId);
    try {
      if (isFavorite) {
        await requestAuthorizedJson(`/tracks/${trackId}/favorite`, { method: 'DELETE' });
        setFavoriteTracks((current) => current.filter((t) => t.id !== trackId));
      } else {
        await requestAuthorizedJson(`/tracks/${trackId}/favorite`, { method: 'POST' });
        const track = libraryTracks.find((c) => c.id === trackId);
        if (track) setFavoriteTracks((current) => [track, ...current]);
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
      Animated.spring(likeScaleAnim, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
    ]).start(() => setLikedPulseTrackId(''));
    void toggleLikeTrack(trackId);
  }

  async function createPlaylist() {
    const name = newPlaylistName.trim();
    if (!session || !name) return;
    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>('/playlists', {
        method: 'POST',
        body: JSON.stringify({ name }),
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
    if (!session) return;
    try {
      await requestAuthorizedJson(`/playlists/${playlistId}`, { method: 'DELETE' });
      setPlaylists((current) => {
        const nextPlaylists = current.filter((p) => p.id !== playlistId);
        if (selectedPlaylistId === playlistId) setSelectedPlaylistId('library');
        return nextPlaylists;
      });
    } catch (error) {
      handleApiError(error);
    }
  }

  async function addTrackToPlaylist(trackId: string, playlistId?: string) {
    const targetPlaylist = playlistId
      ? playlists.find((p) => p.id === playlistId)
      : addTargetPlaylist;

    if (!session || !targetPlaylist) return;

    if (targetPlaylist.tracks.some((t) => t.id === trackId)) {
      setAddToPlaylistId(targetPlaylist.id);
      setIsPlaylistPickerOpen(false);
      closeTrackActionSheet();
      return;
    }

    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>(
        `/playlists/${targetPlaylist.id}/tracks/${trackId}`,
        { method: 'POST' },
      );
      const playlist = normalizePlaylist(payload.playlist);
      setPlaylists((current) => current.map((c) => (c.id === playlist.id ? playlist : c)));
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

  async function downloadTrack(trackId: string) {
    const track = libraryTracks.find((t) => t.id === trackId) ?? currentTracks.find((t) => t.id === trackId);
    if (!track?.streamUrl) return;
    const FileSystem = await import('expo-file-system/legacy');
    const fullUrl = track.streamUrl.startsWith('http') ? track.streamUrl : `${apiBaseUrl}${track.streamUrl}`;
    const fileName = `${track.title} - ${track.artist}.ogg`.replace(/[/\\?%*:|"<>]/g, '_');
    const dest = `${FileSystem.documentDirectory}downloads/${fileName}`;
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}downloads`, { intermediates: true });
    const { status } = await FileSystem.downloadAsync(fullUrl, dest);
    if (status === 200) {
      const updated = [...downloadedTrackIds.filter((id) => id !== trackId), trackId];
      setDownloadedTrackIds(updated);
      void AsyncStorage.setItem(downloadsStorageKey, JSON.stringify(updated));
    }
  }

  useEffect(() => {
    const socket = io(`${apiBaseUrl}/realtime`, {
      transports: ['websocket'],
      autoConnect: true,
    });
    socketRef.current = socket;

    function pushNotification(message: string, kind: 'info' | 'success' | 'warning') {
      const id = `${Date.now()}-${Math.random()}`;
      setNotifications((c) => [...c, { id, message, kind }]);
      setTimeout(() => setNotifications((c) => c.filter((n) => n.id !== id)), 5000);
    }

    socket.on('track:deleted', (event: { trackId: string }) => {
      setLibraryTracks((c) => c.filter((t) => t.id !== event.trackId));
      setFavoriteTracks((c) => c.filter((t) => t.id !== event.trackId));
      setRecentTracks((c) => c.filter((t) => t.id !== event.trackId));
    });
    socket.on('track:added', (event: { track: Record<string, unknown> }) => {
      const track = normalizeTrack(event.track as Parameters<typeof normalizeTrack>[0]);
      setLibraryTracks((c) => uniqueTracksById([track, ...c]));
    });
    socket.on('track:updated', (event: { track: Record<string, unknown> }) => {
      const track = normalizeTrack(event.track as Parameters<typeof normalizeTrack>[0]);
      const replace = (list: MusicTrack[]) => list.map((t) => (t.id === track.id ? track : t));
      setLibraryTracks((c) => replace(c));
      setFavoriteTracks((c) => replace(c));
      setRecentTracks((c) => replace(c));
    });
    socket.on('notification', (event: { message: string; kind: 'info' | 'success' | 'warning' }) => {
      pushNotification(event.message, event.kind);
    });

    return () => { socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissNotification(id: string) {
    setNotifications((c) => c.filter((n) => n.id !== id));
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
    if (!session) return;
    try {
      const payload = await requestAuthorizedJson<QueueActionResponse>(
        `/tracks/${trackId}/queue`,
        { method: 'POST', body: JSON.stringify({ mode }) },
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
    if (!actionArtist) return;
    selectArtist(actionArtist.id);
    closeTrackActionSheet();
    closeTrackDetail();
  }

  function goToActionAlbum() {
    if (!actionAlbum) return;
    selectAlbum(actionAlbum.id);
    closeTrackActionSheet();
    closeTrackDetail();
  }

  async function createPlaylistAndAddCurrentTrack(trackId = selectedTrackId) {
    const name = newPlaylistName.trim();
    if (!session || !name) return;
    try {
      const createPayload = await requestAuthorizedJson<PlaylistResponse>('/playlists', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const createdPlaylist = normalizePlaylist(createPayload.playlist);
      setPlaylists((current) => [createdPlaylist, ...current]);
      setSelectedPlaylistId(createdPlaylist.id);
      setAddToPlaylistId(createdPlaylist.id);
      setNewPlaylistName('');

      const addPayload = await requestAuthorizedJson<PlaylistResponse>(
        `/playlists/${createdPlaylist.id}/tracks/${trackId}`,
        { method: 'POST' },
      );
      const playlistWithTrack = normalizePlaylist(addPayload.playlist);
      setPlaylists((current) =>
        current.map((c) => (c.id === playlistWithTrack.id ? playlistWithTrack : c)),
      );
      setIsPlaylistPickerOpen(false);
      closeTrackActionSheet();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function removeTrackFromPlaylist(playlistId: string, trackId: string) {
    if (!session) return;
    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>(
        `/playlists/${playlistId}/tracks/${trackId}`,
        { method: 'DELETE' },
      );
      const playlist = normalizePlaylist(payload.playlist);
      setPlaylists((current) => current.map((c) => (c.id === playlist.id ? playlist : c)));
    } catch (error) {
      handleApiError(error);
    }
  }

  async function recordCurrentPlay(completed: boolean) {
    if (!session || !selectedTrack.streamUrl) return;
    await requestAuthorizedJson(`/tracks/${selectedTrack.id}/recent`, {
      method: 'POST',
      body: JSON.stringify({ progressSeconds: Math.floor(soundPosition / 1000), completed }),
    }).catch(() => undefined);
    await refreshPersonalLibrary().catch(() => undefined);
  }

  async function persistSession(nextSession: SessionState) {
    await AsyncStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
    setSession(nextSession);
    setLoginForm({ email: '', password: '' });
    setRegisterForm({ profileName: '', email: '', password: '', confirmPassword: '' });
    setResetForm({ newPassword: '' });
    setOtpForm({ email: '', otp: '' });
    setPasswordForm({ currentPassword: '', newPassword: '' });
  }

  async function handleLogin() {
    clearFeedback();
    setIsSubmitting(true);
    try {
      const payload = await requestJson<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });
      await persistSession({ accessToken: payload.accessToken, tokenType: payload.tokenType, user: payload.user });
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
      await persistSession({ accessToken: payload.accessToken, tokenType: payload.tokenType, user: payload.user });
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
      if (emailStatus === 'taken') return;
    }
    setIsSubmitting(true);
    try {
      const payload = await requestJson<{ message: string; devOtp?: string }>('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: otpForm.email, purpose }),
      });
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
      await persistSession({ accessToken: payload.accessToken, tokenType: payload.tokenType, user: payload.user });
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
      const payload = await requestJson<AuthResponse>('/auth/verify-otp-reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: otpForm.email, otp: otpForm.otp, newPassword: resetForm.newPassword }),
      });
      await persistSession({ accessToken: payload.accessToken, tokenType: payload.tokenType, user: payload.user });
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateProfile() {
    if (!session) return;
    setIsSubmitting(true);
    clearFeedback();
    try {
      const response = await fetch(`${apiBaseUrl}/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify(profileForm),
      });
      if (!response.ok) throw new Error('Could not update profile');
      const data = await response.json();
      setSession({ ...session, user: data.user });
      setNoticeMessage('Profile updated successfully! ✨');
      setTimeout(() => { setIsSettingsOpen(false); setNoticeMessage(''); }, 1500);
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
      await requestJson('/auth/change-password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify(passwordForm),
      });
      setNoticeMessage('Password changed successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '' });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setErrorMessage('Current password is incorrect.');
      } else {
        handleApiError(error);
      }
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
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) throw new Error('Could not delete account');
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
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setErrorMessage('Permission to access photos is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setCropImage({ uri: asset.uri, width: asset.width, height: asset.height });
    } catch (error) {
      handleApiError(error);
    }
  }

  async function handleCropSave(croppedUri: string) {
    if (!session) return;
    setCropImage(null);
    try {
      const filename = `avatar-${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append('avatar', { uri: croppedUri, name: filename, type: 'image/jpeg' } as any);
      setIsSubmitting(true);
      clearFeedback();
      const response = await fetch(`${apiBaseUrl}/auth/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: formData,
      });
      if (!response.ok) throw new Error('Avatar upload failed');
      const data = await response.json();
      // Persist the server URL to storage for restarts, but show the local cropped URI immediately
      await AsyncStorage.setItem(sessionStorageKey, JSON.stringify({ ...session, user: data.user }));
      setSession({ ...session, user: { ...data.user, avatarUrl: croppedUri } });
      setNoticeMessage('Avatar updated successfully!');
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCropCancel() {
    setCropImage(null);
  }

  async function handleGoogleToken(idToken: string) {
    clearFeedback();
    setIsSubmitting(true);
    try {
      const payload = await requestJson<AuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      await persistSession({ accessToken: payload.accessToken, tokenType: payload.tokenType, user: payload.user });
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
    setLoginForm({ email: '', password: '' });
    setRegisterForm({ profileName: '', email: '', password: '', confirmPassword: '' });
    setResetForm({ newPassword: '' });
    setOtpForm({ email: '', otp: '' });
    setProfileForm({ profileName: '', birthday: '', language: 'en' });
    setPasswordForm({ currentPassword: '', newPassword: '' });
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

  // ─── Effects ─────────────────────────────────────────────────────────────────

  async function loadLibrary() {
    const [tracksPayload, artistsPayload, singersPayload, lyricistsPayload, albumsPayload, languagesPayload] =
      await Promise.all([
        requestJson<TracksResponse>('/tracks'),
        requestJson<ArtistsResponse>('/tracks/artists').catch(() => null),
        requestJson<{ singers: ApiSinger[] }>('/people/singers').catch(() => null),
        requestJson<{ lyricists: ApiLyricist[] }>('/people/lyricists').catch(() => null),
        requestJson<AlbumsResponse>('/tracks/albums').catch(() => null),
        requestJson<LanguagesResponse>('/tracks/languages').catch(() => null),
      ]);
    if (!tracksPayload.tracks.length) return;
    const nextTracks = tracksPayload.tracks.map(normalizeTrack);
    setLibraryTracks(nextTracks);
    setArtists(
      artistsPayload?.artists.length
        ? artistsPayload.artists.map(normalizeArtist)
        : buildArtistsFromTracks(nextTracks),
    );
    if (singersPayload?.singers) setSingers(singersPayload.singers.map(normalizeSinger));
    if (lyricistsPayload?.lyricists) setLyricists(lyricistsPayload.lyricists.map(normalizeLyricist));
    setAlbums(
      albumsPayload?.albums.length
        ? albumsPayload.albums.map(normalizeAlbum)
        : buildAlbumsFromTracks(nextTracks),
    );
    setLanguages(
      languagesPayload?.languages.length
        ? languagesPayload.languages.map(normalizeLanguage)
        : buildLanguagesFromTracks(nextTracks),
    );
    setSelectedTrackId(nextTracks[0].id);
    setProgress(0);
    setSoundPosition(0);
    setSoundDuration(nextTracks[0].durationMs ?? 0);
    setIsPlaying(false);
  }

  async function refreshLibrary() {
    setIsRefreshing(true);
    try {
      await loadLibrary();
    } catch {
      setNoticeMessage('Could not refresh library.');
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadLibrary()
      .catch(() => setNoticeMessage('Local tracks could not be loaded from the backend yet.'));
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(themeStorageKey).then((storedTheme) => {
      if (storedTheme === 'light' || storedTheme === 'dark') setThemeMode(storedTheme);
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(downloadsStorageKey).then((stored) => {
      if (stored) {
        try { setDownloadedTrackIds(JSON.parse(stored) as string[]); } catch {}
      }
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(themeStorageKey, themeMode);
  }, [themeMode]);

  useEffect(() => {
    void AsyncStorage.getItem(sessionStorageKey)
      .then(async (storedSession) => {
        if (!storedSession) return;
        const parsedSession = JSON.parse(storedSession) as SessionState;
        const payload = await requestJson<{ user: SessionUser }>('/auth/me', {
          headers: { Authorization: `Bearer ${parsedSession.accessToken}` },
        });
        setSession({ ...parsedSession, user: payload.user });
        setProfileForm({
          profileName: payload.user.profileName,
          birthday: payload.user.birthday || '',
          language: payload.user.language || 'en',
        });
      })
      .catch(() => void AsyncStorage.removeItem(sessionStorageKey))
      .finally(() => setIsBootstrapping(false));
  }, []);

  useEffect(() => {
    if (!session) return;
    void refreshPersonalLibrary(session);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshPersonalLibrary(session);
      }
    });
    return () => sub.remove();
  }, [session]);

  useEffect(() => {
    if (!playlists.length) {
      setAddToPlaylistId('');
      return;
    }
    setAddToPlaylistId((current) =>
      playlists.some((p) => p.id === current) ? current : playlists[0].id,
    );
  }, [playlists]);

  useEffect(() => {
    if (!currentTracks.length) return;
    if (!currentTracks.some((t) => t.id === selectedTrackId)) {
      setSelectedTrackId(currentTracks[0].id);
      setIsPlaying(false);
    }
  }, [currentTracks, selectedTrackId]);

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = googleResponse.params.id_token || googleResponse.authentication?.idToken;
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
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', shouldPlayInBackground: true });
  }, []);

  useEffect(() => {
    if (session && !audioSource) {
      setErrorMessage('This track does not have a backend audio file yet.');
    }
  }, [audioSource, session]);

  useEffect(() => {
    if (!session || !audioSource) return;
    if (isPlaying) {
      player.play();
      return;
    }
    player.pause();
  }, [audioSource, isPlaying, player, session]);

  useEffect(() => {
    if (!session || !playerStatus.isLoaded) return;
    updatePlaybackStatus();
  }, [
    playerStatus.currentTime,
    playerStatus.didJustFinish,
    playerStatus.duration,
    playerStatus.isLoaded,
    playerStatus.playing,
    session,
  ]);

  useEffect(() => {
    completedTrackRef.current = '';
    setProgress(0);
    setSoundPosition(0);
    setSoundDuration(selectedTrack.durationMs ?? 0);
  }, [selectedTrack.durationMs, selectedTrack.id]);

  useEffect(() => {
    if (activePanel !== 'search' || !session) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const resp = await fetch(
          `${apiBaseUrl}/tracks/search?q=${encodeURIComponent(query)}&limit=30`,
          { headers: { Authorization: `Bearer ${session.accessToken}` } },
        );
        const payload = (await resp.json()) as TracksResponse;
        setSearchResults(payload.tracks.map(normalizeTrack));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, activePanel, session?.accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSettingsOpen) {
      setPasswordForm({ currentPassword: '', newPassword: '' });
    }
  }, [isSettingsOpen]);

  useEffect(() => {
    setPasswordForm({ currentPassword: '', newPassword: '' });
  }, [view]);

  useEffect(() => {
    if (view !== 'register-otp' || otpStep !== 'email') return;
    const email = otpForm.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus('idle');
      return;
    }
    setEmailStatus('checking');
    clearTimeout(emailCheckTimer.current);
    emailCheckTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/check-email?email=${encodeURIComponent(email)}`);
        const data = await response.json();
        setEmailStatus(data.available ? 'available' : 'taken');
      } catch {
        setEmailStatus('idle');
      }
    }, 500);
    return () => clearTimeout(emailCheckTimer.current);
  }, [otpForm.email, view, otpStep]);

  useEffect(() => {
    if (!session) return undefined;
    const tracksNeedingRuntime = currentTracks
      .filter((track) => !durationByTrackId[track.id] && (!track.duration || track.duration === '--:--'))
      .slice(0, 24);

    if (!tracksNeedingRuntime.length) return undefined;

    let isCancelled = false;
    const cleanupTasks: Array<() => void> = [];

    tracksNeedingRuntime.forEach((track) => {
      const source = getAudioSourceForTrack(track, session);
      if (!source) return;

      const metadataPlayer = createAudioPlayer(source, { updateInterval: 250 });
      let isCleanedUp = false;

      const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        metadataPlayer.remove();
      };
      const readRuntime = () => {
        const duration = Math.round((metadataPlayer.duration || 0) * 1000);
        if (!duration || isCancelled) return;
        const runtimeLabel = formatMillis(duration);
        setDurationByTrackId((current) =>
          current[track.id] === runtimeLabel ? current : { ...current, [track.id]: runtimeLabel },
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

  const value: AppContextValue = {
    theme,
    themeMode,
    styles,
    toggleThemeMode,
    session,
    isBootstrapping,
    view,
    setView,
    activePanel,
    setActivePanel,
    isSettingsOpen,
    setIsSettingsOpen,
    isTrackDetailOpen,
    isPlaylistPickerOpen,
    isTrackActionSheetOpen,
    actionSheetMode,
    setActionSheetMode,
    actionTrackId,
    addToPlaylistId,
    setAddToPlaylistId,
    isDeleteAccountConfirming,
    setIsDeleteAccountConfirming,
    searchQuery,
    setSearchQuery,
    newPlaylistName,
    setNewPlaylistName,
    libraryTracks,
    favoriteTracks,
    recentTracks,
    playlists,
    artists,
    singers,
    lyricists,
    albums,
    languages,
    queueItems,
    selectedTrackId,
    selectedTrack,
    isPlaying,
    isShuffle,
    setIsShuffle,
    repeatMode,
    progress,
    soundPosition,
    soundDuration,
    durationByTrackId,
    progressTrackWidth,
    setProgressTrackWidth,
    isSoundLoading,
    audioSource,
    currentTracks,
    visibleTracks,
    selectedPlaylistId,
    setSelectedPlaylistId,
    selectedPlaylist,
    selectedSourceLabel,
    isSelectedTrackLiked,
    isSelectedTrackInDetailTarget,
    addTargetPlaylist,
    detailAddTargetPlaylist,
    selectedRuntimeLabel,
    sourceFilters,
    actionTrack,
    actionArtist,
    actionAlbum,
    queuePreviewTracks,
    likedPulseTrackId,
    miniPlayerDragY,
    playerSheetY,
    playerSheetOpacity,
    detailTrackSwipeX,
    detailTrackSwipeOpacity,
    tabSwitchAnim,
    contentSwitchAnim,
    likeScaleAnim,
    playerBackdropOpacity,
    detailInitialFadeOpacity,
    detailTopSolidOpacity,
    tabIndicatorTranslateX,
    miniPlayerRef,
    miniPlayerPanResponder,
    loginForm,
    setLoginForm,
    registerForm,
    setRegisterForm,
    resetForm,
    setResetForm,
    otpForm,
    setOtpForm,
    otpStep,
    setOtpStep,
    emailStatus,
    profileForm,
    setProfileForm,
    passwordForm,
    setPasswordForm,
    isSubmitting,
    errorMessage,
    noticeMessage,
    clearFeedback,
    googleEnabled,
    googleRequest,
    iconButtonColors,
    t,
    handleLogin,
    handleResetPassword,
    handleSendOtp,
    handleVerifyOtpForSignup,
    handleVerifyOtpForPasswordReset,
    handleGoogleToken,
    handleLogout,
    openGoogleFlow,
    handleUpdateProfile,
    handleChangePassword,
    handleDeleteAccount,
    handleUploadAvatar,
    selectTrack,
    openTrackDetail,
    togglePlayback,
    toggleRepeatMode,
    seekToRatio,
    selectNextTrack,
    selectPreviousTrack,
    handleLikePress,
    selectPlaylist,
    selectArtist,
    selectAlbum,
    selectLanguage,
    selectSinger,
    selectLyricist,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    addCurrentTrackToPlaylist,
    createPlaylistAndAddCurrentTrack,
    removeTrackFromPlaylist,
    enqueueTrack,
    shareTrack,
    downloadedTrackIds,
    downloadTrack,
    notifications,
    dismissNotification,
    openTrackActionSheet,
    closeTrackActionSheet,
    goToActionArtist,
    goToActionAlbum,
    openCurrentTrackPlaylistSheet,
    openPlaylistPicker,
    openPlayerSheetFromMiniPlayer,
    closeTrackDetail,
    handleMiniPlayerLayout,
    handleDetailTouchStart,
    handleDetailTouchMove,
    handleDetailTouchEnd,
    handleDetailTouchCancel,
    detailEntity,
    isEntityDetailOpen,
    openEntityDetail,
    closeEntityDetail,
    playEntityTracks,
    isQueueViewOpen,
    setIsQueueViewOpen,
    removeQueueItem,
    clearAllQueue,
    searchResults,
    isSearching,
    isRefreshing,
    refreshLibrary,
    updatePlaylistName,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      {cropImage && (
        <AvatarCropModal
          imageUri={cropImage.uri}
          imageWidth={cropImage.width}
          imageHeight={cropImage.height}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}
    </AppContext.Provider>
  );
}
