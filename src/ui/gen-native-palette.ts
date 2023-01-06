import * as fs from 'fs';
import * as path from 'path';
import { paletteDataInt } from './palette';

function genNativePalette() {
  const data = paletteDataInt();
  const contents = data.map(n => `   ${n},`).join('\n');
  const palette = `#pragma once

unsigned char palette[] = {
${contents}
};
`;
  const outDir = path.join(__dirname, '../native-layer/src/gen');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'palette.h'), palette, 'utf8');
}

genNativePalette();
