(() => {
  'use strict';

  const perf = window.__tjUiStability = window.__tjUiStability || {
    version: 1,
    chartReplacements: 0,
    backupOffset: 0,
    toolsAnchored: false
  };

  function installChartReuseGuard() {
    const NativeChart = window.Chart;
    if (typeof NativeChart !== 'function' || NativeChart.__tjReuseGuard) return;

    const releaseCanvas = target => {
      try {
        const existing = NativeChart.getChart?.(target);
        if (!existing) return;
        existing.destroy();
        perf.chartReplacements++;
      } catch (error) {
        console.warn('[Desktop UI] Chart cleanup failed:', error);
      }
    };

    const GuardedChart = new Proxy(NativeChart, {
      construct(target, args, newTarget) {
        releaseCanvas(args[0]);
        return Reflect.construct(target, args, newTarget === GuardedChart ? target : newTarget);
      },
      apply(target, thisArg, args) {
        releaseCanvas(args[0]);
        return Reflect.apply(target, thisArg, args);
      }
    });

    Object.defineProperty(GuardedChart, '__tjReuseGuard', { value: true });
    Object.defineProperty(GuardedChart, '__tjNativeChart', { value: NativeChart });
    window.Chart = GuardedChart;
  }

  function isVisible(element) {
    if (!element || !element.isConnected || element.hidden) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return element.getClientRects().length > 0;
  }

  function installBackupSpacing() {
    const warning = document.getElementById('autoBackupWarning');
    if (!warning) return false;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const offset = isVisible(warning) ? Math.ceil(warning.getBoundingClientRect().height) + 4 : 0;
        perf.backupOffset = offset;
        document.documentElement.style.setProperty('--tj-backup-offset', `${offset}px`);
      });
    };

    new MutationObserver(update).observe(warning, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: ['class', 'style', 'hidden']
    });
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(warning);
    window.addEventListener('resize', update, { passive: true });
    update();
    return true;
  }

  function installToolsAnchoring() {
    const button = document.getElementById('tjToolsButton');
    const menu = document.getElementById('tjToolsMenu');
    if (!button || !menu) return false;

    let wasOpenOnPointerDown = false;
    const position = () => {
      if (menu.hidden) return;
      const rect = button.getBoundingClientRect();
      const menuWidth = menu.offsetWidth || 210;
      const menuHeight = menu.offsetHeight || 220;
      const margin = 12;
      const left = Math.max(margin, Math.min(rect.right - menuWidth, innerWidth - menuWidth - margin));
      const preferredTop = rect.bottom + 8;
      const top = Math.max(margin, Math.min(preferredTop, innerHeight - menuHeight - margin));
      menu.style.left = `${Math.round(left)}px`;
      menu.style.right = 'auto';
      menu.style.top = `${Math.round(top)}px`;
      perf.toolsAnchored = true;
    };

    button.addEventListener('pointerdown', () => {
      wasOpenOnPointerDown = !menu.hidden;
    }, true);
    button.addEventListener('click', () => {
      if (wasOpenOnPointerDown) {
        setTimeout(() => { menu.hidden = true; }, 0);
        return;
      }
      requestAnimationFrame(position);
    }, true);
    window.addEventListener('resize', () => requestAnimationFrame(position), { passive: true });
    window.addEventListener('scroll', () => requestAnimationFrame(position), true);
    return true;
  }

  function installCommandPaletteStability() {
    const backdrop = document.querySelector('.tj-command-backdrop');
    const input = document.querySelector('.tj-command-input');
    if (!backdrop || !input) return false;

    const revealSelection = () => requestAnimationFrame(() => {
      backdrop.querySelector('.tj-command-item.is-selected')?.scrollIntoView({ block: 'nearest' });
    });

    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') revealSelection();
    });

    new MutationObserver(() => {
      if (backdrop.hidden) return;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      revealSelection();
    }).observe(backdrop, { attributes: true, attributeFilter: ['hidden'] });
    return true;
  }

  function installDomStability() {
    let attempts = 0;
    const attach = () => {
      attempts++;
      const backup = installBackupSpacing();
      const tools = installToolsAnchoring();
      const palette = installCommandPaletteStability();
      if (backup && tools && palette) return;
      if (attempts < 20) setTimeout(attach, 100);
    };
    attach();
  }

  installChartReuseGuard();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installDomStability, { once: true });
  else installDomStability();
})();
