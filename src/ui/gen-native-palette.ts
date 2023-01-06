import * as fs from 'fs';
import * as path from 'path';
import { paletteDataFloat } from './palette';

function genNativePalette() {
  const data = paletteDataFloat();
  const contents = data.map(n => `   ${n},`).join('\n');
  const palette = `#pragma once

GLfloat palette[] = {
${contents}
};
`;
  const outDir = path.join(__dirname, '../native-layer/src/gen');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'palette.h'), palette, 'utf8');
}

genNativePalette();
