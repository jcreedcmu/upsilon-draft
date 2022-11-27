import { ItemPlan } from '../src/fs/fs';

export function testFile(name: string): ItemPlan {
  return { t: 'file', name: name, forceId: name };
}
