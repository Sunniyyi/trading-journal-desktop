'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { transformRenderer } = require('./renderer-transform');

const EXPECTED_V206_SHA256 = '6d988e41e5c1b94848ae67d4c88a2fedaa499cf04603b12164d6ace80540cff6';
const root = path.resolve(__dirname, '..');
const partsDir = path.join(root, 'src', 'renderer-parts');
const outputDir = path.join(root, 'src', 'renderer');
const output = path.join(outputDir, 'trade-journal.html');
const vendorDir = path.join(outputDir, 'vendor');

function reconstructBaseline() {
  const files = fs.readdirSync(partsDir)
    .filter(name => /^renderer\.html\.gz\.b64\.\d+$/.test(name))
    .sort();

  if (!files.length) throw new Error('Aucun morceau du renderer V206 trouvé.');
  const encoded = files.map(name => fs.readFileSync(path.join(partsDir, name), 'utf8').trim()).join('');
  return zlib.gunzipSync(Buffer.from(encoded, 'base64'));
}

function verifyBaseline(buffer) {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (hash !== EXPECTED_V206_SHA256) {
    throw new Error(`Renderer V206 corrompu ou modifié involontairement. SHA attendu ${EXPECTED_V206_SHA256}, obtenu ${hash}.`);
  }
  return hash;
}

function copyChartVendor() {
  // require.resolve('chart.js') points into dist/, next to the UMD browser build.
  const chartEntry = require.resolve('chart.js');
  const chartUmd = path.join(path.dirname(chartEntry), 'chart.umd.js');
  if (!fs.existsSync(chartUmd)) throw new Error(`Chart.js UMD introuvable: ${chartUmd}`);
  fs.mkdirSync(vendorDir, { recursive: true });
  fs.copyFileSync(chartUmd, path.join(vendorDir, 'chart.umd.js'));
}

function main() {
  const baseline = reconstructBaseline();
  const hash = verifyBaseline(baseline);
  const transformed = transformRenderer(baseline.toString('utf8'));

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(output, transformed, 'utf8');
  copyChartVendor();

  console.log(`Renderer V206 vérifié: ${hash}`);
  console.log(`Renderer Desktop généré: ${output} (${Buffer.byteLength(transformed, 'utf8')} octets)`);
}

if (require.main === module) main();

module.exports = { reconstructBaseline, verifyBaseline };
