import { Attr } from '../ui/screen';

export function invertAttr(attr: Attr): Attr {
  return { bg: attr.fg, fg: attr.bg };
}

export function maybeInvertAttr(attr: Attr, doInvert: boolean): Attr {
  return doInvert ? { bg: attr.fg, fg: attr.bg } : attr;
}

export function mapval<T, U>(m: { [k: string]: T }, f: (x: T) => U): { [k: string]: U } {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, f(v)]));
}

export class Rand {
  n: number;
  constructor(n?: number) { this.n = n || 42; for (let i = 0; i < 3; i++) this.f(); }
  f(): number {
    this.n = (2147483629 * this.n + 2147483587) % 2147483647;
    return (this.n & 0xffff) / (1 << 16);
  }
  i(n: number): number {
    return Math.floor(this.f() * n);
  }
}

export function zeropad(str: string, length: number): string {
  return repeat('0', Math.max(0, length - str.length)) + str;
}

export function repeat(x: string, n: number) {
  if (n < 0)
    throw 'negative repeat';

  let s = '';
  for (; ;) {
    if (n & 1) s += x;
    n >>= 1;
    if (n) x += x;
    else break;
  }
  return s;
}

export const int = Math.floor;

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// multiplicative interpolation
export function mlerp(a: number, b: number, t: number) {
  return Math.exp(lerp(Math.log(a), Math.log(b), t));
}

export function unreachable<T>(x: never): T {
  throw new Error('unreachable');
}

export function filterKeys<T>(rec: Record<string, T>, pred: (x: string) => boolean): Record<string, T> {
  return Object.fromEntries(
    Object.entries(rec)
      .filter(([k, v]) => pred(k))
  );
}
