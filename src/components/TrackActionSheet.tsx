import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { TrackArt } from './TrackArt';
import { useAppContext } from '../context/AppContext';

export function TrackActionSheet() {
  const {
    theme,
    styles,
    isTrackActionSheetOpen,
    actionSheetMode,
    setActionSheetMode,
    actionTrack,
    actionArtist,
    actionAlbum,
    playlists,
    newPlaylistName,
    setNewPlaylistName,
    closeTrackActionSheet,
    enqueueTrack,
    shareTrack,
    goToActionArtist,
    goToActionAlbum,
    addTrackToPlaylist,
    createPlaylistAndAddCurrentTrack,
    downloadTrack,
    downloadedTrackIds,
  } = useAppContext();

  return (
    <Modal
      animationType="slide"
      onRequestClose={closeTrackActionSheet}
      transparent
      visible={isTrackActionSheetOpen}
    >
      <Pressable onPress={closeTrackActionSheet} style={styles.sheetBackdrop}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.actionSheet}>
          <View style={styles.sheetDragHandle} />
          {actionTrack ? (
            <>
              <View style={styles.actionSheetHeader}>
                <TrackArt track={actionTrack} size="small" />
                <View style={styles.trackMeta}>
                  <Text style={styles.trackName} numberOfLines={1}>{actionTrack.title}</Text>
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
                    <Ionicons color={theme.text} name="play-skip-forward" size={20} />
                    <Text style={styles.actionSheetOptionText}>Play next</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void enqueueTrack(actionTrack.id, 'end')}
                    style={styles.actionSheetOption}
                  >
                    <Ionicons color={theme.text} name="list" size={20} />
                    <Text style={styles.actionSheetOptionText}>Add to queue</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void shareTrack(actionTrack)}
                    style={styles.actionSheetOption}
                  >
                    <Ionicons color={theme.text} name="share-outline" size={20} />
                    <Text style={styles.actionSheetOptionText}>Share</Text>
                  </Pressable>
                  <Pressable
                    disabled={!actionArtist}
                    onPress={goToActionArtist}
                    style={[styles.actionSheetOption, !actionArtist ? styles.actionSheetOptionDisabled : null]}
                  >
                    <Ionicons color={actionArtist ? theme.text : theme.muted} name="person-outline" size={20} />
                    <Text style={styles.actionSheetOptionText}>Go to artist</Text>
                  </Pressable>
                  <Pressable
                    disabled={!actionAlbum}
                    onPress={goToActionAlbum}
                    style={[styles.actionSheetOption, !actionAlbum ? styles.actionSheetOptionDisabled : null]}
                  >
                    <Ionicons color={actionAlbum ? theme.text : theme.muted} name="albums-outline" size={20} />
                    <Text style={styles.actionSheetOptionText}>Go to album</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setActionSheetMode('playlists')}
                    style={styles.actionSheetOption}
                  >
                    <Ionicons color={theme.text} name="add-circle-outline" size={20} />
                    <Text style={styles.actionSheetOptionText}>Save to playlist</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void downloadTrack(actionTrack.id);
                      closeTrackActionSheet();
                    }}
                    style={styles.actionSheetOption}
                  >
                    <Ionicons
                      color={downloadedTrackIds.includes(actionTrack.id) ? theme.secondary : theme.text}
                      name={downloadedTrackIds.includes(actionTrack.id) ? 'checkmark-circle-outline' : 'download-outline'}
                      size={20}
                    />
                    <Text style={styles.actionSheetOptionText}>
                      {downloadedTrackIds.includes(actionTrack.id) ? 'Downloaded' : 'Download'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actionSheetList}>
                  <Pressable
                    onPress={() => setActionSheetMode('actions')}
                    style={styles.actionSheetOption}
                  >
                    <Ionicons color={theme.text} name="chevron-back" size={20} />
                    <Text style={styles.actionSheetOptionText}>Save to playlist</Text>
                  </Pressable>

                  {playlists.length ? (
                    playlists.map((playlist) => {
                      const isSaved = playlist.tracks.some((t) => t.id === actionTrack.id);
                      return (
                        <Pressable
                          key={`sheet-playlist-${playlist.id}`}
                          onPress={() => void addTrackToPlaylist(actionTrack.id, playlist.id)}
                          style={styles.actionSheetOption}
                        >
                          <Ionicons
                            color={theme.text}
                            name={isSaved ? 'checkmark' : 'musical-notes'}
                            size={20}
                          />
                          <View style={styles.trackMeta}>
                            <Text style={styles.actionSheetOptionText} numberOfLines={1}>
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
                    <Text style={styles.caption}>Create a playlist from Profile first.</Text>
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
                      onPress={() => void createPlaylistAndAddCurrentTrack(actionTrack.id)}
                      style={[
                        styles.sheetCreatePlaylistButton,
                        !newPlaylistName.trim() ? styles.disabledButton : null,
                      ]}
                    >
                      <Ionicons color={theme.accentText} name="add" size={20} />
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
