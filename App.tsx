import * as WebBrowser from 'expo-web-browser';
import { AppProvider, useAppContext } from './src/context/AppContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { BootScreen } from './src/screens/BootScreen';
import { MainScreen } from './src/screens/MainScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

WebBrowser.maybeCompleteAuthSession();

function RootNavigator() {
  const { isBootstrapping, session, isSettingsOpen } = useAppContext();

  if (isBootstrapping) return <BootScreen />;
  if (!session) return <AuthScreen />;
  if (isSettingsOpen) return <SettingsScreen />;
  return <MainScreen />;
}

export default function App() {
  return (
    <AppProvider>
      <RootNavigator />
    </AppProvider>
  );
}
