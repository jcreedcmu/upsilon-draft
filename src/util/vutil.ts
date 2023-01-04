import { Point } from './types';

export function int(x: number): number {
  return Math.floor(x);
}

export function mod(x: number, y: number): number {
  var z = x % y;
  if (z < 0) z += y;
  return z;
}

export function div(x: number, y: number): number {
  return int(x / y);
}

export function vm(a: Point, f: (a: number) => number): Point {
  return { x: f(a.x), y: f(a.y) };
}

export function vm2(a: Point, b: Point, f: (a: number, b: number) => number): Point {
  return { x: f(a.x, b.x), y: f(a.y, b.y) };
}

export function vm3(a: Point, b: Point, c: Point, f: (a: number, b: number, c: number) => number): Point {
  return { x: f(a.x, b.x, c.x), y: f(a.y, b.y, c.y) };
}

export function vmn(ps: Point[], f: (ns: number[]) => number): Point {
  return { x: f(ps.map(p => p.x)), y: f(ps.map(p => p.y)) };
}

export function vequal(a: Point, b: Point): boolean {
  return a.x == b.x && a.y == b.y;
}

export function vplus(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vminus(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vscale(b: Point, s: number): Point {
  return { x: s * b.x, y: s * b.y };
}

export function vdiv(b: Point, s: number): Point {
  return { x: b.x / s, y: b.y / s };
}

export function vint(v: Point): Point {
  return { x: int(v.x), y: int(v.y) };
}

export function vfpart(v: Point): Point {
  return { x: v.x - int(v.x), y: v.y - int(v.y) };
}
