export const isDev = !!location.host.match(/localhost/);

export const DEBUG = {
  glTiming: false,
  clockUpdate: false,
  recurring: false,
  rendering: false,
  reschedule: false,
  produce: false,
  duplicates: true,
  movement: false,
  quickStart: false && isDev,
  keys: false,
};

export function logger(level: keyof (typeof DEBUG), ...args: any[]) {
  if (DEBUG[level]) {
    console.log(...args);
  }
}
