import { mapval, mlerp } from "../util/util";

export const SAMPLE_RATE = 44100; // samples/s
const BEEP_LENGTH = 30000; // samples

export const allSoundEffects = [
  'rising', 'falling', 'high', 'low', 'med', 'pickup', 'drop', 'error'
  , 'startup', 'ping'
] as const;

export type SoundEffect = (typeof allSoundEffects)[number];

export function isSoundEffect(str: string): str is SoundEffect {
  return allSoundEffects.includes(str as SoundEffect);
}

type SoundEffectSpec = {
  startFreq: number, // Hz
  endFreq: number, // Hz
  duration_s: number, // seconds
  attack_s: number, // seconds
  decay_s: number, // seconds
  sustain: number, // dimensionless, amplitude ratio
  release_s: number // seconds
}

function specWithDefaults(spec: Partial<SoundEffectSpec>): SoundEffectSpec {
  return {
    startFreq: 440,
    endFreq: spec.startFreq ?? 440,
    duration_s: 0.08,
    attack_s: 0.005,
    decay_s: 0.005,
    sustain: 0.5,
    release_s: 0.005,
    ...spec
  }
};

export type AllSounds<T> = { [K in SoundEffect]: T };

function adsr(t: number, len: number, attack: number, decay: number, sustain: number, release: number): number {
  if (t < attack) {
    return t / attack;
  }
  else if (t < attack + decay) {
    return 1.0 + (sustain - 1.0) * (t - attack) / decay;
  }
  else if (len - t < release) {
    return sustain * (len - t) / release;
  }
  else {
    return sustain;
  }
}

function makeStartupSound(): Float32Array {
  const len = 5; // seconds
  const samples = len * SAMPLE_RATE;
  const data = new Float32Array(samples);
  const FREQS = 30;
  const freq: number[] = [];
  const phase: number[] = [];
  for (let i = 0; i < FREQS; i++) {
    freq[i] = 40 * i + Math.random() * 50;
    phase[i] = 0;
  }

  for (let frame = 0; frame < samples; frame++) {
    let sample = 0.0;
    for (let i = 0; i < FREQS; i++) {
      const f = 100 + freq[i] * (0.5 + 3 * (frame / samples));
      phase[i] += 2 * Math.PI * f / SAMPLE_RATE;
      sample += adsr(frame / SAMPLE_RATE, len, 0.1, 0, 1, len - 0.1) *
        0.1 / FREQS * square(phase[i]);
    }
    data[frame] = sample;
  }
  return data;
}

function square(phase: number) {
  return 0.5 * ((phase % (2 * Math.PI) < Math.PI) ? 1 : -1);
}

function makeBeep(partialSpec: Partial<SoundEffectSpec>): Float32Array {
  const spec = specWithDefaults(partialSpec);
  const dur_frame = Math.floor(spec.duration_s * SAMPLE_RATE);
  const data = new Float32Array(dur_frame);
  let phase = 0;
  for (let i = 0; i < dur_frame; i++) {
    const freq = mlerp(spec.startFreq, spec.endFreq, i / dur_frame);
    phase += 2 * Math.PI * freq / SAMPLE_RATE;
    const base = square(phase);
    data[i] = 0.1 * base * adsr(i / SAMPLE_RATE, dur_frame / SAMPLE_RATE, spec.attack_s, spec.decay_s, spec.sustain, spec.release_s);
  }
  return data;
}

export function makeSounds(): AllSounds<Float32Array> {
  return {
    startup: makeStartupSound(),
    ping: makeBeep({
      startFreq: 660, endFreq: 675,
      attack_s: 0.05, decay_s: 0.05, sustain: 0.1, release_s: 0.25, duration_s: 0.5
    }),
    rising: makeBeep({ startFreq: 220, endFreq: 440 }),
    falling: makeBeep({ startFreq: 440, endFreq: 220 }),
    high: makeBeep({
      startFreq: 1000, duration_s: 0.01 + 0.03,
      attack_s: 0.01, decay_s: 0.00, sustain: 1, release_s: 0.03
    }),
    low: makeBeep({ startFreq: 220 }),
    med: makeBeep({ startFreq: 330, duration_s: 0.2 }),
    pickup: makeBeep({ startFreq: 55, endFreq: 440 }),
    drop: makeBeep({ startFreq: 440, endFreq: 55 }),
    error: makeBeep({ startFreq: 220, duration_s: 0.3 }),
  }
}

export function mapSounds<T, U>(f: (x: T) => U, allSounds: AllSounds<T>): AllSounds<U> {
  return mapval(allSounds, f) as AllSounds<U>;
}
