export const isDev = !!location.host.match(/localhost/);

export const DEBUG = {
  glTiming: false,
  clockUpdate: false,
  recurring: false,
  rendering: false,
  renderFsView: false,
  reschedule: false,
  produce: false,
  duplicates: true,
  movement: false,
  quickStart: isDev,
  keys: false,
  getLines: false,
};


export type DebugLevel = keyof (typeof DEBUG);
// function isEphemeral(level: DebugLevel): boolean {
//   return level == 'rendering' || level == 'renderFsView';
// }

export function logger(level: DebugLevel, ...args: any[]) {
  if (DEBUG[level]) {
    console.log(...args);
    // if (isEphemeral(level)) { // avoid spamming render debug messages
    //   DEBUG[level] = false;
    // }
  }
}

const done: Record<string, boolean> = {};
export function doOnce(tag: string, k: () => void): void {
  if (!done[tag]) {
    done[tag] = true;
    k();
  }
}

export function debugOnce(level: DebugLevel) {
  DEBUG[level] = false;
  doOnce('_' + level, () => { DEBUG[level] = true; });
}
