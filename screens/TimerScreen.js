import { useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { useTimerContext } from '../contexts/AppContext';
import { formatClock, isInfinite, MAX_ROUNDS } from '../utils/roundTimer';
import {
  setupSummary, startLabel, optionLabel, warningHint, delayHint, pillLabel,
} from '../utils/timerLabels';
import MicButton from '../components/MicButton';
import TimerIcon from '../components/timer/TimerIcon';
import { SectionLabel, Chip, Btn, Toggle } from '../components/timer/TimerUI';
import {
  DurationSheet, OptionSheet, ClockPositionSheet, SavePresetSheet, CLOCK_POSITIONS,
} from '../components/timer/TimerSheets';
import { TimerRunView, TimerDoneView } from '../components/timer/TimerRunView';

const TEST_SOUNDS = [
  { key: 'bell', label: 'Start bell', icon: 'bell' },
  { key: 'bell-x3', label: 'End bell ×3', icon: 'bell' },
  { key: 'clap', label: 'Clap', icon: 'clap' },
  { key: 'beep', label: 'Beep', icon: 'beep' },
  { key: 'voice', label: 'Voice', icon: 'speak' },
];

// .card .r: label + value, highlighted for a moment after a voice edit (C).
function Row({ label, children, onPress, highlighted = false, last = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, last && styles.rowLast, highlighted && styles.rowHighlighted]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </Pressable>
  );
}

// .r b: value + chevron (+ optional small note).
function Value({ text, note, highlighted = false }) {
  return (
    <View style={styles.value}>
      <Text style={[styles.valueText, highlighted && { color: colors.accent }]}>{text}</Text>
      {note ? <Text style={styles.valueNote}>{note}</Text> : null}
      <TimerIcon name="chev" size={12} color={colors.textMuted} />
    </View>
  );
}

// .step: − 5 +
function RoundsStepper({ rounds, onChange, highlighted = false }) {
  const dec = () => onChange(isInfinite(rounds) ? MAX_ROUNDS : Math.max(1, rounds - 1));
  const inc = () => onChange(isInfinite(rounds) || rounds >= MAX_ROUNDS ? null : rounds + 1);
  return (
    <View style={styles.step}>
      <Pressable onPress={dec} hitSlop={8} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={[styles.valueText, highlighted && { color: colors.accent }]}>
        {isInfinite(rounds) ? '∞' : rounds}
      </Text>
      <Pressable onPress={inc} hitSlop={8} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

// Timer tab when idle (A, A2, C) with its sheets (B–B4).
function TimerSetup() {
  const {
    settings, presets, customPresets, selectedPreset, update, applyPreset, savePreset,
    deletePreset, flashedField, start, testCue,
  } = useTimerContext();
  // Which sheet is open: 'roundSec' | 'restSec' | 'roundWarnSec' | 'restWarnSec' | 'delaySec' | 'clock' | 'save'.
  const [sheet, setSheet] = useState(null);
  const close = () => setSheet(null);
  // The time sheet keeps showing round or rest while it fades out.
  const durationFieldRef = useRef('roundSec');
  if (sheet === 'roundSec' || sheet === 'restSec') durationFieldRef.current = sheet;
  const durationField = durationFieldRef.current;

  // Built-ins, then saved presets. "Custom" sits right after the preset the
  // edited values came from.
  const chips = presets.map(p => ({ preset: p }));
  if (!selectedPreset) {
    const base = chips.findIndex(c => c.preset.id === settings.presetId);
    chips.splice(base + 1, 0, { custom: true });
  }

  const confirmDelete = (preset) => {
    Alert.alert(`Delete “${preset.name}”?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePreset(preset.id) },
    ]);
  };

  const hl = (field) => flashedField === field;
  const clockLabel = CLOCK_POSITIONS.find(p => p.key === settings.trainingClock)?.label;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Round timer</Text>
        <Text style={styles.subtitle}>{setupSummary(settings)}</Text>
        <MicButton
          style={styles.mic}
          idleText="Tap to listen: “set 2 min countdown”"
          listeningText="Listening: “set 2 min countdown”"
        />

        <SectionLabel>Presets</SectionLabel>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          {chips.map(c =>
            c.custom ? (
              <Chip key="custom" label="Custom" on />
            ) : (
              <Chip
                key={c.preset.id}
                label={c.preset.name}
                on={selectedPreset?.id === c.preset.id}
                onPress={() => applyPreset(c.preset)}
                onLongPress={
                  customPresets.includes(c.preset) ? () => confirmDelete(c.preset) : undefined
                }
              />
            ))}
          <Chip label="＋ Save" dashed onPress={() => setSheet('save')} />
        </ScrollView>

        <SectionLabel>Rounds</SectionLabel>
        <View style={styles.card}>
          <Row label="Round time" onPress={() => setSheet('roundSec')} highlighted={hl('roundSec')}>
            <Value text={formatClock(settings.roundSec)} highlighted={hl('roundSec')} />
          </Row>
          <Row label="Rest" onPress={() => setSheet('restSec')} highlighted={hl('restSec')}>
            <Value text={formatClock(settings.restSec)} highlighted={hl('restSec')} />
          </Row>
          <Row label="Rounds" highlighted={hl('rounds')}>
            <RoundsStepper
              rounds={settings.rounds}
              onChange={rounds => update({ rounds })}
              highlighted={hl('rounds')}
            />
          </Row>
          <Row label="Start delay" onPress={() => setSheet('delaySec')} highlighted={hl('delaySec')} last>
            <Value text={optionLabel(settings.delaySec)} highlighted={hl('delaySec')} />
          </Row>
        </View>

        <SectionLabel>Cues</SectionLabel>
        <View style={styles.card}>
          <Row label="Round-end warning" onPress={() => setSheet('roundWarnSec')}>
            <Value text={optionLabel(settings.roundWarnSec)} note={settings.roundWarnSec ? 'clap' : null} />
          </Row>
          <Row label="Rest-end warning" onPress={() => setSheet('restWarnSec')}>
            <Value text={optionLabel(settings.restWarnSec)} note={settings.restWarnSec ? 'beep' : null} />
          </Row>
          <Row label="3-2-1 beeps" onPress={() => update({ beeps: !settings.beeps })}>
            <Toggle on={settings.beeps} />
          </Row>
          <Row label="Voice announcements" onPress={() => update({ voice: !settings.voice })}>
            <Toggle on={settings.voice} />
          </Row>
          <Row label="Vibrate" onPress={() => update({ vibrate: !settings.vibrate })} last>
            <Toggle on={settings.vibrate} />
          </Row>
        </View>

        <SectionLabel>Test sounds</SectionLabel>
        <View style={styles.testChips}>
          {TEST_SOUNDS.map(t => (
            <Chip key={t.key} label={t.label} icon={t.icon} onPress={() => testCue(t.key)} />
          ))}
        </View>

        <SectionLabel>Display</SectionLabel>
        <View style={styles.card}>
          <Row label="Clock on Training" onPress={() => setSheet('clock')} last>
            <Value text={clockLabel} />
          </Row>
        </View>
      </ScrollView>

      <View style={styles.dock}>
        <Btn label={startLabel(settings)} icon="play" onPress={() => start()} />
      </View>

      <DurationSheet
        visible={sheet === 'roundSec' || sheet === 'restSec'}
        kind={durationField === 'restSec' ? 'rest' : 'round'}
        value={settings[durationField]}
        onChange={v => update({ [durationField]: v })}
        onClose={close}
      />
      <OptionSheet
        visible={sheet === 'roundWarnSec'}
        title="Round-end warning"
        meta="sound: clap"
        value={settings.roundWarnSec}
        hint={v => warningHint('round', v)}
        onChange={v => update({ roundWarnSec: v })}
        onClose={close}
      />
      <OptionSheet
        visible={sheet === 'restWarnSec'}
        title="Rest-end warning"
        meta="sound: beep"
        value={settings.restWarnSec}
        hint={v => warningHint('rest', v)}
        onChange={v => update({ restWarnSec: v })}
        onClose={close}
      />
      <OptionSheet
        visible={sheet === 'delaySec'}
        title="Start delay"
        meta="before round 1"
        value={settings.delaySec}
        hint={delayHint}
        onChange={v => update({ delaySec: v })}
        onClose={close}
      />
      <ClockPositionSheet
        visible={sheet === 'clock'}
        value={settings.trainingClock}
        onChange={v => update({ trainingClock: v })}
        onClose={close}
      />
      <SavePresetSheet
        visible={sheet === 'save'}
        meta={`${pillLabel(settings)} · rest ${formatClock(settings.restSec)}`}
        reservedNames={presets.filter(p => !customPresets.includes(p)).map(p => p.name)}
        onSave={name => {
          savePreset(name);
          close();
        }}
        onClose={close}
      />
    </SafeAreaView>
  );
}

export default function TimerScreen() {
  const { status } = useTimerContext();
  if (status === 'running' || status === 'paused') return <TimerRunView />;
  if (status === 'done') return <TimerDoneView />;
  return <TimerSetup />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingTop: 6, paddingHorizontal: 12, paddingBottom: 12 },

  title: { fontSize: 17, fontWeight: '500', color: colors.title },
  subtitle: { fontSize: 11, color: colors.subtitle, marginTop: 1 },
  mic: { marginTop: 12, marginBottom: 0 },

  chipScroll: { marginHorizontal: -12 },
  chipRow: { gap: 6, paddingHorizontal: 12 },
  testChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  row: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowHighlighted: { backgroundColor: colors.optionOnBg, marginHorizontal: -12, paddingHorizontal: 12 },
  rowLabel: { fontSize: 12.5, color: colors.textSecondary },
  value: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  valueText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  valueNote: { fontSize: 10.5, color: colors.textMuted, marginLeft: 4 },

  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: colors.accent, fontSize: 14, lineHeight: 14, includeFontPadding: false },

  dock: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
