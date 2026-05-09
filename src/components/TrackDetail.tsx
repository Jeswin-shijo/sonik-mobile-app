import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from './IconButton';
import { TrackArt } from './TrackArt';
import { WaveformScrubber } from './WaveformScrubber';
import { useAppContext } from '../context/AppContext';
import { formatMillis } from '../utils/music';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export function TrackDetail() {
  const {
    theme,
    themeMode,
    styles,
    selectedTrack,
    selectedSourceLabel,
    isPlaying,
    isShuffle,
    setIsShuffle,
    repeatMode,
    progress,
    soundPosition,
    isSelectedTrackLiked,
    isSelectedTrackInDetailTarget,
    isPlaylistPickerOpen,
    isQueueViewOpen,
    setIsQueueViewOpen,
    queueItems,
    playlists,
    addToPlaylistId,
    setAddToPlaylistId,
    newPlaylistName,
    setNewPlaylistName,
    selectedTrackId,
    likedPulseTrackId,
    likeScaleAnim,
    detailTrackSwipeX,
    detailTrackSwipeOpacity,
    playerSheetY,
    playerSheetOpacity,
    playerBackdropOpacity,
    detailInitialFadeOpacity,
    detailTopSolidOpacity,
    selectedRuntimeLabel,
    iconButtonColors,
    isTrackDetailOpen,
    closeTrackDetail,
    handleDetailTouchStart,
    handleDetailTouchMove,
    handleDetailTouchEnd,
    handleDetailTouchCancel,
    handleLikePress,
    openTrackActionSheet,
    togglePlayback,
    selectPreviousTrack,
    selectNextTrack,
    toggleRepeatMode,
    seekToRatio,
    openPlaylistPicker,
    addCurrentTrackToPlaylist,
    createPlaylistAndAddCurrentTrack,
    removeQueueItem,
    clearAllQueue,
  } = useAppContext();

  return (
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
          style={[StyleSheet.absoluteFillObject, { opacity: playerBackdropOpacity }]}
          tint={themeMode === 'dark' ? 'dark' : 'light'}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor:
                themeMode === 'dark' ? 'rgba(8, 6, 14, 0.46)' : 'rgba(255, 255, 255, 0.28)',
              opacity: playerBackdropOpacity,
            },
          ]}
        />
        <Animated.View
          style={{ flex: 1, opacity: playerSheetOpacity, transform: [{ translateY: playerSheetY }] }}
        >
          <View pointerEvents="none" style={styles.detailBackgroundSolid} />
          <Animated.View
            pointerEvents="none"
            style={[styles.detailBackgroundTopSolid, { opacity: detailTopSolidOpacity }]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.detailBackgroundFade, { opacity: detailInitialFadeOpacity }]}
          >
            <LinearGradient
              colors={[
                themeMode === 'dark' ? 'rgba(18, 15, 24, 0)' : 'rgba(247, 242, 234, 0)',
                theme.background,
              ]}
              locations={[0, 1]}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>

          <SafeAreaView style={styles.detailScreen}>
            <View
              onTouchCancel={handleDetailTouchCancel}
              onTouchEnd={handleDetailTouchEnd}
              onTouchMove={handleDetailTouchMove}
              onTouchStart={handleDetailTouchStart}
              style={{ flex: 1 }}
            >
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
                <Text style={styles.detailSource} numberOfLines={1}>{selectedSourceLabel}</Text>
              </View>
              <View style={styles.detailHeaderActions}>
                <Pressable
                  accessibilityLabel={isSelectedTrackLiked ? 'Unlike track' : 'Like track'}
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
                  <Ionicons color={theme.text} name="ellipsis-vertical" size={20} />
                </Pressable>
              </View>
            </View>

            <Animated.View
              style={[
                styles.detailBody,
                { opacity: detailTrackSwipeOpacity, transform: [{ translateX: detailTrackSwipeX }] },
              ]}
            >
              <TrackArt track={selectedTrack} size="large" />
              <View style={styles.detailTrackCopy}>
                <Text style={styles.detailTitle} numberOfLines={3}>{selectedTrack.title}</Text>
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
            </View>

            <View style={styles.detailFooter}>
              <View style={styles.progressMeta}>
                <Text style={styles.progressText}>{formatMillis(soundPosition)}</Text>
                <WaveformScrubber
                  trackId={selectedTrack.id}
                  progress={progress}
                  onSeek={(ratio) => {
                    void seekToRatio(ratio);
                    if (ratio >= 0.99 && isPlaying) togglePlayback();
                  }}
                  accentColor={theme.accent}
                  dimColor={theme.muted}
                  style={{ flex: 1 }}
                />
                <Text style={styles.progressText}>{selectedRuntimeLabel}</Text>
              </View>

              <View style={styles.detailTransportRow}>
                <IconButton
                  icon="shuffle"
                  label="Shuffle"
                  colors={iconButtonColors}
                  onPress={() => setIsShuffle((c) => !c)}
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
                  <Ionicons color={theme.accentText} name={isPlaying ? 'pause' : 'play'} size={34} />
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

              {/* Queue section */}
              <View style={styles.queueSection}>
                <Pressable
                  onPress={() => setIsQueueViewOpen((c) => !c)}
                  style={styles.queueSectionToggle}
                >
                  <Ionicons
                    color={theme.muted}
                    name={isQueueViewOpen ? 'chevron-up' : 'list'}
                    size={16}
                  />
                  <Text style={styles.queueSectionLabel}>Up next</Text>
                  <Text style={styles.queueSectionCount}>
                    {queueItems.length} queued
                  </Text>
                  <Ionicons
                    color={theme.muted}
                    name={isQueueViewOpen ? 'chevron-up' : 'chevron-down'}
                    size={14}
                  />
                </Pressable>

                {isQueueViewOpen && (
                  <>
                    {queueItems.length > 0 ? (
                      <>
                        <ScrollView
                          style={{ maxHeight: 200 }}
                          showsVerticalScrollIndicator={false}
                        >
                          {queueItems.map((item) => (
                            <View key={`queue-detail-${item.id}`} style={styles.queueDetailItem}>
                              <TrackArt track={item.track} size="small" />
                              <View style={styles.queueDetailTrackMeta}>
                                <Text style={styles.queueDetailTrackName} numberOfLines={1}>
                                  {item.track.title}
                                </Text>
                                <Text style={styles.queueDetailTrackArtist} numberOfLines={1}>
                                  {item.track.artist}
                                </Text>
                              </View>
                              <Pressable
                                onPress={() => void removeQueueItem(item.id)}
                                style={styles.queueDetailRemoveButton}
                              >
                                <Ionicons color={theme.muted} name="close" size={18} />
                              </Pressable>
                            </View>
                          ))}
                        </ScrollView>
                        <Pressable
                          onPress={() => void clearAllQueue()}
                          style={styles.queueClearButton}
                        >
                          <Text style={styles.queueClearText}>Clear queue</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Text style={[styles.caption, { paddingHorizontal: 4, paddingVertical: 8 }]}>
                        Queue is empty. Long-press any track to add it.
                      </Text>
                    )}
                  </>
                )}
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
                    <Text style={styles.sectionAction}>{playlists.length} crates</Text>
                  </View>

                  {playlists.length ? (
                    <View style={styles.detailPlaylistList}>
                      {playlists.map((playlist, index) => {
                        const isCurrentTarget = playlist.id === addToPlaylistId;
                        const isAlreadyAdded = playlist.tracks.some((t) => t.id === selectedTrackId);
                        return (
                          <Pressable
                            key={`detail-playlist-${playlist.id}-${index}`}
                            onPress={() => {
                              setAddToPlaylistId(playlist.id);
                              void addCurrentTrackToPlaylist(playlist.id);
                            }}
                            style={[
                              styles.detailPlaylistItem,
                              isCurrentTarget ? styles.detailPlaylistItemActive : null,
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
                              <Text style={styles.trackName} numberOfLines={1}>{playlist.name}</Text>
                              <Text style={styles.trackSubtext}>{playlist.trackCount} tracks</Text>
                            </View>
                            <Text style={styles.sectionAction}>{isAlreadyAdded ? 'Added' : 'Add'}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.caption}>Create a playlist to save this track.</Text>
                  )}

                  <View style={styles.createPlaylistRow}>
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
  );
}
