import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { TrackArt } from '../components/TrackArt';
import { useAppContext } from '../context/AppContext';

export function DownloadsPanel() {
  const { theme, styles, libraryTracks, downloadedTrackIds, openTrackDetail, openTrackActionSheet, selectedTrackId } = useAppContext();

  const downloadedTracks = libraryTracks.filter((t) => downloadedTrackIds.includes(t.id));

  if (downloadedTracks.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons color={theme.muted} name="download-outline" size={32} />
        <Text style={styles.emptyTitle}>No downloads yet</Text>
        <Text style={styles.caption}>Tap ••• on any track and choose Download to save it offline.</Text>
      </View>
    );
  }

  return (
    <View style={styles.trackList}>
      {downloadedTracks.map((track, index) => (
        <Pressable
          key={`dl-${track.id}-${index}`}
          onLongPress={() => openTrackActionSheet(track.id)}
          onPress={() => openTrackDetail(track.id)}
          style={[styles.trackRow, track.id === selectedTrackId ? styles.trackRowActive : null]}
        >
          <Ionicons color={theme.secondary} name="checkmark-circle" size={18} />
          <TrackArt track={track} size="small" />
          <View style={styles.trackMeta}>
            <Text style={styles.trackName} numberOfLines={1}>{track.title}</Text>
            <Text style={styles.trackSubtext} numberOfLines={1}>{track.artist} · {track.album}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
