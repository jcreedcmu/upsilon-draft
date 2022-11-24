import { produce as _produce } from 'immer';
import { DEBUG } from './debug';

let inProduce: string | undefined;

function removeFirstFrame(stack: string | undefined): string {
  const lines = (stack ?? '\n').split('\n');
  lines.splice(1, 1);
  return lines.join('\n');
}
export function produce<S>(draft: S, f: (s: S) => void): S {
  if (DEBUG.produce) {
    if (inProduce) {
      console.log(`%cOuter produce:\n`, 'font-weight:bold;');
      console.log(removeFirstFrame(inProduce));
      console.log(`%cInner produce:\n`, 'font-weight:bold;');
      console.log(removeFirstFrame(new Error().stack));
      throw new Error(`nested produce`);
    }
    else {
      inProduce = new Error().stack;
      const result = _produce(draft, f);
      inProduce = undefined;
      return result;
    }
  }
  else {
    return _produce(draft, f);
  }
}
