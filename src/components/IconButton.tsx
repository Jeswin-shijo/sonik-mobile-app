import Ionicons from '@expo/vector-icons/Ionicons';
import { Dimensions, Pressable, StyleSheet } from 'react-native';
import type { IconName } from '../types';

const isSmallScreen = Dimensions.get('window').width < 380;

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'ghost',
  colors,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  variant?: 'ghost' | 'solid';
  colors?: {
    ghostIcon: string;
    solidIcon: string;
    ghostBackground: string;
    ghostBorder: string;
    solidBackground: string;
    solidBorder: string;
  };
}) {
  const palette = colors ?? {
    ghostIcon: '#fbf7ef',
    solidIcon: '#160f0b',
    ghostBackground: 'rgba(248,244,236,0.07)',
    ghostBorder: 'rgba(248,244,236,0.12)',
    solidBackground: '#f5c15d',
    solidBorder: '#f5c15d',
  };

  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.iconButton,
        {
          backgroundColor: palette.ghostBackground,
          borderColor: palette.ghostBorder,
        },
        variant === 'solid' ? styles.iconButtonSolid : null,
        variant === 'solid'
          ? {
              backgroundColor: palette.solidBackground,
              borderColor: palette.solidBorder,
            }
          : null,
      ]}
    >
      <Ionicons
        color={variant === 'solid' ? palette.solidIcon : palette.ghostIcon}
        name={icon}
        size={variant === 'solid' ? 26 : 21}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: isSmallScreen ? 40 : 44,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    width: isSmallScreen ? 40 : 44,
  },
  iconButtonSolid: {
    height: isSmallScreen ? 48 : 52,
    minHeight: 44,
    minWidth: 44,
    width: isSmallScreen ? 48 : 52,
  },
});
