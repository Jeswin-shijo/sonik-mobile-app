import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

type Props = {
  size?: number;
};

const BARS = [
  { x: 2,  h: 10 },
  { x: 8,  h: 17 },
  { x: 14, h: 24 },
  { x: 20, h: 17 },
  { x: 26, h: 10 },
];
const VB_W = 32;
const VB_H = 26;
const BAR_W = 4;
const CY = VB_H / 2;

export function SonikLogo({ size = 32 }: Props) {
  const aspect = VB_W / VB_H;
  const width = size * aspect;

  return (
    <Svg width={width} height={size} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <LinearGradient id="sonik-grad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#f5c15d" />
          <Stop offset="0.5" stopColor="#ff8c69" />
          <Stop offset="1" stopColor="#55d6c2" />
        </LinearGradient>
      </Defs>
      {BARS.map(({ x, h }) => (
        <Rect
          key={x}
          x={x}
          y={CY - h / 2}
          width={BAR_W}
          height={h}
          rx={BAR_W / 2}
          fill="url(#sonik-grad)"
        />
      ))}
    </Svg>
  );
}
