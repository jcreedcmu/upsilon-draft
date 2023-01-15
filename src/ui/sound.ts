import { AllSounds, makeSounds, mapSounds, SAMPLE_RATE, SoundEffect } from "./synth";
export { SoundEffect } from './synth';

export const allAbstractSoundEffects = [
  'change-file',
  'go-back',
  'change-slot',
  'startup',
  'error',
  'execute',
  'go-into',
  'pickup',
  'drop',
  'success',
  'toggle',
] as const;

export type Sound = {
  d: AudioContext,
  sounds: AllSounds<AudioBuffer>,
}

export type AbstractSoundEffect = (typeof allAbstractSoundEffects)[number];

export function isAbstractSoundEffect(str: string): str is AbstractSoundEffect {
  return allAbstractSoundEffects.includes(str as AbstractSoundEffect);
}

export function initSound(): Sound {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  return {
    d: context,
    sounds: mapSounds(makeBuffer, makeSounds())
  };
}

function makeBuffer(data: Float32Array, name?: string): AudioBuffer {
  console.log(name, data.length);
  const buf = new AudioBuffer({
    length: data.length, sampleRate: SAMPLE_RATE, numberOfChannels: 1
  });
  buf.getChannelData(0).set(data);
  return buf;
}

export function playSound(sound: Sound, which: SoundEffect) {
  const { d, sounds } = sound;
  const beepSrc = d.createBufferSource();
  beepSrc.buffer = sounds[which];
  beepSrc.connect(d.destination); // connect the source to the context's destination (the speakers)
  beepSrc.start();
}
