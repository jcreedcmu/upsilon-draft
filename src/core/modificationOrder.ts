import { ExecutableName, executables as E } from './executeInstructions';


export function modificationOrder(): readonly ExecutableName[] {
  // the fact that typescript infers `_modificationOrder` here as
  //    ("text-dialog" | ⋯)[]
  // seems to depend on `executables` being `as const`, but doesn't
  // require `_modificationOrder` to be `as const` to get an effective
  // static exhaustiveness check via _staticCheckCoverage below.
  const _modificationOrder = [
    E.textDialog,
    E.combine,
    E.movCpu5,
    E.movCpu1,
    E.toggleOpen,
    E.togglePickup,
    E.toggleInstr,
    E.toggleExec,
    E.toggleUnlock,
    E.toggleCaps,
    E.prefix,
    E.charge,
    E.treadmill,
    E.extractId,
    E.magnet,
    E.modify,
    E.copy,
    E.automate
  ];

  // We don't ever expect to call this function, but it will only typecheck if
  // every value of `executables` appears somewhere in _modificationOrder
  function _staticCheckCoverage(x: ExecutableName, f: (y: (typeof _modificationOrder)[number]) => void): void {
    return f(x);
  }
  return _modificationOrder;
}
