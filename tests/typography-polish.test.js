'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'src', 'renderer', 'ui', 'typography-polish.css');
const css = fs.readFileSync(file, 'utf8');

assert(css.length > 4000, 'Typography polish should contain a meaningful global pass.');
assert(css.length < 30000, 'Typography polish should stay focused and below 30 KB.');
assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'Typography CSS braces are unbalanced.');
assert(css.includes('--tj-type-secondary:#c5d0e6'), 'Robust secondary text token is missing.');
assert(css.includes('.tj-search-placeholder'), 'Topbar search typography guard is missing.');
assert(css.includes('.tj-inspector-metric span'), 'Inspector typography guard is missing.');
assert(css.includes('.mw-summary-key'), 'Market widget typography guard is missing.');
assert(css.includes('#tjFxrDrawer .fxr-stat b'), 'FX Replay drawer typography guard is missing.');
assert(css.includes('font-weight:800!important'), 'Strong heading weight guard is missing.');
assert(css.includes('@media(prefers-contrast:more)'), 'High-contrast accessibility fallback is missing.');
assert(!css.includes('-webkit-font-smoothing:antialiased'), 'Do not force antialiased font smoothing; it can make Windows text look thinner.');

console.log('typography polish OK');
