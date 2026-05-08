import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { TrackArt } from '../components/TrackArt';
import { useAppContext } from '../context/AppContext';

export function SearchPanel() {
  const {
    theme,
    styles,
    searchQuery,
    setSearchQuery,
    visibleTracks,
    selectedTrackId,
    durationByTrackId,
    isSearching,
    favoriteTracks,
    openTrackDetail,
    openTrackActionSheet,
    handleLikePress,
  } = useAppContext();

  const hasQuery = searchQuery.trim().length > 0;

  return (
    <>
      <View style={styles.searchPanelHeader}>
        <Text style={styles.eyebrow}>Search</Text>
        <Text style={styles.sectionTitle}>Find your sound</Text>
      </View>

      <View style={styles.searchPill}>
        <Ionicons color={theme.muted} name="search" size={18} />
        <TextInput
          autoCapitalize="none"
          autoFocus
          onChangeText={setSearchQuery}
          placeholder="Songs, artists, albums, moods…"
          placeholderTextColor={theme.muted}
          returnKeyType="search"
          style={styles.searchInput}
          value={searchQuery}
        />
        {hasQuery && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons color={theme.muted} name="close-circle" size={18} />
          </Pressable>
        )}
      </View>

      {/* Loading state */}
      {isSearching && (
        <View style={styles.searchLoadingRow}>
          <ActivityIndicator color={theme.secondary} size="small" />
          <Text style={styles.searchLoadingText}>Searching…</Text>
        </View>
      )}

      {/* Results */}
      {!isSearching && hasQuery && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Results</Text>
            <Text style={styles.sectionAction}>{visibleTracks.length} tracks</Text>
          </View>
          <View style={styles.trackList}>
            {visibleTracks.map((track, index) => {
              const isSelected = track.id === selectedTrackId;
              const isLiked = favoriteTracks.some((f) => f.id === track.id);
              return (
                <Pressable
                  key={`search-${track.id}-${index}`}
                  onLongPress={() => openTrackActionSheet(track.id)}
                  onPress={() => openTrackDetail(track.id)}
                  style={[styles.trackRow, isSelected ? styles.trackRowActive : null]}
                >
                  <Ionicons
                    color={isSelected ? theme.secondary : theme.muted}
                    name="search"
                    size={18}
                  />
                  <TrackArt track={track} size="small" />
                  <View style={styles.trackMeta}>
                    <Text style={styles.trackName} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.trackSubtext} numberOfLines={1}>
                      {track.artist} · {track.album}
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

            {!visibleTracks.length && (
              <View style={styles.searchEmptyHero}>
                <View style={styles.searchEmptyIcon}>
                  <Ionicons color={theme.muted} name="search" size={36} />
                </View>
                <Text style={styles.searchEmptyTitle}>No results</Text>
                <Text style={styles.searchEmptySubtitle}>
                  Try a different song, artist, album, or mood.
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Empty / initial state */}
      {!isSearching && !hasQuery && (
        <View style={styles.searchEmptyHero}>
          <View style={styles.searchEmptyIcon}>
            <Ionicons color={theme.muted} name="musical-notes" size={36} />
          </View>
          <Text style={styles.searchEmptyTitle}>What do you want to hear?</Text>
          <Text style={styles.searchEmptySubtitle}>
            Search songs, artists, albums, or moods.
          </Text>
        </View>
      )}
    </>
  );
}
