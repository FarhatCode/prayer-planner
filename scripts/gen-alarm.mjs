import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const sampleRate = 22050;
const amp = 0.92;

function tone(freq, start, dur, out) {
  const n = Math.floor(dur * sampleRate);
  for (let i = 0; i < n; i++) {
    const t = start * sampleRate + i;
    out[t] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * amp;
  }
}

function silence(start, dur, out) {
  const n = Math.floor(dur * sampleRate);
  for (let i = 0; i < n; i++) out[start * sampleRate + i] = 0;
}

const patternDur = 4.0;
const total = Math.floor(patternDur * sampleRate);
const samples = new Float32Array(total).fill(0);

function addPattern(offsetSec) {
  const freqs = [880, 880, 880, 880, 1174, 1174];
  const lens = [0.14, 0.14, 0.14, 0.22, 0.33, 0.45];
  let t = offsetSec;
  for (let i = 0; i < freqs.length; i++) {
    tone(freqs[i], t, lens[i], samples);
    t += lens[i] + 0.07;
  }
}

addPattern(0);
addPattern(2 + 0.25);

const wavBytes = Buffer.alloc(44 + samples.length * 2);
wavBytes.write('RIFF', 0);
wavBytes.writeUInt32LE(36 + samples.length * 2, 4);
wavBytes.write('WAVE', 8);
wavBytes.write('fmt ', 12);
wavBytes.writeUInt32LE(16, 16);
wavBytes.writeUInt16LE(1, 20);
wavBytes.writeUInt16LE(1, 22);
wavBytes.writeUInt32LE(sampleRate, 24);
wavBytes.writeUInt32LE(sampleRate * 2, 28);
wavBytes.writeUInt16LE(2, 32);
wavBytes.writeUInt16LE(16, 34);
wavBytes.write('data', 36);
wavBytes.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++) {
  const v = Math.max(-1, Math.min(1, samples[i]));
  wavBytes.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
}

const out = join(root, 'resources', 'alarm.wav');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, wavBytes);
console.log('generated', out, wavBytes.length, 'bytes');