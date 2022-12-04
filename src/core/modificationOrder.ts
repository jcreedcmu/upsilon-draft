import { ExecutableName, ExecutableName as E } from './executeInstructions';

export function modificationOrder(): ExecutableName[] {
  return [
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
  ];
}
