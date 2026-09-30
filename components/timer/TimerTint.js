import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

// Phase tint behind the run screen:
// radial-gradient(120% 70% at 50% 40%, <color>, transparent 70%).
// color: 'rgba(r,g,b,a)' theme token.
export default function TimerTint({ color }) {
  const [size, setSize] = useState(null);
  const [, r, g, b, a] = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/) ?? [];
  const rgb = `rgb(${r},${g},${b})`;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={e => setSize(e.nativeEvent.layout)}
    >
      {size && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <RadialGradient
              id="tint"
              gradientUnits="userSpaceOnUse"
              cx={size.width * 0.5}
              cy={size.height * 0.4}
              rx={size.width * 1.2}
              ry={size.height * 0.7}
              fx={size.width * 0.5}
              fy={size.height * 0.4}
            >
              <Stop offset="0" stopColor={rgb} stopOpacity={Number(a)} />
              <Stop offset="0.7" stopColor={rgb} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={size.width} height={size.height} fill="url(#tint)" />
        </Svg>
      )}
    </View>
  );
}
