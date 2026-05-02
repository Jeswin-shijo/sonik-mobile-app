import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { apiBaseUrl } from '../config';
import type { CoverClass, MusicTrack } from '../types';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;
const isMediumScreen = screenWidth >= 380 && screenWidth < 480;

const responsiveScale = (baseSize: number) => {
  if (isSmallScreen) return baseSize * 0.85;
  if (isMediumScreen) return baseSize * 0.92;
  return baseSize;
};

const coverPalettes: Record<CoverClass, { base: string; accent: string }> = {
  neon: { base: '#5334b8', accent: '#ff5a7a' },
  coast: { base: '#214d83', accent: '#55d6c2' },
  velvet: { base: '#5b367f', accent: '#c6537b' },
  summer: { base: '#9b4f2f', accent: '#f5c15d' },
  blue: { base: '#235d72', accent: '#65a8ff' },
};

export function TrackArt({
  track,
  size = 'medium',
  style,
}: {
  track: Pick<MusicTrack, 'coverClass'> & Partial<Pick<MusicTrack, 'coverUrl'>>;
  size?: 'small' | 'medium' | 'large';
  style?: StyleProp<ViewStyle>;
}) {
  const palette = coverPalettes[track.coverClass];
  const [hasImageError, setHasImageError] = useState(false);
  const imageSource = useMemo(() => {
    if (!track.coverUrl) {
      return null;
    }

    const normalizedCoverUrl = track.coverUrl.startsWith('http')
      ? track.coverUrl
      : track.coverUrl.startsWith('/')
        ? track.coverUrl
        : `/${track.coverUrl}`;

    return normalizedCoverUrl.startsWith('http')
      ? normalizedCoverUrl
      : `${apiBaseUrl}${normalizedCoverUrl}`;
  }, [track.coverUrl]);
  const shouldShowImage = Boolean(imageSource && !hasImageError);

  useEffect(() => {
    setHasImageError(false);
  }, [imageSource]);

  return (
    <View
      style={[
        styles.trackArt,
        size === 'small'
          ? styles.trackArtSmall
          : size === 'large'
            ? styles.trackArtLarge
            : styles.trackArtMedium,
        { backgroundColor: palette.base },
        style,
      ]}
    >
      {shouldShowImage && imageSource ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => setHasImageError(true)}
          resizeMode="cover"
          source={{ uri: imageSource }}
          style={styles.coverImage}
        />
      ) : (
        <>
          <View style={[styles.artFrame, { borderColor: palette.accent }]} />
          <View style={[styles.artCircle, { backgroundColor: palette.accent }]} />
          <View style={styles.artLine} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trackArt: {
    overflow: 'hidden',
  },
  coverImage: {
    height: '100%',
    width: '100%',
  },
  trackArtSmall: {
    borderRadius: 8,
    height: responsiveScale(46),
    width: responsiveScale(46),
  },
  trackArtMedium: {
    borderRadius: 8,
    height: responsiveScale(92),
    width: responsiveScale(92),
  },
  trackArtLarge: {
    alignSelf: 'center',
    borderRadius: 8,
    height: isSmallScreen ? 160 : isMediumScreen ? 185 : 210,
    marginVertical: 12,
    width: isSmallScreen ? 160 : isMediumScreen ? 185 : 210,
  },
  artFrame: {
    borderRadius: 24,
    borderWidth: 2,
    height: '58%',
    left: '20%',
    position: 'absolute',
    top: '18%',
    transform: [{ rotate: '20deg' }],
    width: '58%',
  },
  artCircle: {
    borderRadius: 999,
    bottom: '12%',
    height: '34%',
    opacity: 0.9,
    position: 'absolute',
    right: '12%',
    width: '34%',
  },
  artLine: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 999,
    bottom: '14%',
    height: '15%',
    left: '12%',
    position: 'absolute',
    width: '48%',
  },
});
