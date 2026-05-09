import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const CROP_SIZE = Math.round(SCREEN_W * 0.82);
const SIDE = (SCREEN_W - CROP_SIZE) / 2;

interface Props {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onSave: (croppedUri: string) => void;
  onCancel: () => void;
}

export function AvatarCropModal({ imageUri, imageWidth, imageHeight, onSave, onCancel }: Props) {
  const [saving, setSaving] = useState(false);

  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const offset = useRef({ x: 0, y: 0 });

  const scale = CROP_SIZE / Math.min(imageWidth, imageHeight);
  const dw = imageWidth * scale;
  const dh = imageHeight * scale;
  const maxX = (dw - CROP_SIZE) / 2;
  const maxY = (dh - CROP_SIZE) / 2;

  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, { dx, dy }) => {
      tx.setValue(clamp(offset.current.x + dx, -maxX, maxX));
      ty.setValue(clamp(offset.current.y + dy, -maxY, maxY));
    },
    onPanResponderRelease: (_, { dx, dy }) => {
      offset.current = {
        x: clamp(offset.current.x + dx, -maxX, maxX),
        y: clamp(offset.current.y + dy, -maxY, maxY),
      };
    },
  });

  async function handleSave() {
    setSaving(true);
    try {
      const ox = offset.current.x;
      const oy = offset.current.y;
      const origScale = imageWidth / dw;
      const cropX = Math.max(0, Math.round((maxX - ox) * origScale));
      const cropY = Math.max(0, Math.round((maxY - oy) * origScale));
      const cropWH = Math.round(CROP_SIZE * origScale);
      const safeW = Math.min(cropWH, imageWidth - cropX);
      const safeH = Math.min(cropWH, imageHeight - cropY);

      const result = await manipulateAsync(
        imageUri,
        [{ crop: { originX: cropX, originY: cropY, width: safeW, height: safeH } }],
        { compress: 0.9, format: SaveFormat.JPEG },
      );
      onSave(result.uri);
    } catch (e) {
      setSaving(false);
      Alert.alert('Crop failed', String(e));
    }
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.titleTxt}>Move and Scale</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#f59e0b" />
            ) : (
              <Text style={styles.saveTxt}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.cropContainer} {...pan.panHandlers}>
          <Animated.Image
            source={{ uri: imageUri }}
            style={{ width: dw, height: dh, transform: [{ translateX: tx }, { translateY: ty }] }}
          />
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={[styles.dark, { height: SIDE, width: SCREEN_W }]} />
            <View style={[styles.dark, { position: 'absolute', bottom: 0, height: SIDE, width: SCREEN_W }]} />
            <View style={[styles.dark, { position: 'absolute', top: SIDE, left: 0, width: SIDE, height: CROP_SIZE }]} />
            <View style={[styles.dark, { position: 'absolute', top: SIDE, right: 0, width: SIDE, height: CROP_SIZE }]} />
            <View style={[styles.circle, { left: SIDE, top: SIDE, width: CROP_SIZE, height: CROP_SIZE, borderRadius: CROP_SIZE / 2 }]} />
          </View>
        </View>

        <Text style={styles.hint}>Drag to reposition</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerBtn: { minWidth: 64 },
  titleTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelTxt: { color: '#aaa', fontSize: 15 },
  saveTxt: { color: '#f59e0b', fontSize: 15, fontWeight: '600', textAlign: 'right' },
  cropContainer: {
    width: SCREEN_W,
    height: SCREEN_W,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dark: { backgroundColor: 'rgba(0,0,0,0.65)' },
  circle: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  hint: { color: '#555', fontSize: 13, textAlign: 'center', marginTop: 20 },
});
