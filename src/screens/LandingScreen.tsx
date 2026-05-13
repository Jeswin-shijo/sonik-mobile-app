import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../context/AppContext';

const RADIAL_N = 36;
const radialHeights = Array.from({ length: RADIAL_N }, (_, i) => {
  const pos = i / RADIAL_N;
  return 0.3 + 0.7 * Math.abs(Math.sin(pos * Math.PI * 5 + 0.8));
});

const INNER_BARS = [
  { relH: 0.42, color: '#f5c15d' },
  { relH: 0.68, color: '#ff8c69' },
  { relH: 1.0,  color: '#55d6c2' },
  { relH: 0.68, color: '#ff8c69' },
  { relH: 0.42, color: '#f5c15d' },
];
const MAX_INNER_H = 38;

function AnimatedInnerBars() {
  const anims = useRef(INNER_BARS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    anims.forEach((anim, i) => {
      const loop = () => {
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.12 + Math.random() * 0.2,
            duration: 180 + Math.random() * 280,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.65 + Math.random() * 0.35,
            duration: 180 + Math.random() * 280,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => { if (finished) loop(); });
      };
      setTimeout(loop, i * 70);
    });
  }, []);

  return (
    <View style={crest.innerBars}>
      {INNER_BARS.map(({ relH, color }, i) => (
        <Animated.View
          key={i}
          style={{
            width: 5,
            height: MAX_INNER_H * relH,
            borderRadius: 3,
            backgroundColor: color,
            transform: [{ scaleY: anims[i] }],
          }}
        />
      ))}
    </View>
  );
}

function LogoCrest({ size = 200 }: { size?: number }) {
  const barAnims = useRef(radialHeights.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    barAnims.forEach((anim, i) => {
      const loop = () => {
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.08 + Math.random() * 0.22,
            duration: 220 + Math.random() * 320,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.6 + Math.random() * 0.4,
            duration: 220 + Math.random() * 320,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => { if (finished) loop(); });
      };
      setTimeout(loop, i * 25);
    });
  }, []);

  const cx = size / 2;
  const innerCircleR = size / 2 - 44;
  const barInnerR = innerCircleR + 10;
  const barOuterMaxR = size / 2 - 6;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Animated radial bars */}
      {radialHeights.map((h, i) => {
        const angle = (i / RADIAL_N) * 2 * Math.PI - Math.PI / 2;
        const maxBarLen = Math.max(4, h * (barOuterMaxR - barInnerR));
        const midR = barInnerR + maxBarLen / 2;
        const barW = 2.5;
        const color = i % 3 === 0 ? '#55d6c2' : i % 3 === 1 ? '#ff8c69' : '#f5c15d';

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: barW,
              height: maxBarLen,
              borderRadius: barW / 2,
              backgroundColor: color,
              left: cx + Math.cos(angle) * midR - barW / 2,
              top: cx + Math.sin(angle) * midR - maxBarLen / 2,
              opacity: 0.4 + h * 0.4,
              transform: [
                { rotate: `${(angle * 180) / Math.PI + 90}deg` },
                { scaleY: barAnims[i] },
              ],
            }}
          />
        );
      })}

      {/* Inner filled circle */}
      <View
        style={[
          crest.innerCircle,
          {
            width: innerCircleR * 2,
            height: innerCircleR * 2,
            borderRadius: innerCircleR,
          },
        ]}
      >
        <AnimatedInnerBars />
      </View>
    </View>
  );
}

const BG_BARS = [0.45, 0.7, 1, 0.8, 0.55, 0.65, 0.9, 0.6, 0.75, 1, 0.5, 0.85, 0.7, 0.4, 0.95];

// function PulsingBar({ height, delay, color }: { height: number; delay: number; color: string }) {
//   const anim = useRef(new Animated.Value(1)).current;

//   useEffect(() => {
//     Animated.loop(
//       Animated.sequence([
//         Animated.timing(anim, {
//           toValue: 0.25,
//           duration: 500 + Math.random() * 600,
//           delay,
//           easing: Easing.inOut(Easing.sin),
//           useNativeDriver: false,
//         }),
//         Animated.timing(anim, {
//           toValue: 1,
//           duration: 500 + Math.random() * 600,
//           easing: Easing.inOut(Easing.sin),
//           useNativeDriver: false,
//         }),
//       ]),
//     ).start();
//   }, []);

//   return (
//     <Animated.View
//       style={{
//         width: 5,
//         height: anim.interpolate({ inputRange: [0, 1], outputRange: [height * 0.2, height] }),
//         borderRadius: 3,
//         backgroundColor: color,
//         alignSelf: 'flex-end',
//         opacity: 0.55,
//       }}
//     />
//   );
// }

function FloatingNote({ symbol, x, delay }: { symbol: string; x: string; delay: number }) {
  const y = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = () => {
      y.setValue(0);
      opacity.setValue(0);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 400, delay, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(y, { toValue: -220, duration: 3000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(1200),
            Animated.timing(opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
          ]),
        ]),
      ]).start(() => run());
    };
    const t = setTimeout(run, delay);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.Text
      style={[styles.note, { left: x as `${number}%`, opacity, transform: [{ translateY: y }] }]}
    >
      {symbol}
    </Animated.Text>
  );
}

const noteConfigs = [
  { symbol: '♪', x: '10%', delay: 0 },
  { symbol: '♫', x: '25%', delay: 800 },
  { symbol: '♩', x: '45%', delay: 1600 },
  { symbol: '♬', x: '65%', delay: 400 },
  { symbol: '♪', x: '80%', delay: 1200 },
  { symbol: '𝅗𝅥', x: '55%', delay: 2000 },
];

export function LandingScreen() {
  const { handleGuestLogin, isSubmitting, setView } = useAppContext();

  const contentAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentAnim, { toValue: 1, duration: 900, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0a0614', '#1a0a2e', '#0f1a2e', '#0a1a1a']}
        locations={[0, 0.35, 0.7, 1]}
        style={styles.gradient}
      >
        {noteConfigs.map((n, i) => <FloatingNote key={i} {...n} />)}

        {/* <View style={styles.waveformBg}>
          {BG_BARS.map((h, i) => (
            <PulsingBar key={i} height={h * 120} delay={i * 60}
              color={i % 3 === 0 ? '#55d6c2' : i % 3 === 1 ? '#ff8c69' : '#f5c15d'} />
          ))}
        </View> */}

        <Animated.View
          style={[styles.content, { opacity: contentAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <LogoCrest size={200} />

          <View style={styles.brand}>
            <Text style={styles.brandName}>sonik</Text>
            <Text style={styles.tagline}>Your music, your way.</Text>
          </View>

          <View style={styles.pills}>
            {['Playlists', 'Smart Queue', 'Lyrics', 'Artists'].map((label) => (
              <View key={label} style={styles.pill}>
                <Text style={styles.pillText}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.buttons}>
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
              onPress={() => setView('login')}
            >
              <LinearGradient
                colors={['#f5c15d', '#ff8c69', '#55d6c2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnPrimaryText}>Get Started</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.btnSecondary,
                isSubmitting && styles.btnDisabled,
                pressed && !isSubmitting && { opacity: 0.7 },
              ]}
              onPress={handleGuestLogin}
            >
              <Text style={styles.btnSecondaryText}>
                {isSubmitting ? 'Starting guest session' : 'Continue as Guest'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.btnDismiss, pressed && { opacity: 0.7 }]}
              onPress={() => BackHandler.exitApp()}
            >
              <Text style={styles.btnDismissText}>Dismiss</Text>
            </Pressable>
          </View>
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const crest = StyleSheet.create({
  innerCircle: {
    position: 'absolute',
    backgroundColor: '#130a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: MAX_INNER_H,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0614' },
  gradient: { flex: 1, overflow: 'hidden' },
  waveformBg: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 140,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
    opacity: 0.6,
  },
  note: {
    position: 'absolute',
    bottom: 160,
    fontSize: 28,
    color: '#55d6c2',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
    gap: 24,
  },
  brand: { alignItems: 'center', gap: 8 },
  brandName: {
    fontSize: 48, fontWeight: '900', color: '#ffffff', letterSpacing: -1,
  },
  tagline: {
    fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  pillText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  buttons: { width: '100%', gap: 12 },
  btnPrimary: { borderRadius: 16, overflow: 'hidden' },
  btnGradient: { paddingVertical: 17, alignItems: 'center', borderRadius: 16 },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#0a0614', letterSpacing: 0.2 },
  btnSecondary: {
    paddingVertical: 17, alignItems: 'center', borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  btnSecondaryText: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.2 },
  btnDismiss: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnDismissText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.2 },
  btnDisabled: { opacity: 0.55 },
});
