#!/usr/bin/env node
// Generates the round-timer cue sounds into assets/sounds/ (44.1 kHz, 16-bit mono WAV).
// No dependencies and fully deterministic (seeded noise), so re-running it
// reproduces the committed files byte for byte:
//
//   node scripts/generate-sounds.js
//   afplay assets/sounds/bell.wav

const fs = require('fs');
const path = require('path');

const SR = 44100;
const PEAK = 10 ** (-1 / 20); // normalize to about -1 dBFS
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

// mulberry32: tiny seeded PRNG so the noise is the same on every run.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const buffer = (seconds) => new Float64Array(Math.round(seconds * SR));

function mixInto(out, src, atSeconds) {
  const offset = Math.round(atSeconds * SR);
  for (let i = 0; i < src.length && offset + i < out.length; i++) out[offset + i] += src[i];
}

// Short raised-cosine fades so nothing clicks at the start or end.
function fade(buf, inMs, outMs) {
  const nIn = Math.round((inMs / 1000) * SR);
  const nOut = Math.round((outMs / 1000) * SR);
  for (let i = 0; i < nIn && i < buf.length; i++) buf[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / nIn);
  for (let i = 0; i < nOut && i < buf.length; i++) {
    buf[buf.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / nOut);
  }
  return buf;
}

function normalize(buf) {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < buf.length; i++) buf[i] *= PEAK / peak;
  return buf;
}

// RBJ band-pass biquad (constant 0 dB peak gain), applied in place.
function bandPass(buf, centerHz, q) {
  const w = (2 * Math.PI * centerHz) / SR;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0, b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

// One boxing-bell strike: inharmonic partials of ~740 Hz, each decaying at its
// own rate (higher partials die faster), in detuned pairs for shimmer, plus a
// 3 ms noise transient for the hammer.
const BELL_F0 = 740;
const BELL_PARTIALS = [
  // [ratio, amplitude, decay time constant in s]
  [0.5, 0.35, 2.4], // hum
  [1.0, 1.0, 1.7],
  [1.19, 0.5, 1.25],
  [1.5, 0.4, 1.0],
  [2.0, 0.55, 0.8],
  [2.74, 0.35, 0.5],
  [3.76, 0.25, 0.32],
  [5.4, 0.18, 0.2],
];

function bellStrike(seconds, seed) {
  const rand = rng(seed);
  const out = buffer(seconds);
  for (const [ratio, amp, tau] of BELL_PARTIALS) {
    const f = BELL_F0 * ratio;
    const beat = 0.7 + ratio * 0.5; // Hz between the pair → slow shimmer
    const p1 = rand() * 2 * Math.PI;
    const p2 = rand() * 2 * Math.PI;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const env = amp * Math.exp(-t / tau);
      out[i] += env * (0.62 * Math.sin(2 * Math.PI * f * t + p1)
        + 0.38 * Math.sin(2 * Math.PI * (f + beat) * t + p2));
    }
  }
  const strike = Math.round(0.003 * SR);
  for (let i = 0; i < strike; i++) out[i] += (rand() * 2 - 1) * 0.9 * (1 - i / strike);
  return fade(out, 1, 60);
}

// One knock of a wooden clapper: band-passed noise burst + damped wood resonances.
function knock(seed) {
  const rand = rng(seed);
  const out = buffer(0.2);
  const burst = buffer(0.02);
  for (let i = 0; i < burst.length; i++) {
    burst[i] = (rand() * 2 - 1) * Math.exp(-i / SR / 0.003);
  }
  bandPass(burst, 1600, 0.9);
  mixInto(out, burst.map(v => v * 2.2), 0);
  for (const [f, amp, tau] of [[900, 0.8, 0.022], [2100, 0.5, 0.012]]) {
    const p = rand() * 2 * Math.PI;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      out[i] += amp * Math.exp(-t / tau) * Math.sin(2 * Math.PI * f * t + p);
    }
  }
  return fade(out, 0.3, 30);
}

function tone(hz, seconds) {
  const out = buffer(seconds);
  for (let i = 0; i < out.length; i++) out[i] = Math.sin((2 * Math.PI * hz * i) / SR);
  return fade(out, 5, 5);
}

const SOUNDS = {
  // Start of a round: one strike.
  bell: () => bellStrike(2.8, 1),
  // End of a round: the classic "ding-ding-ding", three strikes 0.32 s apart.
  'bell-x3': () => {
    const out = buffer(0.64 + 2.4);
    [0, 0.32, 0.64].forEach((at, i) => mixInto(out, bellStrike(2.4, 10 + i), at));
    return fade(out, 1, 60);
  },
  // Round-end warning: two knocks 110 ms apart.
  clap: () => {
    const out = buffer(0.33);
    mixInto(out, knock(21), 0);
    mixInto(out, knock(22), 0.11);
    return fade(out, 0.3, 20);
  },
  // 3-2-1 tick.
  beep: () => tone(1000, 0.12),
  // Rest-end warning: double beep.
  'rest-warn': () => {
    const out = buffer(0.33);
    mixInto(out, tone(1000, 0.12), 0);
    mixInto(out, tone(1000, 0.12), 0.21);
    return out;
  },
};

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2);
  });
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, make] of Object.entries(SOUNDS)) {
  const samples = normalize(make());
  const file = path.join(OUT_DIR, `${name}.wav`);
  fs.writeFileSync(file, toWav(samples));
  console.log(`${path.relative(process.cwd(), file)}  ${(samples.length / SR).toFixed(2)} s`);
}
