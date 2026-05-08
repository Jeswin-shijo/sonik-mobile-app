import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LibraryCollectionCard } from '../components/LibraryCollectionCard';
import { TrackArt } from '../components/TrackArt';
import { apiBaseUrl } from '../config';
import { useAppContext } from '../context/AppContext';

export function LibraryPanel() {
  const {
    theme,
    styles,
    libraryTracks,
    favoriteTracks,
    recentTracks,
    artists,
    albums,
    singers,
    lyricists,
    playlists,
    selectedTrackId,
    durationByTrackId,
    t,
    openTrackDetail,
    openTrackActionSheet,
    selectArtist,
    selectAlbum,
    selectSinger,
    selectLyricist,
    setSelectedPlaylistId,
    setActivePanel,
  } = useAppContext();

  return (
    <>
      <View style={styles.libraryOverviewCard}>
        <View style={styles.libraryOverviewIcon}>
          <Ionicons color={theme.accentText} name="library" size={22} />
        </View>
        <View style={styles.libraryOverviewCopy}>
          <Text style={styles.libraryOverviewTitle}>Your Library</Text>
          <Text style={styles.libraryOverviewMeta}>
            {libraryTracks.length} tracks · {artists.length} artists · {albums.length} albums
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('likedSongs')}</Text>
        <Text style={styles.sectionAction}>{favoriteTracks.length} saved</Text>
      </View>
      <View style={styles.trackList}>
        {favoriteTracks.length ? (
          favoriteTracks.map((track, index) => (
            <Pressable
              key={`favorite-${track.id}-${index}`}
              onLongPress={() => openTrackActionSheet(track.id)}
              onPress={() => openTrackDetail(track.id)}
              style={[styles.trackRow, track.id === selectedTrackId ? styles.trackRowActive : null]}
            >
              <Ionicons color="#ff7a59" name="heart" size={19} />
              <TrackArt track={track} size="small" />
              <View style={styles.trackMeta}>
                <Text style={styles.trackName} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.trackSubtext} numberOfLines={1}>{track.artist} - {track.album}</Text>
              </View>
              <Text style={styles.trackDuration}>{durationByTrackId[track.id] ?? track.duration}</Text>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No liked songs yet</Text>
            <Text style={styles.caption}>Tap the heart in Profile to start building your library.</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('recentPlays')}</Text>
        <Text style={styles.sectionAction}>{recentTracks.length} listened</Text>
      </View>
      <View style={styles.trackList}>
        {recentTracks.length ? (
          recentTracks.map((track, index) => (
            <Pressable
              key={`recent-${track.id}-${index}`}
              onLongPress={() => openTrackActionSheet(track.id)}
              onPress={() => openTrackDetail(track.id)}
              style={[styles.trackRow, track.id === selectedTrackId ? styles.trackRowActive : null]}
            >
              <Ionicons color={theme.secondary} name="time" size={19} />
              <TrackArt track={track} size="small" />
              <View style={styles.trackMeta}>
                <Text style={styles.trackName} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.trackSubtext} numberOfLines={1}>{track.artist} - {track.album}</Text>
              </View>
              <Text style={styles.trackDuration}>{durationByTrackId[track.id] ?? track.duration}</Text>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No recent plays yet</Text>
            <Text style={styles.caption}>Finished tracks will appear here automatically.</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('artists')}</Text>
        <Text style={styles.sectionAction}>{artists.length} profiles</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionScroller}>
        {artists.map((artist) => {
          const sampleTrack = artist.tracks[0];
          return (
            <LibraryCollectionCard
              artwork={sampleTrack ? { kind: 'track', track: sampleTrack } : { kind: 'initial', label: artist.name }}
              colors={theme}
              key={`artist-${artist.id}`}
              onPress={() => selectArtist(artist.id)}
              subtitle={`Artist · ${artist.trackCount} tracks · ${artist.albumCount} albums`}
              title={artist.name}
            />
          );
        })}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('albums')}</Text>
        <Text style={styles.sectionAction}>{albums.length} releases</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionScroller}>
        {albums.map((album) => {
          const sampleTrack = album.tracks[0];
          return (
            <LibraryCollectionCard
              artwork={
                sampleTrack
                  ? { kind: 'track', track: sampleTrack }
                  : { kind: 'icon', icon: 'albums', color: theme.accent, backgroundColor: 'rgba(245,193,93,0.12)' }
              }
              colors={theme}
              key={`album-${album.id}`}
              onPress={() => selectAlbum(album.id)}
              subtitle={`Album · ${album.artist} · ${album.trackCount} tracks`}
              title={album.title}
            />
          );
        })}
      </ScrollView>

      {singers.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('singers')}</Text>
            <Text style={styles.sectionAction}>{singers.length} profiles</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionScroller}>
            {singers.map((singer) => (
              <LibraryCollectionCard
                artwork={
                  singer.imageName
                    ? { kind: 'image', uri: `${apiBaseUrl}/uploads/people/${singer.imageName}`, shape: 'round' }
                    : { kind: 'initial', label: singer.name }
                }
                colors={theme}
                key={`singer-${singer.id}`}
                onPress={() => selectSinger(singer.id)}
                subtitle={`Singer · ${singer.trackCount} tracks`}
                title={singer.name}
              />
            ))}
          </ScrollView>
        </>
      )}

      {lyricists.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('lyricists')}</Text>
            <Text style={styles.sectionAction}>{lyricists.length} profiles</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionScroller}>
            {lyricists.map((lyricist) => (
              <LibraryCollectionCard
                artwork={
                  lyricist.imageName
                    ? { kind: 'image', uri: `${apiBaseUrl}/uploads/people/${lyricist.imageName}` }
                    : { kind: 'icon', icon: 'create', color: theme.secondary, backgroundColor: 'rgba(85,214,194,0.12)' }
                }
                colors={theme}
                key={`lyricist-${lyricist.id}`}
                onPress={() => selectLyricist(lyricist.id)}
                subtitle={`Lyricist · ${lyricist.trackCount} tracks`}
                title={lyricist.name}
              />
            ))}
          </ScrollView>
        </>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('crates')}</Text>
        <Text style={styles.sectionAction}>{playlists.length} crates</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionScroller}>
        {playlists.map((playlist, index) => (
          <LibraryCollectionCard
            artwork={{ kind: 'icon', icon: 'musical-notes', color: theme.accentText, backgroundColor: theme.accent }}
            colors={theme}
            key={`library-playlist-${playlist.id}-${index}`}
            onPress={() => { setSelectedPlaylistId(playlist.id); setActivePanel('flow'); }}
            subtitle={`Playlist · ${playlist.trackCount} tracks`}
            title={playlist.name}
          />
        ))}
      </ScrollView>
    </>
  );
}
