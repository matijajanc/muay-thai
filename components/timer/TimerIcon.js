import Svg, { Path, Rect, Circle, G } from 'react-native-svg';

// The wireframe's icon set (its <symbol> defs), 24×24 viewBox, ported 1:1.
const stroke = (color, width, extra) => ({
  fill: 'none', stroke: color, strokeWidth: width, strokeLinecap: 'round', ...extra,
});

const ICONS = {
  timer: (c) => (
    <G {...stroke(c, 2)}>
      <Circle cx="12" cy="13.5" r="7.5" />
      <Path d="M12 9.5v4l2.5 2M9.5 2.5h5" />
    </G>
  ),
  play: (c) => <Path d="M7 4.5v15l12.5-7.5z" fill={c} />,
  pause: (c) => (
    <G fill={c}>
      <Rect x="6" y="4.5" width="4" height="15" rx="1" />
      <Rect x="14" y="4.5" width="4" height="15" rx="1" />
    </G>
  ),
  stop: (c) => <Rect x="6" y="6" width="12" height="12" rx="2" fill={c} />,
  skip: (c) => (
    <G fill={c}>
      <Path d="M5 5v14l10-7z" />
      <Rect x="16.5" y="5" width="2.5" height="14" rx="1" />
    </G>
  ),
  bell: (c) => (
    <G {...stroke(c, 2, { strokeLinecap: undefined, strokeLinejoin: 'round' })}>
      <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 1.8H4.2z" />
      <Path d="M10 21h4" strokeLinecap="round" />
    </G>
  ),
  clap: (c) => (
    <G {...stroke(c, 2.2)}>
      <Path d="M5 20L14 4M10 20L19 4" />
      <Path d="M3 8l2 1M2.5 12h2.2" strokeWidth="1.6" />
    </G>
  ),
  beep: (c) => (
    <G {...stroke(c, 2)}>
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" strokeLinejoin="round" />
      <Path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </G>
  ),
  speak: (c) => (
    <Path d="M4 5h16v11H10l-5 4v-4H4z" {...stroke(c, 2, { strokeLinecap: undefined, strokeLinejoin: 'round' })} />
  ),
  check: (c) => <Path d="M5 12.5l4.5 4.5L19 7.5" {...stroke(c, 2.6, { strokeLinejoin: 'round' })} />,
  // The Stats day dots draw it bolder (Stats wireframe).
  checkBold: (c) => <Path d="M5 12.5l4.5 4.5L19 7.5" {...stroke(c, 2.8, { strokeLinejoin: 'round' })} />,
  chev: (c) => <Path d="M9 6l6 6-6 6" {...stroke(c, 2.4)} />,
  barbell: (c) => <Path d="M3 9v6M6.5 6.5v11M17.5 6.5v11M21 9v6M6.5 12h11" {...stroke(c, 2)} />,
  flame: (c) => (
    <Path
      d="M12 2.5c.6 3.2 4.5 5.3 4.5 10.2A4.5 4.5 0 0 1 12 21.5a5.5 5.5 0 0 1-5.5-5.6c0-2.6 1.4-4.2 2.6-5.4.2 1.6.8 2.6 1.9 3.1C10.6 9.8 11.2 6 12 2.5z"
      fill={c}
    />
  ),
  stats: (c) => (
    <G {...stroke(c, 2)}>
      <Path d="M4 20h16" />
      <Rect x="5.5" y="11" width="3" height="6.5" rx=".8" />
      <Rect x="10.5" y="6.5" width="3" height="11" rx=".8" />
      <Rect x="15.5" y="13.5" width="3" height="4" rx=".8" />
    </G>
  ),
  restart: (c) => (
    <G {...stroke(c, 2, { strokeLinejoin: 'round' })}>
      <Path d="M4.5 12a7.5 7.5 0 1 0 2.6-5.7" />
      <Path d="M4.5 3.5v4h4" />
    </G>
  ),
};

export default function TimerIcon({ name, size = 16, color, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {ICONS[name](color)}
    </Svg>
  );
}
