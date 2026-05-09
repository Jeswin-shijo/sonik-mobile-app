import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Animated, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabBar } from '../components/BottomTabBar';
import { EntityDetailOverlay } from '../components/EntityDetailOverlay';
import { MiniPlayer } from '../components/MiniPlayer';
import { SonikLogo } from '../components/SonikLogo';
import { SourceFilter } from '../components/SourceFilter';
import { TrackActionSheet } from '../components/TrackActionSheet';
import { TrackDetail } from '../components/TrackDetail';
import { useAppContext } from '../context/AppContext';
import { FlowPanel } from '../panels/FlowPanel';
import { LibraryPanel } from '../panels/LibraryPanel';
import { ProfilePanel } from '../panels/ProfilePanel';
import { SearchPanel } from '../panels/SearchPanel';

function getGreeting(name: string) {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Ready to play, ${name}`;
  if (hour < 21) return `Good evening, ${name}`;
  return `Late night session, ${name}`;
}

export function MainScreen() {
  const {
    theme,
    themeMode,
    styles,
    session,
    activePanel,
    contentSwitchAnim,
    toggleThemeMode,
    handleLogout,
    isRefreshing,
    refreshLibrary,
  } = useAppContext();

  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <View style={styles.playerScreen}>
        {/* App header */}
        <View style={styles.appHeader}>
          <View style={styles.brandRow}>
            <SonikLogo size={28} />
            <Text style={styles.brandName} numberOfLines={1}>
              {getGreeting(session?.user.profileName.split(' ')[0] ?? 'there')}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
              style={styles.themeButton}
              onPress={toggleThemeMode}
            >
              <Ionicons color={theme.text} name={themeMode === 'dark' ? 'sunny' : 'moon'} size={18} />
            </Pressable>
            <Pressable style={styles.logoutButton} onPress={() => setLogoutConfirmVisible(true)}>
              <Ionicons color={theme.text} name="log-out-outline" size={20} />
            </Pressable>
          </View>
        </View>

        {/* Scrollable content */}
        <ScrollView
          contentContainerStyle={styles.playerContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void refreshLibrary()}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
        >
          <Animated.View
            style={[
              styles.tabContentAnimator,
              {
                opacity: contentSwitchAnim,
                transform: [
                  {
                    translateY: contentSwitchAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {(activePanel === 'flow' || activePanel === 'library') && <SourceFilter />}
            {activePanel === 'search' && <SearchPanel />}
            {activePanel === 'flow' && <FlowPanel />}
            {activePanel === 'library' && <LibraryPanel />}
            {activePanel === 'profile' && <ProfilePanel />}
          </Animated.View>
        </ScrollView>

        {/* Overlays */}
        <TrackActionSheet />
        <TrackDetail />
        <EntityDetailOverlay />
        <BottomTabBar />
        <MiniPlayer />

        {/* Logout confirmation */}
        <Modal
          animationType="fade"
          transparent
          visible={logoutConfirmVisible}
          onRequestClose={() => setLogoutConfirmVisible(false)}
        >
          <Pressable style={sheet.backdrop} onPress={() => setLogoutConfirmVisible(false)}>
            <Pressable style={[sheet.dialog, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={() => {}}>
              <View style={sheet.iconWrap}>
                <Ionicons name="log-out-outline" size={32} color={theme.accent} />
              </View>
              <Text style={[sheet.title, { color: theme.text }]}>Sign out?</Text>
              <Text style={[sheet.body, { color: theme.muted }]}>
                You'll need to sign in again to access your library.
              </Text>
              <View style={sheet.actions}>
                <Pressable
                  style={[sheet.btn, { borderColor: theme.border }]}
                  onPress={() => setLogoutConfirmVisible(false)}
                >
                  <Text style={[sheet.btnLabel, { color: theme.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[sheet.btn, sheet.btnDestructive, { backgroundColor: theme.accent }]}
                  onPress={() => { setLogoutConfirmVisible(false); void handleLogout(); }}
                >
                  <Text style={[sheet.btnLabel, { color: theme.accentText }]}>Sign out</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const sheet = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  dialog: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
  body: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  btnDestructive: {
    borderWidth: 0,
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
});
