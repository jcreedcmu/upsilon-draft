import { lerp, mlerp } from "../util/util";

const SAMPLE_RATE = 44100; // samples/s
const BEEP_LENGTH = 30000; // samples

export type SoundEffect =
  | 'rising' | 'falling' | 'high' | 'low' | 'med' | 'pickup' | 'drop' | 'error';

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

export type Sound = {
  d: AudioContext,
  beeps: { [K in SoundEffect]: AudioBuffer },
}

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

function makeBeep(partialSpec: Partial<SoundEffectSpec>): AudioBuffer {
  const spec = specWithDefaults(partialSpec);
  const dur_frame = Math.floor(spec.duration_s * SAMPLE_RATE);
  const beep = new AudioBuffer({ length: dur_frame, sampleRate: SAMPLE_RATE, numberOfChannels: 1 });
  const data = beep.getChannelData(0);
  let phase = 0;
  for (let i = 0; i < dur_frame; i++) {
    const freq = mlerp(spec.startFreq, spec.endFreq, i / dur_frame);
    phase += 2 * Math.PI * freq / SAMPLE_RATE;
    const base = Math.sin(phase);
    data[i] = 0.1 * base * adsr(i / SAMPLE_RATE, dur_frame / SAMPLE_RATE, spec.attack_s, spec.decay_s, spec.sustain, spec.release_s);
  }
  return beep;
}

export function initSound(): Sound {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  return {
    d: context,
    beeps: {
      rising: makeBeep({ startFreq: 220, endFreq: 440 }),
      falling: makeBeep({ startFreq: 440, endFreq: 220 }),
      high: makeBeep({ startFreq: 440 }),
      low: makeBeep({ startFreq: 220 }),
      med: makeBeep({ startFreq: 330, duration_s: 0.2 }),
      pickup: makeBeep({ startFreq: 55, endFreq: 440 }),
      drop: makeBeep({ startFreq: 440, endFreq: 55 }),
      error: makeBeep({ startFreq: 220, duration_s: 0.3 }),
    }
  };
}

export function playBeep(sound: Sound, which: SoundEffect) {
  const { d, beeps } = sound;
  const beepSrc = d.createBufferSource();
  beepSrc.buffer = beeps[which];
  beepSrc.connect(d.destination); // connect the source to the context's destination (the speakers)
  beepSrc.start();
}
