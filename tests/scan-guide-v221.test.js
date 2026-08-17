'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,'../src/renderer/ui/scan-guide-hotfix-v221.css'),'utf8');
const count=(source,char)=>[...source].filter(c=>c===char).length;

assert.equal(count(css,'{'),count(css,'}'),'Scan guide 2.1.21 CSS braces must stay balanced.');
assert(css.includes('.tj-scan-guide-details:not([open]) > .scan-capture-guide'),'Closed guide must explicitly hide tutorial content.');
assert(css.includes('.tj-scan-guide-details[open] > .scan-capture-guide'),'Open guide must explicitly reveal tutorial content.');
assert(/\[open\][^{]*> \.scan-capture-guide\s*\{[^}]*display\s*:\s*block!important/s.test(css),'Open guide must force display:block.');
assert(/\.tj-scan-guide-details\s*\{[^}]*width\s*:\s*100%!important/s.test(css),'Guide container must use the full Scan workspace width.');
assert(!css.includes('#viewTrading'),'Scan guide hotfix must not touch Journal.');
assert(!css.includes('#viewBacktest'),'Scan guide hotfix must not touch Backtesting.');

console.log('scan guide v2.1.21 OK');
