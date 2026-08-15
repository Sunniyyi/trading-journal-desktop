'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const partsDir = path.join(root, 'src', 'renderer-parts');
const outputDir = path.join(root, 'src', 'renderer');
const output = path.join(outputDir, 'trade-journal.html');

const files = fs.readdirSync(partsDir)
  .filter(name => /^renderer\.html\.gz\.b64\.\d+$/.test(name))
  .sort();

if (!files.length) throw new Error('Aucun morceau du renderer V206 trouvé.');
const encoded = files.map(name => fs.readFileSync(path.join(partsDir, name), 'utf8').trim()).join('');
const compressed = Buffer.from(encoded, 'base64');
const buffer = zlib.gunzipSync(compressed);
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(output, buffer);
console.log(`Renderer V206 reconstruit: ${output} (${buffer.length} octets)`);
