import { Sample } from 'native-layer';
import { mapSounds, makeSounds, AllSounds } from '../../src/ui/synth';

function makeSample(buf: Float32Array): Sample {
  return new Sample(new Int16Array(buf.map(s => Math.floor(s * 32767))));
}

export function initSounds(): AllSounds<Sample> {
  return mapSounds(makeSample, makeSounds());
}
