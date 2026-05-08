import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { Animated, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
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
  if (hour < 17) return `Ready to play, ${name}?`;
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
            <Pressable style={styles.logoutButton} onPress={handleLogout}>
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
      </View>
    </SafeAreaView>
  );
}
