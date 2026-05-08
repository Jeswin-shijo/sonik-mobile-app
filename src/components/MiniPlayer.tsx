import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Pressable, Text, View } from 'react-native';
import { TrackArt } from './TrackArt';
import { useAppContext } from '../context/AppContext';

export function MiniPlayer() {
  const {
    theme,
    styles,
    selectedTrack,
    isPlaying,
    progress,
    miniPlayerDragY,
    miniPlayerRef,
    miniPlayerPanResponder,
    openPlayerSheetFromMiniPlayer,
    handleMiniPlayerLayout,
    selectPreviousTrack,
    selectNextTrack,
    togglePlayback,
  } = useAppContext();

  return (
    <Animated.View
      {...miniPlayerPanResponder.panHandlers}
      onLayout={handleMiniPlayerLayout}
      ref={miniPlayerRef}
      style={[styles.nowBar, { transform: [{ translateY: miniPlayerDragY }] }]}
    >
      <Pressable onPress={openPlayerSheetFromMiniPlayer} style={styles.miniPlayerPressable}>
        <TrackArt track={selectedTrack} size="small" />
        <View style={styles.miniTrackMeta}>
          <Text style={styles.nowTitle} numberOfLines={1}>{selectedTrack.title}</Text>
          <Text style={styles.trackSubtext} numberOfLines={1}>{selectedTrack.artist}</Text>
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
        <View style={[styles.miniProgressFill, { width: `${progress}%` as `${number}%` }]} />
      </View>
    </Animated.View>
  );
}
