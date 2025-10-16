/**
 * Widget renderer - main orchestrator
 *
 * Simplified to just:
 * 1. Parse JSON data
 * 2. Compute metadata
 * 3. Build widget component
 * 4. Mount to DOM
 */

import type { WidgetData } from './types';
import { computeWidgetMetadata } from './metadata';
import { buildWidgetContainer } from './components/WidgetContainer';

/**
 * Initialize a widget in the given container
 *
 * This is the main entry point called by index.ts
 */
export function initWidget(container: HTMLElement): void {
  try {
    // 1. Parse embedded JSON data
    const scriptTag = container.querySelector('script[data-role="tp-widget-data"]');
    if (!scriptTag || !scriptTag.textContent) {
      container.innerHTML = '<div class="tp-error">No widget data found</div>';
      return;
    }

    const data: WidgetData = JSON.parse(scriptTag.textContent);

    // 2. Validate data
    if (!data.ir || !data.ir.chunks) {
      container.innerHTML = '<div class="tp-error">No chunks found in widget data</div>';
      return;
    }

    // 3. Compute metadata (Phase 1 & 2)
    const metadata = computeWidgetMetadata(data);

    // 4. Build widget component (Phase 3)
    const widget = buildWidgetContainer(data, metadata);

    // 5. Mount to DOM
    const mountPoint = container.querySelector('.tp-widget-mount');
    if (mountPoint) {
      mountPoint.innerHTML = '';
      mountPoint.appendChild(widget.element);
    } else {
      container.innerHTML = '';
      container.appendChild(widget.element);
    }

    // 6. Store component reference for future access
    (container as HTMLElement & { _widgetComponent?: typeof widget })._widgetComponent = widget;
  } catch (error) {
    console.error('Widget initialization error:', error);
    container.innerHTML = `<div class="tp-error">Failed to initialize widget: ${
      error instanceof Error ? error.message : String(error)
    }</div>`;
  }
}
