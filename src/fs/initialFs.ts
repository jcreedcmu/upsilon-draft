import { errorCodes, errorCodeText } from '../core/errors';
import { Resources } from './resources';
import { Fs, insertPlans, ItemPlan, mkFs, VirtualItemPlan } from './fs';
import { AbstractSoundEffect, KeyAction } from '../core/model';
import { arrowChars } from '../ui/screen';
import { ExecutableName, executableProperties, executables } from '../core/executables';
import { SoundEffect } from '../ui/sound';

export enum SpecialId {
  keys = '_keys',
  sounds = '_sounds',
  lens = '_lens',
  root = '_root',
};

function singleExec(name: string, opts?: { numTargets?: number, resources?: Resources }): ItemPlan {
  return {
    t: 'exec',
    name,
    contents: [{ t: 'file', name: 'cpu100' }, { t: 'instr', name }],
    numTargets: opts?.numTargets,
    resources: opts?.resources
  };
}

function namedExec(name: ExecutableName, opts?: { resources?: Resources }): ItemPlan {
  return {
    t: 'exec',
    name,
    contents: [],
    resources: opts?.resources
  };
}

function keysDir(): ItemPlan {
  const keys: { name: string, keyAction: KeyAction }[] = [
    { name: '[', keyAction: KeyAction.prevInventorySlot },
    { name: ']', keyAction: KeyAction.nextInventorySlot },
    { name: '<down>', keyAction: KeyAction.nextLine },
    { name: '<left>', keyAction: KeyAction.back },
    { name: '<return>', keyAction: KeyAction.exec },
    { name: '<right>', keyAction: KeyAction.exec },
    { name: '<space>', keyAction: KeyAction.pickupDrop },
    { name: '<up>', keyAction: KeyAction.prevLine },
    { name: 'a', keyAction: KeyAction.back },
    { name: 'd', keyAction: KeyAction.exec },
    { name: 's', keyAction: KeyAction.nextLine },
    { name: 'w', keyAction: KeyAction.prevLine },
  ];
  function keyDir(key: { name: string, keyAction: KeyAction }): ItemPlan {
    const { name, keyAction } = key;
    return { t: 'dir', name, contents: [{ t: 'file', name: keyAction }], hooks: ['KEY'] }
  }
  return {
    t: 'dir', name: 'key',
    contents: keys.map(keyDir),
    forceId: SpecialId.keys,
    resources: { data: 4 }
  };
}

function soundsDir(): ItemPlan {
  const sounds: { name: AbstractSoundEffect, soundEffect: SoundEffect }[] = [
    { name: 'change-file', soundEffect: 'high' },
    { name: 'go-back', soundEffect: 'falling' },
    { name: 'change-slot', soundEffect: 'high' },
    { name: 'startup', soundEffect: 'startup' },
    { name: 'error', soundEffect: 'error' },
    { name: 'execute', soundEffect: 'rising' },
    { name: 'go-into', soundEffect: 'rising' },
    { name: 'pickup', soundEffect: 'pickup' },
    { name: 'drop', soundEffect: 'drop' },
    { name: 'success', soundEffect: 'ping' },
  ];
  function soundDir(sound: { name: string, soundEffect: SoundEffect }): ItemPlan {
    const { name, soundEffect } = sound;
    return { t: 'dir', name, contents: [{ t: 'file', name: soundEffect }], hooks: ['SOUND'] }
  }
  return {
    t: 'dir', name: 'sounds',
    contents: sounds.map(soundDir),
    forceId: SpecialId.sounds,
    resources: {}
  };
}

function lensDir(): ItemPlan {
  const lenses = [
    'show-cwd',
    'show-size',
    'show-charge',
    'show-network',
    'show-info',
    'show-inventory',
  ];
  function lensFile(lens: string): ItemPlan {
    return { t: 'file', name: lens };
  }
  return {
    t: 'dir', name: 'lens', forceId: SpecialId.lens,
    contents: lenses.map(lensFile),
    hooks: ['LENS']
  };
}

function errorDir(): ItemPlan {
  const errorFiles: ItemPlan[] = Object.entries(errorCodes).map(([str, code]) => {
    return {
      t: 'file',
      name: 'E' + code,
      text: errorCodeText(str as keyof (typeof errorCodes))
    };
  });

  return { t: 'dir', name: 'error', contents: errorFiles };
}

function binDirs(): ItemPlan[] {
  return [{
    t: 'dir', name: 'bin', contents: [
      namedExec(executables.textDialog, { resources: { cpu: 4 } }),
      namedExec(executables.movCpu5, { resources: { cpu: 5 } }),
      namedExec(executables.movCpu1, { resources: { cpu: 5 } }),
      namedExec(executables.combine),
      namedExec(executables.toggleOpen),
      namedExec(executables.togglePickup),
      namedExec(executables.toggleInstr, { resources: { cpu: 8 } }),
      namedExec(executables.toggleExec),
      namedExec(executables.toggleUnlock),
    ]
  },
  {
    t: 'dir', name: 'bin2', contents: [
      namedExec(executables.extractId, { resources: { cpu: 10 } }),
      namedExec(executables.magnet, { resources: { cpu: 10 } }),
      namedExec(executables.toggleCaps, { resources: { data: 1 } }),
      namedExec(executables.prefix, { resources: { network: 1 } }),
      namedExec(executables.charge, { resources: { cpu: 4, network: 3 } }),
      namedExec(executables.treadmill, { resources: { cpu: 0, network: 0 } }),
      namedExec(executables.modify, { resources: { cpu: 5, network: 0 } }),
      namedExec(executables.copy, { resources: { cpu: 5, network: 0 } }),
      namedExec(executables.automate, { resources: { cpu: 5, network: 0 } }),
    ]
  }];
}

function initialPlans(): VirtualItemPlan[] {
  return [
    {
      t: 'file', name: 'README', text: `
{white}${arrowChars}{/}/{white}wasd{/}: navigate
{white}<enter>{/}: interact
{white}<space>{/}: pickup/drop` },
    {
      t: 'dir', name: 'sys',
      contents: [
        keysDir(),
        soundsDir(),
        lensDir(),
        errorDir(),
      ]
    },
    ...binDirs(),
    { t: 'virtual', id: 'vroot' },
    {
      t: 'dir', name: 'home', contents: [
        { t: 'file', name: 'foo', resources: { cpu: 5 } },
        { t: 'file', name: 'bar', text: 'Here is some {white}white text{/} and here is some {red}red text{/}.' },
        { t: 'file', name: 'mumble', size: 23 },
      ]
    }
  ];
}

export function initialFs(): Fs {
  let fs = mkFs();
  [fs,] = insertPlans(fs, SpecialId.root, initialPlans());
  return fs;
}
