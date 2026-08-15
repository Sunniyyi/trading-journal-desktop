'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const css = fs.readFileSync(path.join(__dirname,'../src/renderer/ui/widget-polish.css'),'utf8');

assert(css.length > 8000, 'Widget polish should contain the dedicated News/Market/FXR presentation layer.');
assert(css.length < 40000, 'Widget polish should stay focused and must not become another CSS monolith.');
assert(css.includes('.nw-widget.show:not(.ui-minimized):not(.ui-maximized):has(#nwDetails:not(.show))'), 'News compact auto-fit guard is missing.');
assert(css.includes('.mw-widget.show:not(.ui-minimized):not(.ui-maximized):has(#mwDetails:not(.show))'), 'Market compact auto-fit guard is missing.');
assert(css.includes('height:auto!important'), 'Compact widgets must not preserve stale empty vertical space.');
assert(css.includes('resize:horizontal!important'), 'Compact widgets should resize horizontally without recreating empty vertical space.');
assert(css.includes('.ui-window-front'), 'Focused floating-window visual state is missing.');
assert(css.includes('#tjFxrDrawer .fxr-sync-grid'), 'FX Replay drawer-specific grid is missing.');
assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important'), 'FX Replay drawer should use a two-column narrow layout.');
assert(css.includes('#tjFxrDrawer .fxr-sync-title>div{display:none!important}'), 'Redundant FX Replay legacy title must be hidden inside the drawer.');
assert(css.includes(':has(#tjFxrDrawer:not([hidden]))'), 'Floating Market collision guard for the FX Replay drawer is missing.');
assert(css.includes('.mw-summary-line'), 'Market reading hierarchy refinements are missing.');
assert(css.includes('#nwCompactList'), 'News compact feed refinements are missing.');

let balance = 0;
for (const ch of css) {
  if (ch === '{') balance++;
  else if (ch === '}') balance--;
  assert(balance >= 0, 'Widget polish contains a premature closing brace.');
}
assert.equal(balance, 0, 'Widget polish CSS braces are unbalanced.');

console.log('widget polish OK');
