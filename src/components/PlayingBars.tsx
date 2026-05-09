import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

const CYCLE = 380;

export function PlayingBars({ color, size = 14 }: { color: string; size?: number }) {
  const b1 = useRef(new Animated.Value(0.5)).current;
  const b2 = useRef(new Animated.Value(1.0)).current;
  const b3 = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    function startLoop(anim: Animated.Value) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: CYCLE, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0.15, duration: CYCLE, useNativeDriver: false }),
        ])
      );
      loop.start();
      loops.push(loop);
    }

    // Stagger once via setTimeout — each loop then runs at the same CYCLE*2 cadence
    startLoop(b1);
    timers.push(setTimeout(() => startLoop(b2), 130));
    timers.push(setTimeout(() => startLoop(b3), 260));

    return () => {
      timers.forEach(clearTimeout);
      loops.forEach(l => l.stop());
    };
  }, []);

  const barW = Math.max(2, size * 0.16);
  const maxH = size * 0.9;
  const minH = size * 0.15;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: size }}>
      {[b1, b2, b3].map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            width: barW,
            height: anim.interpolate({ inputRange: [0, 1], outputRange: [minH, maxH] }),
            backgroundColor: color,
            borderRadius: 999,
          }}
        />
      ))}
    </View>
  );
}
