/**
 * Widget Container Component
 *
 * Top-level container that orchestrates multiple views and toolbars.
 * Currently contains just CodeView, but designed to support:
 * - Toolbar for view switching and controls
 * - Multiple visualization views (tree, table, etc.)
 */

import type { Component } from './base';
import type { WidgetData, WidgetMetadata } from '../types';
import { buildCodeView } from './CodeView';

/**
 * Widget container component interface
 */
export interface WidgetContainer extends Component {
  // Container-specific
  views: Component[]; // Child components
  toolbar?: HTMLElement; // Future: toolbar

  // Operations
  addView(view: Component): void;
  removeView(view: Component): void;
}

/**
 * Build a WidgetContainer component from widget data and metadata
 */
export function buildWidgetContainer(data: WidgetData, metadata: WidgetMetadata): WidgetContainer {
  // 1. Create root element
  const element = document.createElement('div');
  element.className = 'tp-widget-output';

  // 2. Build code view
  const codeView = buildCodeView(data, metadata);

  // 3. Assemble
  // Future: Add toolbar here
  // const toolbar = createToolbar();
  // element.appendChild(toolbar);

  element.appendChild(codeView.element);

  // 4. Track views
  const views: Component[] = [codeView];

  // 5. Return component
  return {
    element,
    views,
    toolbar: undefined, // Future

    hide(ids: string[]): void {
      // Delegate to all views
      views.forEach((view) => view.hide(ids));
    },

    show(ids: string[]): void {
      // Delegate to all views
      views.forEach((view) => view.show(ids));
    },

    destroy(): void {
      // Cleanup all views
      views.forEach((view) => view.destroy());
      element.remove();
    },

    addView(view: Component): void {
      views.push(view);
      element.appendChild(view.element);
    },

    removeView(view: Component): void {
      const index = views.indexOf(view);
      if (index !== -1) {
        views.splice(index, 1);
        view.element.remove();
      }
    },
  };
}
