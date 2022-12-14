import { ItemPlan } from '../src/fs/fs';
import { Resources } from '../src/fs/resources';

export function testFile(name: string, resources?: Resources): ItemPlan {
  return { t: 'file', name: name, forceId: name, resources };
}
