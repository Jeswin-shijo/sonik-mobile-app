import Ionicons from '@expo/vector-icons/Ionicons';
import { Dimensions, Pressable, StyleSheet } from 'react-native';
import type { IconName } from '../types';

const isSmallScreen = Dimensions.get('window').width < 380;

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'ghost',
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  variant?: 'ghost' | 'solid';
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.iconButton,
        variant === 'solid' ? styles.iconButtonSolid : null,
      ]}
    >
      <Ionicons
        color={variant === 'solid' ? '#160f0b' : '#fbf7ef'}
        name={icon}
        size={variant === 'solid' ? 26 : 21}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(248,244,236,0.07)',
    borderColor: 'rgba(248,244,236,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    height: isSmallScreen ? 40 : 44,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    width: isSmallScreen ? 40 : 44,
  },
  iconButtonSolid: {
    backgroundColor: '#f5c15d',
    borderColor: '#f5c15d',
    height: isSmallScreen ? 48 : 52,
    minHeight: 44,
    minWidth: 44,
    width: isSmallScreen ? 48 : 52,
  },
});
