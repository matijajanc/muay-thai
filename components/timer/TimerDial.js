import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Circle, Path, Line, Text as SvgText } from 'react-native-svg';
import { colors } from '../../constants/theme';

// Analog "gym clock" (frame N), ported 1:1 from the wireframe's svg.dial
// renderer: the wedge is the time left (a full circle = the current phase),
// the hand sweeps clockwise from 12, the rim marks the warning window, and the
// hub shows the digits and a short line.
//
// totalSec: phase length; leftSec: time left (fractional, for a smooth sweep);
// warnSec: warning window (0 = none); digits/sub: hub text ('' = none);
// hub: hub radius (44, or 26 in the Top/Bottom bands); pulse: changes → one pulse.

const R = 90;
const pt = (deg, r) => [
  100 + r * Math.sin((deg * Math.PI) / 180),
  100 - r * Math.cos((deg * Math.PI) / 180),
];
const f = (n) => n.toFixed(2);

export default function TimerDial({
  size, totalSec, leftSec, color, warnSec = 0, digits = '', sub = '', hub = 44, pulse,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!pulse) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.05, duration: 140, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [pulse, scale]);

  const total = Math.max(1, totalSec);
  const left = Math.max(0, Math.min(total, leftSec));
  const a = (1 - left / total) * 360; // elapsed angle, clockwise from 12

  let wedge = null;
  if (left >= total) {
    wedge = <Circle cx="100" cy="100" r={R} fill={color} />;
  } else if (left > 0) {
    const [x, y] = pt(a, R);
    wedge = (
      <Path
        d={`M100 100L${f(x)} ${f(y)}A${R} ${R} 0 ${360 - a > 180 ? 1 : 0} 1 100 ${100 - R}Z`}
        fill={color}
      />
    );
  }

  let warnArc = null;
  if (warnSec) {
    const [x, y] = pt((1 - warnSec / total) * 360, 95);
    warnArc = (
      <Path
        d={`M${f(x)} ${f(y)}A95 95 0 0 1 100 5`}
        fill="none"
        stroke={colors.timerWarn}
        strokeWidth="5"
        strokeLinecap="round"
      />
    );
  }

  const step = total <= 60 ? 5 : total <= 180 ? 15 : 30;
  const ticks = [];
  for (let t = 0; t < total; t += step) {
    const deg = (t / total) * 360;
    const major = total > 60 ? t % 60 === 0 : t % 15 === 0;
    const [x1, y1] = pt(deg, R - (major ? 16 : 8));
    const [x2, y2] = pt(deg, R - 1);
    ticks.push(
      <Line
        key={t}
        x1={f(x1)}
        y1={f(y1)}
        x2={f(x2)}
        y2={f(y2)}
        stroke="#ffffff"
        strokeOpacity={major ? 0.85 : 0.45}
        strokeWidth={major ? 3.5 : 2}
        strokeLinecap="round"
      />,
    );
  }

  const [hx, hy] = pt(a, R + 3);

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale }] }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Circle cx="100" cy="100" r="98" fill={colors.dialFace} stroke={colors.dialStroke} strokeWidth="2" />
        {wedge}
        {warnArc}
        {ticks}
        <Line x1="100" y1="100" x2={f(hx)} y2={f(hy)} stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
        <Circle cx="100" cy="100" r={hub} fill={colors.dialHub} fillOpacity={0.95} />
        {digits ? (
          <SvgText
            x="100"
            y={sub ? 108 : 112}
            textAnchor="middle"
            fill="#ffffff"
            fontSize="34"
            fontWeight="500"
          >
            {digits}
          </SvgText>
        ) : null}
        {digits && sub ? (
          <SvgText
            x="100"
            y="131"
            textAnchor="middle"
            fill={colors.textSecondary}
            fontSize="13"
            fontWeight="700"
            letterSpacing="1"
          >
            {sub}
          </SvgText>
        ) : null}
      </Svg>
    </Animated.View>
  );
}
