'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,'../src/renderer/ui/scan-premium-v220.css'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../src/renderer/ui/workspaces/scan.js'),'utf8');
const inspector=fs.readFileSync(path.join(__dirname,'../src/renderer/ui/inspector.js'),'utf8');
const count=(source,char)=>[...source].filter(c=>c===char).length;

assert.equal(count(css,'{'),count(css,'}'),'Scan TA 2.1.20 CSS braces must stay balanced.');
assert(css.includes('body[data-workspace="scan"] #viewScan.tj-scan-workspace.tj-scan-premium'),'Scan TA premium CSS must stay scoped to the Scan workspace.');
assert(!css.includes('#viewTrading'),'Scan TA premium CSS must not touch Journal.');
assert(!css.includes('#viewBacktest'),'Scan TA premium CSS must not touch Backtesting.');
assert(js.includes("weight:'45 %'")&&js.includes("weight:'35 %'")&&js.includes("weight:'20 %'"),'Scan TA UI must expose the engine timeframe weights.');
assert(js.includes('tj-scan-flow'),'Scan TA workflow rail is missing.');
assert(js.includes('tj-scan-guide-details'),'The capture guide must remain available as a collapsible secondary aid.');
assert(js.includes("result.after(details)"),'The capture guide must move after the primary analysis workflow.');
assert(js.includes('MutationObserver'),'Scan TA capture progress must react to the legacy engine state.');
assert(inspector.includes("active==='scan'"),'Inspector must expose a Scan TA snapshot.');
assert(inspector.includes('Scan en cours'),'Scan TA inspector snapshot label is missing.');
const resultRule=css.match(/#scanResult\s*\{([^}]*)\}/);
assert(resultRule&&!/display\s*:/.test(resultRule[1]),'Scan TA presentation must not override the V206 result visibility state.');
assert(css.includes('@container (max-width:1180px)'),'Scan TA must respond to its real workspace width, including Inspector.');

console.log('scan premium v2.1.20 OK');
