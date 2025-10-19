import type { ToolbarSection } from './Toolbar';
import type { DiffOverlayController } from '../controllers/DiffOverlayController';
import type { DiffContext } from '../types';

interface ToolbarSectionDiffOptions {
  controller: DiffOverlayController;
  diffContext: DiffContext;
  showBeforeToggle: boolean;
}

export function createDiffToolbarSection(options: ToolbarSectionDiffOptions): ToolbarSection {
  const { controller, diffContext, showBeforeToggle } = options;
  let container: HTMLElement | null = null;
  let diffButton: HTMLButtonElement | null = null;
  let beforeButton: HTMLButtonElement | null = null;
  let removeDiffListener: (() => void) | null = null;
  let removeBeforeListener: (() => void) | null = null;

  function renderDiffMetrics(): HTMLElement {
    const metricsContainer = document.createElement('div');
    metricsContainer.className = 'tp-diff-metrics';

    const structured = diffContext.structured.stats;
    const rendered = diffContext.rendered.stats;

    const structSummary = document.createElement('div');
    structSummary.className = 'tp-diff-metric tp-diff-metric--structured';
    structSummary.innerHTML = `
      <div class="tp-diff-metric-title">Structural</div>
      <div class="tp-diff-metric-value">+${structured.nodes_added} / -${structured.nodes_removed}</div>
    `;

    const renderedSummary = document.createElement('div');
    renderedSummary.className = 'tp-diff-metric tp-diff-metric--rendered';
    renderedSummary.innerHTML = `
      <div class="tp-diff-metric-title">Rendered</div>
      <div class="tp-diff-metric-value">+${rendered.insert} / -${rendered.delete}</div>
    `;

    metricsContainer.appendChild(structSummary);
    metricsContainer.appendChild(renderedSummary);
    return metricsContainer;
  }

  function createDiffToggleButton(initiallyEnabled: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tp-toolbar-diff-btn tp-view-toggle-btn';
    button.setAttribute('aria-pressed', initiallyEnabled ? 'true' : 'false');
    button.title = initiallyEnabled ? 'Hide diff overlay' : 'Show diff overlay';
    button.appendChild(createDiffIcon());
    if (initiallyEnabled) {
      button.classList.add('active');
    }
    return button;
  }

  function createBeforeToggleButton(initiallyVisible: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tp-toolbar-before-btn tp-view-toggle-btn';
    button.setAttribute('aria-pressed', initiallyVisible ? 'true' : 'false');
    button.title = initiallyVisible ? 'Hide before view' : 'Show before view';
    button.appendChild(createBeforeIcon());
    if (initiallyVisible) {
      button.classList.add('active');
    }
    return button;
  }

  function updateDiffButton(enabled: boolean): void {
    if (!diffButton) return;
    diffButton.classList.toggle('active', enabled);
    diffButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    diffButton.title = enabled ? 'Hide diff overlay' : 'Show diff overlay';
  }

  function updateBeforeButton(visible: boolean): void {
    if (!beforeButton) return;
    beforeButton.classList.toggle('active', visible);
    beforeButton.setAttribute('aria-pressed', visible ? 'true' : 'false');
    beforeButton.title = visible ? 'Hide before view' : 'Show before view';
  }

  return {
    mount(target: HTMLElement): void {
      container = document.createElement('div');
      container.className = 'tp-toolbar-diff-section';
      container.appendChild(renderDiffMetrics());

      diffButton = createDiffToggleButton(controller.isDiffEnabled());
      diffButton.addEventListener('click', () => {
        controller.setDiffEnabled(!controller.isDiffEnabled());
      });
      container.appendChild(diffButton);

      if (showBeforeToggle) {
        beforeButton = createBeforeToggleButton(controller.isBeforeVisible());
        beforeButton.addEventListener('click', () => {
          controller.setBeforeVisible(!controller.isBeforeVisible());
        });
        container.appendChild(beforeButton);
      }

      removeDiffListener = controller.onDiffEnabledChange((enabled) => updateDiffButton(enabled));
      removeBeforeListener = controller.onBeforeVisibleChange((visible) => updateBeforeButton(visible));

      target.appendChild(container);
    },
    destroy(): void {
      if (diffButton) {
        diffButton.replaceWith();
        diffButton = null;
      }
      if (beforeButton) {
        beforeButton.replaceWith();
        beforeButton = null;
      }
      removeDiffListener?.();
      removeBeforeListener?.();
      removeDiffListener = null;
      removeBeforeListener = null;
      container?.remove();
      container = null;
    },
  };
}

function createDiffIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'currentColor');
  svg.innerHTML =
    '<path d="M3 2h10v1H3V2zm7 3h3v1h-3v3H9V6H6V5h3V2h1v3zm-7 4h10v1H3V9zm0 3h10v1H3v-1z"/>' +
    '<path d="M11 10h2v1h-2v2h-1v-2H8v-1h2V8h1v2z" fill="none" stroke="currentColor" stroke-width="0.5"/>';
  return svg;
}

function createBeforeIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'currentColor');
  svg.innerHTML =
    '<path d="M4 1.5v13h8v-13H4zm7 12H5v-11h6v11z"/>' +
    '<path d="M7.5 8H10V7H7.5V5.5L5.5 7.5 7.5 9.5V8z" fill="currentColor"/>';
  return svg;
}
