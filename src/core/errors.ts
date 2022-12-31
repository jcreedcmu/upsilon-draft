import { Ident, Location } from "./model";

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
  badExecutable: 112,
  badArchive: 113,
  permissionDenied: 114,
  unhandledSignal: 115,
};

export type ErrorCode = keyof (typeof errorCodes);

export type ErrorInfo = {
  // What type of error it was
  code: ErrorCode,

  // Which binary caused the error. The real point of this is to disable
  // automation for that binary. Conceivably I might want multiple in
  // the future.
  blame?: Ident,

  // In what directory the error occurred, for at least the purpose of
  // determining whether or not to play sound effects depending on whether
  // the player is looking at that directory right now.
  loc?: Location,
};

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
    case 'badExecutable': return `Bad executable`;
    case 'badArchive': return `Bad archive`;
    case 'permissionDenied': return `Permission denied`;
    case 'unhandledSignal': return `Unhandled signal`;
  }
}

export class ErrorCodeException extends Error {
  constructor(public code: ErrorCode) { super(); }
}

export function errorFileName(code: ErrorCode) {
  return 'E' + errorCodes[code];
}
