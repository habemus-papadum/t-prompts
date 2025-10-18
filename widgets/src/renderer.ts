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
import type { DiffData, StructuredPromptDiffData, RenderedPromptDiffData } from './diff-types';
import { computeWidgetMetadata } from './metadata';
import { buildWidgetContainer } from './components/WidgetContainer';
import { buildStructuredPromptDiffView } from './components/StructuredPromptDiffView';
import { buildRenderedPromptDiffView } from './components/RenderedPromptDiffView';

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

    const data: WidgetData | DiffData = JSON.parse(scriptTag.textContent);

    // 2. Detect widget type based on mount point or data
    const mountPoint = container.querySelector(
      '.tp-widget-mount, .tp-sp-diff-mount, .tp-rendered-diff-mount'
    );

    // Check if this is a diff widget
    if ('diff_type' in data) {
      // Diff widget path
      const diffData = data as DiffData;
      let component;

      if (diffData.diff_type === 'structured') {
        component = buildStructuredPromptDiffView(diffData as StructuredPromptDiffData);
      } else if (diffData.diff_type === 'rendered') {
        component = buildRenderedPromptDiffView(diffData as RenderedPromptDiffData);
      } else {
        // Exhaustiveness check - this should never happen
        const _exhaustiveCheck: never = diffData;
        container.innerHTML = `<div class="tp-error">Unknown diff type: ${(_exhaustiveCheck as { diff_type?: string }).diff_type}</div>`;
        return;
      }

      // Mount diff component
      if (mountPoint) {
        mountPoint.innerHTML = '';
        mountPoint.appendChild(component.element);
      } else {
        container.innerHTML = '';
        container.appendChild(component.element);
      }

      (container as HTMLElement & { _widgetComponent?: typeof component })._widgetComponent = component;
    } else {
      // Standard widget path
      const widgetData = data as WidgetData;

      // Validate data
      if (!widgetData.ir || !widgetData.ir.chunks) {
        container.innerHTML = '<div class="tp-error">No chunks found in widget data</div>';
        return;
      }

      // 3. Compute metadata (Phase 1 & 2)
      const metadata = computeWidgetMetadata(widgetData);

      // 4. Build widget component (Phase 3)
      const widget = buildWidgetContainer(widgetData, metadata);

      // 5. Mount to DOM
      if (mountPoint) {
        mountPoint.innerHTML = '';
        mountPoint.appendChild(widget.element);
      } else {
        container.innerHTML = '';
        container.appendChild(widget.element);
      }

      // 6. Store component reference for future access
      (container as HTMLElement & { _widgetComponent?: typeof widget })._widgetComponent = widget;
    }
  } catch (error) {
    console.error('Widget initialization error:', error);
    container.innerHTML = `<div class="tp-error">Failed to initialize widget: ${
      error instanceof Error ? error.message : String(error)
    }</div>`;
  }
}
