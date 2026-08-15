'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'ui', 'stability-runtime.js'), 'utf8');

class FakeChart {
  static instances = new Map();

  constructor(target) {
    this.target = target;
    this.destroyed = false;
    FakeChart.instances.set(target, this);
  }

  destroy() {
    this.destroyed = true;
    FakeChart.instances.delete(this.target);
  }

  static getChart(target) {
    return FakeChart.instances.get(target);
  }
}

const document = {
  readyState: 'loading',
  addEventListener() {}
};
const window = { Chart: FakeChart };
const context = vm.createContext({
  window,
  document,
  console,
  Math,
  Proxy,
  Reflect,
  Object,
  requestAnimationFrame: fn => { if (typeof fn === 'function') fn(); return 1; },
  cancelAnimationFrame() {},
  setTimeout() {},
  getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  ResizeObserver: undefined,
  MutationObserver: class { observe() {} }
});

vm.runInContext(source, context, { filename: 'stability-runtime.js' });

assert.notEqual(window.Chart, FakeChart, 'Chart constructor should be wrapped by the reuse guard.');
const canvas = {};
const first = new window.Chart(canvas);
assert.equal(first.destroyed, false, 'First chart should remain alive initially.');
const second = new window.Chart(canvas);
assert.equal(first.destroyed, true, 'Existing chart must be destroyed before the canvas is reused.');
assert.equal(second.destroyed, false, 'Replacement chart should remain active.');
assert.equal(FakeChart.getChart(canvas), second, 'Replacement chart should own the canvas.');
assert.equal(window.__tjUiStability.chartReplacements, 1, 'Chart replacement should be recorded once.');

console.log('ui stability runtime OK');
