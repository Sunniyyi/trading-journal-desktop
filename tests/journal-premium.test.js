'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'src', 'renderer', 'ui', 'journal-premium.css');
const css = fs.readFileSync(file, 'utf8');

assert(css.includes('container-name:tj-journal'), 'Journal premium must use a container tied to the actual Journal width.');
assert(css.includes('@container tj-journal'), 'Journal premium responsive container rules are missing.');
assert(css.includes('.cal-cell:nth-child(7n+6)'), 'Weekend de-emphasis rule is missing.');
assert(css.includes(':has(.cal-pnl:not(:empty))'), 'Traded-day visual emphasis rule is missing.');
assert(css.includes('@media(prefers-reduced-motion:reduce)'), 'Reduced-motion fallback is missing.');
assert(css.includes('body[data-workspace="journal"]'), 'Journal premium rules must be scoped to the Journal workspace.');
assert(!css.includes('body[data-workspace="overview"]'), 'Journal premium must not target Overview.');
assert(!css.includes('body[data-workspace="backtesting"]'), 'Journal premium must not target Backtesting.');

let depth = 0;
for (const ch of css) {
  if (ch === '{') depth += 1;
  if (ch === '}') depth -= 1;
  assert(depth >= 0, 'Journal premium CSS contains an unexpected closing brace.');
}
assert.equal(depth, 0, 'Journal premium CSS braces are unbalanced.');

console.log('journal premium CSS OK');
