import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { IconName, MusicTrack } from '../types';
import { TrackArt } from './TrackArt';

type CollectionColors = {
  surfaceSoft: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  secondary: string;
};

type Artwork =
  | {
      kind: 'track';
      track: Pick<MusicTrack, 'coverClass'> &
        Partial<Pick<MusicTrack, 'coverUrl'>>;
    }
  | {
      kind: 'image';
      uri: string;
      shape?: 'round' | 'square';
    }
  | {
      kind: 'initial';
      label: string;
      backgroundColor?: string;
    }
  | {
      kind: 'icon';
      icon: IconName;
      color: string;
      backgroundColor?: string;
    };

export function LibraryCollectionCard({
  artwork,
  colors,
  onPress,
  subtitle,
  title,
}: {
  artwork: Artwork;
  colors: CollectionColors;
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceSoft,
          borderColor: colors.border,
        },
      ]}
    >
      <View>{renderArtwork(artwork, colors)}</View>
      <View>
        <Text
          numberOfLines={2}
          style={[styles.title, { color: colors.text }]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={3}
          style={[styles.subtitle, { color: colors.muted }]}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function renderArtwork(artwork: Artwork, colors: CollectionColors) {
  if (artwork.kind === 'track') {
    return <TrackArt track={artwork.track} size="small" />;
  }

  if (artwork.kind === 'image') {
    return (
      <Image
        source={{ uri: artwork.uri }}
        style={[
          styles.artwork,
          artwork.shape === 'round' ? styles.roundArtwork : null,
        ]}
      />
    );
  }

  if (artwork.kind === 'initial') {
    return (
      <View
        style={[
          styles.artwork,
          styles.roundArtwork,
          {
            backgroundColor:
              artwork.backgroundColor ?? 'rgba(85,214,194,0.14)',
          },
        ]}
      >
        <Text style={[styles.initial, { color: colors.text }]}>
          {artwork.label.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.artwork,
        {
          backgroundColor: artwork.backgroundColor ?? colors.accent,
        },
      ]}
    >
      <Ionicons color={artwork.color} name={artwork.icon} size={22} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    minHeight: 156,
    padding: 12,
    width: 164,
  },
  artwork: {
    alignItems: 'center',
    borderRadius: 12,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 46,
  },
  roundArtwork: {
    borderRadius: 999,
  },
  initial: {
    fontSize: 20,
    fontWeight: '900',
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
  },
});
