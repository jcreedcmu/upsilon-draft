import { Fs, getFullContents, getItem, itemContents } from '../fs/fs';
import { SpecialId } from '../fs/initial-fs';
import { SoundEffect } from '../ui/sound';
import { Show, showAll } from './model';
import { KeyAction, keyActionReverse, keyActions } from "./key-actions";

// A hook is an extra piece of code that should be run any time a
// directory has its contents changed.
export type Hook =
  | 'LENS'
  | 'KEY'
  | 'SOUND'
  | 'ERROR'
  | 'ENUM'
  ;

export function keybindingsOfFs(fs: Fs): Record<string, KeyAction> {
  let cont;
  try {
    cont = getFullContents(fs, SpecialId.keys);
  }
  catch (e) {
    return {};
  }

  const keyActionNames: string[] = Object.values(keyActions);

  const rv: Record<string, KeyAction> = {};
  cont.forEach(item => {
    const contents = itemContents(item);
    if (contents.length == 1) {
      const inner = getItem(fs, contents[0]);
      if (keyActionNames.includes(inner.name)) {
        rv[item.name] = keyActionReverse[inner.name];
      }
    }
  });
  return rv;
}

export function showOfFs(fs: Fs): Show {
  let cont;
  try {
    cont = getFullContents(fs, SpecialId.lens);
  }
  catch (e) {
    return showAll();
  }
  return {
    size: cont.some(x => x.name == 'show-size'),
    charge: cont.some(x => x.name == 'show-charge'),
    network: cont.some(x => x.name == 'show-network'),
    cwd: cont.some(x => x.name == 'show-cwd'),
    inventory: cont.some(x => x.name == 'show-inventory'),
    info: cont.some(x => x.name == 'show-info'),
  };
}

export function errorsOfFs(fs: Fs): Record<number, string> {
  let cont;
  try {
    cont = getFullContents(fs, SpecialId.errors);
  }
  catch (e) {
    return {};
  }
  const rv: Record<number, string> = {};
  cont?.forEach(item => {
    let m;
    if (item.content.t == 'file' && (m = item.name.match(/^E(\d+)$/))) {
      const n = parseInt(m[1]);
      if (!isNaN(n)) {
        rv[n] = item.content.text;
      }
    }
  });
  return rv;

}

export function soundsOfFs(fs: Fs): Record<string, SoundEffect> {
  let cont;
  try {
    cont = getFullContents(fs, SpecialId.sounds);
  }
  catch (e) {
    return {};
  }
  const rv: Record<string, SoundEffect> = {};


  const ix = cont.findIndex(item => item.content.t == 'checkbox' && item.name == 'sounds');
  if (ix == -1)
    return {};
  else {
    const content = cont[ix].content;
    if (content.t != 'checkbox') {
      throw new Error(`invariant violation, found checkbox but wasn't checkbox somehow?`);
    }
    if (!content.checked)
      return {};
  }

  cont.forEach(item => {
    const contents = itemContents(item);
    if (contents.length >= 1) {
      const content = getItem(fs, contents[0]).content;
      if (content.t == 'sound') {
        rv[item.name] = content.effect;
      }
    }
  });
  return rv;
}

export function enumsOfFs(fs: Fs): Record<string, string[]> {
  let cont;
  try {
    cont = getFullContents(fs, SpecialId.enums);
  }
  catch (e) {
    return {};
  }
  const rv: Record<string, string[]> = {};
  cont?.forEach(item => {
    let m;
    if (item.content.t == 'file') {
      rv[item.name] = item.content.contents.map(childId => getItem(fs, childId).name);
    }
  });
  return rv;
}
