#!/usr/bin/env node
/**
 * Generates all music and sound effects as original chiptune, synthesized from
 * scratch to 8-bit mono WAV. Nothing is downloaded and nothing is sampled, so
 * there is no third-party audio in the bundle.
 *
 * Run: npm run audio
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'assets', 'audio');
const RATE = 11025; // square waves need very little bandwidth; keeps files small

// --- note table -------------------------------------------------------------
const NOTES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function freq(note) {
  if (note === '-') return 0;
  const m = /^([A-G]#?)(\d)$/.exec(note);
  if (!m) throw new Error(`bad note ${note}`);
  const semis = NOTES[m[1]] + (Number(m[2]) - 4) * 12 - 9; // relative to A4
  return 440 * Math.pow(2, semis / 12);
}

// --- oscillators ------------------------------------------------------------
const osc = {
  square: (p, duty = 0.5) => ((p % 1) < duty ? 1 : -1),
  triangle: (p) => {
    const t = p % 1;
    return t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
  },
  saw: (p) => 2 * (p % 1) - 1,
  noise: () => Math.random() * 2 - 1,
};

/** Quantise to 4 bits so it sounds like hardware, not like a soft synth. */
function crush(v, bits = 4) {
  const steps = 2 ** bits;
  return Math.round(v * steps) / steps;
}

class Track {
  constructor(seconds) {
    this.n = Math.ceil(seconds * RATE);
    this.buf = new Float32Array(this.n);
  }

  /**
   * @param at start time (s)
   * @param dur duration (s)
   * @param note e.g. 'A4' or '-' for a rest
   */
  note(at, dur, note, { wave = 'square', duty = 0.5, gain = 0.2, attack = 0.005, release = 0.06, vibrato = 0 } = {}) {
    const f = freq(note);
    if (!f) return this;
    const start = Math.floor(at * RATE);
    const len = Math.floor(dur * RATE);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= this.n) continue;
      const t = i / RATE;
      const env =
        t < attack ? t / attack :
        t > dur - release ? Math.max(0, (dur - t) / release) : 1;
      const vf = vibrato ? f * (1 + Math.sin(t * Math.PI * 2 * 6) * vibrato) : f;
      phase += vf / RATE;
      const s = wave === 'noise' ? osc.noise() : osc[wave](phase, duty);
      this.buf[idx] += crush(s) * env * gain;
    }
    return this;
  }

  /** Percussive noise hit. */
  hit(at, dur, { gain = 0.25, decay = 3 } = {}) {
    const start = Math.floor(at * RATE);
    const len = Math.floor(dur * RATE);
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      if (idx >= this.n) break;
      const t = i / len;
      this.buf[idx] += osc.noise() * Math.exp(-decay * t * 3) * gain;
    }
    return this;
  }

  /** Frequency sweep, for blips and door sounds. */
  sweep(at, dur, f0, f1, { wave = 'square', duty = 0.5, gain = 0.25 } = {}) {
    const start = Math.floor(at * RATE);
    const len = Math.floor(dur * RATE);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      if (idx >= this.n) break;
      const t = i / len;
      const f = f0 + (f1 - f0) * t;
      phase += f / RATE;
      const env = Math.min(1, (1 - t) * 4);
      this.buf[idx] += crush(osc[wave](phase, duty)) * env * gain;
    }
    return this;
  }

  toWav() {
    const data = Buffer.alloc(this.n);
    for (let i = 0; i < this.n; i++) {
      const v = Math.max(-1, Math.min(1, this.buf[i]));
      data[i] = Math.round((v * 0.5 + 0.5) * 255);
    }
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);      // PCM
    header.writeUInt16LE(1, 22);      // mono
    header.writeUInt32LE(RATE, 24);
    header.writeUInt32LE(RATE, 28);   // byte rate
    header.writeUInt16LE(1, 32);      // block align
    header.writeUInt16LE(8, 34);      // bits
    header.write('data', 36);
    header.writeUInt32LE(data.length, 40);
    return Buffer.concat([header, data]);
  }
}

/**
 * Play a melody written as [note, beats] pairs. Keeping tunes in this form
 * makes the shape of the phrase readable in the source, which matters more
 * than cleverness for something this short that loops forever.
 */
function melody(t, seq, beat, opts, startBeat = 0) {
  let at = startBeat;
  for (const [note, beats] of seq) {
    t.note(at * beat, beats * beat * 0.92, note, opts);
    at += beats;
  }
  return at;
}

function bassline(t, roots, beat, barsPerRoot, opts) {
  let at = 0;
  for (const root of roots) {
    for (let i = 0; i < barsPerRoot * 2; i++) {
      t.note((at + i * 2) * beat, beat * 1.7, root, opts);
    }
    at += barsPerRoot * 4;
  }
}

// ---------------------------------------------------------------------------
// Town theme — C major, one clear singable phrase that arches up and resolves.
// Deliberately sparse: a single lead voice, a simple root bass, and a quiet
// pulse. Busier arrangements turn to mud on a loop you hear for minutes.
// ---------------------------------------------------------------------------
function townTheme() {
  const BPM = 128;
  const beat = 60 / BPM;
  const BARS = 8;
  const t = new Track(beat * 4 * BARS + 0.3);

  const lead = [
    ['G4', 1], ['A4', 1], ['B4', 1], ['C5', 1],
    ['D5', 2], ['C5', 1], ['B4', 1],
    ['A4', 1], ['B4', 1], ['C5', 1], ['A4', 1],
    ['G4', 3], ['-', 1],
    ['E5', 1], ['D5', 1], ['C5', 1], ['B4', 1],
    ['C5', 2], ['D5', 1], ['E5', 1],
    ['D5', 1], ['C5', 1], ['B4', 1], ['A4', 1],
    ['G4', 3], ['-', 1],
  ];
  melody(t, lead, beat, { wave: 'square', duty: 0.5, gain: 0.20, vibrato: 0.003, release: 0.04 });

  // C  G  Am C | Am F  G  C
  bassline(t, ['C3', 'G2', 'A2', 'C3', 'A2', 'F2', 'G2', 'C3'], beat, 1, {
    wave: 'triangle', gain: 0.20, attack: 0.002, release: 0.06,
  });

  // Light pulse: kick on 1 and 3, soft hat on the offbeats.
  for (let b = 0; b < BARS * 4; b++) {
    if (b % 2 === 0) t.hit(b * beat, 0.07, { gain: 0.07, decay: 5 });
    t.hit(b * beat + beat * 0.5, 0.035, { gain: 0.035, decay: 8 });
  }
  return t;
}

// ---------------------------------------------------------------------------
// Interior theme — F major, warm and cheerful, slower than the town but not sad.
// ---------------------------------------------------------------------------
function interiorTheme() {
  const BPM = 104;
  const beat = 60 / BPM;
  const BARS = 8;
  const t = new Track(beat * 4 * BARS + 0.3);

  const lead = [
    ['C5', 1], ['D5', 1], ['E5', 2],
    ['D5', 1], ['E5', 1], ['F5', 2],
    ['E5', 1], ['D5', 1], ['C5', 1], ['D5', 1],
    ['E5', 3], ['-', 1],
    ['A4', 1], ['C5', 1], ['D5', 2],
    ['C5', 1], ['D5', 1], ['E5', 2],
    ['D5', 1], ['C5', 1], ['B4', 1], ['C5', 1],
    ['C5', 3], ['-', 1],
  ];
  melody(t, lead, beat, { wave: 'square', duty: 0.25, gain: 0.17, vibrato: 0.004, release: 0.05 });

  // A gentle harmony a third below, only under the held notes.
  melody(t, [
    ['A4', 4], ['B4', 4], ['A4', 4], ['G4', 4],
    ['F4', 4], ['A4', 4], ['G4', 4], ['E4', 4],
  ], beat, { wave: 'triangle', gain: 0.09, attack: 0.03, release: 0.1 });

  // F  C  G  C | Am F  G  C
  bassline(t, ['F2', 'C3', 'G2', 'C3', 'A2', 'F2', 'G2', 'C3'], beat, 1, {
    wave: 'triangle', gain: 0.17, attack: 0.003, release: 0.08,
  });

  for (let b = 0; b < BARS * 4; b++) {
    if (b % 4 === 0) t.hit(b * beat, 0.06, { gain: 0.045, decay: 6 });
  }
  return t;
}

// ---------------------------------------------------------------------------
// SFX
// ---------------------------------------------------------------------------
const sfx = {
  'sfx-bump': () => new Track(0.1).sweep(0, 0.08, 160, 70, { wave: 'square', duty: 0.5, gain: 0.3 }),
  'sfx-door': () =>
    new Track(0.35)
      .sweep(0, 0.14, 320, 620, { wave: 'square', duty: 0.25, gain: 0.16 })
      .hit(0.14, 0.16, { gain: 0.1, decay: 4 }),
  'sfx-select': () =>
    new Track(0.14)
      .note(0, 0.05, 'E6', { wave: 'square', duty: 0.25, gain: 0.2, release: 0.02 })
      .note(0.05, 0.07, 'B6', { wave: 'square', duty: 0.25, gain: 0.18, release: 0.03 }),
  'sfx-text': () => new Track(0.035).note(0, 0.03, 'C6', { wave: 'square', duty: 0.125, gain: 0.14, release: 0.012 }),
};

// ---------------------------------------------------------------------------

fs.mkdirSync(OUT, { recursive: true });
const written = [];
function save(name, track) {
  const file = path.join(OUT, `${name}.wav`);
  fs.writeFileSync(file, track.toWav());
  written.push({ name: `${name}.wav`, bytes: fs.statSync(file).size });
}

save('bgm-town', townTheme());
save('bgm-interior', interiorTheme());
for (const [name, make] of Object.entries(sfx)) save(name, make());

// --- compress ---------------------------------------------------------------
// Raw WAV is roughly 10x larger than it needs to be. Encode to OGG (Chrome,
// Firefox) and M4A (Safari), then drop the WAVs. If ffmpeg is unavailable the
// WAVs are kept and the game simply loads no audio.
function encode() {
  let ffmpeg;
  try {
    ffmpeg = execSync('which ffmpeg', { encoding: 'utf8' }).trim();
  } catch {
    console.warn('\n  ffmpeg not found - keeping WAV files. Install ffmpeg and re-run for a ~10x smaller bundle.\n');
    return false;
  }
  for (const w of written) {
    const base = path.join(OUT, w.name.replace(/\.wav$/, ''));
    execSync(`"${ffmpeg}" -y -loglevel error -i "${base}.wav" -c:a libvorbis -q:a 1 -ar 22050 "${base}.ogg"`);
    execSync(`"${ffmpeg}" -y -loglevel error -i "${base}.wav" -c:a aac -b:a 48k -ar 22050 "${base}.m4a"`);
    fs.unlinkSync(`${base}.wav`);
  }
  return true;
}

const compressed = encode();
const finalFiles = fs
  .readdirSync(OUT)
  .filter((f) => /\.(ogg|m4a|wav)$/.test(f))
  .map((f) => ({ name: f, bytes: fs.statSync(path.join(OUT, f)).size }))
  .sort((a, b) => a.name.localeCompare(b.name));

const total = finalFiles.reduce((s, w) => s + w.bytes, 0);
console.log(`\nGenerated audio into public/assets/audio${compressed ? ' (ogg + m4a)' : ' (wav)'}\n`);
for (const w of finalFiles) {
  console.log(`  ${w.name.padEnd(22)} ${(w.bytes / 1024).toFixed(1)} KB`);
}
console.log(`\n  TOTAL ${(total / 1024).toFixed(1)} KB\n`);
