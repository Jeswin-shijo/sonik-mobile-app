import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Pressable, Text, View } from 'react-native';
import { bottomTabs } from '../constants/navigation';
import { useAppContext } from '../context/AppContext';

export function BottomTabBar() {
  const { theme, styles, activePanel, setActivePanel, tabSwitchAnim } = useAppContext();

  return (
    <View style={styles.bottomTabBar}>
      {bottomTabs.map((tab) => {
        const isActive = activePanel === tab.id;
        const tabIndex = bottomTabs.findIndex((t) => t.id === tab.id);
        const tabScale = tabSwitchAnim.interpolate({
          inputRange: bottomTabs.map((_, i) => i),
          outputRange: bottomTabs.map((_, i) => (i === tabIndex ? 1.08 : 1)),
        });

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={tab.id}
            onPress={() => setActivePanel(tab.id)}
            style={styles.bottomTab}
          >
            <Animated.View style={{ transform: [{ scale: tabScale }] }}>
              <Ionicons color={isActive ? theme.accent : theme.muted} name={tab.icon} size={22} />
            </Animated.View>
            <Text style={[styles.bottomTabLabel, isActive ? styles.bottomTabLabelActive : null]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
