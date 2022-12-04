import { Item } from '../core/model';

export type Resource = 'cpu' | 'network' | 'data';

export type Resources = {
  [P in Resource]?: number;
};

export function getResource(item: Item, resource: Resource): number {
  return item.resources[resource] ?? 0;
}

export function modifyResourceꜝ(item: Item, resource: Resource, f: (x: number) => number): void {
  item.resources[resource] = f(item.resources[resource] ?? 0);
}

export function resourcesPlus(r1: Resources, r2: Resources): Resources {
  const rv: Resources = {};
  Object.entries(r1).forEach(([k, v]) => {
    const r = k as Resource;
    rv[r] = (rv[r] ?? 0) + r1[r]!;
  });
  Object.entries(r2).forEach(([k, v]) => {
    const r = k as Resource;
    rv[r] = (rv[r] ?? 0) + r2[r]!;
  });
  return rv;
}
