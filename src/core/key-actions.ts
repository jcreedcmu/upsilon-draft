// The value in this object is the magic string that in-game entities
// have to match to have their hook effect; the key is how we refer to
// it in the implementation.

export const keyActions = {
  prevInventorySlot: 'prev-inventory-slot',
  nextInventorySlot: 'next-inventory-slot',
  prevLine: 'prev-line',
  nextLine: 'next-line',
  back: 'back',
  exec: 'exec',
  pickupDrop: 'pickup-drop',
  qsignal: 'qsignal',
  debug: 'debug',
} as const;

export const keyActionReverse = Object.fromEntries(Object.entries(keyActions).map(([x, y]) => [y, x])) as Record<string, EnumKeyAction>;

export type EnumKeyAction = keyof (typeof keyActions);
export type KeyActionString = (typeof keyActions)[EnumKeyAction];
export type KeyAction = EnumKeyAction | { t: 'other'; code: string; };
