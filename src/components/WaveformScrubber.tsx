import { useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, ViewStyle } from 'react-native';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

const BAR_COUNT = 60;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

function seededRandom(seed: number): () => number {
  let s = Math.abs(seed) || 1;
  return () => {
    s = ((s * 1664525) + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateBars(trackId: string): number[] {
  const seed = trackId.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7);
  const rng = seededRandom(seed);
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const rand = rng();
    const pos = i / BAR_COUNT;
    const envelope = Math.pow(Math.sin(pos * Math.PI), 0.4) * 0.45 + 0.55;
    return Math.max(0.07, Math.min(1, rand * envelope));
  });
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function touchDistance(t: { pageX: number; pageY: number }[]) {
  if (t.length < 2) return 0;
  const dx = t[0]!.pageX - t[1]!.pageX;
  const dy = t[0]!.pageY - t[1]!.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface WaveformScrubberProps {
  trackId: string;
  progress: number;
  onSeek: (ratio: number) => void;
  accentColor: string;
  dimColor: string;
  playheadColor?: string;
  waveHeight?: number;
  style?: ViewStyle;
}

export function WaveformScrubber({
  trackId,
  progress,
  onSeek,
  accentColor,
  dimColor,
  playheadColor = '#ffffff',
  waveHeight = 52,
  style,
}: WaveformScrubberProps) {
  const bars = useMemo(() => generateBars(trackId), [trackId]);
  const [containerWidth, setContainerWidth] = useState(300);

  const zoomLevelRef = useRef(MIN_ZOOM);
  const visibleStartRef = useRef(0);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    zoomLevelRef.current = MIN_ZOOM;
    visibleStartRef.current = 0;
    forceUpdate(n => n + 1);
  }, [trackId]);

  const pinchRef = useRef<{
    initialDist: number;
    initialZoom: number;
    initialStart: number;
    midLocalX: number;
  } | null>(null);

  const isSeeking = useRef(false);
  // Snapshot of the view's left edge in screen coords, captured on touchStart.
  // Used in touchMove so locationX (which iOS clamps to [0, width]) can't
  // accidentally trigger a seek when the finger has slid outside the waveform.
  const viewPageOffsetX = useRef(0);

  function getVisibleWidth() {
    return 1 / zoomLevelRef.current;
  }

  function isInBounds(lx: number, ly: number) {
    return lx >= 0 && lx <= containerWidth && ly >= 0 && ly <= waveHeight;
  }

  function seekFromLocalX(localX: number) {
    // Clamp to 0.99 so dragging to the far right never triggers auto-advance
    const ratio = clamp(
      visibleStartRef.current + (clamp(localX, 0, containerWidth) / containerWidth) * getVisibleWidth(),
      0,
      0.99,
    );
    onSeek(ratio);
  }

  function handleTouchStart(e: GestureResponderEvent) {
    const touches = e.nativeEvent.touches;
    if (touches.length === 1) {
      const t = touches[0]!;
      // Snapshot the view's left edge in screen coords so touchMove can use
      // pageX for true unclamped coordinates.
      viewPageOffsetX.current = t.pageX - t.locationX;
      isSeeking.current = true;
      seekFromLocalX(t.locationX);
    } else if (touches.length >= 2) {
      const t0 = touches[0]!;
      const t1 = touches[1]!;
      // Reject pinch if either finger is outside the waveform bounds
      if (!isInBounds(t0.locationX, t0.locationY) || !isInBounds(t1.locationX, t1.locationY)) {
        return;
      }
      isSeeking.current = false;
      const dist = touchDistance([...touches]);
      const midLocalX = (t0.locationX + t1.locationX) / 2;
      pinchRef.current = {
        initialDist: dist,
        initialZoom: zoomLevelRef.current,
        initialStart: visibleStartRef.current,
        midLocalX: clamp(midLocalX, 0, containerWidth),
      };
    }
  }

  function handleTouchMove(e: GestureResponderEvent) {
    const touches = e.nativeEvent.touches;
    if (touches.length >= 2 && pinchRef.current) {
      const { initialDist, initialZoom, initialStart, midLocalX } = pinchRef.current;
      if (initialDist === 0) return;
      const scale = touchDistance([...touches]) / initialDist;
      const newZoom = clamp(initialZoom * scale, MIN_ZOOM, MAX_ZOOM);
      const newVisibleWidth = 1 / newZoom;
      const midRatio = midLocalX / containerWidth;
      const anchorPos = initialStart + midRatio * (1 / initialZoom);
      const newStart = clamp(anchorPos - midRatio * newVisibleWidth, 0, 1 - newVisibleWidth);
      zoomLevelRef.current = newZoom;
      visibleStartRef.current = newStart;
      forceUpdate(n => n + 1);
    } else if (touches.length === 1 && isSeeking.current) {
      // Use pageX minus the snapshotted view offset so we get a true local X
      // that goes negative when the finger slides left of the waveform — iOS
      // clamps locationX to [0, width] which would otherwise snap to position 0.
      const lx = touches[0]!.pageX - viewPageOffsetX.current;
      if (lx >= 0 && lx <= containerWidth) {
        seekFromLocalX(lx);
      }
    }
  }

  function handleTouchEnd(e: GestureResponderEvent) {
    const remaining = e.nativeEvent.touches;
    if (remaining.length === 0) {
      isSeeking.current = false;
      pinchRef.current = null;
    } else if (remaining.length === 1) {
      pinchRef.current = null;
      isSeeking.current = true;
    }
  }

  const visibleStart = visibleStartRef.current;
  const visibleWidth = getVisibleWidth();
  const progressFraction = progress / 100;
  const playheadLocalX = ((progressFraction - visibleStart) / visibleWidth) * containerWidth;

  const BAR_SLOT = containerWidth / BAR_COUNT;
  const BAR_W = Math.max(1.5, BAR_SLOT - 2);

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={[{ height: waveHeight }, style]}
    >
      <Svg width={containerWidth} height={waveHeight}>
        {bars.map((h, i) => {
          const barCenterTrackPos = visibleStart + ((i + 0.5) / BAR_COUNT) * visibleWidth;
          const isPlayed = barCenterTrackPos <= progressFraction;
          const svgH = Math.max(2, h * waveHeight * 0.88);
          const x = i * BAR_SLOT + (BAR_SLOT - BAR_W) / 2;
          const y = (waveHeight - svgH) / 2;
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={BAR_W}
              height={svgH}
              rx={BAR_W / 2}
              fill={isPlayed ? accentColor : dimColor}
            />
          );
        })}
        {playheadLocalX >= 0 && playheadLocalX <= containerWidth && (
          <>
            <Rect
              x={playheadLocalX - 1.5}
              y={0}
              width={3}
              height={waveHeight}
              rx={1.5}
              fill={playheadColor}
              opacity={0.9}
            />
            <Rect
              x={playheadLocalX - 5}
              y={(waveHeight - 10) / 2}
              width={10}
              height={10}
              rx={5}
              fill={playheadColor}
              opacity={1}
            />
          </>
        )}
      </Svg>
    </View>
  );
}
