'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const file = path.join(__dirname, '../src/renderer/ui/journal-polish.css');
const css = fs.readFileSync(file, 'utf8');

assert(css.includes('body[data-workspace="journal"]'), 'Journal polish must be scoped to the active journal workspace.');
assert(css.includes('#journalCalGrid .cal-cell'), 'Journal calendar cells must have a dedicated readable layout.');
assert(css.includes('--cal-row:108px'), 'Comfort calendar row height guard is missing.');
assert(css.includes('body.tj-inspector-open[data-workspace="journal"]'), 'Journal must adapt when the inspector is open.');
assert(css.includes('#tableSection>.tablecard thead'), 'Journal table header must remain readable while scrolling.');
assert(!css.includes('#tjOverviewView'), 'Journal polish must not affect Overview.');
assert(!css.includes('#viewBacktest'), 'Journal polish must not affect Backtesting.');

const opens = (css.match(/{/g) || []).length;
const closes = (css.match(/}/g) || []).length;
assert.equal(opens, closes, 'Journal polish CSS braces are unbalanced.');
assert(Buffer.byteLength(css, 'utf8') < 36000, 'Journal polish should remain a focused page layer, not a new monolith.');

console.log('journal polish OK');
