import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LibraryCollectionCard } from '../components/LibraryCollectionCard';
import { TrackArt } from '../components/TrackArt';
import { useAppContext } from '../context/AppContext';

export function FlowPanel() {
  const {
    theme,
    styles,
    selectedTrack,
    selectedSourceLabel,
    currentTracks,
    selectedTrackId,
    selectedPlaylistId,
    isPlaying,
    artists,
    albums,
    libraryTracks,
    recentTracks,
    favoriteTracks,
    durationByTrackId,
    queuePreviewTracks,
    selectedRuntimeLabel,
    isSelectedTrackLiked,
    likedPulseTrackId,
    likeScaleAnim,
    togglePlayback,
    handleLikePress,
    openCurrentTrackPlaylistSheet,
    openTrackDetail,
    openTrackActionSheet,
    selectArtist,
    selectAlbum,
    setActivePanel,
    setSelectedPlaylistId,
  } = useAppContext();

  const moods = [...new Set(libraryTracks.map((t) => t.mood).filter(Boolean))].sort();
  const genres = [...new Set(libraryTracks.map((t) => t.genre).filter(Boolean))].sort();

  return (
    <>
      <View style={styles.signalDeck}>
        <TrackArt track={selectedTrack} size="large" />
        <View style={styles.deckCopy}>
          <Text style={styles.eyebrow}>Playing from {selectedSourceLabel}</Text>
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
              <LinearGradient
                colors={[theme.accent, theme.secondary]}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons color={theme.accentText} name={isPlaying ? 'pause' : 'play'} size={18} />
            </Pressable>
            <Pressable
              onPress={() => handleLikePress(selectedTrack.id)}
              style={[styles.heroSubtleButton, isSelectedTrackLiked ? styles.heroSubtleButtonActive : null]}
            >
              <Animated.View
                style={[likedPulseTrackId === selectedTrack.id ? { transform: [{ scale: likeScaleAnim }] } : null]}
              >
                <Ionicons
                  color={isSelectedTrackLiked ? '#ff7a59' : theme.text}
                  name={isSelectedTrackLiked ? 'heart' : 'heart-outline'}
                  size={18}
                />
              </Animated.View>
            </Pressable>
            <Pressable onPress={openCurrentTrackPlaylistSheet} style={styles.heroSubtleButton}>
              <Ionicons color={theme.text} name="add" size={18} />
            </Pressable>
          </View>
        </View>
      </View>

      {recentTracks.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recently played</Text>
            <Pressable onPress={() => setActivePanel('library')}>
              <Text style={styles.sectionAction}>See all</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.collectionScroller}
          >
            {recentTracks.slice(0, 8).map((track, index) => (
              <LibraryCollectionCard
                artwork={{ kind: 'track', track }}
                colors={theme}
                key={`recent-flow-${track.id}-${index}`}
                onPress={() => openTrackDetail(track.id)}
                subtitle={track.artist}
                title={track.title}
              />
            ))}
          </ScrollView>
        </>
      )}

      {moods.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse by mood</Text>
            <Text style={styles.sectionAction}>{moods.length} moods</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sourceScroller}
          >
            {moods.map((mood) => {
              const isActive = selectedPlaylistId === `mood:${mood}`;
              return (
                <Pressable
                  key={`mood-${mood}`}
                  onPress={() => setSelectedPlaylistId(isActive ? 'library' : `mood:${mood}`)}
                  style={[styles.sourceChip, isActive ? styles.sourceChipActive : null]}
                >
                  <Text style={[styles.sourceChipLabel, isActive ? styles.sourceChipLabelActive : null]}>
                    {mood}
                  </Text>
                  <Text style={[styles.sourceChipCount, isActive ? styles.sourceChipCountActive : null]}>
                    {libraryTracks.filter((t) => t.mood === mood).length}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {genres.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse by genre</Text>
            <Text style={styles.sectionAction}>{genres.length} genres</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sourceScroller}
          >
            {genres.map((genre) => {
              const isActive = selectedPlaylistId === `genre:${genre}`;
              return (
                <Pressable
                  key={`genre-${genre}`}
                  onPress={() => setSelectedPlaylistId(isActive ? 'library' : `genre:${genre}`)}
                  style={[styles.sourceChip, isActive ? styles.sourceChipActive : null]}
                >
                  <Text style={[styles.sourceChipLabel, isActive ? styles.sourceChipLabelActive : null]}>
                    {genre}
                  </Text>
                  <Text style={[styles.sourceChipCount, isActive ? styles.sourceChipCountActive : null]}>
                    {libraryTracks.filter((t) => t.genre === genre).length}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Featured artists</Text>
        <Text style={styles.sectionAction}>{artists.length} profiles</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionScroller}>
        {artists.slice(0, 8).map((artist) => {
          const sampleTrack = artist.tracks[0];
          return (
            <LibraryCollectionCard
              artwork={sampleTrack ? { kind: 'track', track: sampleTrack } : { kind: 'initial', label: artist.name }}
              colors={theme}
              key={`flow-artist-${artist.id}`}
              onPress={() => selectArtist(artist.id)}
              subtitle={`Artist · ${artist.trackCount} tracks · ${artist.albumCount} albums`}
              title={artist.name}
            />
          );
        })}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Albums for you</Text>
        <Text style={styles.sectionAction}>{albums.length} releases</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionScroller}>
        {albums.slice(0, 8).map((album) => {
          const sampleTrack = album.tracks[0];
          return (
            <LibraryCollectionCard
              artwork={
                sampleTrack
                  ? { kind: 'track', track: sampleTrack }
                  : { kind: 'icon', icon: 'albums', color: theme.accent, backgroundColor: 'rgba(245,193,93,0.12)' }
              }
              colors={theme}
              key={`flow-album-${album.id}`}
              onPress={() => selectAlbum(album.id)}
              subtitle={`Album · ${album.artist} · ${album.trackCount} tracks`}
              title={album.title}
            />
          );
        })}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Track runway</Text>
        <Text style={styles.sectionAction}>{currentTracks.length} tracks</Text>
      </View>
      <View style={styles.trackList}>
        {currentTracks.map((track, index) => {
          const isSelected = track.id === selectedTrackId;
          return (
            <Pressable
              key={`runway-${track.id}-${index}`}
              onLongPress={() => openTrackActionSheet(track.id)}
              onPress={() => openTrackDetail(track.id)}
              style={[styles.trackRow, isSelected ? styles.trackRowActive : null]}
            >
              <Text style={[styles.trackNumber, isSelected ? styles.trackNumberActive : null]}>
                {isSelected && isPlaying ? '|||' : index + 1}
              </Text>
              <TrackArt track={track} size="small" />
              <View style={styles.trackMeta}>
                <Text style={styles.trackName} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.trackSubtext} numberOfLines={1}>{track.artist} - {track.mood}</Text>
              </View>
              <Pressable
                accessibilityLabel={
                  favoriteTracks.some((f) => f.id === track.id) ? 'Unlike track' : 'Like track'
                }
                onPress={(event) => { event.stopPropagation(); handleLikePress(track.id); }}
                style={styles.rowIconButton}
              >
                <Animated.View
                  style={[likedPulseTrackId === track.id ? { transform: [{ scale: likeScaleAnim }] } : null]}
                >
                  <Ionicons
                    color={favoriteTracks.some((f) => f.id === track.id) ? '#ff7a59' : theme.muted}
                    name={favoriteTracks.some((f) => f.id === track.id) ? 'heart' : 'heart-outline'}
                    size={19}
                  />
                </Animated.View>
              </Pressable>
              <Text style={styles.trackDuration}>{durationByTrackId[track.id] ?? track.duration}</Text>
            </Pressable>
          );
        })}
        {!currentTracks.length ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No tracks here yet</Text>
            <Text style={styles.caption}>Pick a different library source to keep listening.</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.queueCard}>
        <Text style={styles.sectionTitle}>Up next</Text>
        {queuePreviewTracks.slice(0, 3).map((track, index) => (
          <Pressable
            key={`queue-${track.id}-${index}`}
            onLongPress={() => openTrackActionSheet(track.id)}
            onPress={() => openTrackDetail(track.id)}
            style={styles.queueItem}
          >
            <TrackArt track={track} size="small" />
            <View style={styles.trackMeta}>
              <Text style={styles.trackName} numberOfLines={1}>{track.title}</Text>
              <Text style={styles.trackSubtext} numberOfLines={1}>{track.artist}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </>
  );
}
