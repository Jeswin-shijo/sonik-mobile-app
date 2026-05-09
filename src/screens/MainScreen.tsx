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
import { useIsOnline } from '../hooks/useIsOnline';
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
    setActivePanel,
    notifications,
    dismissNotification,
  } = useAppContext();

  const isOnline = useIsOnline();
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

        {/* Offline banner */}
        {!isOnline && (
          <Pressable
            onPress={() => setActivePanel('library')}
            style={sheet.offlineBanner}
          >
            <Ionicons color="#fff" name="cloud-offline-outline" size={16} />
            <Text style={sheet.offlineBannerText}>You're offline</Text>
            <Text style={sheet.offlineBannerLink}>View Downloads →</Text>
          </Pressable>
        )}

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

        {/* Notification toasts */}
        {notifications.length > 0 && (
          <View style={sheet.toastStack} pointerEvents="box-none">
            {notifications.map((n) => {
              const kindBg = n.kind === 'success' ? '#1a7a4a' : n.kind === 'warning' ? '#a86c1a' : '#1a5fa8';
              return (
                <View key={n.id} style={[sheet.toast, { backgroundColor: kindBg }]}>
                  <Text style={sheet.toastText} numberOfLines={2}>{n.message}</Text>
                  <Pressable onPress={() => dismissNotification(n.id)} style={sheet.toastDismiss}>
                    <Text style={sheet.toastDismissText}>✕</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
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
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    backgroundColor: '#c0392b',
  },
  offlineBannerText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  offlineBannerLink: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
  },
  toastStack: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  toastDismiss: {
    padding: 4,
  },
  toastDismissText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '700',
  },
});
