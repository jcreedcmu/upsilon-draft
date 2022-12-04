import { errorCodes, errorCodeText } from '../core/error-codes';
import { Resources } from './resources';
import { Fs, insertPlans, ItemPlan, mkFs, VirtualItemPlan } from './fs';
import { KeyAction } from '../core/model';
import { arrowChars } from '../ui/screen';
import { ExecutableName } from '../core/executeInstructions';

export enum SpecialId {
  keys = '_keys',
  lens = '_lens',
  root = '_root',
  inventory = '_inventory',
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
    { name: '<up>', keyAction: KeyAction.prevLine },
    { name: 'w', keyAction: KeyAction.prevLine },
    { name: '<down>', keyAction: KeyAction.nextLine },
    { name: 's', keyAction: KeyAction.nextLine },
    { name: '<left>', keyAction: KeyAction.back },
    { name: 'a', keyAction: KeyAction.back },
    { name: 'd', keyAction: KeyAction.exec },
    { name: '<return>', keyAction: KeyAction.exec },
    { name: '<right>', keyAction: KeyAction.exec },
    { name: '<space>', keyAction: KeyAction.pickupDrop },
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
      namedExec(ExecutableName.textDialog, { resources: { cpu: 4 } }),
      namedExec(ExecutableName.movCpu5, { resources: { cpu: 5 } }),
      namedExec(ExecutableName.movCpu1, { resources: { cpu: 5 } }),
      namedExec(ExecutableName.combine),
      namedExec(ExecutableName.toggleOpen),
      namedExec(ExecutableName.togglePickup),
      namedExec(ExecutableName.toggleInstr, { resources: { cpu: 8 } }),
      namedExec(ExecutableName.toggleExec),
      namedExec(ExecutableName.toggleUnlock),
    ]
  },
  {
    t: 'dir', name: 'bin2', contents: [
      namedExec(ExecutableName.extractId, { resources: { cpu: 10 } }),
      namedExec(ExecutableName.magnet, { resources: { cpu: 10 } }),
      namedExec(ExecutableName.toggleCaps, { resources: { data: 1 } }),
      namedExec(ExecutableName.prefix, { resources: { network: 1 } }),
      namedExec(ExecutableName.charge, { resources: { cpu: 4, network: 3 } }),
      namedExec(ExecutableName.treadmill, { resources: { cpu: 0, network: 0 } }),
      namedExec(ExecutableName.modify, { resources: { cpu: 5, network: 0 } }),
      namedExec(ExecutableName.copy, { resources: { cpu: 5, network: 0 } }),
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
