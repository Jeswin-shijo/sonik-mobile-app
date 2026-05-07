const fs = require('fs');
const file = 'App.tsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = "{activePanel === 'profile' ? (";
const endStr = "            ) : null}\n          </ScrollView>\n\n          <Modal";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const newProfileView = `{activePanel === 'profile' ? (
              <View style={styles.spotifyProfileContainer}>
                {/* Header Section */}
                <View style={styles.spotifyHeader}>
                  <Pressable 
                    onPress={() => setIsSettingsOpen(true)}
                    style={styles.spotifySettingsButton}
                  >
                    <Ionicons color={theme.text} name="settings-outline" size={24} />
                  </Pressable>
                  
                  <View style={styles.spotifyAvatarContainer}>
                    {session.user.avatarUrl ? (
                      <Image
                        source={{ uri: session.user.avatarUrl }}
                        style={styles.spotifyAvatarLarge}
                      />
                    ) : (
                      <View style={[styles.spotifyAvatarLarge, styles.spotifyAvatarPlaceholder]}>
                        <Text style={styles.spotifyAvatarInitial}>
                          {session.user.profileName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={styles.spotifyName}>{session.user.profileName}</Text>
                  
                  <Text style={styles.spotifyStatsInline}>
                    {favoriteTracks.length} Liked • {playlists.length} Playlists • {libraryTracks.length} Tracks
                  </Text>
                </View>

                {/* Playlists Section */}
                <View style={styles.spotifyPlaylistsSection}>
                  <Text style={styles.spotifySectionTitle}>Your Playlists</Text>
                  
                  {/* Create Playlist Row */}
                  <View style={styles.spotifyCreatePlaylistRow}>
                    <View style={styles.spotifyCreateIconContainer}>
                      <Ionicons color={theme.accentText} name="add" size={24} />
                    </View>
                    <TextInput
                      onChangeText={setNewPlaylistName}
                      placeholder="Name a new playlist..."
                      placeholderTextColor={theme.muted}
                      style={styles.spotifyCreateInput}
                      value={newPlaylistName}
                      onSubmitEditing={createPlaylist}
                    />
                    {newPlaylistName.trim().length > 0 && (
                      <Pressable onPress={createPlaylist} style={styles.spotifyCreateButton}>
                        <Text style={styles.spotifyCreateButtonText}>Create</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Playlists List */}
                  {playlists.length > 0 ? (
                    <View style={styles.spotifyPlaylistsList}>
                      {playlists.map((playlist, index) => (
                        <Pressable
                          key={\`spotify-playlist-\${playlist.id}-\${index}\`}
                          onPress={() => setSelectedPlaylistId(playlist.id)}
                          style={[
                            styles.spotifyPlaylistRow,
                            selectedPlaylist?.id === playlist.id && styles.spotifyPlaylistRowActive
                          ]}
                        >
                          <View style={styles.spotifyPlaylistCover}>
                            <Ionicons color={theme.muted} name="musical-notes" size={24} />
                          </View>
                          <View style={styles.spotifyPlaylistMeta}>
                            <Text style={styles.spotifyPlaylistName}>{playlist.name}</Text>
                            <Text style={styles.spotifyPlaylistSubtext}>{playlist.trackCount} tracks</Text>
                          </View>
                          <Pressable
                            onPress={() => deletePlaylist(playlist.id)}
                            style={styles.spotifyPlaylistDelete}
                          >
                            <Ionicons color={theme.muted} name="trash-outline" size={20} />
                          </Pressable>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.spotifyEmptyState}>
                      <Text style={styles.spotifyEmptyStateText}>You don't have any playlists yet.</Text>
                    </View>
                  )}

                  {/* Tracks of Selected Playlist */}
                  {selectedPlaylist && selectedPlaylist.tracks.length > 0 && (
                    <View style={styles.spotifySelectedPlaylistContainer}>
                      <Text style={styles.spotifySectionTitle}>{selectedPlaylist.name} Tracks</Text>
                      {selectedPlaylist.tracks.map((track, index) => (
                        <View
                          style={styles.playlistTrackRow}
                          key={\`spotify-playlist-track-\${track.id}-\${index}\`}
                        >
                          <Pressable
                            onLongPress={() => openTrackActionSheet(track.id)}
                            onPress={() => openTrackDetail(track.id)}
                            style={styles.playlistTrackPressable}
                          >
                            <TrackArt track={track} size="small" />
                            <View style={styles.trackMeta}>
                              <Text style={styles.trackName} numberOfLines={1}>
                                {track.title}
                              </Text>
                              <Text
                                style={styles.trackSubtext}
                                numberOfLines={1}
                              >
                                {track.artist}
                              </Text>
                            </View>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              removeTrackFromPlaylist(
                                selectedPlaylist.id,
                                track.id,
                              )
                            }
                            style={styles.removeButton}
                          >
                            <Ionicons
                              color={theme.danger}
                              name="remove"
                              size={18}
                            />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
`;
  content = content.substring(0, startIndex) + newProfileView + content.substring(endIndex);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully replaced profile view.');
} else {
  console.log('Could not find start or end string.');
  console.log('StartIndex:', startIndex, 'EndIndex:', endIndex);
}
