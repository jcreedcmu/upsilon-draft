import { AllSounds, makeSounds, SAMPLE_RATE, SoundEffect } from "./synth";
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
  sounds: AllSounds,
}


export type AbstractSoundEffect = (typeof allAbstractSoundEffects)[number];

export function isAbstractSoundEffect(str: string): str is AbstractSoundEffect {
  return allAbstractSoundEffects.includes(str as AbstractSoundEffect);
}

export function initSound(): Sound {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  return {
    d: context,
    sounds: makeSounds()
  };
}

export function playSound(sound: Sound, which: SoundEffect) {
  const { d, sounds } = sound;
  const beepSrc = d.createBufferSource();
  beepSrc.buffer = sounds[which];
  beepSrc.connect(d.destination); // connect the source to the context's destination (the speakers)
  beepSrc.start();
}
