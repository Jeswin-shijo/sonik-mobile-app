import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiBaseUrl } from '../config';
import { useAppContext } from '../context/AppContext';
import type { MusicTrack } from '../types';
import { TrackArt } from './TrackArt';

export function EntityDetailOverlay() {
  const {
    theme,
    styles,
    isEntityDetailOpen,
    detailEntity,
    artists,
    albums,
    singers,
    lyricists,
    favoriteTracks,
    selectedTrackId,
    isPlaying,
    durationByTrackId,
    likedPulseTrackId,
    likeScaleAnim,
    closeEntityDetail,
    playEntityTracks,
    openTrackDetail,
    openTrackActionSheet,
    handleLikePress,
  } = useAppContext();

  if (!detailEntity) return null;

  let name = '';
  let subtitle = '';
  let tracks: MusicTrack[] = [];
  let imageUri: string | null = null;
  let isRound = false;

  switch (detailEntity.kind) {
    case 'artist': {
      const entity = artists.find((a) => a.id === detailEntity.id);
      if (entity) {
        name = entity.name;
        subtitle = `${entity.trackCount} tracks · ${entity.albumCount} albums`;
        tracks = entity.tracks;
      }
      break;
    }
    case 'album': {
      const entity = albums.find((a) => a.id === detailEntity.id);
      if (entity) {
        name = entity.title;
        subtitle = `${entity.artist} · ${entity.trackCount} tracks`;
        tracks = entity.tracks;
        const coverTrack = entity.tracks[0];
        if (coverTrack?.coverUrl) imageUri = coverTrack.coverUrl.startsWith('http') ? coverTrack.coverUrl : `${apiBaseUrl}${coverTrack.coverUrl}`;
      }
      break;
    }
    case 'singer': {
      const entity = singers.find((s) => s.id === detailEntity.id);
      if (entity) {
        name = entity.name;
        subtitle = `Singer · ${entity.trackCount} tracks`;
        tracks = entity.tracks;
        if (entity.imageName) imageUri = `${apiBaseUrl}/uploads/people/${entity.imageName}`;
        isRound = true;
      }
      break;
    }
    case 'lyricist': {
      const entity = lyricists.find((l) => l.id === detailEntity.id);
      if (entity) {
        name = entity.name;
        subtitle = `Lyricist · ${entity.trackCount} tracks`;
        tracks = entity.tracks;
        if (entity.imageName) imageUri = `${apiBaseUrl}/uploads/people/${entity.imageName}`;
        isRound = true;
      }
      break;
    }
  }

  const kindIcon: Record<string, string> = {
    artist: 'musical-note',
    album: 'albums',
    singer: 'person',
    lyricist: 'create',
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={closeEntityDetail}
      presentationStyle="pageSheet"
      visible={isEntityDetailOpen}
    >
      <SafeAreaView style={styles.entityDetailScreen}>
        {/* Header */}
        <View style={styles.entityDetailHeader}>
          <Pressable
            accessibilityLabel="Go back"
            onPress={closeEntityDetail}
            style={styles.entityDetailBackButton}
          >
            <Ionicons color={theme.text} name="chevron-down" size={26} />
          </Pressable>
          <Text style={styles.entityDetailHeaderTitle} numberOfLines={1}>{name}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.entityDetailScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.entityDetailHero}>
            <View style={isRound ? styles.entityDetailArtworkRound : styles.entityDetailArtworkSquare}>
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.entityDetailArtworkImage}
                />
              ) : tracks[0] ? (
                <TrackArt track={tracks[0]} size="large" />
              ) : (
                <Ionicons
                  color={theme.muted}
                  name={kindIcon[detailEntity.kind] as any}
                  size={48}
                />
              )}
            </View>

            <Text style={styles.entityDetailName}>{name}</Text>
            <Text style={styles.entityDetailSubtitle}>{subtitle}</Text>

            {tracks.length > 0 && (
              <View style={styles.entityDetailActions}>
                <Pressable
                  onPress={() => playEntityTracks(detailEntity.kind, detailEntity.id)}
                  style={styles.entityDetailPlayAllButton}
                >
                  <LinearGradient
                    colors={[theme.accent, theme.secondary]}
                    end={{ x: 1, y: 1 }}
                    start={{ x: 0, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons color={theme.accentText} name="play" size={16} />
                  <Text style={styles.entityDetailPlayAllText}>Play all</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    playEntityTracks(detailEntity.kind, detailEntity.id);
                  }}
                  style={styles.entityDetailShuffleButton}
                >
                  <Ionicons color={theme.text} name="shuffle" size={16} />
                  <Text style={styles.entityDetailShuffleText}>Shuffle</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Track list */}
          <View style={styles.trackList}>
            {tracks.map((track, index) => {
              const isSelected = track.id === selectedTrackId;
              const isLiked = favoriteTracks.some((f) => f.id === track.id);
              return (
                <Pressable
                  key={`entity-track-${track.id}-${index}`}
                  onLongPress={() => openTrackActionSheet(track.id)}
                  onPress={() => openTrackDetail(track.id)}
                  style={[styles.trackRow, isSelected ? styles.trackRowActive : null]}
                >
                  <Text style={[styles.trackNumber, isSelected ? styles.trackNumberActive : null]}>
                    {isSelected && isPlaying ? '▶' : index + 1}
                  </Text>
                  <TrackArt track={track} size="small" />
                  <View style={styles.trackMeta}>
                    <Text style={styles.trackName} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.trackSubtext} numberOfLines={1}>
                      {track.artist} · {track.mood}
                    </Text>
                  </View>
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); handleLikePress(track.id); }}
                    style={styles.rowIconButton}
                  >
                    <Ionicons
                      color={isLiked ? '#ff7a59' : theme.muted}
                      name={isLiked ? 'heart' : 'heart-outline'}
                      size={19}
                    />
                  </Pressable>
                  <Text style={styles.trackDuration}>{durationByTrackId[track.id] ?? track.duration}</Text>
                </Pressable>
              );
            })}

            {!tracks.length && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No tracks yet</Text>
                <Text style={styles.caption}>Tracks will appear here once added.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
