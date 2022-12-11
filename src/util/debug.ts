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
  quickStart: isDev,
  keys: false,
};

export function logger(level: keyof (typeof DEBUG), ...args: any[]) {
  if (DEBUG[level]) {
    console.log(...args);
  }
}

const done: Record<string, boolean> = {};
export function doOnce(tag: string, k: () => void): void {
  if (!done[tag]) {
    done[tag] = true;
    k();
  }
}
