import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { TrackArt } from './TrackArt';
import { PlayingBars } from './PlayingBars';
import { useAppContext } from '../context/AppContext';

export function MiniPlayer() {
  const {
    theme,
    themeMode,
    selectedTrack,
    isPlaying,
    progress,
    isSelectedTrackLiked,
    likedPulseTrackId,
    likeScaleAnim,
    miniPlayerDragY,
    miniPlayerRef,
    miniPlayerPanResponder,
    openPlayerSheetFromMiniPlayer,
    handleMiniPlayerLayout,
    selectNextTrack,
    togglePlayback,
    handleLikePress,
  } = useAppContext();

  return (
    <Animated.View
      {...miniPlayerPanResponder.panHandlers}
      onLayout={handleMiniPlayerLayout}
      ref={miniPlayerRef}
      style={[styles.root, { transform: [{ translateY: miniPlayerDragY }] }]}
    >
      {/* Frosted glass background */}
      <BlurView
        intensity={72}
        tint={themeMode === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Accent gradient overlay */}
      <LinearGradient
        colors={[
          themeMode === 'dark' ? 'rgba(85,214,194,0.08)' : 'rgba(85,214,194,0.12)',
          'transparent',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Thin progress bar at top */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress}%` as `${number}%`, backgroundColor: theme.accent },
          ]}
        />
      </View>

      {/* Main row */}
      <Pressable onPress={openPlayerSheetFromMiniPlayer} style={styles.row}>
        {/* Artwork */}
        <View style={styles.artWrap}>
          <TrackArt track={selectedTrack} size="small" />
          {isPlaying && (
            <View style={styles.playingOverlay}>
              <PlayingBars color="#fff" size={10} />
            </View>
          )}
        </View>

        {/* Title + artist */}
        <View style={styles.meta}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {selectedTrack.title}
          </Text>
          <Text style={[styles.artist, { color: theme.muted }]} numberOfLines={1}>
            {selectedTrack.artist}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Like */}
          <Pressable
            onPress={(e) => { e.stopPropagation(); handleLikePress(selectedTrack.id); }}
            hitSlop={10}
            style={styles.controlBtn}
          >
            <Animated.View
              style={likedPulseTrackId === selectedTrack.id
                ? { transform: [{ scale: likeScaleAnim }] }
                : undefined}
            >
              <Ionicons
                name={isSelectedTrackLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={isSelectedTrackLiked ? '#ff7a59' : theme.muted}
              />
            </Animated.View>
          </Pressable>

          {/* Play / Pause */}
          <Pressable
            onPress={(e) => { e.stopPropagation(); togglePlayback(); }}
            hitSlop={8}
            style={[styles.playBtn, { backgroundColor: theme.accent }]}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color={theme.accentText}
            />
          </Pressable>

          {/* Next */}
          <Pressable
            onPress={(e) => { e.stopPropagation(); selectNextTrack(); }}
            hitSlop={10}
            style={styles.controlBtn}
          >
            <Ionicons name="play-skip-forward" size={20} color={theme.text} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const RADIUS = 16;

const styles = StyleSheet.create({
  root: {
    borderRadius: RADIUS,
    bottom: 62,
    left: 10,
    overflow: 'hidden',
    position: 'absolute',
    right: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 12,
  },
  progressTrack: {
    height: 2.5,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  artWrap: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  playingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  artist: {
    fontSize: 12,
    fontWeight: '600',
  },
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  controlBtn: {
    padding: 4,
  },
  playBtn: {
    alignItems: 'center',
    borderRadius: 22,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
});
