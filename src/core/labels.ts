import { Item, Ident } from '../core/model';

export function toggleLabel(name: string): string {
  return nameIsLabel(name) ? name.replace(/:$/, '') : name + ':';
}

export function itemIsLabel(item: Item): boolean {
  return nameIsLabel(item.name);
}

export function nameIsLabel(name: string): boolean {
  return !!name.match(/:$/);
}
