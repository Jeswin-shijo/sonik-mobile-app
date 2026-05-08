import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SonikLogo } from '../components/SonikLogo';
import { useAppContext } from '../context/AppContext';

export function BootScreen() {
  const { theme, themeMode, styles } = useAppContext();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <View style={styles.bootCard}>
        <SonikLogo size={56} />
        <ActivityIndicator color={theme.secondary} style={{ marginTop: 20 }} />
        <Text style={styles.bootText}>Opening Sonik</Text>
      </View>
    </SafeAreaView>
  );
}
