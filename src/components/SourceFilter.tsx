import { Pressable, ScrollView, Text } from 'react-native';
import { useAppContext } from '../context/AppContext';

export function SourceFilter() {
  const {
    styles,
    sourceFilters,
    playlists,
    selectedPlaylistId,
    selectedSourceLabel,
    currentTracks,
    selectPlaylist,
  } = useAppContext();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.sourceScroller}
    >
      {sourceFilters.map(({ id, label, count }) => (
        <Pressable
          key={id}
          onPress={() => selectPlaylist(id)}
          style={[styles.sourceChip, selectedPlaylistId === id ? styles.sourceChipActive : null]}
        >
          <Text style={[styles.sourceChipLabel, selectedPlaylistId === id ? styles.sourceChipLabelActive : null]}>
            {label}
          </Text>
          <Text style={[styles.sourceChipCount, selectedPlaylistId === id ? styles.sourceChipCountActive : null]}>
            {count}
          </Text>
        </Pressable>
      ))}

      {(selectedPlaylistId.startsWith('artist:') || selectedPlaylistId.startsWith('album:')) && (
        <Pressable style={[styles.sourceChip, styles.sourceChipActive]}>
          <Text style={[styles.sourceChipLabel, styles.sourceChipLabelActive]} numberOfLines={1}>
            {selectedSourceLabel}
          </Text>
          <Text style={[styles.sourceChipCount, styles.sourceChipCountActive]}>
            {currentTracks.length}
          </Text>
        </Pressable>
      )}

      {playlists.map((playlist, index) => (
        <Pressable
          key={`source-playlist-${playlist.id}-${index}`}
          onPress={() => selectPlaylist(playlist.id)}
          style={[styles.sourceChip, selectedPlaylistId === playlist.id ? styles.sourceChipActive : null]}
        >
          <Text
            style={[
              styles.sourceChipLabel,
              selectedPlaylistId === playlist.id ? styles.sourceChipLabelActive : null,
            ]}
          >
            {playlist.name}
          </Text>
          <Text
            style={[
              styles.sourceChipCount,
              selectedPlaylistId === playlist.id ? styles.sourceChipCountActive : null,
            ]}
          >
            {playlist.trackCount}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
