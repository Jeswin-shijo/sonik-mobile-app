import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFriendlyError, requestJson } from './src/api/client';
import { IconButton } from './src/components/IconButton';
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
  AuthResponse,
  AuthView,
  ForgotPasswordResponse,
  MusicTrack,
  Playlist,
  PlaylistResponse,
  PlaylistsResponse,
  RepeatMode,
  SessionState,
  SessionUser,
  TracksResponse,
} from './src/types';
import {
  formatMillis,
  getRuntimeLabel,
  normalizePlaylist,
  normalizeTrack,
  uniqueTracksById,
} from './src/utils/music';

WebBrowser.maybeCompleteAuthSession();

// Responsive design utilities
const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;
const isMediumScreen = screenWidth >= 380 && screenWidth < 480;

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
  const completedTrackRef = useRef('');
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
  const [isTrackDetailOpen, setIsTrackDetailOpen] = useState(false);
  const [isPlaylistPickerOpen, setIsPlaylistPickerOpen] = useState(false);
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
  const [forgotForm, setForgotForm] = useState({
    email: '',
  });
  const [resetForm, setResetForm] = useState({
    token: '',
    newPassword: '',
  });

  const currentTracks = useMemo(() => {
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
    if (selectedPlaylistId === 'favorites') {
      return 'Liked Songs';
    }

    if (selectedPlaylistId === 'recent') {
      return 'Recent Plays';
    }

    return selectedPlaylist?.name ?? 'Library';
  }, [selectedPlaylist, selectedPlaylistId]);
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
    void requestJson<TracksResponse>('/tracks')
      .then((payload) => {
        if (!payload.tracks.length) {
          return;
        }

        const nextTracks = payload.tracks.map(normalizeTrack);
        setLibraryTracks(nextTracks);
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
    session,
  ]);

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

    const [favoritesPayload, recentPayload, playlistsPayload] =
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
      ]);

    setFavoriteTracks(favoritesPayload.tracks.map(normalizeTrack));
    setRecentTracks(uniqueTracksById(recentPayload.tracks.map(normalizeTrack)));

    const nextPlaylists = playlistsPayload.playlists.map(normalizePlaylist);
    setPlaylists(nextPlaylists);
    setSelectedPlaylistId((current) =>
      current === 'library' ||
      current === 'favorites' ||
      current === 'recent' ||
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

  function selectTrack(trackId: string) {
    if (trackId === selectedTrackId) {
      setIsPlaying((current) => !current);
      return;
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

  function selectNextTrack() {
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
      selectTrack(nextTrack.id);
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
    selectTrack(nextTrack.id);
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
    selectTrack(previousTrack.id);
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

  async function addCurrentTrackToPlaylist(playlistId?: string) {
    const targetPlaylist = playlistId
      ? playlists.find((playlist) => playlist.id === playlistId)
      : addTargetPlaylist;

    if (!session || !targetPlaylist) {
      return;
    }

    if (targetPlaylist.tracks.some((track) => track.id === selectedTrackId)) {
      setAddToPlaylistId(targetPlaylist.id);
      setIsPlaylistPickerOpen(false);
      return;
    }

    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>(
        `/playlists/${targetPlaylist.id}/tracks/${selectedTrackId}`,
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
    } catch (error) {
      handleApiError(error);
    }
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
    player.pause();

    await AsyncStorage.removeItem(sessionStorageKey);
    setSession(null);
    setFavoriteTracks([]);
    setRecentTracks([]);
    setPlaylists([]);
    setSelectedPlaylistId('library');
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
              <TextInput
                autoCapitalize="none"
                onChangeText={setSearchQuery}
                placeholder="Search songs, artists, moods"
                placeholderTextColor="#b8afaa"
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
                    <Ionicons
                      color="#160f0b"
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
                      color={isSelectedTrackLiked ? '#ff7a59' : '#fbf7ef'}
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
                    <Ionicons color="#fbf7ef" name="add" size={18} />
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
                            : '#b8afaa'
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
              {visibleTracks
                .filter((track) => track.id !== selectedTrack.id)
                .slice(0, 3)
                .map((track, index) => (
                  <Pressable
                    key={`queue-${track.id}-${index}`}
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
                        onPress={() => openTrackDetail(track.id)}
                        style={[
                          styles.trackRow,
                          track.id === selectedTrackId
                            ? styles.trackRowActive
                            : null,
                        ]}
                      >
                        <Ionicons color="#55d6c2" name="time" size={19} />
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
                    onPress={() => void addCurrentTrackToPlaylist()}
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
                  <Ionicons color="#fbf7ef" name="chevron-down" size={24} />
                </Pressable>
                <View style={styles.detailHeaderCopy}>
                  <Text style={styles.detailEyebrow}>Playing from</Text>
                  <Text style={styles.detailSource} numberOfLines={1}>
                    {selectedSourceLabel}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={
                    isSelectedTrackLiked ? 'Unlike track' : 'Like track'
                  }
                  onPress={() => void toggleLikeTrack(selectedTrack.id)}
                  style={styles.detailHeaderButton}
                >
                  <Ionicons
                    color={isSelectedTrackLiked ? '#ff7a59' : '#fbf7ef'}
                    name={isSelectedTrackLiked ? 'heart' : 'heart-outline'}
                    size={23}
                  />
                </Pressable>
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
                    onPress={() => setIsShuffle((current) => !current)}
                    variant={isShuffle ? 'solid' : 'ghost'}
                  />
                  <IconButton
                    icon="play-skip-back"
                    label="Previous track"
                    onPress={selectPreviousTrack}
                  />
                  <Pressable
                    accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                    onPress={togglePlayback}
                    style={styles.detailPlayButton}
                  >
                    <Ionicons
                      color="#160f0b"
                      name={isPlaying ? 'pause' : 'play'}
                      size={34}
                    />
                  </Pressable>
                  <IconButton
                    icon="play-skip-forward"
                    label="Next track"
                    onPress={selectNextTrack}
                  />
                  <IconButton
                    icon="repeat"
                    label="Repeat one"
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
                    color="#fbf7ef"
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
                                  color="#160f0b"
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
                        placeholderTextColor="#817873"
                        style={[styles.input, styles.playlistInput]}
                        value={newPlaylistName}
                      />
                      <Pressable
                        onPress={createPlaylistAndAddCurrentTrack}
                        style={styles.addButton}
                      >
                        <Ionicons color="#160f0b" name="add" size={22} />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            </SafeAreaView>
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
                onPress={() => setIsShuffle((current) => !current)}
                variant={isShuffle ? 'solid' : 'ghost'}
              />
              <IconButton
                icon="play-skip-back"
                label="Previous track"
                onPress={selectPreviousTrack}
              />
              <IconButton
                icon={isPlaying ? 'pause' : 'play'}
                label={isPlaying ? 'Pause' : 'Play'}
                onPress={togglePlayback}
                variant="solid"
              />
              <IconButton
                icon="play-skip-forward"
                label="Next track"
                onPress={selectNextTrack}
              />
              <IconButton
                icon="repeat"
                label="Repeat one"
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
  searchInput: {
    color: '#fbf7ef',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 48,
    paddingVertical: 0,
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
  sourceScroller: {
    gap: 8,
    paddingRight: 16,
  },
  sourceChip: {
    alignItems: 'center',
    borderColor: 'rgba(248,244,236,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 13,
  },
  sourceChipActive: {
    backgroundColor: '#fbf7ef',
    borderColor: '#fbf7ef',
  },
  sourceChipLabel: {
    color: '#d8d0c8',
    fontSize: 13,
    fontWeight: '900',
  },
  sourceChipLabelActive: {
    color: '#120f18',
  },
  sourceChipCount: {
    color: '#b8afaa',
    fontSize: 12,
    fontWeight: '900',
  },
  sourceChipCountActive: {
    color: '#4b3f36',
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
  heroActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 6,
  },
  heroPlayButton: {
    alignItems: 'center',
    backgroundColor: '#f5c15d',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 17,
  },
  heroPlayLabel: {
    color: '#160f0b',
    fontSize: 13,
    fontWeight: '900',
  },
  heroSubtleButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(248,244,236,0.07)',
    borderColor: 'rgba(248,244,236,0.12)',
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
    color: '#fbf7ef',
    fontSize: 13,
    fontWeight: '900',
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
  rowIconButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
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
  detailScreen: {
    backgroundColor: '#120f18',
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
  detailHeaderButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(248,244,236,0.07)',
    borderColor: 'rgba(248,244,236,0.12)',
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
    color: '#55d6c2',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  detailSource: {
    color: '#fbf7ef',
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
    color: '#fbf7ef',
    fontSize: isSmallScreen ? 27 : 32,
    fontWeight: '900',
    lineHeight: isSmallScreen ? 32 : 37,
    textAlign: 'center',
  },
  detailArtist: {
    color: '#b8afaa',
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
    backgroundColor: '#f5c15d',
    borderRadius: 999,
    height: isSmallScreen ? 68 : 76,
    justifyContent: 'center',
    width: isSmallScreen ? 68 : 76,
  },
  detailSecondaryAction: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(248,244,236,0.07)',
    borderColor: 'rgba(248,244,236,0.12)',
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
    backgroundColor: 'rgba(248,244,236,0.055)',
    borderColor: 'rgba(248,244,236,0.12)',
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
    backgroundColor: 'rgba(8,12,18,0.42)',
    borderColor: 'rgba(248,244,236,0.1)',
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
    backgroundColor: '#f5c15d',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
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
