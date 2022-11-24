export const errorCodes = {
  cantPickUpDir: 100,
  cantPickUpParentDir: 101,
  cantPickUpLocked: 102,
  itemLocked: 103,
  noArgument: 104,
  alreadyExecuting: 105,
  noInstr: 106,
  illegalInstr: 107,
  cantGoBack: 108,
  noCharge: 109,
  notExecutable: 110,
  badInputs: 111,
};

export type ErrorCode = keyof (typeof errorCodes);

export function errorCodeText(k: ErrorCode): string {
  switch (k) {
    case 'cantPickUpDir': return `Can't pick up directory`;
    case 'cantPickUpParentDir': return `Can't pick up parent directory`;
    case 'cantPickUpLocked': return `Can't pick up locked item`;
    case 'itemLocked': return `Item locked`;
    case 'noArgument': return `No argument available`;
    case 'alreadyExecuting': return `Already executing`;
    case 'noInstr': return `No instruction`;
    case 'illegalInstr': return `Illegal instruction`;
    case 'cantGoBack': return `Can't access parent directory`;
    case 'noCharge': return `No quota`;
    case 'notExecutable': return `Not executable`;
    case 'badInputs': return `Bad inputs`;
  }
}
