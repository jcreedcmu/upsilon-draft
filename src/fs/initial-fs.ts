import { ErrorCode, errorCodes, errorCodeText, errorFileName } from '../core/errors';
import { ExecutableName, executables } from '../core/executables';
import { Ident, KeyAction } from '../core/model';
import { ImgData } from '../ui/image';
import { arrowChars, Chars } from '../ui/screen';
import { AbstractSoundEffect, SoundEffect } from '../ui/sound';
import { isDev } from '../util/debug';
import { Fs, GeneralItemPlan, insertPlans, ItemPlan, mkFs, textContent } from './fs';
import { Resources } from './resources';

export enum SpecialId {
  keys = '_keys',
  sounds = '_sounds',
  lens = '_lens',
  errors = '_errors',
  root = '_root',
  cursorMark = '_cursorMark', // XXX not really an ident in the same sense?
  tmpMark = '_tmpMark', // XXX this is like a caller-save register
};

export function namedExec(name: ExecutableName, opts?: { resources?: Resources, forceId?: Ident }): ItemPlan {
  return {
    t: 'exec',
    name,
    contents: [],
    resources: opts?.resources,
    forceId: opts?.forceId
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
    ...(isDev ? [{ name: 'z', keyAction: KeyAction.debug }] : []),
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
    { name: 'toggle', soundEffect: 'high' },
  ];
  function soundDir(sound: { name: string, soundEffect: SoundEffect }): ItemPlan {
    const { name, soundEffect } = sound;
    return {
      t: 'dir', name, contents: [
        { t: 'file', name: soundEffect + '.snd', content: { t: 'sound', effect: soundEffect } }
      ], hooks: ['SOUND']
    }
  }
  const toggle: ItemPlan = { t: 'checkbox', name: 'sounds', checked: true };
  return {
    t: 'dir', name: 'sounds', hooks: ['SOUND'],
    contents: [toggle, ...sounds.map(soundDir)],
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
      name: errorFileName(str as ErrorCode),
      content: textContent(errorCodeText(str as keyof (typeof errorCodes))),
    };
  });

  return {
    t: 'dir', name: 'error', contents: errorFiles, forceId: SpecialId.errors, hooks: ['ERROR'],
  };
}

function binDirs(): ItemPlan[] {
  return [{
    t: 'dir', name: 'bin', contents: [
      namedExec(executables.textEdit, { resources: { cpu: 4 } }),
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
    t: 'dir', name: 'sbin', contents: [
      namedExec(executables.extractId, { resources: { cpu: 10 } }),
      namedExec(executables.magnet, { resources: { cpu: 10 } }),
      namedExec(executables.toggleCaps, { resources: { data: 1 } }),
      namedExec(executables.makeLabel, { resources: { network: 1 } }),
      namedExec(executables.charge, { resources: { cpu: 4, network: 3 } }),
      namedExec(executables.treadmill, { resources: { cpu: 0, network: 0 } }),
      namedExec(executables.modify, { resources: { cpu: 5, network: 0 } }),
      namedExec(executables.robot, { resources: { cpu: 5, network: 0 } }),
      namedExec(executables.copy, { resources: { cpu: 5, network: 0 } }),
      namedExec(executables.automate, { resources: { cpu: 5, network: 0 } }),
    ]
  },
  {
    t: 'dir', name: 'xbin', contents: [
      namedExec(executables.charge, { resources: { cpu: 40, network: 3 } }),
      namedExec(executables.modify, { resources: { cpu: 5, network: 0 } }),
      namedExec(executables.robot, { resources: { cpu: 5, network: 0 } }),
      namedExec(executables.compress, { resources: { cpu: 5, network: 0 } }),
      namedExec(executables.configure, { resources: { cpu: 5, network: 0 } }),
      namedExec(executables.uncompress, { resources: { cpu: 5, network: 0 } }),
    ]
  }

  ];
}

const readmeText = `
{white}${arrowChars}{/}/{white}wasd{/}: navigate
{white}<enter>{/}: interact
{white}<space>{/}: pickup/drop`;

const initialImage: ImgData = [
  1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1,
  1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1,
  1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0,
  1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0,
  1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1,
  1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
  1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
  1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
  1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1,
  1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1,
  1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1,
  1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0,
  1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0,
  1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0,
  1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0,
  1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0,
  1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1,
  1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0,
  1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0,
  1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

function initialPlans(): GeneralItemPlan[] {
  return [
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
    {
      t: 'dir', name: 'cont', contents: [
        { t: 'virtual', id: 'vroot' },
      ]
    },
    {
      t: 'dir', name: 'linlog', contents: [
        namedExec(executables.automate, { resources: { cpu: 5, network: 0 } }),
        { t: 'file', name: `a${Chars.LOLLI}b` },
        { t: 'file', name: `b${Chars.OTIMES}${Chars.BOT}` },
        { t: 'file', name: `c${Chars.PAR}${Chars.TOP}` },
        { t: 'file', name: `c${Chars.OPLUS}d` },
        namedExec(executables.robot, { resources: { cpu: 5, network: 0 } }),
      ]
    },
    {
      t: 'dir', name: 'home', contents: [
        { t: 'file', name: 'foo', resources: { cpu: 5 } },
        {
          t: 'dir', name: 'bigdir', contents: [...Array(31).keys()].map(ix => {
            return { t: 'file', name: ix + '', content: textContent('') };
          })
        },
        { t: 'file', name: 'bar', content: textContent('Here is some {white}white text{/} and here is some {red}red text{/}.') },
        { t: 'file', name: 'mumble', size: 23 },
        { t: 'checkbox', name: 'toggle1', checked: true },
        { t: 'checkbox', name: 'toggle2', checked: false },
        { t: 'numeric', name: 'numeric', value: 3 },
        { t: 'file', name: 'portrait.bmp', content: { t: 'image', data: initialImage }, resources: { data: 3, cpu: 2 } },
        { t: 'file', name: 'inventory.spc', content: { t: 'inventorySlot' } },
        { t: 'file', name: 'inventory.spc', content: { t: 'inventorySlot' } },
      ]
    },
    {
      t: 'file', name: 'README.txt', content: textContent(readmeText)
    },

  ];
}

export function initialFs(): Fs {
  let fs = mkFs();
  [fs,] = insertPlans(fs, SpecialId.root, initialPlans());
  return fs;
}
