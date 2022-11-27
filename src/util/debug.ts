export const DEBUG = {
  glTiming: false,
  clockUpdate: false,
  rendering: false,
  reschedule: false,
  produce: false,
  duplicates: true,
};

export function logger(level: keyof (typeof DEBUG), ...args: any[]) {
  if (DEBUG[level]) {
    console.log(...args);
  }
}
