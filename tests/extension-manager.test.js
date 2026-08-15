'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.resolve(__dirname, '..');
const manager = fs.readFileSync(path.join(root, 'src', 'extension-manager.js'), 'utf8');
const background = fs.readFileSync(path.join(root, 'extension', 'fxreplay-v21-desktop', 'background.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'fxreplay-v21-desktop', 'manifest.json'), 'utf8'));

assert(manager.includes('FXReplay Extension'), 'stable extension folder missing');
assert(manager.includes('.desktop-managed.json'), 'managed marker missing');
assert(background.includes('/api/extension-version'), 'extension update endpoint missing');
assert(background.includes('chrome.runtime.reload()'), 'extension self reload missing');
assert.strictEqual(manifest.version, '2.1.1');
console.log('extension-manager.test.js: OK');
