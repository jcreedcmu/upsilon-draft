export const DEBUG = {
  glTiming: false,
  clockUpdate: false,
  recurring: false,
  rendering: false,
  reschedule: false,
  produce: false,
  duplicates: true,
  movement: false,
  quickStart: true,
};

export function logger(level: keyof (typeof DEBUG), ...args: any[]) {
  if (DEBUG[level]) {
    console.log(...args);
  }
}
