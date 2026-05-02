import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

// Responsive design utilities
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const isSmallScreen = screenWidth < 380;
const isMediumScreen = screenWidth >= 380 && screenWidth < 480;
const isLargeScreen = screenWidth >= 480;

const responsiveScale = (baseSize: number) => {
  if (isSmallScreen) return baseSize * 0.85;
  if (isMediumScreen) return baseSize * 0.92;
  return baseSize;
};

const defaultApiBaseUrl =
  Platform.select({
    android: 'http://10.0.2.2:4001',
    ios: 'http://localhost:4001',
    default: 'http://localhost:4001',
  }) ?? 'http://localhost:4001';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl;
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const googleAndroidClientId =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const sessionStorageKey = 'sonik.mobile.session';

type AuthView = 'login' | 'register' | 'forgot' | 'reset';
type ActivePanel = 'flow' | 'library' | 'profile';
type CoverClass = 'neon' | 'coast' | 'velvet' | 'summer' | 'blue';
type IconName = ComponentProps<typeof Ionicons>['name'];

type SessionUser = {
  id: number;
  email: string;
  profileName: string;
  authProvider: 'local' | 'google' | 'hybrid';
  googleConnected: boolean;
  createdAt: string;
  updatedAt: string;
};

type SessionState = {
  accessToken: string;
  tokenType: string;
  user: SessionUser;
};

type AuthResponse = {
  message: string;
  accessToken: string;
  tokenType: string;
  user: SessionUser;
};

type ForgotPasswordResponse = {
  message: string;
  devResetToken?: string;
  expiresAt?: string;
};

type ApiErrorPayload = {
  message?: string | string[];
};

type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationMs: number;
  plays: string;
  mood: string;
  coverClass: CoverClass;
  audio: number;
};

type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
};

class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

const tracks: MusicTrack[] = [
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
    audio: require('./assets/audio/neon-afterhours.wav'),
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
    audio: require('./assets/audio/coastal-static.wav'),
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
    audio: require('./assets/audio/velvet-signal.wav'),
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
    audio: require('./assets/audio/summer-loop.wav'),
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
    audio: require('./assets/audio/blue-hour-drive.wav'),
  },
];

const mixes = [
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

const waveformHeights = [
  32, 58, 46, 74, 38, 82, 50, 66, 42, 88, 56, 70, 36, 64, 92, 48, 78, 40,
];

const coverPalettes: Record<CoverClass, { base: string; accent: string }> = {
  neon: { base: '#5334b8', accent: '#ff5a7a' },
  coast: { base: '#214d83', accent: '#55d6c2' },
  velvet: { base: '#5b367f', accent: '#c6537b' },
  summer: { base: '#9b4f2f', accent: '#f5c15d' },
  blue: { base: '#235d72', accent: '#65a8ff' },
};

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = (await response.json().catch(() => null)) as
    | T
    | ApiErrorPayload
    | null;

  if (!response.ok) {
    const payloadMessage = (payload as ApiErrorPayload | null)?.message;
    const message = Array.isArray(payloadMessage)
      ? payloadMessage.join(', ')
      : payloadMessage;

    throw new ApiRequestError(response.status, message || 'Request failed.');
  }

  return payload as T;
}

function getFriendlyError(error: unknown, view: AuthView) {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return view === 'login'
        ? 'Email or password did not match.'
        : 'Please sign in again to continue.';
    }

    if (error.status === 409) {
      return 'An account with this email already exists.';
    }

    if (error.status === 400) {
      return 'Please check the details and try again.';
    }
  }

  return 'Sonik could not complete that action right now.';
}

function TrackArt({
  track,
  size = 'medium',
  style,
}: {
  track: Pick<MusicTrack, 'coverClass'>;
  size?: 'small' | 'medium' | 'large';
  style?: StyleProp<ViewStyle>;
}) {
  const palette = coverPalettes[track.coverClass];

  return (
    <View
      style={[
        styles.trackArt,
        size === 'small'
          ? styles.trackArtSmall
          : size === 'large'
            ? styles.trackArtLarge
            : styles.trackArtMedium,
        { backgroundColor: palette.base },
        style,
      ]}
    >
      <View style={[styles.artFrame, { borderColor: palette.accent }]} />
      <View style={[styles.artCircle, { backgroundColor: palette.accent }]} />
      <View style={styles.artLine} />
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  variant = 'ghost',
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  variant?: 'ghost' | 'solid';
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.iconButton,
        variant === 'solid' ? styles.iconButtonSolid : null,
      ]}
    >
      <Ionicons
        color={variant === 'solid' ? '#160f0b' : '#fbf7ef'}
        name={icon}
        size={variant === 'solid' ? 26 : 21}
      />
    </Pressable>
  );
}

function formatProgress(progress: number) {
  const seconds = Math.round((progress / 100) * 222);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(seconds % 60).padStart(2, '0');

  return `${minutes}:${remainingSeconds}`;
}

function formatMillis(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return `${minutes}:${seconds}`;
}

export default function App() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [view, setView] = useState<AuthView>('login');
  const [activePanel, setActivePanel] = useState<ActivePanel>('flow');
  const [session, setSession] = useState<SessionState | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState(tracks[0].id);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [soundPosition, setSoundPosition] = useState(0);
  const [soundDuration, setSoundDuration] = useState(tracks[0].durationMs);
  const [progressTrackWidth, setProgressTrackWidth] = useState(1);
  const [isSoundLoading, setIsSoundLoading] = useState(false);
  const [volume, setVolume] = useState(76);
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>([
    tracks[0].id,
    tracks[2].id,
  ]);
  const [playlists, setPlaylists] = useState<Playlist[]>([
    {
      id: 'night-crate',
      name: 'Night Crate',
      trackIds: ['neon-afterhours', 'blue-hour-drive'],
    },
    {
      id: 'focus-room',
      name: 'Focus Room',
      trackIds: ['coastal-static', 'velvet-signal'],
    },
  ]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('night-crate');
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
  const [forgotForm, setForgotForm] = useState({
    email: '',
  });
  const [resetForm, setResetForm] = useState({
    token: '',
    newPassword: '',
  });

  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === selectedTrackId) ?? tracks[0],
    [selectedTrackId],
  );
  const likedTracks = useMemo(
    () => tracks.filter((track) => likedTrackIds.includes(track.id)),
    [likedTrackIds],
  );
  const selectedPlaylist = useMemo(
    () =>
      playlists.find((playlist) => playlist.id === selectedPlaylistId) ??
      playlists[0],
    [playlists, selectedPlaylistId],
  );
  const selectedPlaylistTracks = useMemo(
    () =>
      selectedPlaylist
        ? tracks.filter((track) => selectedPlaylist.trackIds.includes(track.id))
        : [],
    [selectedPlaylist],
  );
  const isSelectedTrackLiked = likedTrackIds.includes(selectedTrackId);

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
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    });

    return () => {
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    let isMounted = true;
    const previousSound = soundRef.current;
    soundRef.current = null;
    setIsSoundLoading(true);
    setProgress(0);
    setSoundPosition(0);
    setSoundDuration(selectedTrack.durationMs);

    async function loadTrack() {
      try {
        if (previousSound) {
          await previousSound.unloadAsync();
        }

        const { sound } = await Audio.Sound.createAsync(
          selectedTrack.audio,
          {
            progressUpdateIntervalMillis: 500,
            shouldPlay: isPlaying,
            volume: volume / 100,
          },
          (status) => {
            if (isMounted) {
              updatePlaybackStatus(status);
            }
          },
        );

        if (!isMounted) {
          await sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
      } catch {
        if (isMounted) {
          setErrorMessage('This track could not be played.');
        }
      } finally {
        if (isMounted) {
          setIsSoundLoading(false);
        }
      }
    }

    void loadTrack();

    return () => {
      isMounted = false;
    };
  }, [session, selectedTrack.id]);

  useEffect(() => {
    if (!session || !soundRef.current || isSoundLoading) {
      return;
    }

    void (isPlaying
      ? soundRef.current.playAsync()
      : soundRef.current.pauseAsync());
  }, [isPlaying, isSoundLoading, session]);

  useEffect(() => {
    if (!soundRef.current) {
      return;
    }

    void soundRef.current.setVolumeAsync(volume / 100);
  }, [volume]);

  function clearFeedback() {
    setErrorMessage('');
    setNoticeMessage('');
  }

  function handleApiError(error: unknown) {
    setErrorMessage(getFriendlyError(error, view));
  }

  function updatePlaybackStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) {
      if (status.error) {
        setErrorMessage('This track could not be played.');
      }
      return;
    }

    const duration = status.durationMillis ?? selectedTrack.durationMs;
    const position = status.positionMillis ?? 0;

    setSoundPosition(position);
    setSoundDuration(duration);
    setProgress(duration ? Math.min(100, (position / duration) * 100) : 0);
    setIsPlaying(status.isPlaying);

    if (status.didJustFinish) {
      selectNextTrack();
    }
  }

  function selectTrack(trackId: string) {
    setSelectedTrackId(trackId);
    setProgress(0);
    setSoundPosition(0);
    setIsPlaying(true);
  }

  function selectNextTrack() {
    const currentIndex = tracks.findIndex((track) => track.id === selectedTrackId);
    const nextTrack = tracks[(currentIndex + 1) % tracks.length];
    selectTrack(nextTrack.id);
  }

  function selectPreviousTrack() {
    const currentIndex = tracks.findIndex((track) => track.id === selectedTrackId);
    const previousTrack =
      tracks[(currentIndex - 1 + tracks.length) % tracks.length];
    selectTrack(previousTrack.id);
  }

  async function seekToRatio(ratio: number) {
    const nextPosition = Math.round(
      Math.max(0, Math.min(1, ratio)) * soundDuration,
    );

    setSoundPosition(nextPosition);
    setProgress(soundDuration ? (nextPosition / soundDuration) * 100 : 0);
    await soundRef.current?.setPositionAsync(nextPosition);
  }

  function toggleLikeTrack(trackId: string) {
    setLikedTrackIds((current) =>
      current.includes(trackId)
        ? current.filter((likedTrackId) => likedTrackId !== trackId)
        : [...current, trackId],
    );
  }

  function createPlaylist() {
    const name = newPlaylistName.trim();

    if (!name) {
      return;
    }

    const playlist: Playlist = {
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      name,
      trackIds: [],
    };

    setPlaylists((current) => [...current, playlist]);
    setSelectedPlaylistId(playlist.id);
    setNewPlaylistName('');
  }

  function deletePlaylist(playlistId: string) {
    setPlaylists((current) => {
      const nextPlaylists = current.filter(
        (playlist) => playlist.id !== playlistId,
      );

      if (selectedPlaylistId === playlistId) {
        setSelectedPlaylistId(nextPlaylists[0]?.id ?? '');
      }

      return nextPlaylists;
    });
  }

  function addCurrentTrackToPlaylist() {
    if (!selectedPlaylist) {
      return;
    }

    setPlaylists((current) =>
      current.map((playlist) =>
        playlist.id === selectedPlaylist.id
          ? {
              ...playlist,
              trackIds: playlist.trackIds.includes(selectedTrackId)
                ? playlist.trackIds
                : [...playlist.trackIds, selectedTrackId],
            }
          : playlist,
      ),
    );
  }

  function removeTrackFromPlaylist(playlistId: string, trackId: string) {
    setPlaylists((current) =>
      current.map((playlist) =>
        playlist.id === playlistId
          ? {
              ...playlist,
              trackIds: playlist.trackIds.filter(
                (playlistTrackId) => playlistTrackId !== trackId,
              ),
            }
          : playlist,
      ),
    );
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

  async function handleRegister() {
    clearFeedback();

    if (registerForm.password !== registerForm.confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await requestJson<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          profileName: registerForm.profileName,
          email: registerForm.email,
          password: registerForm.password,
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

  async function handleForgotPassword() {
    clearFeedback();
    setIsSubmitting(true);

    try {
      const payload = await requestJson<ForgotPasswordResponse>(
        '/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify(forgotForm),
        },
      );

      if (payload.devResetToken) {
        setResetForm((current) => ({
          ...current,
          token: payload.devResetToken ?? current.token,
        }));
        setView('reset');
        setNoticeMessage('Choose a new password to finish the reset.');
      } else {
        setNoticeMessage('If the account exists, a reset link is on its way.');
      }
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
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    await AsyncStorage.removeItem(sessionStorageKey);
    setSession(null);
    setView('login');
    setActivePanel('flow');
    setResetForm({
      token: '',
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

  if (isBootstrapping) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.bootCard}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>S</Text>
          </View>
          <ActivityIndicator color="#55d6c2" />
          <Text style={styles.bootText}>Opening Sonik</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.playerScreen}>
          <ScrollView
            contentContainerStyle={styles.playerContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.appHeader}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>S</Text>
                </View>
                <Text style={styles.brandName}>Sonik</Text>
              </View>
              <Pressable style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons color="#fbf7ef" name="log-out-outline" size={20} />
              </Pressable>
            </View>

            <View style={styles.searchPill}>
              <Ionicons color="#b8afaa" name="search" size={18} />
              <Text style={styles.searchText}>Search songs, artists, moods</Text>
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

            {activePanel === 'flow' ? (
              <>
            <View style={styles.signalDeck}>
              <TrackArt track={selectedTrack} size="large" />
              <View style={styles.deckCopy}>
                <Text style={styles.eyebrow}>Playing from Flow State</Text>
                <Text style={styles.trackTitle}>{selectedTrack.title}</Text>
                <Text style={styles.trackArtist}>
                  {selectedTrack.artist} - {selectedTrack.album}
                </Text>
                <View style={styles.chipRow}>
                  <Text style={styles.chip}>{selectedTrack.mood}</Text>
                  <Text style={styles.chip}>{selectedTrack.plays} plays</Text>
                  <Text style={styles.chip}>
                    {isSoundLoading ? 'Loading audio' : 'Static audio'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.waveCard}>
              {waveformHeights.map((height, index) => (
                <View
                  key={`${height}-${index}`}
                  style={[styles.waveBar, { height }]}
                />
              ))}
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
              <Text style={styles.sectionAction}>Mood sort</Text>
            </View>
            <View style={styles.trackList}>
              {tracks.map((track, index) => {
                const isSelected = track.id === selectedTrackId;

                return (
                  <Pressable
                    key={track.id}
                    onPress={() => selectTrack(track.id)}
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
                    <Text style={styles.trackDuration}>{track.duration}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.queueCard}>
              <Text style={styles.sectionTitle}>Up next</Text>
              {tracks
                .filter((track) => track.id !== selectedTrack.id)
                .slice(0, 3)
                .map((track) => (
                  <Pressable
                    key={track.id}
                    onPress={() => selectTrack(track.id)}
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
                  <Text style={styles.sectionAction}>{likedTracks.length} saved</Text>
                </View>
                <View style={styles.trackList}>
                  {likedTracks.length ? (
                    likedTracks.map((track) => (
                      <Pressable
                        key={track.id}
                        onPress={() => selectTrack(track.id)}
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
                        <Text style={styles.trackDuration}>{track.duration}</Text>
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
                  <Text style={styles.sectionTitle}>Playlists</Text>
                  <Text style={styles.sectionAction}>{playlists.length} crates</Text>
                </View>
                <View style={styles.playlistGrid}>
                  {playlists.map((playlist) => (
                    <Pressable
                      key={playlist.id}
                      onPress={() => {
                        setSelectedPlaylistId(playlist.id);
                        setActivePanel('profile');
                      }}
                      style={styles.playlistCard}
                    >
                      <Text style={styles.playlistTitle}>{playlist.name}</Text>
                      <Text style={styles.caption}>
                        {playlist.trackIds.length} tracks
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
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{likedTracks.length}</Text>
                    <Text style={styles.statLabel}>Liked</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{playlists.length}</Text>
                    <Text style={styles.statLabel}>Playlists</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{tracks.length}</Text>
                    <Text style={styles.statLabel}>Static tracks</Text>
                  </View>
                </View>

                <View style={styles.managementCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Current track</Text>
                    <Pressable onPress={() => toggleLikeTrack(selectedTrackId)}>
                      <Ionicons
                        color={isSelectedTrackLiked ? '#ff7a59' : '#d8d0c8'}
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
                    onPress={addCurrentTrackToPlaylist}
                    style={styles.secondaryAction}
                  >
                    <Ionicons color="#fbf7ef" name="add" size={18} />
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
                      placeholderTextColor="#817873"
                      style={[styles.input, styles.playlistInput]}
                      value={newPlaylistName}
                    />
                    <Pressable onPress={createPlaylist} style={styles.addButton}>
                      <Ionicons color="#160f0b" name="add" size={22} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.managementCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Manage playlists</Text>
                    {selectedPlaylist ? (
                      <Text style={styles.sectionAction}>
                        {selectedPlaylist.trackIds.length} tracks
                      </Text>
                    ) : null}
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.playlistScroller}
                  >
                    {playlists.map((playlist) => (
                      <Pressable
                        key={playlist.id}
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
                      {selectedPlaylistTracks.length ? (
                        selectedPlaylistTracks.map((track) => (
                          <View style={styles.playlistTrackRow} key={track.id}>
                            <Pressable
                              onPress={() => selectTrack(track.id)}
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
                                color="#ff9aa5"
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
              </>
            ) : null}
          </ScrollView>

          <View style={styles.nowBar}>
            <View style={styles.nowTrack}>
              <TrackArt track={selectedTrack} size="small" />
              <View style={styles.trackMeta}>
                <Text style={styles.nowTitle} numberOfLines={1}>
                  {selectedTrack.title}
                </Text>
                <Text style={styles.trackSubtext} numberOfLines={1}>
                  {selectedTrack.artist}
                </Text>
              </View>
            </View>

            <View style={styles.transportRow}>
              <IconButton icon="shuffle" label="Shuffle" />
              <IconButton
                icon="play-skip-back"
                label="Previous track"
                onPress={selectPreviousTrack}
              />
              <IconButton
                icon={isPlaying ? 'pause' : 'play'}
                label={isPlaying ? 'Pause' : 'Play'}
                onPress={() => setIsPlaying((current) => !current)}
                variant="solid"
              />
              <IconButton
                icon="play-skip-forward"
                label="Next track"
                onPress={selectNextTrack}
              />
              <IconButton icon="repeat" label="Repeat" />
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
              <Text style={styles.progressText}>{formatMillis(soundDuration)}</Text>
            </View>

            <Pressable
              accessibilityLabel="Change volume"
              onPress={() =>
                setVolume((current) => (current >= 100 ? 20 : current + 20))
              }
              style={styles.volumeRow}
            >
              <Ionicons color="#b8afaa" name="volume-medium" size={17} />
              <View style={styles.volumeTrack}>
                <View
                  style={[
                    styles.volumeFill,
                    { width: `${volume}%` as `${number}%` },
                  ]}
                />
              </View>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const authTitle =
    view === 'login'
      ? 'Sign in to Sonik'
      : view === 'register'
        ? 'Create your account'
        : view === 'forgot'
          ? 'Reset your password'
          : 'Choose a new password';

  const authCopy =
    view === 'login'
      ? 'Your library, playlists, and playback stay in sync.'
      : view === 'register'
        ? 'Start with a personal music space built around your taste.'
        : view === 'forgot'
          ? 'We will send a secure reset link if the email is registered.'
          : 'Finish the reset and return to your music.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.accessContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.appHeader}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>S</Text>
            </View>
            <Text style={styles.brandName}>Sonik</Text>
          </View>
          <Text style={styles.headerPill}>Mobile player</Text>
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
              ['register', 'Create'],
              ['forgot', 'Reset'],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => {
                  clearFeedback();
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
                placeholderTextColor="#817873"
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
                placeholderTextColor="#817873"
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
                  setView('forgot');
                }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>Forgot password?</Text>
              </Pressable>
            </>
          ) : null}

          {view === 'register' ? (
            <>
              <TextInput
                onChangeText={(profileName) =>
                  setRegisterForm((current) => ({
                    ...current,
                    profileName,
                  }))
                }
                placeholder="Profile name"
                placeholderTextColor="#817873"
                style={styles.input}
                value={registerForm.profileName}
              />
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={(email) =>
                  setRegisterForm((current) => ({ ...current, email }))
                }
                placeholder="listener@sonik.app"
                placeholderTextColor="#817873"
                style={styles.input}
                value={registerForm.email}
              />
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
                placeholderTextColor="#817873"
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
                placeholderTextColor="#817873"
                secureTextEntry
                style={styles.input}
                value={registerForm.confirmPassword}
              />
              <Pressable
                disabled={isSubmitting}
                onPress={handleRegister}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isSubmitting ? 'Creating account' : 'Create account'}
                </Text>
              </Pressable>
            </>
          ) : null}

          {view === 'forgot' ? (
            <>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={(email) => setForgotForm({ email })}
                placeholder="listener@sonik.app"
                placeholderTextColor="#817873"
                style={styles.input}
                value={forgotForm.email}
              />
              <Pressable
                disabled={isSubmitting}
                onPress={handleForgotPassword}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isSubmitting ? 'Sending link' : 'Send reset link'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  clearFeedback();
                  setView('reset');
                }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>
                  I already have a reset code
                </Text>
              </Pressable>
            </>
          ) : null}

          {view === 'reset' ? (
            <>
              {resetForm.token ? null : (
                <TextInput
                  onChangeText={(token) =>
                    setResetForm((current) => ({ ...current, token }))
                  }
                  placeholder="Reset code"
                  placeholderTextColor="#817873"
                  style={styles.input}
                  value={resetForm.token}
                />
              )}
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
                placeholderTextColor="#817873"
                secureTextEntry
                style={styles.input}
                value={resetForm.newPassword}
              />
              <Pressable
                disabled={isSubmitting}
                onPress={handleResetPassword}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isSubmitting ? 'Updating password' : 'Update password'}
                </Text>
              </Pressable>
            </>
          ) : null}

          {view !== 'forgot' && view !== 'reset' && googleEnabled ? (
            <Pressable
              disabled={isSubmitting || !googleRequest}
              onPress={openGoogleFlow}
              style={styles.googleButton}
            >
              <Ionicons color="#fbf7ef" name="logo-google" size={18} />
              <Text style={styles.googleButtonLabel}>Continue with Google</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#120f18',
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
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#f5c15d',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  brandMarkText: {
    color: '#160f0b',
    fontSize: 18,
    fontWeight: '900',
  },
  brandName: {
    color: '#fbf7ef',
    fontSize: isSmallScreen ? 18 : isMediumScreen ? 20 : 22,
    fontWeight: '900',
  },
  headerPill: {
    borderColor: 'rgba(248,244,236,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    color: '#d8d0c8',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(248,244,236,0.08)',
    borderColor: 'rgba(248,244,236,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  searchPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(248,244,236,0.07)',
    borderColor: 'rgba(248,244,236,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  searchText: {
    color: '#b8afaa',
    fontSize: 14,
    fontWeight: '700',
  },
  panelTabs: {
    backgroundColor: 'rgba(248,244,236,0.06)',
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
    backgroundColor: '#55d6c2',
  },
  panelTabLabel: {
    color: '#b8afaa',
    fontSize: 13,
    fontWeight: '900',
  },
  panelTabLabelActive: {
    color: '#0b121a',
  },
  previewDeck: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(29,23,35,0.86)',
    borderColor: 'rgba(248,244,236,0.11)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  previewTitle: {
    color: '#fbf7ef',
    fontSize: 35,
    fontWeight: '900',
    lineHeight: 38,
  },
  previewCopy: {
    color: '#b8afaa',
    fontSize: 15,
    lineHeight: 22,
  },
  authCard: {
    backgroundColor: 'rgba(16,18,24,0.9)',
    borderColor: 'rgba(248,244,236,0.11)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  tabRow: {
    backgroundColor: 'rgba(248,244,236,0.06)',
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
    backgroundColor: '#fbf7ef',
  },
  tabLabel: {
    color: '#b8afaa',
    fontSize: isSmallScreen ? 11 : 13,
    fontWeight: '900',
  },
  tabLabelActive: {
    color: '#120f18',
  },
  eyebrow: {
    color: '#55d6c2',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: '#fbf7ef',
    fontSize: 25,
    fontWeight: '900',
  },
  caption: {
    color: '#b8afaa',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: 'rgba(7,12,18,0.72)',
    borderColor: 'rgba(248,244,236,0.12)',
    borderRadius: 8,
    borderWidth: 1,
    color: '#fbf7ef',
    minHeight: 52,
    paddingHorizontal: 15,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#f5c15d',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonLabel: {
    color: '#160f0b',
    fontSize: 15,
    fontWeight: '900',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(248,244,236,0.06)',
    borderColor: 'rgba(248,244,236,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 52,
  },
  googleButtonLabel: {
    color: '#fbf7ef',
    fontSize: 14,
    fontWeight: '800',
  },
  textButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  textButtonLabel: {
    color: '#d8d0c8',
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
    color: '#fbf7ef',
    fontSize: 14,
    lineHeight: 20,
  },
  signalDeck: {
    backgroundColor: 'rgba(29,23,35,0.86)',
    borderColor: 'rgba(248,244,236,0.11)',
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
    color: '#fbf7ef',
    fontSize: isSmallScreen ? 26 : isMediumScreen ? 30 : 34,
    fontWeight: '900',
    lineHeight: isSmallScreen ? 30 : isMediumScreen ? 34 : 38,
    textAlign: 'center',
  },
  trackArtist: {
    color: '#b8afaa',
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
    borderColor: 'rgba(248,244,236,0.13)',
    borderRadius: 999,
    borderWidth: 1,
    color: '#d8d0c8',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  waveCard: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(85,214,194,0.08)',
    borderColor: 'rgba(248,244,236,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    height: 108,
    padding: 14,
  },
  waveBar: {
    backgroundColor: '#55d6c2',
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
    color: '#fbf7ef',
    fontSize: isSmallScreen ? 17 : isMediumScreen ? 19 : 21,
    fontWeight: '900',
  },
  sectionAction: {
    color: '#d8d0c8',
    fontSize: isSmallScreen ? 11 : 13,
    fontWeight: '800',
  },
  mixScroller: {
    gap: 10,
    paddingRight: 16,
  },
  mixCard: {
    backgroundColor: 'rgba(248,244,236,0.06)',
    borderColor: 'rgba(248,244,236,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
    width: 164,
  },
  mixTitle: {
    color: '#fbf7ef',
    fontSize: 15,
    fontWeight: '900',
  },
  mixDetail: {
    color: '#b8afaa',
    fontSize: 12,
    lineHeight: 17,
  },
  trackList: {
    gap: 8,
  },
  trackRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(248,244,236,0.035)',
    borderColor: 'rgba(248,244,236,0.08)',
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
    color: '#b8afaa',
    fontSize: 13,
    fontWeight: '900',
    width: 24,
  },
  trackNumberActive: {
    color: '#55d6c2',
  },
  trackMeta: {
    flex: 1,
    minWidth: 0,
  },
  trackName: {
    color: '#fbf7ef',
    fontSize: isSmallScreen ? 13 : 15,
    fontWeight: '900',
  },
  trackSubtext: {
    color: '#b8afaa',
    fontSize: isSmallScreen ? 11 : 12,
    marginTop: 2,
  },
  trackDuration: {
    color: '#b8afaa',
    fontSize: isSmallScreen ? 11 : 12,
    fontWeight: '800',
  },
  queueCard: {
    backgroundColor: 'rgba(245,193,93,0.08)',
    borderColor: 'rgba(248,244,236,0.1)',
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
    backgroundColor: 'rgba(248,244,236,0.05)',
    borderColor: 'rgba(248,244,236,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  emptyTitle: {
    color: '#fbf7ef',
    fontSize: 16,
    fontWeight: '900',
  },
  playlistGrid: {
    gap: 10,
  },
  playlistCard: {
    backgroundColor: 'rgba(245,193,93,0.08)',
    borderColor: 'rgba(248,244,236,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  playlistTitle: {
    color: '#fbf7ef',
    fontSize: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    fontWeight: '900',
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(29,23,35,0.86)',
    borderColor: 'rgba(248,244,236,0.11)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  profileAvatar: {
    alignItems: 'center',
    backgroundColor: '#55d6c2',
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  profileAvatarText: {
    color: '#0b121a',
    fontSize: 24,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: '#fbf7ef',
    fontSize: isSmallScreen ? 18 : isMediumScreen ? 20 : 22,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    backgroundColor: 'rgba(248,244,236,0.06)',
    borderColor: 'rgba(248,244,236,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  statValue: {
    color: '#fbf7ef',
    fontSize: 23,
    fontWeight: '900',
  },
  statLabel: {
    color: '#b8afaa',
    fontSize: 11,
    fontWeight: '800',
  },
  managementCard: {
    backgroundColor: 'rgba(248,244,236,0.045)',
    borderColor: 'rgba(248,244,236,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  secondaryAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(248,244,236,0.07)',
    borderColor: 'rgba(248,244,236,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  secondaryActionLabel: {
    color: '#fbf7ef',
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
    backgroundColor: '#f5c15d',
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  playlistScroller: {
    gap: 8,
    paddingRight: 12,
  },
  playlistChip: {
    borderColor: 'rgba(248,244,236,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  playlistChipActive: {
    backgroundColor: '#fbf7ef',
  },
  playlistChipText: {
    color: '#d8d0c8',
    fontSize: 13,
    fontWeight: '900',
  },
  playlistChipTextActive: {
    color: '#120f18',
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
    color: '#ff9aa5',
    fontSize: 13,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  nowBar: {
    backgroundColor: 'rgba(8,12,18,0.96)',
    borderColor: 'rgba(248,244,236,0.12)',
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
    color: '#fbf7ef',
    fontSize: isSmallScreen ? 13 : 15,
    fontWeight: '900',
  },
  transportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: isSmallScreen ? 14 : 18,
    justifyContent: 'center',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(248,244,236,0.07)',
    borderColor: 'rgba(248,244,236,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    height: isSmallScreen ? 40 : 44,
    justifyContent: 'center',
    width: isSmallScreen ? 40 : 44,
    minHeight: 44,
    minWidth: 44,
  },
  iconButtonSolid: {
    backgroundColor: '#f5c15d',
    borderColor: '#f5c15d',
    height: isSmallScreen ? 48 : 52,
    width: isSmallScreen ? 48 : 52,
    minHeight: 44,
    minWidth: 44,
  },
  progressMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  progressText: {
    color: '#b8afaa',
    fontSize: 11,
    fontWeight: '800',
    width: 34,
  },
  progressTrack: {
    backgroundColor: 'rgba(248,244,236,0.12)',
    borderRadius: 999,
    flex: 1,
    height: 5,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#55d6c2',
    borderRadius: 999,
    height: '100%',
  },
  volumeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  volumeTrack: {
    backgroundColor: 'rgba(248,244,236,0.12)',
    borderRadius: 999,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  volumeFill: {
    backgroundColor: '#f5c15d',
    borderRadius: 999,
    height: '100%',
  },
  trackArt: {
    overflow: 'hidden',
  },
  trackArtSmall: {
    borderRadius: 8,
    height: responsiveScale(46),
    width: responsiveScale(46),
  },
  trackArtMedium: {
    borderRadius: 8,
    height: responsiveScale(92),
    width: responsiveScale(92),
  },
  trackArtLarge: {
    borderRadius: 8,
    height: isSmallScreen ? 160 : isMediumScreen ? 185 : 210,
    width: isSmallScreen ? 160 : isMediumScreen ? 185 : 210,
    alignSelf: 'center',
    marginVertical: 12,
  },
  artFrame: {
    borderRadius: 24,
    borderWidth: 2,
    height: '58%',
    left: '20%',
    position: 'absolute',
    top: '18%',
    transform: [{ rotate: '20deg' }],
    width: '58%',
  },
  artCircle: {
    borderRadius: 999,
    bottom: '12%',
    height: '34%',
    opacity: 0.9,
    position: 'absolute',
    right: '12%',
    width: '34%',
  },
  artLine: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 999,
    bottom: '14%',
    height: '15%',
    left: '12%',
    position: 'absolute',
    width: '48%',
  },
  bootCard: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  bootText: {
    color: '#fbf7ef',
    fontSize: 15,
    fontWeight: '800',
  },
});
