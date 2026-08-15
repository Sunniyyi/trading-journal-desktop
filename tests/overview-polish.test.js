'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

const file=path.join(__dirname,'..','src','renderer','ui','overview-polish.css');
assert(fs.existsSync(file),'overview-polish.css must exist');
const css=fs.readFileSync(file,'utf8');
assert(css.length>7000,'Overview polish layer is unexpectedly small');
assert(css.length<30000,'Overview polish layer is too large; split it before it becomes another monolith');

const opens=(css.match(/\{/g)||[]).length;
const closes=(css.match(/\}/g)||[]).length;
assert.equal(opens,closes,'Overview polish CSS braces are unbalanced');

for(const marker of [
  '--tj-inspector-open-width:400px',
  'grid-template-areas:',
  '"activity summary"',
  'grid-template-columns:repeat(2,minmax(0,1fr))!important',
  '#tjOverviewView .tj-overview-actions-panel',
  'body.tj-desktop-v2 .tj-inspector-scroll',
  'body.tj-desktop-v2 .tj-inspector-metrics',
  'body.tj-inspector-open #tjOverviewView .tj-overview-main',
  '@media(max-width:1280px)'
]) assert(css.includes(marker),`Missing overview polish guard: ${marker}`);

assert(!css.includes('display:none!important}#tjOverviewView'),'Overview layer must not hide the homepage');
console.log('overview polish OK');
