import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  micOnLine, phraseLine, errorLine, phraseCount,
  appendVoiceLog, readVoiceLog, clearVoiceLog, MAX_LOG_LINES,
} from '../voiceLog';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const AT = new Date(2026, 9, 29, 15, 21, 58);

describe('micOnLine', () => {
  it('heads a mic session with the recognizer and phone', () => {
    expect(micOnLine(AT, {
      onDevice: true, service: 'com.google.android.as',
      platform: 'android', os: 36, device: 'samsung SM-S938B',
    })).toBe('--- 2026-10-29 15:21 mic on · offline (com.google.android.as) · android 36 · samsung SM-S938B');
  });

  it('ends with the app version when known', () => {
    expect(micOnLine(AT, { onDevice: false, platform: 'android', os: 37, app: '1.0.1 (6)' }))
      .toBe('--- 2026-10-29 15:21 mic on · online · android 37 · app 1.0.1 (6)');
  });

  it('says online and skips a missing device', () => {
    expect(micOnLine(AT, { onDevice: false, platform: 'ios', os: '18.1', device: '' }))
      .toBe('--- 2026-10-29 15:21 mic on · online · ios 18.1');
  });
});

describe('phraseLine', () => {
  it('lists every distinct alternative and what the app did', () => {
    expect(phraseLine(AT, {
      alts: ['combo tree', 'combo three', 'combo tree', ''],
      did: ['Combo 3'],
    })).toBe('15:21:58  "combo tree" | "combo three"  → Combo 3');
  });

  it('notes why a phrase did nothing', () => {
    expect(phraseLine(AT, { alts: ['ding'], did: [], note: 'ignored: during our bell or voice' }))
      .toBe('15:21:58  "ding"  (ignored: during our bell or voice)');
    expect(phraseLine(AT, {})).toBe('15:21:58  (nothing)');
  });

  it('shortens long alternatives', () => {
    const line = phraseLine(AT, { alts: ['la '.repeat(40)] });
    expect(line).toBe(`15:21:58  "${'la '.repeat(20)}…"`);
  });
});

describe('phraseCount', () => {
  it('counts phrases, not headers or errors', () => {
    expect(phraseCount([
      micOnLine(AT, { onDevice: false, platform: 'android', os: 36 }),
      phraseLine(AT, { alts: ['combo 3'] }),
      errorLine(AT, 'network', 'No connection'),
      phraseLine(AT, { alts: ['timer pause'] }),
    ])).toBe(2);
  });
});

describe('voice log storage', () => {
  beforeEach(() => clearVoiceLog());

  it('keeps lines in order across reads', async () => {
    await appendVoiceLog('a');
    await appendVoiceLog('b');
    expect(await readVoiceLog()).toEqual(['a', 'b']);
    expect(JSON.parse(await AsyncStorage.getItem('@muaythai_voice_log'))).toEqual(['a', 'b']);
  });

  it('keeps only the newest lines', async () => {
    for (let i = 0; i < MAX_LOG_LINES + 3; i++) await appendVoiceLog(String(i));
    const log = await readVoiceLog();
    expect(log).toHaveLength(MAX_LOG_LINES);
    expect(log[0]).toBe('3');
  });

  it('clears', async () => {
    await appendVoiceLog('a');
    await clearVoiceLog();
    expect(await readVoiceLog()).toEqual([]);
  });
});
