import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Image, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TrackArt } from '../components/TrackArt';
import { useAppContext } from '../context/AppContext';
import { resolveAvatarUrl } from '../utils/music';

export function ProfilePanel() {
  const {
    theme,
    styles,
    session,
    favoriteTracks,
    playlists,
    libraryTracks,
    selectedPlaylist,
    selectedTrackId,
    newPlaylistName,
    setNewPlaylistName,
    setSelectedPlaylistId,
    setIsSettingsOpen,
    createPlaylist,
    deletePlaylist,
    removeTrackFromPlaylist,
    updatePlaylistName,
    openTrackDetail,
    openTrackActionSheet,
    handleUploadAvatar,
  } = useAppContext();

  const [previewVisible, setPreviewVisible] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<TextInput>(null);

  function startEdit(id: string, currentName: string) {
    setEditingPlaylistId(id);
    setEditingName(currentName);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }

  function commitEdit(id: string) {
    if (editingName.trim()) void updatePlaylistName(id, editingName.trim());
    setEditingPlaylistId(null);
  }

  if (!session) return null;

  return (
    <View style={styles.spotifyProfileContainer}>
      {/* Profile Header */}
      <View style={styles.spotifyHeader}>
        <Pressable onPress={() => setIsSettingsOpen(true)} style={styles.spotifySettingsButton}>
          <Ionicons color={theme.text} name="settings-outline" size={24} />
        </Pressable>

        <View style={styles.spotifyAvatarContainer}>
          <Pressable
            onPress={() => resolveAvatarUrl(session.user.avatarUrl) && setPreviewVisible(true)}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            {resolveAvatarUrl(session.user.avatarUrl) ? (
              <Image source={{ uri: resolveAvatarUrl(session.user.avatarUrl)! }} style={styles.spotifyAvatarLarge} />
            ) : (
              <View style={[styles.spotifyAvatarLarge, styles.spotifyAvatarPlaceholder]}>
                <Text style={styles.spotifyAvatarInitial}>
                  {session.user.profileName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => void handleUploadAvatar()}
            style={({ pressed }) => [styles.profileCameraBadge, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="camera" size={16} color="#fff" />
          </Pressable>
        </View>

        {/* Avatar preview modal */}
        <Modal visible={previewVisible} transparent animationType="fade" statusBarTranslucent>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => setPreviewVisible(false)}
          >
            <Image
              source={{ uri: resolveAvatarUrl(session.user.avatarUrl)! }}
              style={{ width: 300, height: 300, borderRadius: 150 }}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={{ position: 'absolute', top: 56, right: 20, padding: 8 }}
              onPress={() => setPreviewVisible(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </Pressable>
        </Modal>

        <Text style={styles.spotifyName}>{session.user.profileName}</Text>
        <Text style={styles.spotifyStatsInline}>
          {favoriteTracks.length} Liked • {playlists.length} Playlists • {libraryTracks.length} Tracks
        </Text>
      </View>

      {/* Playlists Section */}
      <View style={styles.spotifyPlaylistsSection}>
        <Text style={styles.spotifySectionTitle}>Your Playlists</Text>

        {/* Create playlist row */}
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
            onSubmitEditing={() => void createPlaylist()}
          />
          {newPlaylistName.trim().length > 0 && (
            <Pressable onPress={() => void createPlaylist()} style={styles.spotifyCreateButton}>
              <Text style={styles.spotifyCreateButtonText}>Create</Text>
            </Pressable>
          )}
        </View>

        {/* Playlist list */}
        {playlists.length > 0 ? (
          <View style={styles.spotifyPlaylistsList}>
            {playlists.map((playlist, index) => (
              <Pressable
                key={`spotify-playlist-${playlist.id}-${index}`}
                onPress={() => setSelectedPlaylistId(playlist.id)}
                style={[
                  styles.spotifyPlaylistRow,
                  selectedPlaylist?.id === playlist.id && styles.spotifyPlaylistRowActive,
                ]}
              >
                <View style={styles.spotifyPlaylistCover}>
                  <Ionicons color={theme.muted} name="musical-notes" size={24} />
                </View>
                <View style={styles.spotifyPlaylistMeta}>
                  {editingPlaylistId === playlist.id ? (
                    <TextInput
                      ref={editInputRef}
                      autoFocus
                      blurOnSubmit
                      onBlur={() => commitEdit(playlist.id)}
                      onChangeText={setEditingName}
                      onSubmitEditing={() => commitEdit(playlist.id)}
                      returnKeyType="done"
                      style={[styles.spotifyPlaylistName, styles.spotifyPlaylistNameInput]}
                      value={editingName}
                    />
                  ) : (
                    <Pressable onPress={() => startEdit(playlist.id, playlist.name)}>
                      <Text style={styles.spotifyPlaylistName}>{playlist.name}</Text>
                    </Pressable>
                  )}
                  <Text style={styles.spotifyPlaylistSubtext}>{playlist.trackCount} tracks</Text>
                </View>
                <Pressable
                  onPress={() => void deletePlaylist(playlist.id)}
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

        {/* Tracks of selected playlist */}
        {selectedPlaylist && selectedPlaylist.tracks.length > 0 && (
          <View style={styles.spotifySelectedPlaylistContainer}>
            <Text style={styles.spotifySectionTitle}>{selectedPlaylist.name} Tracks</Text>
            {selectedPlaylist.tracks.map((track, index) => (
              <View style={styles.playlistTrackRow} key={`spotify-playlist-track-${track.id}-${index}`}>
                <Pressable
                  onLongPress={() => openTrackActionSheet(track.id)}
                  onPress={() => openTrackDetail(track.id)}
                  style={styles.playlistTrackPressable}
                >
                  <TrackArt track={track} size="small" />
                  <View style={styles.trackMeta}>
                    <Text style={styles.trackName} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.trackSubtext} numberOfLines={1}>{track.artist}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => void removeTrackFromPlaylist(selectedPlaylist.id, track.id)}
                  style={styles.removeButton}
                >
                  <Ionicons color={theme.danger} name="remove" size={18} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
