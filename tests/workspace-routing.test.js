'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname,'../src/renderer/ui/workspace-routing-fix.css'),'utf8');
const shell = fs.readFileSync(path.join(__dirname,'../src/renderer/ui/shell.js'),'utf8');
const overview = fs.readFileSync(path.join(__dirname,'../src/renderer/ui/overview-polish.css'),'utf8');

assert(overview.includes('#tjOverviewView{') && overview.includes('display:flex!important'), 'Expected legacy overview display rule not found; reassess this guard if the source rule changes.');
assert(css.includes('#tjOverviewView[hidden]'), 'Overview [hidden] visibility guard is missing.');
assert(css.includes('#tjDisciplineView[hidden]'), 'Discipline [hidden] visibility guard is missing.');
assert(css.includes('.tj-workspace[hidden]'), 'Generic hidden workspace guard is missing.');
assert(css.includes('display:none!important'), 'Hidden workspaces must beat display:* !important polish rules.');
assert(css.includes('data-workspace="overview"'), 'Overview dataset routing guard is missing.');
assert(css.includes(':not([data-workspace="overview"]) #tjOverviewView'), 'Inactive Overview must be hidden by workspace dataset.');
assert(shell.includes('document.body.dataset.workspace=id'), 'Shell must publish the active workspace on body.dataset.');
assert(shell.includes("function hideCustom(){['tjOverviewView','tjDisciplineView']"), 'Shell custom workspace hiding contract changed unexpectedly.');

let balance=0;
for(const ch of css){if(ch==='{')balance++;else if(ch==='}')balance--;assert(balance>=0,'Workspace routing CSS has a premature closing brace.');}
assert.equal(balance,0,'Workspace routing CSS braces are unbalanced.');

console.log('workspace routing guard OK');
